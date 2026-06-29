import { getFirestoreDb, nowIso, TRAE_COLLECTIONS } from "./firestore.ts";
import type { TraeRun, TraeRunStatus, TraeRunType, TraeSourceType } from "./types.ts";

export async function startRun(type: TraeRunType, sourceType: TraeSourceType | null): Promise<TraeRun> {
  const db = getFirestoreDb();
  const id = `${type}_${sourceType ?? "all"}_${Date.now()}`;
  const run: TraeRun = {
    id,
    type,
    sourceType,
    startedAt: nowIso(),
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
  await db.collection(TRAE_COLLECTIONS.runs).doc(id).set(run);
  return run;
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
  const db = getFirestoreDb();
  await db
    .collection(TRAE_COLLECTIONS.runs)
    .doc(id)
    .set(
      {
        ...patch,
        logs: patch.logs?.slice(-50),
        finishedAt: nowIso()
      },
      { merge: true }
    );
}
