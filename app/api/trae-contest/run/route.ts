import { after, NextResponse } from "next/server";
import { listRuns } from "@/lib/trae/api";
import { runFullPipeline } from "@/lib/trae/pipeline";
import { isFreshRunningRun, reclaimStaleRunningRuns, STALE_RUNNING_RUN_MS } from "@/lib/trae/runs";
import type { TraeRun } from "@/lib/trae/types";

export const runtime = "nodejs";
// Allow the POST to stay alive under Cloud Run's long timeout if the client keeps waiting.
export const maxDuration = 900;

// One public "update now" button drives the whole pipeline (scrape -> match -> judge).
// POST schedules runFullPipeline() with Next.js `after` and returns immediately; the client
// polls GET for cross-instance status derived from the persistent runs table.
//
// Previous design self-invoked the cron run-all endpoint via loopback HTTP to keep CPU
// allocated, but Next.js 15 route handlers don't pass nextConfig to NextURL, making
// basePath reconstruction unreliable on loopback — every self-invoke 404'd, fell back
// in-process, and the POST blocked for the full 900s. `after` provides the intended
// request-lifecycle hook without another HTTP hop or a multi-minute browser request.

export type RunPhase = "idle" | "scrape" | "match" | "judge" | "done" | "error";

export interface PipelineStatus {
  running: boolean;
  phase: RunPhase;
  startedAt: string | null;
  finishedAt: string | null;
  message: string;
  error: string | null;
}

// Keep reporting "done" to pollers after finish so the client that started the run gets
// its completion signal even when the memory that produced the run lives on another instance.
const DONE_RUN_WINDOW_MS = 2 * 60 * 1000;
// In-memory "running" older than this is stale (background pipeline died without a
// finally); fall through to DB status and let POST start a fresh run.
const STALE_MEMORY_RUNNING_MS = 20 * 60 * 1000;
// Polling clients hit GET every 2s; cache the runs read briefly so status polls cost
// at most ~1 Data Connect query per interval regardless of how many tabs are open.
const RUNS_CACHE_TTL_MS = 2_500;
// Status storage is advisory for the button. A slow Data Connect read must not hold the
// public GET/POST open until the browser or proxy gives up.
const RUNS_READ_TIMEOUT_MS = 5_000;

interface PipelineState {
  status: PipelineStatus;
  runsCache?: { at: number; runs: TraeRun[] };
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

function isStaleRunningStatus(status: PipelineStatus): boolean {
  if (!status.running) return false;
  const startedAt = status.startedAt ? Date.parse(status.startedAt) : Number.NaN;
  return !Number.isFinite(startedAt) || Date.now() - startedAt > STALE_MEMORY_RUNNING_MS;
}

function invalidateRunsCache(state: PipelineState): void {
  state.runsCache = undefined;
}

async function readRecentRuns(state: PipelineState, limit = 20): Promise<TraeRun[]> {
  const now = Date.now();
  if (state.runsCache && now - state.runsCache.at < RUNS_CACHE_TTL_MS) return state.runsCache.runs;
  const runs = await listRuns(limit);
  state.runsCache = { at: now, runs };
  return runs;
}

async function readRecentRunsBestEffort(state: PipelineState, limit = 20): Promise<TraeRun[]> {
  const fallback = state.runsCache?.runs ?? [];
  let timer: ReturnType<typeof setTimeout> | undefined;
  const read = readRecentRuns(state, limit).catch((error) => {
    console.error("[trae] listRuns failed:", error);
    return fallback;
  });
  const timeout = new Promise<TraeRun[]>((resolve) => {
    timer = setTimeout(() => {
      console.error(`[trae] listRuns exceeded ${RUNS_READ_TIMEOUT_MS}ms; using cached/in-memory status`);
      resolve(fallback);
    }, RUNS_READ_TIMEOUT_MS);
  });

  try {
    return await Promise.race([read, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function reclaimStaleRunsBestEffort(state: PipelineState, runs: TraeRun[]): Promise<number> {
  try {
    const reclaimed = await reclaimStaleRunningRuns(runs);
    if (reclaimed > 0) invalidateRunsCache(state);
    return reclaimed;
  } catch (error) {
    console.error("[trae] reclaimStaleRunningRuns failed:", error);
    return 0;
  }
}

const RUN_TYPE_PHASE: Record<TraeRun["type"], RunPhase> = {
  scrape: "scrape",
  match: "match",
  judge: "judge"
};

const PHASE_MESSAGE: Partial<Record<RunPhase, string>> = {
  scrape: "正在抓取报名与初赛专区…",
  match: "正在匹配报名方向…",
  judge: "正在评分作品…"
};

/**
 * Cross-instance pipeline status derived from the persistent runs table. Returns null when
 * the table says nothing relevant (no fresh RUNNING run, no recent finish), so callers can
 * fall back to this process's in-memory state.
 */
function statusFromRuns(runs: TraeRun[], now = Date.now()): PipelineStatus | null {
  const runningRuns = runs.filter((run) => isFreshRunningRun(run, now, STALE_RUNNING_RUN_MS));
  if (runningRuns.length > 0) {
    // listRuns is startedAt DESC: latest run's type decides the phase shown, the oldest
    // running run anchors startedAt.
    const phase = RUN_TYPE_PHASE[runningRuns[0].type];
    return {
      running: true,
      phase,
      startedAt: runningRuns[runningRuns.length - 1].startedAt,
      finishedAt: null,
      message: PHASE_MESSAGE[phase] ?? "运行中…",
      error: null
    };
  }

  const finished = runs.find((run) => run.finishedAt !== null);
  if (!finished || now - Date.parse(finished.finishedAt as string) >= DONE_RUN_WINDOW_MS) return null;

  if (finished.status === "error") {
    const rawError = finished.error ?? "Pipeline failed.";
    // Reclaimed zombies are timeouts of a previous killed batch, not a permanent failure —
    // surface a clear retryable message instead of the internal reclaim string.
    const reclaimed = /Reclaimed stale RUNNING run/i.test(rawError);
    return {
      running: false,
      phase: "error",
      startedAt: finished.startedAt,
      finishedAt: finished.finishedAt,
      message: reclaimed
        ? "上一轮评分超时中断，可立即重试。"
        : "运行中断，请稍后重试。",
      error: reclaimed
        ? "上一轮评分在云端超时前未能正常结束，已自动清理。请再点一次重试评分。"
        : rawError
    };
  }

  const latestJudge = runs.find((run) => run.type === "judge" && run.finishedAt !== null);
  return {
    running: false,
    phase: "done",
    startedAt: finished.startedAt,
    finishedAt: finished.finishedAt,
    message: `本轮后台运行已完成；最近一批评分 ${latestJudge?.evaluatedCount ?? 0} 个，失败 ${latestJudge?.failedCount ?? 0} 个。`,
    error: null
  };
}

/**
 * Run the full pipeline after the response. Updates in-memory state on completion so same-instance
 * GETs see the result without a DB round-trip. The runs table (updated by judge/match
 * sub-tasks) drives cross-instance status for GETs that land on other instances.
 */
async function runPipelineAfterResponse(state: PipelineState): Promise<void> {
  const startedAt = state.status.startedAt;
  try {
    const result = await runFullPipeline();
    state.status = {
      running: false,
      phase: "done",
      startedAt,
      finishedAt: new Date().toISOString(),
      message: `本轮抓取、匹配、评分已完成；评分 ${result.evaluatedCount} 个，失败 ${result.failedCount} 个。`,
      error: null
    };
  } catch (error) {
    console.error("[trae] pipeline failed:", error);
    state.status = {
      running: false,
      phase: "error",
      startedAt,
      finishedAt: new Date().toISOString(),
      message: "运行中断，请稍后重试。",
      error: error instanceof Error ? error.message : "Pipeline failed."
    };
  }
}

export async function GET(): Promise<NextResponse> {
  const state = getState();
  if (state.status.running && !isStaleRunningStatus(state.status)) {
    return NextResponse.json(state.status);
  }

  const runs = await readRecentRunsBestEffort(state);
  // Best-effort zombie cleanup on poll so the UI does not stick on "运行中" for dead batches.
  const reclaimed = await reclaimStaleRunsBestEffort(state, runs);
  const freshRuns = reclaimed > 0 ? await readRecentRunsBestEffort(state) : runs;
  const derived = statusFromRuns(freshRuns);
  if (derived) return NextResponse.json(derived);
  return NextResponse.json(state.status);
}

export async function POST(): Promise<NextResponse> {
  const state = getState();
  if (isStaleRunningStatus(state.status)) {
    state.status = { ...state.status, running: false, phase: "idle", message: "等待运行。" };
  }
  if (state.status.running) {
    return NextResponse.json(state.status);
  }

  // Reclaim zombies first so forever-RUNNING rows do not block this click.
  invalidateRunsCache(state);
  let runs = await readRecentRunsBestEffort(state);
  const reclaimed = await reclaimStaleRunsBestEffort(state, runs);
  if (reclaimed > 0) runs = await readRecentRunsBestEffort(state);

  // Cross-instance guard: a *fresh* run already in flight anywhere reports as running
  // instead of double-starting. No cooldown — the user wants immediate retry after a run.
  const dbStatus = statusFromRuns(runs);
  if (dbStatus?.running) {
    return NextResponse.json(dbStatus);
  }

  state.status = {
    running: true,
    phase: "judge",
    startedAt: new Date().toISOString(),
    finishedAt: null,
    message: "评分与抓取已启动…",
    error: null
  };

  // Keep long work on Next's request lifecycle without holding the button's POST open.
  // The client gets an immediate acknowledgement and polls GET for progress.
  after(async () => {
    await runPipelineAfterResponse(state);
  });

  return NextResponse.json(state.status);
}
