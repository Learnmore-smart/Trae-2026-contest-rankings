import { z } from "zod";

export type TraeSourceType = "signup" | "preliminary";
export type TraeTopicStatus = "scraped" | "needs_judging" | "judged" | "scrape_error" | "judge_error";
export type TraeRunType = "scrape" | "judge" | "match";
export type TraeRunStatus = "running" | "success" | "partial" | "error";
export type TraeAIProvider = "nvidia" | "openrouter";
export type MatchMethod = "same_author" | "title_similarity" | "manual" | "none";
export type MismatchRisk = "none" | "low" | "medium" | "high" | "unknown";
export type CompetitionLevel = "极具竞争力" | "有竞争力" | "竞争力一般" | "较弱";

export interface TraeEvidence {
  hasDemoUrl: boolean;
  hasTraeProcess: boolean;
  screenshotCount: number;
  sessionIdCount: number;
  hasThreeScreenshots: boolean;
  hasThreeSessionIds: boolean;
  processKeywords: string[];
}

export interface TraeTopic {
  id: string;
  sourceType: TraeSourceType;
  externalTopicId: string;
  slug: string;
  title: string;
  url: string;
  authorName: string;
  /**
   * Discourse `username` of the first-post author (the stable identity key the
   * forum's `@` search indexes by). Carried in-memory only — used to confirm a
   * preliminary↔signup match by person, not title. Not persisted to Data Connect.
   */
  authorUsername?: string | null;
  authorAvatarUrl: string | null;
  track: string | null;
  tags: string[];
  replyCount: number | null;
  viewCount: number | null;
  likeCount: number | null;
  createdAtExternal: string | null;
  lastActivityAtExternal: string | null;
  scrapedAt: string;
  updatedAt: string;
  contentText: string;
  contentHtml: string | null;
  excerpt: string;
  demoUrl: string | null;
  attachmentUrls: string[];
  imageUrls: string[];
  sessionIds: string[];
  traeEvidence: TraeEvidence | null;
  contentHash: string;
  status: TraeTopicStatus;
  rawJson: unknown | null;
  rawHtml: string | null;
}

export interface TraeMatch {
  id: string;
  preliminaryTopicId: string;
  signupTopicId: string | null;
  preliminaryAuthorName: string;
  signupAuthorName: string | null;
  matchMethod: MatchMethod;
  matchConfidence: number;
  titleSimilarity: number | null;
  directionConsistencyScore: number | null;
  directionConsistencyComment: string | null;
  mismatchRisk: MismatchRisk;
  createdAt: string;
  updatedAt: string;
}

export interface TraeLLMCallLog {
  provider: TraeAIProvider;
  model: string;
  latencyMs: number;
  retryCount: number;
  errorReason: string | null;
  inputTokens: number;
  outputTokens: number;
  rawResponse: string;
}

export interface TraeModelTokenUsage {
  id: string;
  provider: TraeAIProvider;
  model: string;
  input: number;
  output: number;
  updatedAt: string;
}

export interface TraeEvaluation {
  id: string;
  topicId: string;
  sourceType: "preliminary";
  provider?: TraeAIProvider | null;
  model: string;
  promptVersion: string;
  totalScore: number;
  innovationScore: number;
  practicalityScore: number;
  completionScore: number;
  designScore: number;
  complianceRiskScore: number;
  directionConsistencyScore: number | null;
  confidenceScore: number;
  competitionLevel: CompetitionLevel;
  summary: string;
  strengths: string[];
  weaknesses: string[];
  suggestions: string[];
  complianceRisks: string[];
  dimensionComments: Record<string, string>;
  matchComment: string | null;
  /** Full prompt (user message) sent to the model. Surfaced in the UI as "模型输入". */
  promptText?: string;
  /** System message sent to the model, shown alongside the prompt as part of the input. */
  systemPrompt?: string;
  /** Prompt tokens (输入词元) of the successful call; convenience copy of the winning llmCallLog. */
  inputTokens?: number;
  /** Completion tokens (输出词元) of the successful call. */
  outputTokens?: number;
  rawModelResponse: string;
  llmCallLogs?: TraeLLMCallLog[];
  error: string | null;
  createdAt: string;
}

export interface TraeRun {
  id: string;
  type: TraeRunType;
  sourceType: TraeSourceType | null;
  startedAt: string;
  finishedAt: string | null;
  status: TraeRunStatus;
  pagesScanned: number | null;
  topicsFound: number | null;
  topicsCreated: number | null;
  topicsUpdated: number | null;
  evaluatedCount: number | null;
  failedCount: number | null;
  matchedCount: number | null;
  logs: string[];
  error: string | null;
}

export interface TraePresence {
  sessionId: string;
  lastSeenAt: string;
  userAgentHash: string | null;
}

/**
 * Resume cursor for paginated scraping. Lets repeated bounded runs walk the whole
 * forum category (报名 ~20K / 初赛 ~2K) across many cron/dev triggers instead of
 * re-fetching page 0 every time. Wraps back to page 0 after reaching the end.
 */
export interface TraeScrapeCursor {
  sourceType: TraeSourceType;
  nextPage: number;
  totalSeen: number;
  lastRunAt: string;
  lastCompletedCycleAt: string | null;
}

export const dimensionCommentsSchema = z
  .object({
    innovation: z.string().min(1),
    practicality: z.string().min(1),
    completion: z.string().min(1),
    design: z.string().min(1)
  })
  .catchall(z.string());

export const evaluationOutputSchema = z
  .object({
    totalScore: z.number().min(0).max(100),
    innovationScore: z.number().min(0).max(30),
    practicalityScore: z.number().min(0).max(30),
    completionScore: z.number().min(0).max(20),
    designScore: z.number().min(0).max(20),
    complianceRiskScore: z.number().min(0).max(10),
    directionConsistencyScore: z.number().min(0).max(10).nullable(),
    confidenceScore: z.number().min(0).max(100),
    competitionLevel: z.enum(["极具竞争力", "有竞争力", "竞争力一般", "较弱"]),
    summary: z.string().min(1),
    strengths: z.array(z.string()).default([]),
    weaknesses: z.array(z.string()).default([]),
    suggestions: z.array(z.string()).default([]),
    complianceRisks: z.array(z.string()).default([]),
    dimensionComments: dimensionCommentsSchema,
    matchComment: z.string().nullable()
  })
  .strict();

export type EvaluationOutput = z.infer<typeof evaluationOutputSchema>;

export interface RankingItem {
  rank: number;
  topic: Omit<TraeTopic, "contentHtml" | "rawJson" | "rawHtml">;
  evaluation: TraeEvaluation | null;
  match: TraeMatch | null;
}

export interface StatsPayload {
  signupCount: number;
  preliminaryCount: number;
  evaluatedCount: number;
  matchedCount: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  lastUpdatedAt: string | null;
  onlineCount: number;
  sourceUnavailable?: boolean;
  message?: string;
}
