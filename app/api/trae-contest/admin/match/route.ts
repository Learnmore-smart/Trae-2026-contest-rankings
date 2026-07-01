import { NextRequest, NextResponse } from "next/server";
import { extractBearerToken, isValidAdminToken } from "@/lib/trae/auth";
import { writeBoardSnapshot } from "@/lib/trae/api";
import { runTraeMatching } from "@/lib/trae/matcher";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!isValidAdminToken(extractBearerToken(request.headers))) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const result = await runTraeMatching();
    await writeBoardSnapshot().catch((error) => console.error("[trae] writeBoardSnapshot failed:", error));
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Match failed." },
      { status: 500 }
    );
  }
}
