import { NextRequest, NextResponse } from "next/server";
import { listRankedTopics } from "@/lib/trae/api";

export const runtime = "nodejs";

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const page = Number(searchParams.get("page") ?? "1");
    const pageSize = Number(searchParams.get("pageSize") ?? "12");
    const minConfidenceRaw = searchParams.get("minConfidence");
    const bypassCache = searchParams.get("bypassCache") === "true";
    const payload = await listRankedTopics({
      track: searchParams.get("track"),
      q: searchParams.get("q"),
      sort: searchParams.get("sort"),
      dir: searchParams.get("dir"),
      page: Number.isFinite(page) ? page : 1,
      pageSize: Number.isFinite(pageSize) ? pageSize : 12,
      minConfidence: minConfidenceRaw ? Number(minConfidenceRaw) : null,
      bypassCache
    });
    return NextResponse.json(payload);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load TRAE topics." },
      { status: 500 }
    );
  }
}
