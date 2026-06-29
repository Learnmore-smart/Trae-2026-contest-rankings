import { NextRequest, NextResponse } from "next/server";
import { extractBearerToken, isValidCronSecret } from "@/lib/trae/auth";
import { judgeChangedTraeTopics } from "@/lib/trae/judge";
import { runTraeMatching } from "@/lib/trae/matcher";
import { scrapeAllTraeSources, scrapeTraeSource } from "@/lib/trae/scraper";

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ task: string }> }
): Promise<NextResponse> {
  if (!isValidCronSecret(extractBearerToken(request.headers))) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { task } = await context.params;
  try {
    if (task === "scrape-signup") return NextResponse.json({ ok: true, result: await scrapeTraeSource("signup") });
    if (task === "scrape-preliminary") return NextResponse.json({ ok: true, result: await scrapeTraeSource("preliminary") });
    if (task === "match") return NextResponse.json({ ok: true, result: await runTraeMatching() });
    if (task === "judge") return NextResponse.json({ ok: true, result: await judgeChangedTraeTopics({ mode: "unjudged" }) });
    if (task === "run-all") {
      await scrapeAllTraeSources();
      await runTraeMatching();
      const result = await judgeChangedTraeTopics({ mode: "unjudged" });
      return NextResponse.json({ ok: true, result });
    }
    return NextResponse.json({ error: "Unknown cron task." }, { status: 404 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Cron task failed." },
      { status: 500 }
    );
  }
}
