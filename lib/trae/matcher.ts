import type { MatchMethod, MismatchRisk, TraeMatch, TraeTopic } from "./types.ts";
import { getFirestoreDb, TRAE_COLLECTIONS, nowIso } from "./firestore.ts";
import { finishRun, startRun } from "./runs.ts";

export interface MatchScore {
  signupTopicId: string | null;
  signupAuthorName: string | null;
  matchMethod: MatchMethod;
  matchConfidence: number;
  titleSimilarity: number | null;
  directionConsistencyScore: number | null;
  directionConsistencyComment: string | null;
  mismatchRisk: MismatchRisk;
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/[\s\p{P}\p{S}]+/gu, "");
}

function tokens(value: string): Set<string> {
  const normalized = normalize(value);
  const result = new Set<string>();
  for (const word of value.toLowerCase().match(/[a-z0-9_]{2,}/g) ?? []) result.add(word);
  for (let index = 0; index < normalized.length - 1; index += 1) {
    result.add(normalized.slice(index, index + 2));
  }
  return result;
}

function diceSimilarity(left: string, right: string): number {
  const leftTokens = tokens(left);
  const rightTokens = tokens(right);
  if (!leftTokens.size || !rightTokens.size) return 0;
  let overlap = 0;
  for (const token of leftTokens) {
    if (rightTokens.has(token)) overlap += 1;
  }
  return (2 * overlap) / (leftTokens.size + rightTokens.size);
}

function levenshtein(left: string, right: string): number {
  const a = normalize(left);
  const b = normalize(right);
  const dp = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i += 1) dp[i][0] = i;
  for (let j = 0; j <= b.length; j += 1) dp[0][j] = j;
  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
  }
  return dp[a.length][b.length];
}

function authorSimilarity(left: string, right: string): number {
  const a = normalize(left);
  const b = normalize(right);
  if (!a || !b) return 0;
  if (a === b) return 1;
  const distance = levenshtein(a, b);
  return 1 - distance / Math.max(a.length, b.length);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function mismatchRiskFor(consistency: number, confidence: number): MismatchRisk {
  if (confidence < 35) return "high";
  if (confidence >= 85 && consistency >= 7) return "none";
  if (consistency >= 8) return "none";
  if (consistency >= 6) return "low";
  if (consistency >= 4) return "medium";
  return "high";
}

function directionComment(score: number, preliminary: TraeTopic, signup: TraeTopic): string {
  if (score >= 8) return "初赛作品与报名创意方向高度一致，核心主题和目标场景基本延续。";
  if (score >= 6) return "初赛作品与报名方向大体一致，但实现重点或表达方式有一定变化。";
  if (score >= 4) return "初赛作品与报名方向存在可见偏移，需要人工复核是否仍属于同一创意。";
  return `初赛作品“${preliminary.title}”与报名帖“${signup.title}”主题差异较大，存在方向不一致风险。`;
}

export function scoreTopicMatch(preliminary: TraeTopic, signup: TraeTopic): MatchScore {
  const sameAuthor = normalize(preliminary.authorName) === normalize(signup.authorName);
  const authorScore = authorSimilarity(preliminary.authorName, signup.authorName);
  const titleSimilarity = diceSimilarity(preliminary.title, signup.title);
  const contentSimilarity = diceSimilarity(preliminary.contentText.slice(0, 1200), signup.contentText.slice(0, 1200));
  const sameTrack = Boolean(preliminary.track && signup.track && preliminary.track === signup.track);

  let matchMethod: MatchMethod = "title_similarity";
  let confidence = 0;

  if (sameAuthor) {
    matchMethod = "same_author";
    confidence += 70;
  } else if (authorScore >= 0.82) {
    matchMethod = "same_author";
    confidence += 48;
  }

  confidence += titleSimilarity * 25;
  confidence += contentSimilarity * 15;
  if (sameTrack) confidence += 5;
  if (!sameAuthor && authorScore < 0.5 && titleSimilarity < 0.25) confidence -= 15;

  const directionConsistencyScore = clamp(
    Math.round((titleSimilarity * 5 + contentSimilarity * 3 + (sameTrack ? 2 : 0) + (sameAuthor ? 4 : 0)) * 10) / 10,
    0,
    10
  );
  const matchConfidence = Math.round(clamp(confidence, 0, 100));

  return {
    signupTopicId: signup.id,
    signupAuthorName: signup.authorName,
    matchMethod,
    matchConfidence,
    titleSimilarity: Math.round(titleSimilarity * 100),
    directionConsistencyScore,
    directionConsistencyComment: directionComment(directionConsistencyScore, preliminary, signup),
    mismatchRisk: mismatchRiskFor(directionConsistencyScore, matchConfidence)
  };
}

function noMatch(): MatchScore {
  return {
    signupTopicId: null,
    signupAuthorName: null,
    matchMethod: "none",
    matchConfidence: 0,
    titleSimilarity: null,
    directionConsistencyScore: null,
    directionConsistencyComment: "暂未匹配到报名记录；这不代表未报名，可能是用户名或标题无法自动匹配。",
    mismatchRisk: "unknown"
  };
}

export async function runTraeMatching(): Promise<{ matchedCount: number; failedCount: number }> {
  const run = await startRun("match", null);
  const db = getFirestoreDb();
  let matchedCount = 0;
  let failedCount = 0;

  try {
    const [preliminarySnapshot, signupSnapshot] = await Promise.all([
      db.collection(TRAE_COLLECTIONS.topics).where("sourceType", "==", "preliminary").get(),
      db.collection(TRAE_COLLECTIONS.topics).where("sourceType", "==", "signup").get()
    ]);
    const preliminaries = preliminarySnapshot.docs.map((doc) => doc.data() as TraeTopic);
    const signups = signupSnapshot.docs.map((doc) => doc.data() as TraeTopic);

    for (const preliminary of preliminaries) {
      try {
        let best = noMatch();
        for (const signup of signups) {
          const score = scoreTopicMatch(preliminary, signup);
          if (score.matchConfidence > best.matchConfidence) best = score;
        }
        if (best.matchConfidence < 35) best = noMatch();
        const now = nowIso();
        const doc: TraeMatch = {
          id: preliminary.id,
          preliminaryTopicId: preliminary.id,
          signupTopicId: best.signupTopicId,
          preliminaryAuthorName: preliminary.authorName,
          signupAuthorName: best.signupAuthorName,
          matchMethod: best.matchMethod,
          matchConfidence: best.matchConfidence,
          titleSimilarity: best.titleSimilarity,
          directionConsistencyScore: best.directionConsistencyScore,
          directionConsistencyComment: best.directionConsistencyComment,
          mismatchRisk: best.mismatchRisk,
          createdAt: now,
          updatedAt: now
        };
        await db.collection(TRAE_COLLECTIONS.matches).doc(preliminary.id).set(doc, { merge: true });
        if (doc.signupTopicId) matchedCount += 1;
      } catch {
        failedCount += 1;
      }
    }

    await finishRun(run.id, {
      status: failedCount > 0 ? "partial" : "success",
      matchedCount,
      failedCount,
      logs: [`Matched ${matchedCount} preliminary topics; ${failedCount} failures.`]
    });
    return { matchedCount, failedCount };
  } catch (error) {
    await finishRun(run.id, {
      status: "error",
      error: error instanceof Error ? error.message : String(error),
      matchedCount,
      failedCount
    });
    throw error;
  }
}
