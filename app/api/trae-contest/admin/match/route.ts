import { NextRequest, NextResponse } from "next/server";
import { extractBearerToken, isValidAdminToken } from "@/lib/trae/auth";
import { runTraeMatching } from "@/lib/trae/matcher";

export const runtime = "nodejs";

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!isValidAdminToken(extractBearerToken(request.headers))) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    return NextResponse.json({ ok: true, result: await runTraeMatching() });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Match failed." },
      { status: 500 }
    );
  }
}
