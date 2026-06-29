import { NextResponse } from "next/server";
import { getTraeStats } from "@/lib/trae/api";

export const runtime = "nodejs";

export async function GET(): Promise<NextResponse> {
  try {
    return NextResponse.json(await getTraeStats());
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load TRAE stats." },
      { status: 500 }
    );
  }
}
