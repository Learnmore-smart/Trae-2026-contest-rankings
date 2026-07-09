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
