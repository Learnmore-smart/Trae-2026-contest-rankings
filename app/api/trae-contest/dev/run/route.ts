import { NextRequest, NextResponse } from "next/server";
import { writeBoardSnapshot } from "@/lib/trae/api";
import { judgeChangedTraeTopics } from "@/lib/trae/judge";
import { runTraeMatching } from "@/lib/trae/matcher";
import { scrapeAllTraeSources, scrapeTraeSource } from "@/lib/trae/scraper";

export const runtime = "nodejs";

type DevTask = "scrape-signup" | "scrape-preliminary" | "match" | "judge" | "run-all";

function isLocalRequest(request: NextRequest): boolean {
  const localHosts = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);
  const isLocalHostValue = (value: string | null | undefined): boolean => {
    const host = value?.split(":")[0]?.replace(/^\[|\]$/g, "").toLowerCase();
    return Boolean(host && localHosts.has(host));
  };
  const host = request.headers.get("host")?.split(":")[0]?.toLowerCase();
  const forwardedHost = request.headers.get("x-forwarded-host");
  // The Next.js dev server forwards a loopback x-forwarded-for (e.g. ::1) even on
  // localhost, so we only reject when the forwarded values are non-loopback hops.
  const forwardedFor = request.headers
    .get("x-forwarded-for")
    ?.split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  return Boolean(
    host &&
      localHosts.has(host) &&
      (!forwardedHost || isLocalHostValue(forwardedHost)) &&
      (!forwardedFor || forwardedFor.every((value) => isLocalHostValue(value)))
  );
}

async function runTask(task: DevTask) {
  if (task === "scrape-signup") return scrapeTraeSource("signup");
  if (task === "scrape-preliminary") return scrapeTraeSource("preliminary");
  if (task === "match") return runTraeMatching();
  if (task === "judge") return judgeChangedTraeTopics({ mode: "unjudged" });
  await scrapeAllTraeSources();
  await runTraeMatching();
  return judgeChangedTraeTopics({ mode: "unjudged" });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!isLocalRequest(request)) {
    return NextResponse.json({ error: "/dev is only available from localhost." }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as { task?: DevTask };
  const task = body.task;
  if (!task || !["scrape-signup", "scrape-preliminary", "match", "judge", "run-all"].includes(task)) {
    return NextResponse.json({ error: "Unknown dev task." }, { status: 400 });
  }

  try {
    const result = await runTask(task);
    await writeBoardSnapshot().catch((error) => console.error("[trae] writeBoardSnapshot failed:", error));
    return NextResponse.json({ ok: true, task, result });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Dev task failed." },
      { status: 500 }
    );
  }
}
