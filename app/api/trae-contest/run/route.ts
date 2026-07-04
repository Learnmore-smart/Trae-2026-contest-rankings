import { NextResponse } from "next/server";
import { writeBoardSnapshot } from "@/lib/trae/api";
import { judgeChangedTraeTopics } from "@/lib/trae/judge";
import { DEFAULT_JUDGE_BATCH_MAX, DEFAULT_JUDGE_CONCURRENCY } from "@/lib/trae/judge-policy";
import { runTraeMatching } from "@/lib/trae/matcher";
import { scrapeAllTraeSources } from "@/lib/trae/scraper";

export const runtime = "nodejs";

// One public "update now" button drives the whole pipeline (scrape -> match -> judge).
// The same pipeline also runs automatically on the Vercel cron schedule; this endpoint
// is only a manual trigger, so it is intentionally token-free but guarded by a single
// in-flight lock plus a short cooldown to avoid hammering the public forum.

export type RunPhase = "idle" | "scrape" | "match" | "judge" | "done" | "error";

export interface PipelineStatus {
  running: boolean;
  phase: RunPhase;
  startedAt: string | null;
  finishedAt: string | null;
  message: string;
  error: string | null;
}

const COOLDOWN_MS = 30_000;

interface PipelineState {
  status: PipelineStatus;
}

type JudgeBatchResult = Awaited<ReturnType<typeof judgeChangedTraeTopics>>;

// Persist across Next.js dev hot-reloads / route module re-evaluation.
const globalState = globalThis as typeof globalThis & { __traePipeline?: PipelineState };

function getState(): PipelineState {
  if (!globalState.__traePipeline) {
    globalState.__traePipeline = {
      status: {
        running: false,
        phase: "idle",
        startedAt: null,
        finishedAt: null,
        message: "等待运行。",
        error: null
      }
    };
  }
  return globalState.__traePipeline;
}

function judgeChangedBatch(): Promise<JudgeBatchResult> {
  return judgeChangedTraeTopics({
    mode: "changed",
    max: DEFAULT_JUDGE_BATCH_MAX,
    concurrency: DEFAULT_JUDGE_CONCURRENCY
  });
}

function mergeJudgeResults(results: JudgeBatchResult[]): Pick<JudgeBatchResult, "evaluatedCount" | "failedCount"> {
  return results.reduce(
    (summary, result) => ({
      evaluatedCount: summary.evaluatedCount + result.evaluatedCount,
      failedCount: summary.failedCount + result.failedCount
    }),
    { evaluatedCount: 0, failedCount: 0 }
  );
}

async function runPipeline(state: PipelineState): Promise<void> {
  const set = (patch: Partial<PipelineStatus>) => {
    state.status = { ...state.status, ...patch };
  };

  try {
    set({ phase: "judge", message: "正在评分现有未评分作品，同时抓取公开帖子…" });
    const immediateJudge = judgeChangedBatch();
    const scrapeAndMatch = (async () => {
      set({ phase: "scrape", message: "正在抓取报名与初赛专区，同时评分未评分作品…" });
      await scrapeAllTraeSources();

      set({ phase: "match", message: "正在匹配报名方向…" });
      await runTraeMatching();
    })();

    const [, immediateJudgeResult] = await Promise.all([scrapeAndMatch, immediateJudge]);

    set({ phase: "judge", message: "正在评分新匹配的未评分作品…" });
    const postMatchJudgeResult = await judgeChangedBatch();
    const judgeResult = mergeJudgeResults([immediateJudgeResult, postMatchJudgeResult]);

    // Refresh the board snapshot so the next public load reads 1 doc instead of re-scanning
    // 5 collections. Best-effort: a failure here doesn't undo the pipeline's work.
    try {
      await writeBoardSnapshot();
    } catch (error) {
      console.error("[trae] writeBoardSnapshot failed:", error);
    }

    set({
      running: false,
      phase: "done",
      finishedAt: new Date().toISOString(),
      message: `本轮抓取、匹配、评分已完成；评分 ${judgeResult.evaluatedCount} 个，失败 ${judgeResult.failedCount} 个。`,
      error: null
    });
  } catch (error) {
    set({
      running: false,
      phase: "error",
      finishedAt: new Date().toISOString(),
      message: "运行中断，请稍后重试。",
      error: error instanceof Error ? error.message : "Pipeline failed."
    });
  }
}

export function GET(): NextResponse {
  return NextResponse.json(getState().status);
}

export function POST(): NextResponse {
  const state = getState();
  const { status } = state;

  if (status.running) {
    return NextResponse.json(status);
  }

  if (status.finishedAt) {
    const sinceFinish = Date.now() - Date.parse(status.finishedAt);
    if (Number.isFinite(sinceFinish) && sinceFinish < COOLDOWN_MS) {
      return NextResponse.json({
        ...status,
        message: "刚刚已更新过，请稍后再试。"
      });
    }
  }

  state.status = {
    running: true,
    phase: "judge",
    startedAt: new Date().toISOString(),
    finishedAt: null,
    message: "评分与抓取已启动…",
    error: null
  };

  // Fire-and-forget: the response returns immediately and the client polls GET for progress.
  void runPipeline(state);

  return NextResponse.json(state.status);
}
