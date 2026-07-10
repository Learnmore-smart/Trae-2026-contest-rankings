import { getDataConnectDb, nowIso, withSqlRetry } from "./dataconnect.ts";
import { upsertRun, finishRun as finishRunMutation } from "@trae-contest/dataconnect-generated";
import type { TraeRun, TraeRunStatus, TraeRunType, TraeSourceType } from "./types.ts";

const runTypeMap = {
  scrape: "SCRAPE",
  judge: "JUDGE",
  match: "MATCH"
} as const;

const sourceTypeMap = {
  signup: "SIGNUP",
  preliminary: "PRELIMINARY"
} as const;

const runStatusMap = {
  running: "RUNNING",
  success: "SUCCESS",
  partial: "PARTIAL",
  error: "ERROR"
} as const;

/**
 * A RUNNING row older than this is treated as a zombie: the process was killed
 * (Cloud Run timeout / CPU throttle / OOM) before finishRun. Must exceed the longest
 * legitimate single-request batch (~900s Cloud Run timeout) so live work is not reclaimed.
 */
export const STALE_RUNNING_RUN_MS = 15 * 60 * 1000;

export function isFreshRunningRun(
  run: Pick<TraeRun, "status" | "startedAt">,
  now = Date.now(),
  maxAgeMs = STALE_RUNNING_RUN_MS
): boolean {
  if (run.status !== "running") return false;
  const startedAt = Date.parse(run.startedAt);
  return Number.isFinite(startedAt) && now - startedAt < maxAgeMs;
}

/**
 * Finalize RUNNING rows that outlived the max legitimate batch window so public/cron
 * start guards stop treating dead work as in-flight. Callers pass runs from listRuns.
 */
export async function reclaimStaleRunningRuns(
  runs: TraeRun[],
  options?: {
    maxAgeMs?: number;
    now?: number;
  }
): Promise<number> {
  const maxAgeMs = options?.maxAgeMs ?? STALE_RUNNING_RUN_MS;
  const now = options?.now ?? Date.now();
  let reclaimed = 0;

  for (const run of runs) {
    if (run.status !== "running") continue;
    const startedAt = Date.parse(run.startedAt);
    if (!Number.isFinite(startedAt)) continue;
    const ageMs = now - startedAt;
    if (ageMs < maxAgeMs) continue;

    await finishRun(run.id, {
      status: "error",
      error: `Reclaimed stale RUNNING run after ${Math.round(ageMs / 1000)}s (process likely killed before finishRun).`
    });
    reclaimed += 1;
  }

  return reclaimed;
}

export async function startRun(type: TraeRunType, sourceType: TraeSourceType | null): Promise<TraeRun> {
  const dc = getDataConnectDb();
  const id = `${type}_${sourceType ?? "all"}_${Date.now()}`;
  const startedAt = nowIso();
  await withSqlRetry(() => upsertRun(dc as any, {
    id,
    type: runTypeMap[type],
    sourceType: sourceType ? sourceTypeMap[sourceType] : null,
    status: "RUNNING"
  } as any));
  return {
    id,
    type,
    sourceType,
    startedAt,
    finishedAt: null,
    status: "running",
    pagesScanned: null,
    topicsFound: null,
    topicsCreated: null,
    topicsUpdated: null,
    evaluatedCount: null,
    failedCount: null,
    matchedCount: null,
    logs: [],
    error: null
  };
}

export interface FinishRunPatch {
  status: TraeRunStatus;
  pagesScanned?: number;
  topicsFound?: number;
  topicsCreated?: number;
  topicsUpdated?: number;
  evaluatedCount?: number;
  failedCount?: number;
  matchedCount?: number;
  logs?: string[];
  error?: string | null;
}

export async function finishRun(id: string, patch: FinishRunPatch): Promise<void> {
  const dc = getDataConnectDb();
  await withSqlRetry(() => finishRunMutation(dc as any, {
    id,
    status: runStatusMap[patch.status],
    pagesScanned: patch.pagesScanned ?? null,
    topicsFound: patch.topicsFound ?? null,
    topicsCreated: patch.topicsCreated ?? null,
    topicsUpdated: patch.topicsUpdated ?? null,
    evaluatedCount: patch.evaluatedCount ?? null,
    failedCount: patch.failedCount ?? null,
    matchedCount: patch.matchedCount ?? null,
    logs: patch.logs ? patch.logs.slice(-50) : null,
    error: patch.error ?? null
  } as any));
}
