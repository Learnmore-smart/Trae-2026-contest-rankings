import { NextResponse } from "next/server";
import { getTopicDetail, writeBoardSnapshot } from "@/lib/trae/api";
import { rejudgeTopicById } from "@/lib/trae/judge";
import { normalizeTopicRouteId } from "@/lib/trae/topic-route-id";

export const runtime = "nodejs";
export const maxDuration = 60;

// Public, token-free "re-score this work" button lives on the detail page, so anyone
// viewing a project can trigger it. Each re-judge fans out into a multi-evaluator LLM
// consensus (several calls against the zero-budget providers) plus DB writes, so it is
// guarded three ways: a per-topic in-flight lock (no double submit), a per-topic cooldown
// (no spamming the same work), and a global concurrency cap (no stampede across works).
const REJUDGE_COOLDOWN_MS = 60_000;
const MAX_CONCURRENT_REJUDGE = 2;
const LAST_FINISHED_MAX_ENTRIES = 500;

interface RejudgeState {
  inFlight: Set<string>;
  lastFinishedAt: Map<string, number>;
}

const globalState = globalThis as typeof globalThis & { __traeRejudge?: RejudgeState };

function getState(): RejudgeState {
  if (!globalState.__traeRejudge) {
    globalState.__traeRejudge = { inFlight: new Set<string>(), lastFinishedAt: new Map<string, number>() };
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
  try {
    const result = await rejudgeTopicById(id);
    if (result.status === "not_found") {
      return NextResponse.json({ error: "作品不存在或不是初赛作品。", code: "not_found" }, { status: 404 });
    }
    if (result.status === "empty") {
      return NextResponse.json({ error: "该作品内容为空或已删除，无法评分。", code: "empty" }, { status: 422 });
    }

    // Refresh the board snapshot so the leaderboard reflects the new score. Best-effort:
    // the detail page already reads fresh from the DB, so a snapshot failure is non-fatal.
    await writeBoardSnapshot().catch((error) => console.error("[trae] writeBoardSnapshot failed:", error));

    const item = await getTopicDetail(id);
    return NextResponse.json({ ok: true, item });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "重新评分失败，请稍后再试。", code: "error" },
      { status: 500 }
    );
  } finally {
    // Start the cooldown on both success and failure so a failing provider can't be hammered.
    const finishedAt = Date.now();
    pruneLastFinished(state, finishedAt);
    state.lastFinishedAt.set(id, finishedAt);
    state.inFlight.delete(id);
  }
}
