import { setTimeout as sleep } from "node:timers/promises";
import { getModelSequence, getTraeConfig } from "./config.ts";
import { getFirestoreDb, nowIso, TRAE_COLLECTIONS } from "./firestore.ts";
import { finishRun, startRun } from "./runs.ts";
import {
  evaluationOutputSchema,
  type EvaluationOutput,
  type TraeEvaluation,
  type TraeMatch,
  type TraeTopic
} from "./types.ts";

export const PROMPT_VERSION = "trae-contest-2026-v1";
let openRouterRequestsThisProcess = 0;

export function parseEvaluationJson(raw: string): EvaluationOutput {
  const candidate = extractJsonCandidate(raw);
  const repaired = repairJson(candidate);
  return evaluationOutputSchema.parse(JSON.parse(repaired));
}

function extractJsonCandidate(raw: string): string {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) return fenced[1].trim();
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start >= 0 && end > start) return raw.slice(start, end + 1);
  return raw.trim();
}

function repairJson(raw: string): string {
  return raw
    .replace(/^\uFEFF/, "")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/,\s*([}\]])/g, "$1")
    .trim();
}

function summarizeMatch(match: TraeMatch | null): string {
  if (!match || !match.signupTopicId) {
    return "暂未匹配到报名帖，不代表未报名，可能是用户名或标题无法自动匹配。";
  }
  return [
    `matchedSignupId: ${match.signupTopicId}`,
    `matchConfidence: ${match.matchConfidence}`,
    `directionConsistencyScore: ${match.directionConsistencyScore ?? "unknown"}`,
    `mismatchRisk: ${match.mismatchRisk}`,
    `comment: ${match.directionConsistencyComment ?? ""}`
  ].join("\n");
}

function complianceHints(topic: TraeTopic, match: TraeMatch | null): string[] {
  const risks: string[] = [];
  if (!topic.demoUrl) risks.push("缺少 Demo 体验地址");
  if (!topic.traeEvidence?.hasTraeProcess) risks.push("没有清晰 TRAE 实践过程");
  if ((topic.traeEvidence?.screenshotCount ?? 0) < 3) risks.push("开发截图少于 3 张");
  if ((topic.traeEvidence?.sessionIdCount ?? 0) < 3) risks.push("Session ID 少于 3 个");
  if (!match?.signupTopicId) risks.push("暂未匹配到报名记录");
  if (match?.mismatchRisk === "medium" || match?.mismatchRisk === "high") risks.push("初赛作品与报名方向可能不一致");
  if (topic.contentText.length < 240) risks.push("帖子材料较少，评分置信度应降低");
  return risks;
}

export function buildJudgePrompt(topic: TraeTopic, match: TraeMatch | null): string {
  const isHardwareTrack = topic.track?.includes("硬件") || /硬件|设备|传感器|机器人/.test(topic.title);
  const designDimension = isHardwareTrack
    ? "美观度/设计体验 20 分：硬件交互赛道改看交互流畅、体验融合、软硬件反馈闭环。"
    : "美观度/设计体验 20 分：视觉美观、信息架构、交互体验、完成后的观摩价值。";

  return `你是 TRAE AI 创造力大赛第三方 AI 模拟评分员。本站不是官方评分，不预测官方结果。

请仅根据公开帖子内容评分。信息不足时不要给高分，要降低 confidenceScore，并在 weaknesses/complianceRisks 中说明。

评分维度：
- 创新性 30 分：创意新颖性、AI 使用方式、差异化。
- 实用性 30 分：真实需求、可用价值、用户场景、落地潜力。
- 完成度 20 分：是否有可体验 Demo、功能完整度、帖子材料充分度。
- ${designDimension}

合规/材料风险只作为评分解释参考，不做单独审核页面。重点识别：缺 Demo、缺 TRAE 实践过程、缺 3 张开发截图、缺 3 个 Session ID、作品与报名方向不一致、只有概念没有 Demo、赛道/标题/标签不一致、材料不足导致置信度降低。

报名匹配信息：
${summarizeMatch(match)}

已检测风险：
${complianceHints(topic, match)
  .map((risk) => `- ${risk}`)
  .join("\n")}

帖子：
标题：${topic.title}
作者：${topic.authorName}
赛道：${topic.track ?? "未知"}
标签：${topic.tags.join(", ") || "无"}
Demo：${topic.demoUrl ?? "未检测到"}
图片数量：${topic.imageUrls.length}
Session IDs：${topic.sessionIds.join(", ") || "未检测到"}
正文：
${topic.contentText.slice(0, 12000)}

只返回严格 JSON，不要 Markdown，不要解释 JSON 外内容。字段必须完整：
{
  "totalScore": 0-100,
  "innovationScore": 0-30,
  "practicalityScore": 0-30,
  "completionScore": 0-20,
  "designScore": 0-20,
  "complianceRiskScore": 0-10,
  "directionConsistencyScore": 0-10 或 null,
  "confidenceScore": 0-100,
  "competitionLevel": "极具竞争力" | "有竞争力" | "竞争力一般" | "较弱",
  "summary": "一句话总结",
  "strengths": ["..."],
  "weaknesses": ["..."],
  "suggestions": ["..."],
  "complianceRisks": ["..."],
  "dimensionComments": {
    "innovation": "...",
    "practicality": "...",
    "completion": "...",
    "design": "..."
  },
  "matchComment": "..." 或 null
}`;
}

async function callOpenRouter(model: string, prompt: string, attempt: number): Promise<string> {
  const config = getTraeConfig();
  if (!config.openRouterApiKey) throw new Error("OPENROUTER_API_KEY is not configured.");
  if (config.openRouterDailyCap > 0 && openRouterRequestsThisProcess >= config.openRouterDailyCap) {
    throw new Error("TRAE_OPENROUTER_DAILY_CAP reached for this process.");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60_000);
  try {
    openRouterRequestsThisProcess += 1;
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${config.openRouterApiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": config.openRouterSiteUrl,
        "X-Title": config.openRouterAppName
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "system",
            content: "You return strict JSON only. Do not include Markdown fences or comments."
          },
          { role: "user", content: prompt }
        ],
        temperature: 0.2,
        response_format: { type: "json_object" }
      })
    });

    const text = await response.text();
    if (!response.ok) {
      if ([429, 500, 502, 503, 504].includes(response.status)) {
        await sleep(Math.min(30_000, 1000 * 2 ** attempt));
      }
      throw new Error(`OpenRouter ${response.status}: ${text.slice(0, 500)}`);
    }

    const json = JSON.parse(text) as { choices?: Array<{ message?: { content?: string } }> };
    const content = json.choices?.[0]?.message?.content;
    if (!content) throw new Error("OpenRouter response did not include message content.");
    return content;
  } finally {
    clearTimeout(timeout);
  }
}

async function judgeOneTopic(topic: TraeTopic, match: TraeMatch | null): Promise<TraeEvaluation> {
  const config = getTraeConfig();
  const prompt = buildJudgePrompt(topic, match);
  let lastError: string | null = null;

  for (const [index, model] of getModelSequence(config).entries()) {
    try {
      const rawModelResponse = await callOpenRouter(model, prompt, index);
      const parsed = parseEvaluationJson(rawModelResponse);
      const createdAt = nowIso();
      return {
        id: `${topic.id}_${Date.now()}`,
        topicId: topic.id,
        sourceType: "preliminary",
        model,
        promptVersion: PROMPT_VERSION,
        ...parsed,
        rawModelResponse,
        error: null,
        createdAt
      };
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      await sleep(Math.min(20_000, 800 * 2 ** index));
    }
  }

  throw new Error(lastError ?? "All OpenRouter models failed.");
}

export interface JudgeOptions {
  mode?: "unjudged" | "changed" | "low-confidence";
  max?: number;
}

export async function judgeChangedTraeTopics(options: JudgeOptions = {}): Promise<{ evaluatedCount: number; failedCount: number }> {
  const config = getTraeConfig();
  const max = options.max ?? config.maxJudgePerRun;
  const mode = options.mode ?? "unjudged";
  const run = await startRun("judge", "preliminary");
  const db = getFirestoreDb();
  let evaluatedCount = 0;
  let failedCount = 0;

  try {
    const [topicSnapshot, evaluationSnapshot, matchSnapshot] = await Promise.all([
      db.collection(TRAE_COLLECTIONS.topics).where("sourceType", "==", "preliminary").get(),
      db.collection(TRAE_COLLECTIONS.evaluations).where("sourceType", "==", "preliminary").get(),
      db.collection(TRAE_COLLECTIONS.matches).get()
    ]);

    const latestEvaluations = new Map<string, TraeEvaluation>();
    for (const doc of evaluationSnapshot.docs) {
      const evaluation = doc.data() as TraeEvaluation;
      const existing = latestEvaluations.get(evaluation.topicId);
      if (!existing || evaluation.createdAt > existing.createdAt) latestEvaluations.set(evaluation.topicId, evaluation);
    }
    const matches = new Map(matchSnapshot.docs.map((doc) => [doc.id, doc.data() as TraeMatch]));

    const topics = topicSnapshot.docs
      .map((doc) => doc.data() as TraeTopic)
      .filter((topic) => {
        const latest = latestEvaluations.get(topic.id);
        if (mode === "low-confidence") return Boolean(latest && latest.confidenceScore < 55);
        if (mode === "changed") return topic.status === "needs_judging" || topic.status === "judge_error";
        return topic.status === "needs_judging" || topic.status === "judge_error" || !latest;
      })
      .slice(0, max);

    for (const topic of topics) {
      const delayMs = Math.ceil(60_000 / Math.max(1, config.openRouterRpm));
      if (evaluatedCount + failedCount > 0) await sleep(delayMs);
      try {
        const evaluation = await judgeOneTopic(topic, matches.get(topic.id) ?? null);
        await db.collection(TRAE_COLLECTIONS.evaluations).doc(evaluation.id).set(evaluation);
        await db.collection(TRAE_COLLECTIONS.topics).doc(topic.id).set(
          {
            status: "judged",
            updatedAt: nowIso()
          },
          { merge: true }
        );
        evaluatedCount += 1;
      } catch (error) {
        failedCount += 1;
        await db.collection(TRAE_COLLECTIONS.topics).doc(topic.id).set(
          {
            status: "judge_error",
            updatedAt: nowIso()
          },
          { merge: true }
        );
        const errorText = error instanceof Error ? error.message : String(error);
        const failedEvaluation: TraeEvaluation = {
          id: `${topic.id}_${Date.now()}_error`,
          topicId: topic.id,
          sourceType: "preliminary",
          model: getModelSequence(config)[0] ?? "unknown",
          promptVersion: PROMPT_VERSION,
          totalScore: 0,
          innovationScore: 0,
          practicalityScore: 0,
          completionScore: 0,
          designScore: 0,
          complianceRiskScore: 10,
          directionConsistencyScore: null,
          confidenceScore: 0,
          competitionLevel: "较弱",
          summary: "评分失败，等待重试。",
          strengths: [],
          weaknesses: ["模型调用或 JSON 校验失败"],
          suggestions: ["稍后重试评分"],
          complianceRisks: [],
          dimensionComments: {
            innovation: "未评分",
            practicality: "未评分",
            completion: "未评分",
            design: "未评分"
          },
          matchComment: null,
          rawModelResponse: "",
          error: errorText,
          createdAt: nowIso()
        };
        await db.collection(TRAE_COLLECTIONS.evaluations).doc(failedEvaluation.id).set(failedEvaluation);
      }
    }

    await finishRun(run.id, {
      status: failedCount > 0 ? "partial" : "success",
      evaluatedCount,
      failedCount,
      logs: [`Evaluated ${evaluatedCount} topics; ${failedCount} failures.`]
    });
    return { evaluatedCount, failedCount };
  } catch (error) {
    await finishRun(run.id, {
      status: "error",
      error: error instanceof Error ? error.message : String(error),
      evaluatedCount,
      failedCount
    });
    throw error;
  }
}
