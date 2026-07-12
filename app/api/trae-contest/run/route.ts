import { NextRequest, NextResponse } from "next/server";
import { setTimeout as sleep } from "node:timers/promises";
import { listRuns, writeBoardSnapshot } from "@/lib/trae/api";
import { getTraeConfig } from "@/lib/trae/config";
import { judgeChangedTraeTopics } from "@/lib/trae/judge";
import { DEFAULT_JUDGE_BATCH_MAX, DEFAULT_JUDGE_CONCURRENCY } from "@/lib/trae/judge-policy";
import { runTraeMatching } from "@/lib/trae/matcher";
import { isFreshRunningRun, reclaimStaleRunningRuns, STALE_RUNNING_RUN_MS } from "@/lib/trae/runs";
import { scrapeAllTraeSources } from "@/lib/trae/scraper";
import type { TraeRun } from "@/lib/trae/types";

export const runtime = "nodejs";
// Allow the POST handoff (or in-process fallback) to stay alive under Cloud Run's long timeout.
export const maxDuration = 900;

// One public "update now" button drives the whole pipeline (scrape -> match -> judge).
// The same pipeline also runs automatically on the Cloud Scheduler cron; this endpoint
// is only a manual trigger, so it is intentionally token-free but guarded by a single
// in-flight lock plus a short cooldown to avoid hammering the public forum.
//
// Cloud Run reality check: in-memory state is per-instance, and CPU is throttled once a
// response is sent. So POST must NOT rely on fire-and-forget background work (it stalls
// mid-flight), and GET must NOT rely on this process's memory alone (the poll may land on
// a different instance than the click). Instead, POST self-invokes the cron run-all
// endpoint — the work then runs inside a request that keeps CPU for the full 900s service
// timeout — and GET derives a cross-instance status from the persistent runs table.
//
// Handoff: POST keeps the request open (CPU allocated) until run-all has written a fresh
// RUNNING row (or the self-invoke settles / fails early). Returning after a blind 250ms
// sleep left zombies: startRun wrote RUNNING, then CPU throttle killed the outbound fetch.

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
// Keep reporting "done" to pollers after finish so the client that started the run gets
// its completion signal even when the memory that produced the run lives on another instance.
const DONE_RUN_WINDOW_MS = 2 * 60 * 1000;
// In-memory "running" older than this is stale (background pipeline died without a
// finally); fall through to DB status and let POST start a fresh run.
const STALE_MEMORY_RUNNING_MS = 20 * 60 * 1000;
// Polling clients hit GET every 2s; cache the runs read briefly so status polls cost
// at most ~1 Data Connect query per interval regardless of how many tabs are open.
const RUNS_CACHE_TTL_MS = 2_500;
// How long POST holds open waiting for run-all to prove it started (fresh RUNNING row).
const HANDOFF_WAIT_MS = 25_000;
// In-process fallback must fit two judge passes under Cloud Run's ~900s request timeout
// (same budget as cron run-all). Soft 300s + hard drain ~90s per pass ≈ 390s × 2.
const FALLBACK_JUDGE_DEADLINE_MS = 300_000;
// Match phase has the same 300s ceiling so scrape+match never blocks the second judge
// pass from running. Without this, unlimited forum lookups on ~6000 preliminaries
// regularly exceed 900s and Cloud Run kills the request, leaving zombie RUNNING rows.
const FALLBACK_MATCH_DEADLINE_MS = 300_000;

interface PipelineState {
  status: PipelineStatus;
  runsCache?: { at: number; runs: TraeRun[] };
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

function latestFinishedAtMs(runs: TraeRun[], memory: PipelineStatus): number | null {
  const candidates = [
    ...runs.map((run) => (run.finishedAt ? Date.parse(run.finishedAt) : Number.NaN)),
    memory.finishedAt ? Date.parse(memory.finishedAt) : Number.NaN
  ].filter((value) => Number.isFinite(value));
  return candidates.length > 0 ? Math.max(...candidates) : null;
}

function judgeChangedBatch(): Promise<JudgeBatchResult> {
  return judgeChangedTraeTopics({
    mode: "changed",
    max: DEFAULT_JUDGE_BATCH_MAX,
    concurrency: DEFAULT_JUDGE_CONCURRENCY,
    // Match cron run-all: two sequential-ish passes must not each take the full 690s default
    // or Cloud Run kills the request mid-flight and leaves zombie RUNNING rows.
    deadlineMs: FALLBACK_JUDGE_DEADLINE_MS
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

// Legacy in-process pipeline: only used when no cron secret is configured (local dev,
// where the process keeps CPU) or when the cron self-invocation fails to start.
async function runPipeline(state: PipelineState): Promise<void> {
  const set = (patch: Partial<PipelineStatus>) => {
    state.status = { ...state.status, ...patch };
  };
  // Same overall budget as cron run-all: leave headroom under Cloud Run 900s so the second
  // judge pass (and finishRun) are not cut off when scrape/match is slow.
  const pipelineStartedAt = Date.now();
  const PIPELINE_BUDGET_MS = 840_000;
  const MIN_SECOND_JUDGE_MS = 45_000;

  try {
    set({ phase: "judge", message: "正在评分现有未评分作品，同时抓取公开帖子…" });
    const immediateJudge = judgeChangedBatch();
    const scrapeAndMatch = (async () => {
      set({ phase: "scrape", message: "正在抓取报名与初赛专区，同时评分未评分作品…" });
      await scrapeAllTraeSources();

      set({ phase: "match", message: "正在匹配报名方向…" });
      await runTraeMatching(FALLBACK_MATCH_DEADLINE_MS);
    })();

    const [, immediateJudgeResult] = await Promise.all([scrapeAndMatch, immediateJudge]);

    const remainingMs = PIPELINE_BUDGET_MS - (Date.now() - pipelineStartedAt);
    let postMatchJudgeResult: JudgeBatchResult = { evaluatedCount: 0, failedCount: 0 };
    if (remainingMs >= MIN_SECOND_JUDGE_MS + 90_000) {
      set({ phase: "judge", message: "正在评分新匹配的未评分作品…" });
      const secondDeadlineMs = Math.min(FALLBACK_JUDGE_DEADLINE_MS, remainingMs - 90_000);
      postMatchJudgeResult = await judgeChangedTraeTopics({
        mode: "changed",
        max: DEFAULT_JUDGE_BATCH_MAX,
        concurrency: DEFAULT_JUDGE_CONCURRENCY,
        deadlineMs: secondDeadlineMs
      });
    } else {
      console.warn(
        `[trae] in-process pipeline skipping second judge pass: only ${remainingMs}ms left under ${PIPELINE_BUDGET_MS}ms budget`
      );
    }
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

function buildCronRunAllUrl(request: NextRequest): string {
  // Loopback keeps the handoff inside this container: no public ingress/egress, no
  // dependency on the external hostname resolving from Cloud Run. Preserve basePath by
  // swapping only the route suffix on the incoming pathname.
  const pathname = new URL(request.url).pathname.replace(
    /\/api\/trae-contest\/run\/?$/,
    "/api/trae-contest/cron/run-all"
  );
  const port = process.env.PORT || "8080";
  return `http://127.0.0.1:${port}${pathname}`;
}

async function hasDispatchHandoff(state: PipelineState, dispatchedAt: number): Promise<boolean> {
  invalidateRunsCache(state);
  const runs = await readRecentRuns(state);
  return runs.some(
    (run) => isFreshRunningRun(run) && Date.parse(run.startedAt) >= dispatchedAt - 2_000
  );
}

type CronRunAllPayload = {
  result?: { evaluatedCount?: number; failedCount?: number };
  skipped?: string;
} | null;

function applyCronPayloadToState(state: PipelineState, payload: CronRunAllPayload): void {
  state.status = {
    ...state.status,
    running: false,
    phase: "done",
    finishedAt: new Date().toISOString(),
    message: payload?.skipped
      ? "后台已有评分批次在运行，本次点击已并入该批次。"
      : `本轮抓取、匹配、评分已完成；评分 ${payload?.result?.evaluatedCount ?? 0} 个，失败 ${payload?.result?.failedCount ?? 0} 个。`,
    error: null
  };
}

/**
 * Run the pipeline through the cron run-all endpoint so it executes inside its own request
 * (full CPU up to the Cloud Run service timeout) instead of as throttled background work.
 * The secret goes in a header — never the query string — so it stays out of request logs.
 *
 * Keeps this request alive until handoff evidence (fresh RUNNING row) so Cloud Run does not
 * throttle CPU before the outbound self-invoke is established. Once handoff is confirmed,
 * detaches from the full 900s response and lets clients poll the runs table.
 */
async function invokeCronRunAll(request: NextRequest, cronSecret: string, state: PipelineState): Promise<void> {
  const dispatchedAt = Date.now();
  let fetchError: unknown = null;
  let fetchSettled = false;
  let payload: CronRunAllPayload = null;

  const fetchPromise = (async () => {
    try {
      const response = await fetch(buildCronRunAllUrl(request), {
        method: "POST",
        headers: { "x-trae-cron-secret": cronSecret },
        cache: "no-store"
      });
      if (!response.ok) throw new Error(`cron run-all responded ${response.status}`);
      payload = (await response.json().catch(() => null)) as CronRunAllPayload;
    } catch (error) {
      fetchError = error;
    } finally {
      fetchSettled = true;
    }
  })();

  while (Date.now() - dispatchedAt < HANDOFF_WAIT_MS) {
    if (fetchSettled) break;

    if (await hasDispatchHandoff(state, dispatchedAt)) {
      // run-all is request-bound elsewhere (or on this instance as a concurrent request).
      // Detach: do not await the full 900s response on this POST.
      void fetchPromise.then(() => {
        if (!fetchError) applyCronPayloadToState(state, payload);
        else {
          console.error("[trae] cron run-all self-invocation lost its response after handoff:", fetchError);
          // Handoff already proved work started; let GET/statusFromRuns drive the rest.
          state.status = { ...state.status, running: false, phase: "idle", message: "等待运行。" };
        }
      });
      return;
    }

    await sleep(400);
  }

  // Fetch finished inside the handoff window (skip, fast path, or error).
  if (fetchSettled) {
    if (fetchError) {
      // Only defer to the runs table when this dispatch actually started server-side.
      // Connect timeouts / 401 / DNS never write a RUNNING row — those must fall back
      // in-process. The old timer-based "late failure ⇒ idle" path made 开始评分 a silent
      // no-op when undici's ~10s connect timeout landed just after a 10s early window.
      if (await hasDispatchHandoff(state, dispatchedAt)) {
        console.error("[trae] cron run-all self-invocation lost its response after handoff; deferring to runs table:", fetchError);
        state.status = { ...state.status, running: false, phase: "idle", message: "等待运行。" };
        return;
      }
      console.error("[trae] cron run-all self-invocation failed to start; falling back in-process:", fetchError);
      await runPipeline(state);
      return;
    }
    applyCronPayloadToState(state, payload);
    return;
  }

  // Still no RUNNING row and fetch not settled — connection may be stuck (e.g. container
  // concurrency=1 deadlock on self-fetch). Fall back in-process while this request still
  // holds CPU so the click does real work.
  console.error("[trae] cron run-all handoff timed out without RUNNING evidence; falling back in-process");
  void fetchPromise; // abandon waiting; avoid double work only if run-all later starts
  await runPipeline(state);
}

export async function GET(): Promise<NextResponse> {
  const state = getState();
  if (state.status.running && !isStaleRunningStatus(state.status)) {
    return NextResponse.json(state.status);
  }

  const runs = await readRecentRuns(state);
  // Best-effort zombie cleanup on poll so the UI does not stick on "运行中" for dead batches.
  const reclaimed = await reclaimStaleRunningRuns(runs);
  if (reclaimed > 0) {
    invalidateRunsCache(state);
  }
  const freshRuns = reclaimed > 0 ? await readRecentRuns(state) : runs;
  const derived = statusFromRuns(freshRuns);
  if (derived) return NextResponse.json(derived);
  return NextResponse.json(state.status);
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const state = getState();
  if (isStaleRunningStatus(state.status)) {
    state.status = { ...state.status, running: false, phase: "idle", message: "等待运行。" };
  }
  if (state.status.running) {
    return NextResponse.json(state.status);
  }

  // Reclaim zombies first so forever-RUNNING rows do not block this click.
  invalidateRunsCache(state);
  let runs = await readRecentRuns(state);
  const reclaimed = await reclaimStaleRunningRuns(runs);
  if (reclaimed > 0) {
    invalidateRunsCache(state);
    runs = await readRecentRuns(state);
  }

  // Cross-instance guards: a *fresh* run already in flight anywhere reports as running
  // instead of double-starting, and a run that just finished anywhere still honors cooldown.
  const dbStatus = statusFromRuns(runs);
  if (dbStatus?.running) {
    return NextResponse.json(dbStatus);
  }

  const lastFinishedAt = latestFinishedAtMs(runs, state.status);
  if (lastFinishedAt !== null && Date.now() - lastFinishedAt < COOLDOWN_MS) {
    return NextResponse.json({
      ...state.status,
      running: false,
      message: "刚刚已更新过，请稍后再试。"
    });
  }

  state.status = {
    running: true,
    phase: "judge",
    startedAt: new Date().toISOString(),
    finishedAt: null,
    message: "评分与抓取已启动…",
    error: null
  };

  const config = getTraeConfig();
  if (config.cronSecret) {
    // Await handoff (not the full 900s batch) so CPU stays allocated until run-all is live.
    await invokeCronRunAll(request, config.cronSecret, state);
  } else {
    // Local dev: no cron secret, and the process keeps CPU — run in-process as before.
    void runPipeline(state);
  }

  return NextResponse.json(state.status);
}
