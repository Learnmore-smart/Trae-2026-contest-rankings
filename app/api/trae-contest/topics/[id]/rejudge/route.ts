import { after, NextResponse } from "next/server";
import { writeBoardSnapshot } from "@/lib/trae/api";
import { rejudgeTopicById } from "@/lib/trae/judge";
import { normalizeTopicRouteId } from "@/lib/trae/topic-route-id";

export const runtime = "nodejs";
// Single-topic rejudge runs vision + multi-evaluator consensus (often 60–400s).
// Next.js `after` keeps the work on the route lifecycle without holding the browser POST
// open for the entire run. Align its budget with cron/run's long timeout.
export const maxDuration = 900;

// Public, token-free "re-score this work" button lives on the detail page, so anyone
// viewing a project can trigger it. Each re-judge fans out into a multi-evaluator LLM
// consensus (several calls against the zero-budget providers) plus DB writes, so it is
// guarded three ways: a per-topic in-flight lock (no double submit), a per-topic cooldown
// (no spamming the same work), and a global concurrency cap (no stampede across works).
//
// POST schedules the full rejudge with Next.js `after`, acknowledges immediately, and the
// client polls until the detail payload contains a newer evaluation.
//
// inFlight is process-local. Killed/timeout requests can leave slots occupied forever unless
// we reclaim by startedAt age (see 2026-07-13 busy fix).
const REJUDGE_COOLDOWN_MS = 60_000;
const MAX_CONCURRENT_REJUDGE = 4;
/** Reclaim abandoned locks slightly under maxDuration so stuck slots do not block the site. */
const STALE_IN_FLIGHT_MS = 14 * 60 * 1000;
const LAST_FINISHED_MAX_ENTRIES = 500;

interface RejudgeState {
  /** topicId → startedAt ms */
  inFlight: Map<string, number>;
  lastFinishedAt: Map<string, number>;
  lastError: Map<string, string | null>;
}

const globalState = globalThis as typeof globalThis & { __traeRejudge?: RejudgeState };

function getState(): RejudgeState {
  if (!globalState.__traeRejudge) {
    globalState.__traeRejudge = {
      inFlight: new Map<string, number>(),
      lastFinishedAt: new Map<string, number>(),
      lastError: new Map<string, string | null>()
    };
  } else if (globalState.__traeRejudge.inFlight instanceof Set) {
    // Hot-reload / older shape: Set has no startedAt → treat as stale and clear.
    globalState.__traeRejudge.inFlight = new Map<string, number>();
  }
  return globalState.__traeRejudge;
}

/** Drop cooldown entries that have already expired so the map can't grow without bound. */
function pruneLastFinished(state: RejudgeState, now: number): void {
  if (state.lastFinishedAt.size < LAST_FINISHED_MAX_ENTRIES) return;
  for (const [key, finishedAt] of state.lastFinishedAt) {
    if (now - finishedAt >= REJUDGE_COOLDOWN_MS) state.lastFinishedAt.delete(key);
  }
}

/** Free slots left behind when a request was killed without running markFinished. */
function reclaimStaleInFlight(state: RejudgeState, now: number): void {
  for (const [id, startedAt] of state.inFlight) {
    if (now - startedAt >= STALE_IN_FLIGHT_MS) {
      state.inFlight.delete(id);
      if (!state.lastError.has(id)) state.lastError.set(id, "stale_timeout");
    }
  }
}

function markFinished(state: RejudgeState, id: string, error: string | null): void {
  const finishedAt = Date.now();
  pruneLastFinished(state, finishedAt);
  state.lastFinishedAt.set(id, finishedAt);
  state.lastError.set(id, error);
  state.inFlight.delete(id);
}

function oldestInFlightAgeMs(state: RejudgeState, now: number): number {
  let oldest = now;
  for (const startedAt of state.inFlight.values()) {
    if (startedAt < oldest) oldest = startedAt;
  }
  return Math.max(0, now - oldest);
}

async function runRejudgeAfterResponse(state: RejudgeState, id: string): Promise<void> {
  let finishError: string | null = "aborted";
  try {
    const result = await rejudgeTopicById(id);

    if (result.status === "not_found" || result.status === "empty") {
      finishError = result.status;
      return;
    }

    // Best-effort: topic detail reads the fresh evaluation directly even if the snapshot fails.
    await writeBoardSnapshot().catch((error) => console.error("[trae] writeBoardSnapshot failed:", error));
    finishError = null;
  } catch (error) {
    finishError = error instanceof Error ? error.message : "Pipeline failed.";
    console.error("[trae] rejudge failed:", error);
  } finally {
    markFinished(state, id, finishError);
  }
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id: rawId } = await context.params;
  const id = normalizeTopicRouteId(decodeURIComponent(rawId));
  const state = getState();
  reclaimStaleInFlight(state, Date.now());
  return NextResponse.json({
    running: state.inFlight.has(id),
    error: state.lastError.get(id) ?? null
  });
}

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id: rawId } = await context.params;
  const id = normalizeTopicRouteId(decodeURIComponent(rawId));
  const state = getState();
  const now = Date.now();
  reclaimStaleInFlight(state, now);

  if (state.inFlight.has(id)) {
    return NextResponse.json({ error: "该作品正在重新评分，请稍候。", code: "in_flight" }, { status: 409 });
  }

  const lastFinishedAt = state.lastFinishedAt.get(id);
  if (typeof lastFinishedAt === "number" && now - lastFinishedAt < REJUDGE_COOLDOWN_MS) {
    return NextResponse.json(
      { error: "刚刚已重新评分，请稍后再试。", code: "cooldown", retryAfterMs: REJUDGE_COOLDOWN_MS - (now - lastFinishedAt) },
      { status: 429 }
    );
  }

  if (state.inFlight.size >= MAX_CONCURRENT_REJUDGE) {
    const age = oldestInFlightAgeMs(state, now);
    const retryAfterMs = Math.min(
      STALE_IN_FLIGHT_MS,
      Math.max(10_000, STALE_IN_FLIGHT_MS - age)
    );
    return NextResponse.json(
      { error: "评分服务繁忙，请稍后再试。", code: "busy", retryAfterMs },
      { status: 429 }
    );
  }

  state.inFlight.set(id, now);
  state.lastError.delete(id);

  // A full re-score can take several minutes. Schedule it on the route lifecycle and let
  // the existing client polling confirm that a newer evaluation has been persisted.
  after(async () => {
    await runRejudgeAfterResponse(state, id);
  });

  return NextResponse.json({ ok: true, started: true });
}
