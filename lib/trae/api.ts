import { createHash } from "node:crypto";
import { FirestoreUnavailableError, getFirestoreDb, isFirestoreConfigured, nowIso, TRAE_COLLECTIONS } from "./firestore.ts";
import type { RankingItem, StatsPayload, TraeEvaluation, TraeMatch, TraePresence, TraeRun, TraeTopic } from "./types.ts";

export interface TopicListParams {
  track?: string | null;
  q?: string | null;
  sort?: string | null;
  page?: number;
  pageSize?: number;
  minConfidence?: number | null;
}

function emptyStats(message?: string): StatsPayload {
  return {
    signupCount: 0,
    preliminaryCount: 0,
    evaluatedCount: 0,
    matchedCount: 0,
    lastUpdatedAt: null,
    onlineCount: 0,
    sourceUnavailable: true,
    message
  };
}

function sanitizeTopic(topic: TraeTopic): RankingItem["topic"] {
  const { contentHtml, rawHtml, rawJson, ...safeTopic } = topic;
  void contentHtml;
  void rawHtml;
  void rawJson;
  return safeTopic;
}

function latestEvaluationMap(evaluations: TraeEvaluation[]): Map<string, TraeEvaluation> {
  const map = new Map<string, TraeEvaluation>();
  for (const evaluation of evaluations) {
    const existing = map.get(evaluation.topicId);
    if (!existing || evaluation.createdAt > existing.createdAt) map.set(evaluation.topicId, evaluation);
  }
  return map;
}

async function readAll<T>(collection: string): Promise<T[]> {
  const snapshot = await getFirestoreDb().collection(collection).limit(2000).get();
  return snapshot.docs.map((doc) => doc.data() as T);
}

export async function getTraeStats(): Promise<StatsPayload> {
  if (!isFirestoreConfigured()) return emptyStats("Firestore credentials are not configured.");
  try {
    const [topics, evaluations, matches, presence] = await Promise.all([
      readAll<TraeTopic>(TRAE_COLLECTIONS.topics),
      readAll<TraeEvaluation>(TRAE_COLLECTIONS.evaluations),
      readAll<TraeMatch>(TRAE_COLLECTIONS.matches),
      readAll<TraePresence>(TRAE_COLLECTIONS.presence)
    ]);
    const latest = latestEvaluationMap(evaluations);
    const onlineSince = Date.now() - 2 * 60 * 1000;
    const timestamps = [
      ...topics.map((topic) => topic.updatedAt),
      ...evaluations.map((evaluation) => evaluation.createdAt),
      ...matches.map((match) => match.updatedAt)
    ].filter(Boolean);

    return {
      signupCount: topics.filter((topic) => topic.sourceType === "signup").length,
      preliminaryCount: topics.filter((topic) => topic.sourceType === "preliminary").length,
      evaluatedCount: Array.from(latest.values()).filter((evaluation) => !evaluation.error).length,
      matchedCount: matches.filter((match) => Boolean(match.signupTopicId)).length,
      lastUpdatedAt: timestamps.sort().at(-1) ?? null,
      onlineCount: presence.filter((entry) => Date.parse(entry.lastSeenAt) >= onlineSince).length
    };
  } catch (error) {
    if (error instanceof FirestoreUnavailableError) return emptyStats(error.message);
    throw error;
  }
}

function sortValue(item: RankingItem, sort: string): number | string {
  const evaluation = item.evaluation;
  switch (sort) {
    case "innovation":
      return evaluation?.innovationScore ?? -1;
    case "practicality":
      return evaluation?.practicalityScore ?? -1;
    case "completion":
      return evaluation?.completionScore ?? -1;
    case "design":
      return evaluation?.designScore ?? -1;
    case "confidence":
      return evaluation?.confidenceScore ?? -1;
    case "views":
      return item.topic.viewCount ?? -1;
    case "replies":
      return item.topic.replyCount ?? -1;
    case "updated":
      return item.topic.updatedAt;
    case "total":
    default:
      return evaluation?.totalScore ?? -1;
  }
}

export async function listRankedTopics(params: TopicListParams = {}): Promise<{
  items: RankingItem[];
  total: number;
  page: number;
  pageSize: number;
  sourceUnavailable?: boolean;
  message?: string;
}> {
  if (!isFirestoreConfigured()) {
    return { items: [], total: 0, page: 1, pageSize: params.pageSize ?? 12, sourceUnavailable: true, message: "Firestore credentials are not configured." };
  }

  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(50, Math.max(1, params.pageSize ?? 12));
  const sort = params.sort ?? "total";
  const query = params.q?.trim().toLowerCase() ?? "";

  const [topics, evaluations, matches] = await Promise.all([
    readAll<TraeTopic>(TRAE_COLLECTIONS.topics),
    readAll<TraeEvaluation>(TRAE_COLLECTIONS.evaluations),
    readAll<TraeMatch>(TRAE_COLLECTIONS.matches)
  ]);
  const evaluationMap = latestEvaluationMap(evaluations);
  const matchMap = new Map(matches.map((match) => [match.preliminaryTopicId, match]));

  let items: RankingItem[] = topics
    .filter((topic) => topic.sourceType === "preliminary")
    .map((topic) => ({
      rank: 0,
      topic: sanitizeTopic(topic),
      evaluation: evaluationMap.get(topic.id) ?? null,
      match: matchMap.get(topic.id) ?? null
    }));

  if (params.track) items = items.filter((item) => item.topic.track === params.track);
  if (query) {
    items = items.filter((item) =>
      `${item.topic.title} ${item.topic.authorName} ${item.topic.excerpt} ${item.topic.tags.join(" ")}`
        .toLowerCase()
        .includes(query)
    );
  }
  if (typeof params.minConfidence === "number") {
    items = items.filter((item) => (item.evaluation?.confidenceScore ?? 0) >= params.minConfidence!);
  }

  items.sort((left, right) => {
    const a = sortValue(left, sort);
    const b = sortValue(right, sort);
    if (typeof a === "string" || typeof b === "string") return String(b).localeCompare(String(a));
    return Number(b) - Number(a);
  });
  items = items.map((item, index) => ({ ...item, rank: index + 1 }));

  const total = items.length;
  return {
    items: items.slice((page - 1) * pageSize, page * pageSize),
    total,
    page,
    pageSize
  };
}

export async function getTopicDetail(id: string): Promise<RankingItem | null> {
  if (!isFirestoreConfigured()) return null;
  const db = getFirestoreDb();
  const topicSnapshot = await db.collection(TRAE_COLLECTIONS.topics).doc(id).get();
  if (!topicSnapshot.exists) return null;
  const topic = topicSnapshot.data() as TraeTopic;
  if (topic.sourceType !== "preliminary") return null;

  const [evaluationSnapshot, matchSnapshot] = await Promise.all([
    db.collection(TRAE_COLLECTIONS.evaluations).where("topicId", "==", id).get(),
    db.collection(TRAE_COLLECTIONS.matches).doc(id).get()
  ]);
  const latest = latestEvaluationMap(evaluationSnapshot.docs.map((doc) => doc.data() as TraeEvaluation)).get(id) ?? null;
  const match = matchSnapshot.exists ? (matchSnapshot.data() as TraeMatch) : null;

  return {
    rank: 0,
    topic: sanitizeTopic(topic),
    evaluation: latest,
    match
  };
}

export async function recordPresence(sessionId: string, userAgent: string | null): Promise<{ onlineCount: number }> {
  if (!isFirestoreConfigured()) return { onlineCount: 0 };
  const userAgentHash = userAgent
    ? createHash("sha256").update(userAgent).digest("hex").slice(0, 24)
    : null;
  const entry: TraePresence = {
    sessionId,
    lastSeenAt: nowIso(),
    userAgentHash
  };
  const db = getFirestoreDb();
  await db.collection(TRAE_COLLECTIONS.presence).doc(sessionId).set(entry, { merge: true });
  const stats = await getTraeStats();
  return { onlineCount: stats.onlineCount };
}

export async function listRuns(limit = 30): Promise<TraeRun[]> {
  if (!isFirestoreConfigured()) return [];
  const snapshot = await getFirestoreDb().collection(TRAE_COLLECTIONS.runs).orderBy("startedAt", "desc").limit(limit).get();
  return snapshot.docs.map((doc) => doc.data() as TraeRun);
}
