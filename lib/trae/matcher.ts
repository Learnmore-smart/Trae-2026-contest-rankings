import type { MatchMethod, MismatchRisk, TraeTopic } from "./types.ts";
import { getDataConnectDb } from "./dataconnect.ts";
import { getTopicsBySourceType, upsertMatch } from "@trae-contest/dataconnect-generated";
import { getTraeConfig } from "./config.ts";
import { fetchTopic, upsertTopic } from "./scraper.ts";
import { findSignupRefsByUsername, normalizeUsername, resolveAuthorUsername } from "./signup-finder.ts";
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

/**
 * Score a preliminary↔signup pair whose authorship is already confirmed to be the
 * same person (matched via the forum's author index). Match *existence* no longer
 * depends on title similarity — only the direction-consistency read does. A
 * confirmed author whose Demo drifted far from their 报名 idea still matches, but
 * surfaces as elevated mismatch risk, which is the signal we actually want.
 */
export function scoreConfirmedAuthorMatch(preliminary: TraeTopic, signup: TraeTopic): MatchScore {
  const titleSimilarity = diceSimilarity(preliminary.title, signup.title);
  const contentSimilarity = diceSimilarity(
    preliminary.contentText.slice(0, 1200),
    signup.contentText.slice(0, 1200)
  );
  const sameTrack = Boolean(preliminary.track && signup.track && preliminary.track === signup.track);

  // Identity is already confirmed, so direction reads purely off creative
  // continuity (title/content/track). Weights are higher than the fuzzy scorer's
  // because there's no same-author bonus folded in here — a real idea→Demo
  // continuation should still clear the low-risk band.
  const directionConsistencyScore = clamp(
    Math.round((titleSimilarity * 8 + contentSimilarity * 5 + (sameTrack ? 1 : 0)) * 10) / 10,
    0,
    10
  );
  // The small title/content bonus on confidence only breaks ties when an author
  // posted more than one signup topic.
  const matchConfidence = Math.round(clamp(88 + titleSimilarity * 8 + contentSimilarity * 4, 0, 100));

  return {
    signupTopicId: signup.id,
    signupAuthorName: signup.authorName,
    matchMethod: "same_author",
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

const matchMethodMap = {
  same_author: "SAME_AUTHOR",
  title_similarity: "TITLE_SIMILARITY",
  manual: "MANUAL",
  none: "NONE"
} as const;

const mismatchRiskMap = {
  none: "NONE",
  low: "LOW",
  medium: "MEDIUM",
  high: "HIGH",
  unknown: "UNKNOWN"
} as const;

/**
 * A forum-sourced signup is authoritative by construction: both the `@username`
 * search and the user-activity fallback are keyed to that exact user. When the
 * fetched post still carries its username (JSON path) we re-check it; the
 * HTML-fallback path has no username, so we trust the author-scoped source.
 */
function confirmsIdentity(signup: TraeTopic, username: string): boolean {
  if (!signup.authorUsername) return true;
  return normalizeUsername(signup.authorUsername) === normalizeUsername(username);
}

/**
 * Ask the forum for a user's signup topics, fetch each candidate's full content,
 * confirm identity, and cache it back to the DB so it shows in stats and the next
 * run's cheap in-pool path. Caps candidates so one prolific author can't stall a run.
 */
async function fetchConfirmedSignups(username: string): Promise<TraeTopic[]> {
  const refs = await findSignupRefsByUsername(username);
  const confirmed: TraeTopic[] = [];
  for (const ref of refs.slice(0, 3)) {
    try {
      const topic = await fetchTopic("signup", ref);
      if (!confirmsIdentity(topic, username)) continue;
      await upsertTopic(topic);
      confirmed.push(topic);
    } catch {
      // Skip this candidate; another may still confirm.
    }
  }
  return confirmed;
}

/** Run an async worker over items with a bounded number in flight, preserving order. */
async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  const runnerCount = Math.min(Math.max(1, limit), items.length || 1);
  const runners = Array.from({ length: runnerCount }, async () => {
    for (;;) {
      const index = cursor;
      cursor += 1;
      if (index >= items.length) break;
      results[index] = await worker(items[index], index);
    }
  });
  await Promise.all(runners);
  return results;
}

async function fetchAllTopicsBySourceType(dc: any, sourceType: "PRELIMINARY" | "SIGNUP"): Promise<TraeTopic[]> {
  const all: TraeTopic[] = [];
  const PAGE_SIZE = 1000;
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const res = await getTopicsBySourceType(dc, { sourceType, offset } as any);
    const topics = (res.data.topics ?? []) as unknown as TraeTopic[];
    all.push(...topics);
    if (topics.length < PAGE_SIZE) break;
  }
  return all;
}

export async function runTraeMatching(): Promise<{
  matchedCount: number;
  failedCount: number;
  forumMatchedCount: number;
  forumLookups: number;
}> {
  const run = await startRun("match", null);
  const dc = getDataConnectDb();
  const config = getTraeConfig();
  const forumCap = config.maxForumLookupsPerRun; // <= 0 ⇒ unlimited
  let forumLookups = 0;

  try {
    const [preliminaries, signups] = await Promise.all([
      fetchAllTopicsBySourceType(dc, "PRELIMINARY"),
      fetchAllTopicsBySourceType(dc, "SIGNUP")
    ]);

    // Growing pool: forum-discovered signups join it so later preliminaries by the
    // same author match via the cheap in-memory path instead of re-hitting the forum.
    const signupPool = [...signups];
    const signupPoolIds = new Set(signupPool.map((signup) => signup.id));
    const forumSourcedIds = new Set<string>();
    // One in-flight lookup per username — every preliminary by that author awaits
    // the same promise, so duplicate authors never trigger duplicate forum calls.
    const lookupByUsername = new Map<string, Promise<TraeTopic[]>>();

    const bestInPool = (preliminary: TraeTopic): MatchScore => {
      let best = noMatch();
      for (const signup of signupPool) {
        const score = scoreTopicMatch(preliminary, signup);
        if (score.matchConfidence > best.matchConfidence) best = score;
      }
      return best.matchConfidence >= 35 ? best : noMatch();
    };

    const lookupSignups = (username: string): Promise<TraeTopic[]> => {
      const key = normalizeUsername(username);
      const existing = lookupByUsername.get(key);
      if (existing) return existing;
      forumLookups += 1;
      const pending = fetchConfirmedSignups(username).then((confirmed) => {
        for (const signup of confirmed) {
          forumSourcedIds.add(signup.id);
          if (!signupPoolIds.has(signup.id)) {
            signupPool.push(signup);
            signupPoolIds.add(signup.id);
          }
        }
        return confirmed;
      });
      lookupByUsername.set(key, pending);
      return pending;
    };

    const outcomes = await mapWithConcurrency(preliminaries, config.forumLookupConcurrency, async (preliminary) => {
      try {
        let best = bestInPool(preliminary);
        const hasConfidentAuthorMatch =
          Boolean(best.signupTopicId) && best.matchMethod === "same_author" && best.matchConfidence >= 60;

        // Reach for the forum only when the cheap in-pool path didn't confidently
        // find this author's signup. The cap (if any) gates *new* authors; an
        // already in-flight/cached lookup is free to reuse.
        if (!hasConfidentAuthorMatch) {
          const username = await resolveAuthorUsername(preliminary);
          if (username) {
            const key = normalizeUsername(username);
            const capReached = forumCap > 0 && forumLookups >= forumCap;
            if (lookupByUsername.has(key) || !capReached) {
              const confirmed = await lookupSignups(username);
              for (const signup of confirmed) {
                const score = scoreConfirmedAuthorMatch(preliminary, signup);
                if (score.matchConfidence > best.matchConfidence) best = score;
              }
            }
          }
        }

        await upsertMatch(dc as any, {
          id: preliminary.id,
          preliminaryTopicId: preliminary.id,
          signupTopicId: best.signupTopicId,
          preliminaryAuthorName: preliminary.authorName,
          signupAuthorName: best.signupAuthorName,
          matchMethod: matchMethodMap[best.matchMethod],
          matchConfidence: best.matchConfidence,
          titleSimilarity: best.titleSimilarity ?? null,
          directionConsistencyScore: best.directionConsistencyScore ?? null,
          directionConsistencyComment: best.directionConsistencyComment ?? null,
          mismatchRisk: mismatchRiskMap[best.mismatchRisk]
        } as any);

        const matched = Boolean(best.signupTopicId);
        const forumMatched = matched && forumSourcedIds.has(best.signupTopicId as string);
        return { matched, forumMatched, failed: false };
      } catch {
        return { matched: false, forumMatched: false, failed: true };
      }
    });

    const matchedCount = outcomes.filter((outcome) => outcome.matched).length;
    const forumMatchedCount = outcomes.filter((outcome) => outcome.forumMatched).length;
    const failedCount = outcomes.filter((outcome) => outcome.failed).length;

    await finishRun(run.id, {
      status: failedCount > 0 ? "partial" : "success",
      matchedCount,
      failedCount,
      logs: [
        `Matched ${matchedCount}/${preliminaries.length} preliminary topics (${forumMatchedCount} via forum author search); ${failedCount} failures.`,
        `Forum author lookups: ${forumLookups} unique${forumCap > 0 ? ` (cap ${forumCap})` : " (unlimited)"}; concurrency ${config.forumLookupConcurrency}, min ${config.forumMinRequestMs}ms/req.`
      ]
    });
    return { matchedCount, failedCount, forumMatchedCount, forumLookups };
  } catch (error) {
    await finishRun(run.id, {
      status: "error",
      error: error instanceof Error ? error.message : String(error),
      matchedCount: 0,
      failedCount: 0
    });
    throw error;
  }
}
