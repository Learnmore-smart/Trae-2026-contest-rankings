import { NextRequest, NextResponse } from "next/server";
import { extractBearerToken, isValidAdminToken } from "@/lib/trae/auth";
import { writeBoardSnapshot } from "@/lib/trae/api";
import { scrapeAllTraeSources, scrapeTraeSource } from "@/lib/trae/scraper";
import type { TraeSourceType } from "@/lib/trae/types";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!isValidAdminToken(extractBearerToken(request.headers))) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const body = (await request.json().catch(() => ({}))) as { sourceType?: TraeSourceType | "all" };
    if (body.sourceType === "all") {
      await scrapeAllTraeSources();
      await writeBoardSnapshot().catch((error) => console.error("[trae] writeBoardSnapshot failed:", error));
      return NextResponse.json({ ok: true, sourceType: "all" });
    }
    const sourceType = body.sourceType === "signup" ? "signup" : "preliminary";
    const result = await scrapeTraeSource(sourceType);
    await writeBoardSnapshot().catch((error) => console.error("[trae] writeBoardSnapshot failed:", error));
    return NextResponse.json({ ok: true, sourceType, result });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Scrape failed." },
      { status: 500 }
    );
  }
}
