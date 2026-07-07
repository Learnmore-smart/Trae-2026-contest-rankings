import { NextRequest, NextResponse } from "next/server";
import { extractBearerToken, isValidCronSecret } from "@/lib/trae/auth";
import { listRuns, writeBoardSnapshot } from "@/lib/trae/api";
import { judgeChangedTraeTopics } from "@/lib/trae/judge";
import { runTraeMatching } from "@/lib/trae/matcher";
import { scrapeAllTraeSources, scrapeTraeSource } from "@/lib/trae/scraper";

export const runtime = "nodejs";
// Cron is invoked by Cloud Scheduler directly on Cloud Run (not Vercel), so the Vercel
// maxDuration is advisory only. Cloud Run default timeout is 300s; 80 topics × 5 LLM calls
// at 16 concurrency finishes well within that.
export const maxDuration = 300;

const CRON_JUDGE_MAX = 80;

async function hasRecentRunningJudgeRun(): Promise<boolean> {
  try {
    const runs = await listRuns(5);
    const tenMinAgo = Date.now() - 10 * 60 * 1000;
    return runs.some(
      (run) =>
        run.type === "judge" &&
        run.status === "running" &&
        Date.parse(run.startedAt) > tenMinAgo
    );
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
    const result = await runTraeMatching();
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
    await scrapeAllTraeSources();
    await runTraeMatching();
    if (await hasRecentRunningJudgeRun()) {
      await refreshSnapshot();
      return NextResponse.json({ ok: true, skipped: "judge_already_running" });
    }
    const result = await judgeChangedTraeTopics({ mode: "changed", max: CRON_JUDGE_MAX });
    await refreshSnapshot();
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
