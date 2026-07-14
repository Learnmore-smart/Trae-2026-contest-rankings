import { NextResponse } from "next/server";
import { writeBoardSnapshot } from "@/lib/trae/api";
import { rejudgeTopicById } from "@/lib/trae/judge";
import { normalizeTopicRouteId } from "@/lib/trae/topic-route-id";

export const runtime = "nodejs";
// Single-topic rejudge runs vision + multi-evaluator consensus (often 60–400s).
// Must stay request-bound on Cloud Run — fire-and-forget dies when CPU is throttled
// after the response (see 2026-07-10 bug fix). Align with cron/run long timeout.
export const maxDuration = 900;

// Public, token-free "re-score this work" button lives on the detail page, so anyone
// viewing a project can trigger it. Each re-judge fans out into a multi-evaluator LLM
// consensus (several calls against the zero-budget providers) plus DB writes, so it is
// guarded three ways: a per-topic in-flight lock (no double submit), a per-topic cooldown
// (no spamming the same work), and a global concurrency cap (no stampede across works).
//
// POST awaits the full rejudge so Cloud Run keeps CPU allocated for the whole job.
// The client shows "评分已经开始" immediately, then waits on this request and refreshes
// the detail payload when it completes.
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

  let finishError: string | null = "aborted";
  try {
    // Await the full pipeline so Cloud Run keeps CPU for vision + multi-evaluator consensus.
    // Do not void/fire-and-forget — that is the failure mode that made 重新评分 a no-op.
    const result = await rejudgeTopicById(id);

    if (result.status === "not_found") {
      finishError = "not_found";
      return NextResponse.json({ error: "作品不存在或不是初赛作品。", code: "not_found" }, { status: 404 });
    }

    if (result.status === "empty") {
      finishError = "empty";
      return NextResponse.json(
        { error: "该作品内容为空或已删除，无法评分。", code: "empty" },
        { status: 422 }
      );
    }

    // Refresh the board snapshot so the leaderboard reflects the new score. Best-effort:
    // the detail page already reads fresh from the DB, so a snapshot failure is non-fatal.
    await writeBoardSnapshot().catch((error) => console.error("[trae] writeBoardSnapshot failed:", error));

    finishError = null;
    return NextResponse.json({
      ok: true,
      done: true,
      evaluation: {
        totalScore: result.evaluation.totalScore,
        confidenceScore: result.evaluation.confidenceScore,
        createdAt: result.evaluation.createdAt
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Pipeline failed.";
    finishError = message;
    return NextResponse.json({ error: "重新评分失败，请稍后再试。", code: "error", detail: message }, { status: 500 });
  } finally {
    markFinished(state, id, finishError);
  }
}
