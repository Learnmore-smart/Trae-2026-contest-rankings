import { judgeChangedTraeTopics } from "@/lib/trae/judge";
import { runTraeMatching } from "@/lib/trae/matcher";
import { scrapeAllTraeSources } from "@/lib/trae/scraper";
import { writeBoardSnapshot } from "@/lib/trae/api";

// Shared pipeline logic used by both the cron run-all route and the POST /run handler.
// Extracted here so POST /run can call it directly instead of HTTP self-invoking the cron
// endpoint (which was unreliable on Cloud Run due to basePath/loopback 404 issues).

export interface PipelineResult {
  evaluatedCount: number;
  failedCount: number;
  skipped?: string;
}

const DEFAULT_JUDGE_MAX = 500;
const JUDGE_DEADLINE_MS = 300_000;
const MATCH_DEADLINE_MS = 300_000;
const BUDGET_MS = 840_000;
const MIN_SECOND_JUDGE_MS = 45_000;

async function refreshSnapshot(): Promise<void> {
  try {
    await writeBoardSnapshot();
  } catch (error) {
    console.error("[trae] writeBoardSnapshot failed:", error);
  }
}

/**
 * Run the full pipeline: scrape → match → judge (two passes).
 * Must be called inside a request with maxDuration >= 900s (Cloud Run service timeout).
 */
export async function runFullPipeline(judgeMax = DEFAULT_JUDGE_MAX): Promise<PipelineResult> {
  const halfMax = Math.floor(judgeMax / 2);
  const startedAt = Date.now();

  const scrapeAndMatch = (async () => {
    await scrapeAllTraeSources();
    await runTraeMatching(MATCH_DEADLINE_MS);
  })();

  const firstJudge = judgeChangedTraeTopics({
    mode: "changed",
    max: halfMax,
    deadlineMs: JUDGE_DEADLINE_MS,
  }).catch((error) => {
    console.error("[trae] first judge batch failed:", error);
    return { evaluatedCount: 0, failedCount: 0 };
  });

  const [, firstResult] = await Promise.all([scrapeAndMatch, firstJudge]);

  const remainingMs = BUDGET_MS - (Date.now() - startedAt);
  let secondResult = { evaluatedCount: 0, failedCount: 0 };
  if (remainingMs >= MIN_SECOND_JUDGE_MS + 90_000) {
    const secondDeadlineMs = Math.min(JUDGE_DEADLINE_MS, remainingMs - 90_000);
    secondResult = await judgeChangedTraeTopics({
      mode: "changed",
      max: halfMax,
      deadlineMs: secondDeadlineMs,
    });
  } else {
    console.warn(
      `[trae] pipeline skipping second judge pass: only ${remainingMs}ms left under ${BUDGET_MS}ms budget`
    );
  }

  const merged = {
    evaluatedCount: firstResult.evaluatedCount + secondResult.evaluatedCount,
    failedCount: firstResult.failedCount + secondResult.failedCount,
  };

  await refreshSnapshot();
  return merged;
}
