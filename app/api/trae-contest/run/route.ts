import { NextResponse } from "next/server";
import { writeBoardSnapshot } from "@/lib/trae/api";
import { judgeChangedTraeTopics } from "@/lib/trae/judge";
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

async function runPipeline(state: PipelineState): Promise<void> {
  const set = (patch: Partial<PipelineStatus>) => {
    state.status = { ...state.status, ...patch };
  };

  try {
    set({ phase: "scrape", message: "正在抓取报名与初赛专区…" });
    await scrapeAllTraeSources();

    set({ phase: "match", message: "正在匹配报名方向…" });
    await runTraeMatching();

    set({ phase: "judge", message: "正在调用免费 AI 模型评分…" });
    const judgeResult = await judgeChangedTraeTopics({ mode: "unjudged" });

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
    phase: "scrape",
    startedAt: new Date().toISOString(),
    finishedAt: null,
    message: "流水线已启动…",
    error: null
  };

  // Fire-and-forget: the response returns immediately and the client polls GET for progress.
  void runPipeline(state);

  return NextResponse.json(state.status);
}
