import { createHash } from "node:crypto";
import { getTraeConfig } from "./config.ts";
import { getDataConnectDb, isMissingDataConnectOperationError, nowIso } from "./dataconnect.ts";
import { callLLMWithFallback, LLMFallbackError } from "./llm.ts";
import { finishRun, startRun } from "./runs.ts";
import { gatherVisualEvidence, type TopicVisualEvidence } from "./vision.ts";
import { dedupeByTopicTitle } from "./dedupe.ts";
import { isDeletedOrEmptyTopic } from "./extractors.ts";
import {
  getBoardData as getBoardDataQuery,
  getBoardPage as getBoardPageQuery,
  upsertEvaluation,
  updateTopicEvaluationState,
  upsertModelTokenUsage,
  type GetBoardPageData,
  type UpsertEvaluationVariables
} from "@trae-contest/dataconnect-generated";
import {
  evaluationOutputSchema,
  type EvaluationOutput,
  type TraeAIProvider,
  type TraeEvaluation,
  type TraeLLMCallLog,
  type TraeMatch,
  type TraeTopic
} from "./types.ts";

export const PROMPT_VERSION = "trae-contest-2026-v5-demo-audit-standards";
const JUDGE_BOARD_PAGE_SIZE = 1000;

export type JudgeEvaluatorId = "product" | "technical" | "ux" | "risk";

export interface JudgeEvaluatorProfile {
  id: JudgeEvaluatorId;
  label: string;
  focus: string;
}

export interface JudgeEvaluatorConsensusInput {
  profile: JudgeEvaluatorProfile;
  output: EvaluationOutput;
  rawContent: string;
}

interface JudgeEvaluatorRun extends JudgeEvaluatorConsensusInput {
  provider: TraeAIProvider;
  model: string;
  prompt: string;
  callLogs: TraeLLMCallLog[];
}

const JUDGE_EVALUATOR_PROFILES: readonly JudgeEvaluatorProfile[] = [
  {
    id: "product",
    label: "Product value evaluator",
    focus: "Judge real user value, problem clarity, market/use-case fit, and whether the work is more than a thin static page."
  },
  {
    id: "technical",
    label: "Technical completion evaluator",
    focus: "Judge implementation completeness, functional depth, TRAE process evidence, demo availability, and engineering credibility."
  },
  {
    id: "ux",
    label: "UX and design evaluator",
    focus: "Judge visual hierarchy, interaction quality, usability, polish, and whether the submitted experience is actually inspectable."
  },
  {
    id: "risk",
    label: "Evidence and compliance evaluator",
    focus: "Judge missing evidence, signup-direction mismatch, missing session IDs/screenshots, unsupported claims, and confidence penalties."
  }
];

const DEMO_DOWNLOAD_EXTENSIONS = [".zip", ".rar", ".7z", ".tar", ".gz", ".tgz", ".apk", ".ipa", ".exe", ".dmg", ".msi", ".pkg", ".deb", ".rpm"];

export function getJudgeEvaluatorProfiles(): JudgeEvaluatorProfile[] {
  return JUDGE_EVALUATOR_PROFILES.map((profile) => ({ ...profile }));
}

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

function getDetectedDemoUrls(topic: TraeTopic): string[] {
  const storedUrls = Array.isArray(topic.traeEvidence?.detectedDemoUrls)
    ? topic.traeEvidence.detectedDemoUrls.filter((url): url is string => typeof url === "string" && url.length > 0)
    : [];
  return Array.from(new Set([topic.demoUrl, ...storedUrls].filter((url): url is string => Boolean(url))));
}

function isDownloadDemoUrl(url: string): boolean {
  try {
    const pathname = new URL(url).pathname.toLowerCase();
    return DEMO_DOWNLOAD_EXTENSIONS.some((extension) => pathname.endsWith(extension));
  } catch {
    return false;
  }
}

function hasVisualDemoCue(topic: TraeTopic): boolean {
  const haystack = `${topic.title} ${topic.contentText} ${topic.tags.join(" ")}`;
  return /二维码|扫码|小程序|微信|体验码|QR\s*code|qrcode|wechat|mini\s*program|miniprogram|scan\s*(qr|code)/i.test(haystack);
}

function getDownloadDemoUrls(topic: TraeTopic): string[] {
  const storedUrls = Array.isArray(topic.traeEvidence?.downloadDemoUrls)
    ? topic.traeEvidence.downloadDemoUrls.filter((url): url is string => typeof url === "string" && url.length > 0)
    : [];
  const inferredUrls = topic.attachmentUrls.filter(isDownloadDemoUrl);
  return Array.from(new Set([...storedUrls, ...inferredUrls]));
}

function getVisualDemoImageUrls(topic: TraeTopic): string[] {
  const storedUrls = Array.isArray(topic.traeEvidence?.visualDemoImageUrls)
    ? topic.traeEvidence.visualDemoImageUrls.filter((url): url is string => typeof url === "string" && url.length > 0)
    : [];
  const inferredUrls = hasVisualDemoCue(topic) ? topic.imageUrls : [];
  return Array.from(new Set([...storedUrls, ...inferredUrls]));
}

function getDemoEvidenceTypes(topic: TraeTopic): string[] {
  const storedTypes = Array.isArray(topic.traeEvidence?.demoEvidenceTypes)
    ? topic.traeEvidence.demoEvidenceTypes.filter((type): type is string => typeof type === "string" && type.length > 0)
    : [];
  const inferredTypes = [
    ...(getDetectedDemoUrls(topic).length > 0 ? ["web_url"] : []),
    ...(getDownloadDemoUrls(topic).length > 0 ? ["download"] : []),
    ...(getVisualDemoImageUrls(topic).length > 0 ? ["qr_or_image"] : [])
  ];
  return Array.from(new Set([...storedTypes, ...inferredTypes]));
}

function hasDemoEvidence(topic: TraeTopic): boolean {
  return topic.traeEvidence?.hasDemoEvidence === true || getDemoEvidenceTypes(topic).length > 0;
}

function detectedSessionIdCount(topic: TraeTopic): number {
  return topic.sessionIds.length > 0 ? topic.sessionIds.length : (topic.traeEvidence?.sessionIdCount ?? 0);
}

function complianceHints(topic: TraeTopic, match: TraeMatch | null): string[] {
  const risks: string[] = [];
  if (!hasDemoEvidence(topic)) risks.push("缺少 Demo 体验证据");
  if (!topic.traeEvidence?.hasTraeProcess) risks.push("没有清晰 TRAE 实践过程");
  if ((topic.traeEvidence?.screenshotCount ?? 0) < 3) risks.push("开发截图少于 3 张");
  if (detectedSessionIdCount(topic) === 0) risks.push("未检测到 Session ID");
  if (!match?.signupTopicId) risks.push("暂未匹配到报名记录");
  if (match?.mismatchRisk === "medium" || match?.mismatchRisk === "high") risks.push("初赛作品与报名方向可能不一致");
  if (topic.contentText.length < 240) risks.push("帖子材料较少，评分置信度应降低");
  return risks;
}

function demoEvidenceSource(evidence: NonNullable<TopicVisualEvidence["demoEvidence"]> | null | undefined): string {
  return evidence?.source ?? "screenshot_proxy";
}

function formatDemoEvidenceSummary(evidence: NonNullable<TopicVisualEvidence["demoEvidence"]>): string {
  const method = demoEvidenceSource(evidence);
  const status = evidence.auditStatus ?? "first_screen_only";
  const artifactType = evidence.artifactType ?? "web";

  if (method === "browser_agent" || method === "package_agent") {
    return [
      "Demo browser/package audit evidence (browser/package demo audit WAS performed; screenshots came from a direct audit adapter rather than the screenshot proxy):",
      evidence.summary,
      `Demo audit method: ${method}; status: ${status}; artifact type: ${artifactType}.`
    ].join("\n");
  }

  return [
    "Demo first-screen screenshot proxy evidence (only the first rendered screen was inspected; no click-through browser audit was performed):",
    evidence.summary,
    `Demo audit method: screenshot_proxy; status: ${status}; artifact type: ${artifactType}.`
  ].join("\n");
}

function formatVisualEvidenceSection(topic: TraeTopic, visualEvidence: TopicVisualEvidence | null): string {
  const detectedDemoUrls = getDetectedDemoUrls(topic);
  const downloadDemoUrls = getDownloadDemoUrls(topic);
  const visualDemoImageUrls = getVisualDemoImageUrls(topic);
  const demoEvidenceTypes = getDemoEvidenceTypes(topic);
  const demoSection = visualEvidence?.demoEvidence
    ? formatDemoEvidenceSummary(visualEvidence.demoEvidence)
    : topic.demoUrl
      ? "Demo 自动浏览：本轮截图或视觉识别未成功，仅使用帖子公开文本与 URL，不要假设已实际查看该页面。"
      : hasDemoEvidence(topic)
        ? "Demo 自动浏览：未检测到网页 Demo URL；non-web demo evidence is available, so skip web screenshot and evaluate download/QR/image evidence instead."
        : "Demo 自动浏览：未检测到 Demo 链接或其他体验证据。";

  const demoEvidenceTypeSection = `Demo evidence types: ${demoEvidenceTypes.join(", ") || "none"}`;

  const detectedDemoSection = detectedDemoUrls.length > 0
    ? `Detected Demo-like URLs (${detectedDemoUrls.length}):\n${detectedDemoUrls.slice(0, 10).map((url) => `- ${url}`).join("\n")}`
    : "Detected Demo-like URLs: none";

  const downloadDemoSection = downloadDemoUrls.length > 0
    ? `Download/packaged Demo evidence (${downloadDemoUrls.length}):\n${downloadDemoUrls.slice(0, 10).map((url) => `- ${url}`).join("\n")}`
    : "Download/packaged Demo evidence: none";

  const visualDemoSection = visualDemoImageUrls.length > 0
    ? `QR/image Demo evidence (${visualDemoImageUrls.length}):\n${visualDemoImageUrls.slice(0, 10).map((url) => `- ${url}`).join("\n")}`
    : "QR/image Demo evidence: none";

  const imageSection = visualEvidence?.imageEvidence
    ? `图片视觉识别（AI 已实际查看以下图片内容）：\n${visualEvidence.imageEvidence.summary}`
    : `图片链接（本轮未进行视觉识别）：\n${topic.imageUrls.slice(0, 20).map((url) => `- ${url}`).join("\n") || "未检测到"}`;

  return [
    demoSection,
    demoEvidenceTypeSection,
    detectedDemoSection,
    downloadDemoSection,
    visualDemoSection,
    `图片数量：${topic.imageUrls.length}`,
    imageSection,
    `Session IDs detected: ${detectedSessionIdCount(topic) > 0 ? "yes" : "no"}`
  ].join("\n");
}

function demoEvidenceLimitation(
  topic: TraeTopic,
  visualEvidence: TopicVisualEvidence | null,
  detectedDemoUrls: string[]
): string {
  const evidence = visualEvidence?.demoEvidence;
  if (!evidence) {
    return `- demo URL available: ${topic.demoUrl ? "yes" : "no"}; detected demo-like URLs: ${detectedDemoUrls.length}; browser/package demo audit or screenshot verification was not performed successfully for this run.`;
  }

  const method = demoEvidenceSource(evidence);
  if (method === "browser_agent" || method === "package_agent") {
    return "- browser/package demo audit WAS performed; treat the demo vision summary above as real observed evidence from direct web click-through or extracted package rendering.";
  }

  return "- first-screen screenshot proxy WAS inspected; treat it as real first-screen rendered evidence, but it is not click-through browser validation and does not prove deeper flows work.";
}

function demoConsensusRule(visualEvidence: TopicVisualEvidence | null): string {
  const evidence = visualEvidence?.demoEvidence;
  if (!evidence) {
    return "interactive demo browsing was not performed in this run; no browser/package demo audit evidence is available.";
  }

  const method = demoEvidenceSource(evidence);
  if (method === "browser_agent" || method === "package_agent") {
    return "browser/package demo audit WAS performed in this run; weigh the demo vision summary above as real observed evidence of the audited interactive or package-rendered state.";
  }

  return "first-screen screenshot proxy evidence WAS inspected in this run; weigh it as first-screen rendered evidence only, not as click-through browser validation.";
}

export function buildJudgePrompt(
  topic: TraeTopic,
  match: TraeMatch | null,
  visualEvidence: TopicVisualEvidence | null = null
): string {
  const isHardwareTrack = topic.track?.includes("硬件") || /硬件|设备|传感器|机器人/.test(topic.title);
  const designDimension = isHardwareTrack
    ? "美观度/设计体验 20 分：硬件交互赛道改看交互流畅、体验融合、软硬件反馈闭环。"
    : "美观度/设计体验 20 分：视觉美观、信息架构、交互体验、完成后的观摩价值。若截图/视觉证据显示只是静态介绍页而非可交互产品，本项不得评为高分。";

  return `你是 TRAE AI 创造力大赛第三方 AI 模拟评分员。本站不是官方评分，不预测官方结果。

请仅根据公开帖子内容和下方提供的真实视觉证据评分。信息不足时不要给高分，要降低 confidenceScore，并在 weaknesses/complianceRisks 中说明。

评分维度：
- 创新性 30 分：创意新颖性、AI 使用方式、差异化。
- 实用性 30 分：真实需求、可用价值、用户场景、落地潜力。
- 完成度 20 分：是否有可体验 Demo、功能完整度、帖子材料充分度。若 Demo 截图证据显示这只是一个静态介绍/营销落地页而非真正可交互的产品功能（例如没有可操作的功能界面、无法演示核心 AI 能力），完成度不得评为高分，需在 dimensionComments.completion 中说明依据。
- ${designDimension}

合规/材料风险只作为评分解释参考，不做单独审核页面。重点识别：缺 Demo、缺 TRAE 实践过程、缺 3 张开发截图、缺 Session ID、作品与报名方向不一致、只有概念没有 Demo、赛道/标题/标签不一致、材料不足导致置信度降低。
Uploaded screenshot evidence can satisfy official ordinary screenshot material requirements. When image vision is available, explicitly use it to judge whether there is at least one Trae usage/development process screenshot and at least one finished Demo/product interface screenshot. Do not require a web Demo URL when uploaded screenshots, download packages, QR codes, or mini-program evidence already show a usable product/demo path.
Session ID standard: treat Session IDs as binary evidence. If at least one Session ID is detected, do not penalize for fewer than 3 and do not speculate about authenticity.
Demo audit standard: first decide whether Demo material exists, then separately state whether web click-through or package verification was performed. Do not call found but unverified Demo evidence missing. Only say "unable to verify interactive core functionality" when no product/demo evidence exists, or when actual image/browser/package evidence shows a static, broken, or non-core product surface.

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
${formatVisualEvidenceSection(topic, visualEvidence)}
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

function evidenceLimitations(topic: TraeTopic, visualEvidence: TopicVisualEvidence | null): string {
  const lines = ["Evidence limitations for this automated run:"];
  const detectedDemoUrls = getDetectedDemoUrls(topic);
  const demoEvidenceTypes = getDemoEvidenceTypes(topic);

  lines.push(
    visualEvidence?.imageEvidence
      ? `- image vision WAS performed on this topic's post images; treat the image vision summary above as real observed evidence, not speculation.`
      : `- image URLs available: ${topic.imageUrls.length}; image vision was not performed successfully for this run.`
  );

  lines.push(demoEvidenceLimitation(topic, visualEvidence, detectedDemoUrls));

  lines.push(
    `- demo evidence available: ${hasDemoEvidence(topic) ? "yes" : "no"}; demo evidence types: ${demoEvidenceTypes.join(", ") || "none"}.`
  );

  lines.push(
    "- Do not claim you saw evidence beyond what is explicitly provided above (post text, or the vision summaries when present).",
    "- If public demo/image URLs are available but automation failed, do not describe that as missing contestant-provided materials; describe it only as an automation/evidence-verification limitation.",
    "- Do not call found but unverified Demo evidence missing.",
    "- Only say unable to verify interactive core functionality when no product/demo evidence exists, or when actual image/browser/package evidence shows a static, broken, or non-core product surface.",
    "- Penalize confidence and completion when no real evidence proves a working product beyond marketing claims."
  );

  return lines.join("\n");
}

export function buildEvaluatorJudgePrompt(
  topic: TraeTopic,
  match: TraeMatch | null,
  profile: JudgeEvaluatorProfile,
  visualEvidence: TopicVisualEvidence | null = null
): string {
  return `${buildJudgePrompt(topic, match, visualEvidence)}

Independent evaluator role:
- id: ${profile.id}
- label: ${profile.label}
- focus: ${profile.focus}

${evidenceLimitations(topic, visualEvidence)}

Return your own strict JSON score. Do not average with other evaluators; the consensus referee will do that later.`;
}

export function buildConsensusJudgePrompt(
  topic: TraeTopic,
  match: TraeMatch | null,
  evaluatorResults: readonly JudgeEvaluatorConsensusInput[],
  visualEvidence: TopicVisualEvidence | null = null
): string {
  const evaluatorSummary = evaluatorResults.map((result) => ({
    id: result.profile.id,
    label: result.profile.label,
    focus: result.profile.focus,
    output: result.output
  }));

  return `${buildJudgePrompt(topic, match, visualEvidence)}

Consensus referee task:
You are the final scoring referee. Compare the four independent evaluator JSON outputs below, identify material disagreements, and produce ONE final strict JSON score using the same schema.

Rules:
- Do not blindly average. Prefer the score best supported by public evidence.
- If a weak/static/demo-less project received a high score from any evaluator without evidence, reduce completion, design, and confidence.
- If evaluators disagree by more than 8 total-score points, explain the resolved disagreement in summary or dimensionComments.
- ${visualEvidence?.imageEvidence ? "image vision WAS performed in this run; weigh the image vision summary above as real evidence." : "image vision was not performed in this run."}
- ${demoConsensusRule(visualEvidence)}
- Do not claim screenshots or demo behavior were inspected unless that is present in the post text or the vision summaries above.

${evidenceLimitations(topic, visualEvidence)}

Independent evaluator outputs:
${JSON.stringify(evaluatorSummary, null, 2)}

Return only the final strict JSON object.`;
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

function totalTokensFromLogs(callLogs: TraeLLMCallLog[]): { inputTokens: number; outputTokens: number } {
  return callLogs.reduce(
    (totals, log) => ({
      inputTokens: totals.inputTokens + (log.inputTokens ?? 0),
      outputTokens: totals.outputTokens + (log.outputTokens ?? 0)
    }),
    { inputTokens: 0, outputTokens: 0 }
  );
}

async function runEvaluator(
  profile: JudgeEvaluatorProfile,
  topic: TraeTopic,
  match: TraeMatch | null,
  config: ReturnType<typeof getTraeConfig>,
  visualEvidence: TopicVisualEvidence | null
): Promise<JudgeEvaluatorRun> {
  const prompt = buildEvaluatorJudgePrompt(topic, match, profile, visualEvidence);
  const result = await callLLMWithFallback({
    config,
    messages: [
      { role: "system", content: JUDGE_SYSTEM_PROMPT },
      { role: "user", content: prompt }
    ],
    validateContent: parseEvaluationJson
  });

  return {
    profile,
    output: result.parsed,
    rawContent: result.content,
    provider: result.provider,
    model: result.model,
    prompt,
    callLogs: result.callLogs
  };
}

async function runEvaluatorTeam(
  topic: TraeTopic,
  match: TraeMatch | null,
  config: ReturnType<typeof getTraeConfig>,
  visualEvidence: TopicVisualEvidence | null
): Promise<JudgeEvaluatorRun[]> {
  const settled = await Promise.allSettled(
    JUDGE_EVALUATOR_PROFILES.map((profile) => runEvaluator(profile, topic, match, config, visualEvidence))
  );
  const runs: JudgeEvaluatorRun[] = [];
  const failedLogs: TraeLLMCallLog[] = [];
  const errors: string[] = [];

  for (const result of settled) {
    if (result.status === "fulfilled") {
      runs.push(result.value);
      continue;
    }

    errors.push(result.reason instanceof Error ? result.reason.message : String(result.reason));
    if (result.reason instanceof LLMFallbackError) failedLogs.push(...result.reason.callLogs);
  }

  if (errors.length > 0) {
    const completedLogs = runs.flatMap((run) => run.callLogs);
    throw new LLMFallbackError(`One or more evaluator calls failed: ${errors.join("; ")}`, [
      ...completedLogs,
      ...failedLogs
    ]);
  }

  return runs;
}

function buildStoredPromptText(
  topic: TraeTopic,
  match: TraeMatch | null,
  consensusPrompt: string,
  visualEvidence: TopicVisualEvidence | null
): string {
  return [
    "MULTI-EVALUATOR CONSENSUS RUN",
    "Base prompt shared by every evaluator:",
    buildJudgePrompt(topic, match, visualEvidence),
    "Evaluator profiles:",
    JSON.stringify(JUDGE_EVALUATOR_PROFILES, null, 2),
    "Consensus referee prompt:",
    consensusPrompt
  ].join("\n\n---\n\n");
}

function buildRawModelResponse(
  evaluatorRuns: JudgeEvaluatorRun[],
  consensusContent: string
): string {
  return JSON.stringify(
    {
      evaluators: evaluatorRuns.map((run) => ({
        id: run.profile.id,
        label: run.profile.label,
        provider: run.provider,
        model: run.model,
        content: run.rawContent
      })),
      consensus: {
        content: consensusContent
      }
    },
    null,
    2
  );
}

async function judgeOneTopicConsensus(
  topic: TraeTopic,
  match: TraeMatch | null,
  config: ReturnType<typeof getTraeConfig>,
  visualEvidence: TopicVisualEvidence | null
): Promise<TraeEvaluation> {
  const evaluatorRuns = await runEvaluatorTeam(topic, match, config, visualEvidence);
  const consensusPrompt = buildConsensusJudgePrompt(topic, match, evaluatorRuns, visualEvidence);
  let result: Awaited<ReturnType<typeof callLLMWithFallback<EvaluationOutput>>>;

  try {
    result = await callLLMWithFallback({
      config,
      messages: [
        { role: "system", content: JUDGE_SYSTEM_PROMPT },
        { role: "user", content: consensusPrompt }
      ],
      validateContent: parseEvaluationJson
    });
  } catch (error) {
    if (error instanceof LLMFallbackError) {
      throw new LLMFallbackError(error.message, [
        ...evaluatorRuns.flatMap((run) => run.callLogs),
        ...error.callLogs
      ]);
    }
    throw error;
  }

  const createdAt = nowIso();
  const allCallLogs = [
    ...evaluatorRuns.flatMap((run) => run.callLogs),
    ...result.callLogs
  ];
  const { inputTokens, outputTokens } = totalTokensFromLogs(allCallLogs);
  return {
    id: `${topic.id}_${Date.now()}`,
    topicId: topic.id,
    sourceType: "preliminary",
    provider: result.provider,
    model: result.model,
    promptVersion: PROMPT_VERSION,
    ...result.parsed,
    promptText: buildStoredPromptText(topic, match, consensusPrompt, visualEvidence),
    systemPrompt: JUDGE_SYSTEM_PROMPT,
    inputTokens,
    outputTokens,
    rawModelResponse: buildRawModelResponse(evaluatorRuns, result.content),
    llmCallLogs: allCallLogs,
    error: null,
    createdAt
  };
}

export async function judgeOneTopic(topic: TraeTopic, match: TraeMatch | null): Promise<TraeEvaluation> {
  const config = getTraeConfig();
  const visualEvidence = await gatherVisualEvidence(topic, { config });
  return judgeOneTopicConsensus(topic, match, config, visualEvidence);
}

const providerMap = {
  // The friend endpoint proxies NVIDIA-family models, so it's persisted as NVIDIA to
  // avoid a Data Connect enum migration. The true endpoint is still recorded per-call
  // inside llmCallLogs (provider + baseUrl), so friend vs. direct stays auditable there.
  friend: "NVIDIA",
  nvidia: "NVIDIA"
} as const;

const providerRevMap = {
  "NVIDIA": "nvidia"
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
  mode?: JudgeMode;
  max?: number;
  concurrency?: number;
}

export type JudgeMode = "unjudged" | "changed" | "low-confidence";

export async function runWithConcurrency<T>(
  items: readonly T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<void>
): Promise<void> {
  if (items.length === 0) return;

  const workerCount = Math.min(items.length, Math.max(1, Math.floor(concurrency)));
  let nextIndex = 0;

  async function runWorker(): Promise<void> {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      await worker(items[index], index);
    }
  }

  await Promise.all(Array.from({ length: workerCount }, () => runWorker()));
}

function normalizeJudgeConcurrency(value: number | undefined, max: number): number {
  const parsed = Math.floor(value ?? 1);
  const safeMax = Math.max(1, Math.floor(max));
  if (!Number.isFinite(parsed)) return 1;
  return Math.min(safeMax, Math.max(1, parsed));
}

function isTopicNewerThanEvaluation(topic: TraeTopic, latestEvaluation: TraeEvaluation): boolean {
  const topicUpdatedAt = Date.parse(topic.updatedAt);
  const evaluationCreatedAt = Date.parse(latestEvaluation.createdAt);
  return Number.isFinite(topicUpdatedAt) && Number.isFinite(evaluationCreatedAt) && topicUpdatedAt > evaluationCreatedAt;
}

async function fetchJudgeBoardPage(dc: unknown, offset: number): Promise<GetBoardPageData["topics"]> {
  const res = await getBoardPageQuery(dc as any, { limit: JUDGE_BOARD_PAGE_SIZE, offset } as any);
  return res.data.topics ?? [];
}

async function fetchLegacyJudgeBoardData(dc: unknown): Promise<GetBoardPageData["topics"]> {
  const res = await getBoardDataQuery(dc as any);
  return res.data.topics ?? [];
}

async function fetchJudgeBoardPages(dc: unknown): Promise<GetBoardPageData["topics"]> {
  try {
    const pages: Array<GetBoardPageData["topics"]> = [];

    for (let offset = 0; ; offset += JUDGE_BOARD_PAGE_SIZE) {
      const page = await fetchJudgeBoardPage(dc, offset);
      pages.push(page);
      if (page.length < JUDGE_BOARD_PAGE_SIZE) break;
    }

    return pages.flat();
  } catch (error) {
    if (isMissingDataConnectOperationError(error, "GetBoardPage")) {
      console.warn("Data Connect operation GetBoardPage is not deployed; falling back to legacy GetBoardData.");
      return fetchLegacyJudgeBoardData(dc);
    }
    throw error;
  }
}

export function shouldJudgeTopicForMode(
  topic: TraeTopic,
  latestEvaluation: TraeEvaluation | undefined,
  mode: JudgeMode
): boolean {
  if (mode === "low-confidence") return Boolean(latestEvaluation && latestEvaluation.confidenceScore < 55);
  if (mode === "changed") {
    return (
      topic.status === "needs_judging" ||
      topic.status === "judge_error" ||
      !latestEvaluation ||
      latestEvaluation.promptVersion !== PROMPT_VERSION ||
      isTopicNewerThanEvaluation(topic, latestEvaluation)
    );
  }
  return (
    topic.status === "needs_judging" ||
    topic.status === "judge_error" ||
    !latestEvaluation
  );
}

export async function judgeChangedTraeTopics(options: JudgeOptions = {}): Promise<{ evaluatedCount: number; failedCount: number }> {
  const config = getTraeConfig();
  const max = options.max ?? config.maxJudgePerRun;
  const mode = options.mode ?? "unjudged";
  const concurrency = normalizeJudgeConcurrency(options.concurrency ?? config.judgeConcurrency, max);
  const run = await startRun("judge", "preliminary");
  const dc = getDataConnectDb();
  let evaluatedCount = 0;
  let failedCount = 0;

  try {
    const rawTopics = await fetchJudgeBoardPages(dc);

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

    const topics = dedupeByTopicTitle(mapped)
      // Never spend LLM calls on deleted/empty posts (no content, demo, images, or session IDs).
      .filter(({ topic }) => !isDeletedOrEmptyTopic(topic))
      .filter(({ topic, latestEvaluation }) => shouldJudgeTopicForMode(topic, latestEvaluation, mode))
      .slice(0, max);

    await runWithConcurrency(topics, concurrency, async (topicObj) => {
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
    });

    await finishRun(run.id, {
      status: failedCount > 0 ? "partial" : "success",
      evaluatedCount,
      failedCount,
      logs: [`Evaluated ${evaluatedCount} topics; ${failedCount} failures; concurrency ${concurrency}.`]
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
