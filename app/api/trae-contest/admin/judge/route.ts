import { NextRequest, NextResponse } from "next/server";
import { extractBearerToken, isValidAdminToken } from "@/lib/trae/auth";
import { judgeChangedTraeTopics, type JudgeOptions } from "@/lib/trae/judge";

export const runtime = "nodejs";

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!isValidAdminToken(extractBearerToken(request.headers))) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const body = (await request.json().catch(() => ({}))) as JudgeOptions;
    const mode = body.mode === "changed" || body.mode === "low-confidence" ? body.mode : "unjudged";
    return NextResponse.json({
      ok: true,
      result: await judgeChangedTraeTopics({ mode, max: body.max })
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Judge failed." },
      { status: 500 }
    );
  }
}
