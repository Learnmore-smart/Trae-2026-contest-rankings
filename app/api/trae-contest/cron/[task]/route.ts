import { NextRequest, NextResponse } from "next/server";
import { extractBearerToken, isValidCronSecret } from "@/lib/trae/auth";
import { listRuns, writeBoardSnapshot } from "@/lib/trae/api";
import { judgeChangedTraeTopics } from "@/lib/trae/judge";
import { runTraeMatching } from "@/lib/trae/matcher";
import { isFreshRunningRun, reclaimStaleRunningRuns } from "@/lib/trae/runs";
import { scrapeTraeSource } from "@/lib/trae/scraper";
import { runFullPipeline } from "@/lib/trae/pipeline";

export const runtime = "nodejs";
// Cron is invoked by Cloud Scheduler directly on Cloud Run (not Vercel), so the Vercel
// maxDuration is advisory only. Cloud Run service timeout must be set to >= 900s to match
// (gcloud run services update trae-contest-2026 --timeout=900). Cloud Scheduler's
// attemptDeadline is 900s. 500 topics × ~7 LLM calls at concurrency 16 fits comfortably.
export const maxDuration = 900;

const CRON_JUDGE_MAX = 500;

async function hasRecentRunningJudgeRun(): Promise<boolean> {
  try {
    const runs = await listRuns(20);
    // Forever-RUNNING rows from killed batches must not block new scoring forever.
    await reclaimStaleRunningRuns(runs);
    const freshRuns = await listRuns(20);
    return freshRuns.some((run) => run.type === "judge" && isFreshRunningRun(run));
  } catch {
    return false;
  }
}

// After any task that mutates board data, refresh the snapshot doc so public reads stay at
// 1 doc/read instead of re-scanning 5 collections on the next board load. Best-effort: a
// snapshot failure must not fail the pipeline itself.
async function refreshSnapshot(): Promise<void> {
  try {
    await writeBoardSnapshot();
  } catch (error) {
    console.error("[trae] writeBoardSnapshot failed:", error);
  }
}

async function runCronTask(task: string): Promise<NextResponse> {
  if (task === "scrape-signup") {
    const result = await scrapeTraeSource("signup");
    await refreshSnapshot();
    return NextResponse.json({ ok: true, result });
  }
  if (task === "scrape-preliminary") {
    const result = await scrapeTraeSource("preliminary");
    await refreshSnapshot();
    return NextResponse.json({ ok: true, result });
  }
  if (task === "match") {
    // Standalone match task also runs under Cloud Run's 900s timeout. Use a generous
    // 780s deadline (leaving ~120s for snapshot + response) so unlimited forum lookups
    // don't create another zombie RUNNING row.
    const result = await runTraeMatching(780_000);
    await refreshSnapshot();
    return NextResponse.json({ ok: true, result });
  }
  if (task === "judge") {
    if (await hasRecentRunningJudgeRun()) {
      return NextResponse.json({ ok: true, skipped: "judge_already_running" });
    }
    const result = await judgeChangedTraeTopics({ mode: "changed", max: CRON_JUDGE_MAX });
    await refreshSnapshot();
    return NextResponse.json({ ok: true, result });
  }
  if (task === "run-all") {
    if (await hasRecentRunningJudgeRun()) {
      await refreshSnapshot();
      return NextResponse.json({ ok: true, skipped: "judge_already_running" });
    }
    const result = await runFullPipeline(CRON_JUDGE_MAX);
    return NextResponse.json({ ok: true, result });
  }
  return NextResponse.json({ error: "Unknown cron task." }, { status: 404 });
}

async function handleCronRequest(request: NextRequest, task: string): Promise<NextResponse> {
  const urlToken = new URL(request.url).searchParams.get("secret");
  if (!isValidCronSecret(extractBearerToken(request.headers) ?? urlToken)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    return await runCronTask(task);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Cron task failed." },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ task: string }> }
): Promise<NextResponse> {
  const { task } = await context.params;
  return handleCronRequest(request, task);
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ task: string }> }
): Promise<NextResponse> {
  const { task } = await context.params;
  return handleCronRequest(request, task);
}
