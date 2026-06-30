import { setTimeout as sleep } from "node:timers/promises";
import { createHash } from "node:crypto";
import { getTraeConfig } from "./config.ts";
import { getDataConnectDb, nowIso } from "./dataconnect.ts";
import { callLLMWithFallback, LLMFallbackError } from "./llm.ts";
import { finishRun, startRun } from "./runs.ts";
import {
  getBoardData,
  upsertEvaluation,
  updateTopicEvaluationState,
  upsertModelTokenUsage,
  type UpsertEvaluationVariables
} from "@trae-contest/dataconnect-generated";
import {
  evaluationOutputSchema,
  type EvaluationOutput,
  type TraeEvaluation,
  type TraeLLMCallLog,
  type TraeMatch,
  type TraeTopic
} from "./types.ts";

export const PROMPT_VERSION = "trae-contest-2026-v1";

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

const JUDGE_SYSTEM_PROMPT = "You return strict JSON only. Do not include Markdown fences or comments.";

/** Tokens from the call that actually succeeded (errorReason === null), or the last attempt. */
function tokensFromLogs(callLogs: TraeLLMCallLog[]): { inputTokens: number; outputTokens: number } {
  const winner = [...callLogs].reverse().find((log) => log.errorReason === null) ?? callLogs.at(-1);
  return {
    inputTokens: winner?.inputTokens ?? 0,
    outputTokens: winner?.outputTokens ?? 0
  };
}

export async function judgeOneTopic(topic: TraeTopic, match: TraeMatch | null): Promise<TraeEvaluation> {
  const config = getTraeConfig();
  const prompt = buildJudgePrompt(topic, match);
  const result = await callLLMWithFallback({
    config,
    messages: [
      { role: "system", content: JUDGE_SYSTEM_PROMPT },
      { role: "user", content: prompt }
    ],
    validateContent: parseEvaluationJson
  });
  const createdAt = nowIso();
  const { inputTokens, outputTokens } = tokensFromLogs(result.callLogs);
  return {
    id: `${topic.id}_${Date.now()}`,
    topicId: topic.id,
    sourceType: "preliminary",
    provider: result.provider,
    model: result.model,
    promptVersion: PROMPT_VERSION,
    ...result.parsed,
    promptText: prompt,
    systemPrompt: JUDGE_SYSTEM_PROMPT,
    inputTokens,
    outputTokens,
    rawModelResponse: result.content,
    llmCallLogs: result.callLogs,
    error: null,
    createdAt
  };
}

const providerMap = {
  nvidia: "NVIDIA",
  openrouter: "OPENROUTER"
} as const;

const providerRevMap = {
  "NVIDIA": "nvidia",
  "OPENROUTER": "openrouter"
} as const;

const competitionLevelMap = {
  "极具竞争力": "HIGHLY_COMPETITIVE",
  "有竞争力": "COMPETITIVE",
  "竞争力一般": "AVERAGE",
  "较弱": "WEAK"
} as const;

const competitionLevelRevMap = {
  "HIGHLY_COMPETITIVE": "极具竞争力",
  "COMPETITIVE": "有竞争力",
  "AVERAGE": "竞争力一般",
  "WEAK": "较弱"
} as const;

function toUpsertEvaluationVariables(evaluation: TraeEvaluation): UpsertEvaluationVariables {
  return {
    id: evaluation.id,
    topicId: evaluation.topicId,
    sourceType: evaluation.sourceType,
    provider: evaluation.provider ? (providerMap[evaluation.provider] as UpsertEvaluationVariables["provider"]) : null,
    model: evaluation.model,
    promptVersion: evaluation.promptVersion,
    totalScore: evaluation.totalScore,
    innovationScore: evaluation.innovationScore,
    practicalityScore: evaluation.practicalityScore,
    completionScore: evaluation.completionScore,
    designScore: evaluation.designScore,
    complianceRiskScore: evaluation.complianceRiskScore,
    directionConsistencyScore: evaluation.directionConsistencyScore ?? null,
    confidenceScore: evaluation.confidenceScore,
    competitionLevel: competitionLevelMap[evaluation.competitionLevel] as UpsertEvaluationVariables["competitionLevel"],
    summary: evaluation.summary,
    strengths: evaluation.strengths ?? [],
    weaknesses: evaluation.weaknesses ?? [],
    suggestions: evaluation.suggestions ?? [],
    complianceRisks: evaluation.complianceRisks ?? [],
    dimensionComments: evaluation.dimensionComments ?? null,
    matchComment: evaluation.matchComment ?? null,
    promptText: null,
    systemPrompt: null,
    inputTokens: evaluation.inputTokens ?? null,
    outputTokens: evaluation.outputTokens ?? null,
    rawModelResponse: evaluation.rawModelResponse,
    llmCallLogs: evaluation.llmCallLogs ?? [],
    error: evaluation.error ?? null
  };
}

async function recordTokenUsage(callLogs: TraeLLMCallLog[]): Promise<void> {
  const dc = getDataConnectDb();
  const totals = new Map<string, { provider: TraeLLMCallLog["provider"]; model: string; input: number; output: number }>();
  for (const log of callLogs) {
    const input = log.inputTokens ?? 0;
    const output = log.outputTokens ?? 0;
    if (input <= 0 && output <= 0) continue;
    const key = `${log.provider}:${log.model}`;
    const existing = totals.get(key);
    if (existing) {
      existing.input += input;
      existing.output += output;
    } else {
      totals.set(key, {
        provider: log.provider,
        model: log.model,
        input,
        output
      });
    }
  }

  if (!totals.size) return;
  for (const [key, usage] of totals) {
    const id = `usage_${Date.now()}_${createHash("sha256").update(key).digest("hex").slice(0, 10)}`;
    await upsertModelTokenUsage(dc as any, {
      id,
      provider: providerMap[usage.provider],
      model: usage.model,
      input: usage.input,
      output: usage.output
    } as any);
  }
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
  const dc = getDataConnectDb();
  let evaluatedCount = 0;
  let failedCount = 0;

  try {
    const boardRes = await getBoardData(dc as any);
    const rawTopics = boardRes.data.topics ?? [];

    const mapped = rawTopics.map((t) => {
      const latestEval = t.evaluations_on_topic?.[0];
      const match = t.match_on_preliminaryTopic;

      const mappedTopic: TraeTopic = {
        ...t,
        sourceType: t.sourceType.toLowerCase() as any,
        status: t.status.toLowerCase() as any,
        competitionLevel: t.competitionLevel ? competitionLevelRevMap[t.competitionLevel] : null,
        evaluatedAt: t.evaluatedAt ?? null,
        createdAtExternal: t.createdAtExternal ?? null,
        lastActivityAtExternal: t.lastActivityAtExternal ?? null
      } as any;

      const mappedEval: TraeEvaluation | undefined = latestEval ? {
        ...latestEval,
        provider: latestEval.provider ? providerRevMap[latestEval.provider] : null,
        competitionLevel: competitionLevelRevMap[latestEval.competitionLevel]
      } as any : undefined;

      const mappedMatch: TraeMatch | null = match ? {
        ...match,
        matchMethod: match.matchMethod.toLowerCase() as any,
        mismatchRisk: match.mismatchRisk.toLowerCase() as any
      } as any : null;

      return {
        topic: mappedTopic,
        latestEvaluation: mappedEval,
        match: mappedMatch
      };
    });

    const topics = mapped
      .filter(({ topic, latestEvaluation }) => {
        if (mode === "low-confidence") return Boolean(latestEvaluation && latestEvaluation.confidenceScore < 55);
        if (mode === "changed") return topic.status === "needs_judging" || topic.status === "judge_error";
        return topic.status === "needs_judging" || topic.status === "judge_error" || !latestEvaluation;
      })
      .slice(0, max);

    for (const topicObj of topics) {
      const delayMs = Math.ceil(60_000 / Math.max(1, config.aiRpmLimit));
      if (evaluatedCount + failedCount > 0) await sleep(delayMs);
      try {
        const evaluation = await judgeOneTopic(topicObj.topic, topicObj.match);
        await recordTokenUsage(evaluation.llmCallLogs ?? []);

        await upsertEvaluation(dc as any, toUpsertEvaluationVariables(evaluation));

        await updateTopicEvaluationState(dc as any, {
          id: topicObj.topic.id,
          status: "JUDGED",
          totalScore: evaluation.totalScore,
          innovationScore: evaluation.innovationScore,
          practicalityScore: evaluation.practicalityScore,
          completionScore: evaluation.completionScore,
          designScore: evaluation.designScore,
          complianceRiskScore: evaluation.complianceRiskScore,
          directionConsistencyScore: evaluation.directionConsistencyScore ?? null,
          confidenceScore: evaluation.confidenceScore,
          competitionLevel: competitionLevelMap[evaluation.competitionLevel]
        } as any);

        evaluatedCount += 1;
      } catch (error) {
        failedCount += 1;
        const errorText = error instanceof Error ? error.message : String(error);
        const llmCallLogs = error instanceof LLMFallbackError ? error.callLogs : [];
        const lastCallLog = llmCallLogs.at(-1);
        const failedPrompt = buildJudgePrompt(topicObj.topic, topicObj.match);
        const failedTokens = tokensFromLogs(llmCallLogs);

        await updateTopicEvaluationState(dc as any, {
          id: topicObj.topic.id,
          status: "JUDGE_ERROR",
          totalScore: -1,
          innovationScore: -1,
          practicalityScore: -1,
          completionScore: -1,
          designScore: -1,
          complianceRiskScore: -1,
          directionConsistencyScore: null,
          confidenceScore: -1,
          competitionLevel: null
        } as any);

        const failedEvaluation: TraeEvaluation = {
          id: `${topicObj.topic.id}_${Date.now()}_error`,
          topicId: topicObj.topic.id,
          sourceType: "preliminary",
          provider: lastCallLog?.provider ?? null,
          model: lastCallLog?.model ?? "unknown",
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
          promptText: failedPrompt,
          systemPrompt: JUDGE_SYSTEM_PROMPT,
          inputTokens: failedTokens.inputTokens,
          outputTokens: failedTokens.outputTokens,
          rawModelResponse: lastCallLog?.rawResponse ?? "",
          llmCallLogs,
          error: errorText,
          createdAt: nowIso()
        };

        await recordTokenUsage(llmCallLogs);

        const failedEvaluationInput = toUpsertEvaluationVariables(failedEvaluation);
        await upsertEvaluation(dc as any, {
          ...failedEvaluationInput,
          provider: failedEvaluation.provider ? providerMap[failedEvaluation.provider] : null,
          competitionLevel: competitionLevelMap[failedEvaluation.competitionLevel],
          strengths: [],
          weaknesses: ["模型调用或 JSON 校验失败"],
          suggestions: ["稍后重试评分"],
          complianceRisks: [],
          llmCallLogs,
          dimensionComments: failedEvaluation.dimensionComments,
          promptText: failedPrompt,
          systemPrompt: JUDGE_SYSTEM_PROMPT,
          inputTokens: failedTokens.inputTokens,
          outputTokens: failedTokens.outputTokens,
          matchComment: null,
          error: errorText
        } as any);
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
