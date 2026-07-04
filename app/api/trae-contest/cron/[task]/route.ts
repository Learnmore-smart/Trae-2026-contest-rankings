import { NextRequest, NextResponse } from "next/server";
import { extractBearerToken, isValidCronSecret } from "@/lib/trae/auth";
import { writeBoardSnapshot } from "@/lib/trae/api";
import { judgeChangedTraeTopics } from "@/lib/trae/judge";
import { runTraeMatching } from "@/lib/trae/matcher";
import { scrapeAllTraeSources, scrapeTraeSource } from "@/lib/trae/scraper";

export const runtime = "nodejs";
// Scraping is rate-limited (800ms/host) so a chunked run still needs headroom beyond the
// default serverless timeout. 60s is valid on all Vercel plans; raise to 300 on Pro and
// tune TRAE_MAX_TOPIC_DETAILS_PER_RUN so one cron tick fits within it.
export const maxDuration = 60;

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
    const result = await judgeChangedTraeTopics({ mode: "changed" });
    await refreshSnapshot();
    return NextResponse.json({ ok: true, result });
  }
  if (task === "run-all") {
    await scrapeAllTraeSources();
    await runTraeMatching();
    const result = await judgeChangedTraeTopics({ mode: "changed" });
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
