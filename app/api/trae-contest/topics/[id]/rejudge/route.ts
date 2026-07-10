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
const REJUDGE_COOLDOWN_MS = 60_000;
const MAX_CONCURRENT_REJUDGE = 2;
const LAST_FINISHED_MAX_ENTRIES = 500;

interface RejudgeState {
  inFlight: Set<string>;
  lastFinishedAt: Map<string, number>;
  lastError: Map<string, string | null>;
}

const globalState = globalThis as typeof globalThis & { __traeRejudge?: RejudgeState };

function getState(): RejudgeState {
  if (!globalState.__traeRejudge) {
    globalState.__traeRejudge = {
      inFlight: new Set<string>(),
      lastFinishedAt: new Map<string, number>(),
      lastError: new Map<string, string | null>()
    };
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

function markFinished(state: RejudgeState, id: string, error: string | null): void {
  const finishedAt = Date.now();
  pruneLastFinished(state, finishedAt);
  state.lastFinishedAt.set(id, finishedAt);
  state.lastError.set(id, error);
  state.inFlight.delete(id);
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id: rawId } = await context.params;
  const id = normalizeTopicRouteId(decodeURIComponent(rawId));
  const state = getState();
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
    return NextResponse.json({ error: "评分服务繁忙，请稍后再试。", code: "busy" }, { status: 429 });
  }

  state.inFlight.add(id);
  state.lastError.delete(id);

  try {
    // Await the full pipeline so Cloud Run keeps CPU for vision + multi-evaluator consensus.
    // Do not void/fire-and-forget — that is the failure mode that made 重新评分 a no-op.
    const result = await rejudgeTopicById(id);

    if (result.status === "not_found") {
      markFinished(state, id, "not_found");
      return NextResponse.json({ error: "作品不存在或不是初赛作品。", code: "not_found" }, { status: 404 });
    }

    if (result.status === "empty") {
      markFinished(state, id, "empty");
      return NextResponse.json(
        { error: "该作品内容为空或已删除，无法评分。", code: "empty" },
        { status: 422 }
      );
    }

    // Refresh the board snapshot so the leaderboard reflects the new score. Best-effort:
    // the detail page already reads fresh from the DB, so a snapshot failure is non-fatal.
    await writeBoardSnapshot().catch((error) => console.error("[trae] writeBoardSnapshot failed:", error));

    markFinished(state, id, null);
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
    markFinished(state, id, message);
    return NextResponse.json({ error: "重新评分失败，请稍后再试。", code: "error", detail: message }, { status: 500 });
  }
}
