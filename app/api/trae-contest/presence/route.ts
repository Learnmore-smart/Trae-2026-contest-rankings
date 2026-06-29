import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { recordPresence } from "@/lib/trae/api";

export const runtime = "nodejs";

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = (await request.json().catch(() => ({}))) as { sessionId?: string };
    const sessionId = body.sessionId || randomUUID();
    const payload = await recordPresence(sessionId, request.headers.get("user-agent"));
    return NextResponse.json({ sessionId, ...payload });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update presence." },
      { status: 500 }
    );
  }
}
