import { NextResponse } from "next/server";
import { getTopicDetail } from "@/lib/trae/api";
import { normalizeTopicRouteId } from "@/lib/trae/topic-route-id";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { id } = await context.params;
    const payload = await getTopicDetail(normalizeTopicRouteId(decodeURIComponent(id)));
    if (!payload) return NextResponse.json({ error: "Topic not found." }, { status: 404 });
    return NextResponse.json(payload);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load TRAE topic detail." },
      { status: 500 }
    );
  }
}
