import { NextRequest, NextResponse } from "next/server";
import { writeBoardSnapshot } from "@/lib/trae/api";
import { fetchTopic, parseTraeForumTopicUrl, TraeForumUrlError, upsertTopic, type CategoryTopicRef } from "@/lib/trae/scraper";

export const runtime = "nodejs";
export const maxDuration = 60;

type SubmitPhase = "idle" | "crawling" | "done" | "error";

interface SubmittedTopicStatus {
  running: boolean;
  phase: SubmitPhase;
  startedAt: string | null;
  finishedAt: string | null;
  submittedUrl: string | null;
  message: string;
  error: string | null;
  result: "created" | "updated" | "unchanged" | null;
  topic: {
    id: string;
    title: string;
    url: string;
    status: string;
  } | null;
}

interface SubmittedTopicState {
  status: SubmittedTopicStatus;
}

const globalState = globalThis as typeof globalThis & { __traeTopicSubmit?: SubmittedTopicState };

function initialStatus(): SubmittedTopicStatus {
  return {
    running: false,
    phase: "idle",
    startedAt: null,
    finishedAt: null,
    submittedUrl: null,
    message: "等待提交 TRAE 初赛帖链接。",
    error: null,
    result: null,
    topic: null
  };
}

function getState(): SubmittedTopicState {
  if (!globalState.__traeTopicSubmit) {
    globalState.__traeTopicSubmit = { status: initialStatus() };
  }
  return globalState.__traeTopicSubmit;
}

async function runSubmittedTopic(state: SubmittedTopicState, ref: CategoryTopicRef): Promise<void> {
  const set = (patch: Partial<SubmittedTopicStatus>) => {
    state.status = { ...state.status, ...patch };
  };

  try {
    set({ phase: "crawling", message: "正在抓取并校验【大赛初赛专区】帖子..." });
    const topic = await fetchTopic("preliminary", ref, { requirePreliminaryCategory: true });
    const result = await upsertTopic(topic);

    await writeBoardSnapshot().catch((error) => console.error("[trae] writeBoardSnapshot failed:", error));

    set({
      running: false,
      phase: "done",
      finishedAt: new Date().toISOString(),
      message: result === "created" ? "已抓取并加入待评分队列。" : result === "updated" ? "帖子内容已更新，等待评分。" : "这个帖子已经在队列里。",
      error: null,
      result,
      topic: {
        id: topic.id,
        title: topic.title,
        url: topic.url,
        status: topic.status
      }
    });
  } catch (error) {
    set({
      running: false,
      phase: "error",
      finishedAt: new Date().toISOString(),
      message: "提交失败，请检查链接是否为【大赛初赛专区】帖子。",
      error: error instanceof Error ? error.message : "提交失败，请稍后重试。",
      result: null,
      topic: null
    });
  }
}

export function GET(): NextResponse {
  return NextResponse.json(getState().status);
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = (await request.json().catch(() => ({}))) as { url?: unknown };
    if (typeof body.url !== "string") {
      throw new TraeForumUrlError("请输入 TRAE 论坛帖子链接。");
    }

    const ref = parseTraeForumTopicUrl(body.url);
    const state = getState();
    if (state.status.running) return NextResponse.json(state.status);

    state.status = {
      ...initialStatus(),
      running: true,
      phase: "crawling",
      startedAt: new Date().toISOString(),
      submittedUrl: ref.url,
      message: "已开始抓取 TRAE 初赛帖..."
    };

    void runSubmittedTopic(state, ref);

    return NextResponse.json(state.status);
  } catch (error) {
    if (error instanceof TraeForumUrlError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "提交失败，请稍后重试。" },
      { status: 500 }
    );
  }
}
