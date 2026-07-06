import { ConnectorConfig, DataConnect, OperationOptions, ExecuteOperationResponse } from 'firebase-admin/data-connect';

export const connectorConfig: ConnectorConfig;

export type TimestampString = string;
export type UUIDString = string;
export type Int64String = string;
export type DateString = string;

export enum CompetitionLevel {
  HIGHLY_COMPETITIVE = "HIGHLY_COMPETITIVE",
  COMPETITIVE = "COMPETITIVE",
  AVERAGE = "AVERAGE",
  WEAK = "WEAK",
}
export enum MatchMethod {
  SAME_AUTHOR = "SAME_AUTHOR",
  TITLE_SIMILARITY = "TITLE_SIMILARITY",
  MANUAL = "MANUAL",
  NONE = "NONE",
}
export enum MismatchRisk {
  NONE = "NONE",
  LOW = "LOW",
  MEDIUM = "MEDIUM",
  HIGH = "HIGH",
  UNKNOWN = "UNKNOWN",
}
export enum TraeAiProvider {
  NVIDIA = "NVIDIA",
}
export enum TraeRunStatus {
  RUNNING = "RUNNING",
  SUCCESS = "SUCCESS",
  PARTIAL = "PARTIAL",
  ERROR = "ERROR",
}
export enum TraeRunType {
  SCRAPE = "SCRAPE",
  JUDGE = "JUDGE",
  MATCH = "MATCH",
}
export enum TraeSourceType {
  SIGNUP = "SIGNUP",
  PRELIMINARY = "PRELIMINARY",
}
export enum TraeTopicStatus {
  SCRAPED = "SCRAPED",
  NEEDS_JUDGING = "NEEDS_JUDGING",
  JUDGED = "JUDGED",
  SCRAPE_ERROR = "SCRAPE_ERROR",
  JUDGE_ERROR = "JUDGE_ERROR",
}

export interface Evaluation_Key {
  id: string;
  __typename?: 'Evaluation_Key';
}

export interface FinishRunData {
  run_update?: Run_Key | null;
}

export interface FinishRunVariables {
  id: string;
  status: TraeRunStatus;
  pagesScanned?: number | null;
  topicsFound?: number | null;
  topicsCreated?: number | null;
  topicsUpdated?: number | null;
  evaluatedCount?: number | null;
  failedCount?: number | null;
  matchedCount?: number | null;
  logs?: string[] | null;
  error?: string | null;
}

export interface GetBoardDataData {
  topics: ({
    id: string;
    sourceType: TraeSourceType;
    externalTopicId: string;
    slug: string;
    title: string;
    url: string;
    authorName: string;
    authorAvatarUrl?: string | null;
    track?: string | null;
    tags?: string[] | null;
    replyCount?: number | null;
    viewCount?: number | null;
    likeCount?: number | null;
    createdAtExternal?: TimestampString | null;
    lastActivityAtExternal?: TimestampString | null;
    scrapedAt: TimestampString;
    updatedAt: TimestampString;
    contentText: string;
    excerpt: string;
    demoUrl?: string | null;
    attachmentUrls?: string[] | null;
    imageUrls?: string[] | null;
    sessionIds?: string[] | null;
    traeEvidence?: unknown | null;
    contentHash: string;
    status: TraeTopicStatus;
    totalScore?: number | null;
    innovationScore?: number | null;
    practicalityScore?: number | null;
    completionScore?: number | null;
    designScore?: number | null;
    complianceRiskScore?: number | null;
    directionConsistencyScore?: number | null;
    confidenceScore?: number | null;
    competitionLevel?: CompetitionLevel | null;
    evaluatedAt?: TimestampString | null;
    evaluations_on_topic: ({
      id: string;
      provider?: TraeAiProvider | null;
      model: string;
      promptVersion: string;
      totalScore: number;
      innovationScore: number;
      practicalityScore: number;
      completionScore: number;
      designScore: number;
      complianceRiskScore: number;
      directionConsistencyScore?: number | null;
      confidenceScore: number;
      competitionLevel: CompetitionLevel;
      summary: string;
      strengths?: string[] | null;
      weaknesses?: string[] | null;
      suggestions?: string[] | null;
      complianceRisks?: string[] | null;
      dimensionComments?: unknown | null;
      matchComment?: string | null;
      inputTokens?: number | null;
      outputTokens?: number | null;
      error?: string | null;
      createdAt: TimestampString;
    } & Evaluation_Key)[];
      match_on_preliminaryTopic?: {
        id: string;
        preliminaryTopicId: string;
        signupTopicId?: string | null;
        preliminaryAuthorName: string;
        signupAuthorName?: string | null;
        matchMethod: MatchMethod;
        matchConfidence: number;
        titleSimilarity?: number | null;
        directionConsistencyScore?: number | null;
        directionConsistencyComment?: string | null;
        mismatchRisk: MismatchRisk;
        createdAt: TimestampString;
        updatedAt: TimestampString;
      } & Match_Key;
  } & Topic_Key)[];
}

export interface GetBoardPageData {
  topics: ({
    id: string;
    sourceType: TraeSourceType;
    externalTopicId: string;
    slug: string;
    title: string;
    url: string;
    authorName: string;
    authorAvatarUrl?: string | null;
    track?: string | null;
    tags?: string[] | null;
    replyCount?: number | null;
    viewCount?: number | null;
    likeCount?: number | null;
    createdAtExternal?: TimestampString | null;
    lastActivityAtExternal?: TimestampString | null;
    scrapedAt: TimestampString;
    updatedAt: TimestampString;
    contentText: string;
    excerpt: string;
    demoUrl?: string | null;
    attachmentUrls?: string[] | null;
    imageUrls?: string[] | null;
    sessionIds?: string[] | null;
    traeEvidence?: unknown | null;
    contentHash: string;
    status: TraeTopicStatus;
    totalScore?: number | null;
    innovationScore?: number | null;
    practicalityScore?: number | null;
    completionScore?: number | null;
    designScore?: number | null;
    complianceRiskScore?: number | null;
    directionConsistencyScore?: number | null;
    confidenceScore?: number | null;
    competitionLevel?: CompetitionLevel | null;
    evaluatedAt?: TimestampString | null;
    evaluations_on_topic: ({
      id: string;
      provider?: TraeAiProvider | null;
      model: string;
      promptVersion: string;
      totalScore: number;
      innovationScore: number;
      practicalityScore: number;
      completionScore: number;
      designScore: number;
      complianceRiskScore: number;
      directionConsistencyScore?: number | null;
      confidenceScore: number;
      competitionLevel: CompetitionLevel;
      summary: string;
      strengths?: string[] | null;
      weaknesses?: string[] | null;
      suggestions?: string[] | null;
      complianceRisks?: string[] | null;
      dimensionComments?: unknown | null;
      matchComment?: string | null;
      inputTokens?: number | null;
      outputTokens?: number | null;
      error?: string | null;
      createdAt: TimestampString;
    } & Evaluation_Key)[];
      match_on_preliminaryTopic?: {
        id: string;
        preliminaryTopicId: string;
        signupTopicId?: string | null;
        preliminaryAuthorName: string;
        signupAuthorName?: string | null;
        matchMethod: MatchMethod;
        matchConfidence: number;
        titleSimilarity?: number | null;
        directionConsistencyScore?: number | null;
        directionConsistencyComment?: string | null;
        mismatchRisk: MismatchRisk;
        createdAt: TimestampString;
        updatedAt: TimestampString;
      } & Match_Key;
  } & Topic_Key)[];
}

export interface GetBoardPageVariables {
  limit: number;
  offset: number;
}

export interface GetLatestRunData {
  runs: ({
    id: string;
    type: TraeRunType;
    sourceType?: TraeSourceType | null;
    startedAt: TimestampString;
    finishedAt?: TimestampString | null;
    status: TraeRunStatus;
  } & Run_Key)[];
}

export interface GetOnlineCountData {
  presences: ({
    _count: number;
  })[];
}

export interface GetOnlineCountVariables {
  onlineSince: TimestampString;
}

export interface GetScrapeCursorData {
  scrapeCursors: ({
    sourceType: TraeSourceType;
    nextPage: number;
    totalSeen: number;
    lastRunAt: TimestampString;
    lastCompletedCycleAt?: TimestampString | null;
  } & ScrapeCursor_Key)[];
}

export interface GetScrapeCursorVariables {
  sourceType: TraeSourceType;
}

export interface GetStatsData {
  signupCount: ({
    _count: number;
  })[];
    preliminaryCount: ({
      _count: number;
    })[];
      evaluatedCount: ({
        _count: number;
      })[];
        matchedCount: ({
          _count: number;
        })[];
          modelTokenUsages: ({
            input_sum?: number | null;
            output_sum?: number | null;
          })[];
            topics: ({
              updatedAt_max?: TimestampString | null;
            })[];
              evaluations: ({
                createdAt_max?: TimestampString | null;
              })[];
                matches: ({
                  updatedAt_max?: TimestampString | null;
                })[];
}

export interface GetTopicDetailData {
  topic?: {
    id: string;
    sourceType: TraeSourceType;
    externalTopicId: string;
    slug: string;
    title: string;
    url: string;
    authorName: string;
    authorAvatarUrl?: string | null;
    track?: string | null;
    tags?: string[] | null;
    replyCount?: number | null;
    viewCount?: number | null;
    likeCount?: number | null;
    createdAtExternal?: TimestampString | null;
    lastActivityAtExternal?: TimestampString | null;
    scrapedAt: TimestampString;
    updatedAt: TimestampString;
    contentText: string;
    contentHtml?: string | null;
    excerpt: string;
    demoUrl?: string | null;
    attachmentUrls?: string[] | null;
    imageUrls?: string[] | null;
    sessionIds?: string[] | null;
    traeEvidence?: unknown | null;
    contentHash: string;
    status: TraeTopicStatus;
    rawJson?: unknown | null;
    rawHtml?: string | null;
    totalScore?: number | null;
    innovationScore?: number | null;
    practicalityScore?: number | null;
    completionScore?: number | null;
    designScore?: number | null;
    complianceRiskScore?: number | null;
    directionConsistencyScore?: number | null;
    confidenceScore?: number | null;
    competitionLevel?: CompetitionLevel | null;
    evaluatedAt?: TimestampString | null;
    evaluations_on_topic: ({
      id: string;
      topicId: string;
      sourceType: string;
      provider?: TraeAiProvider | null;
      model: string;
      promptVersion: string;
      totalScore: number;
      innovationScore: number;
      practicalityScore: number;
      completionScore: number;
      designScore: number;
      complianceRiskScore: number;
      directionConsistencyScore?: number | null;
      confidenceScore: number;
      competitionLevel: CompetitionLevel;
      summary: string;
      strengths?: string[] | null;
      weaknesses?: string[] | null;
      suggestions?: string[] | null;
      complianceRisks?: string[] | null;
      dimensionComments?: unknown | null;
      matchComment?: string | null;
      promptText?: string | null;
      systemPrompt?: string | null;
      inputTokens?: number | null;
      outputTokens?: number | null;
      rawModelResponse: string;
      llmCallLogs?: unknown[] | null;
      error?: string | null;
      createdAt: TimestampString;
    } & Evaluation_Key)[];
      match_on_preliminaryTopic?: {
        id: string;
        preliminaryTopicId: string;
        signupTopicId?: string | null;
        preliminaryAuthorName: string;
        signupAuthorName?: string | null;
        matchMethod: MatchMethod;
        matchConfidence: number;
        titleSimilarity?: number | null;
        directionConsistencyScore?: number | null;
        directionConsistencyComment?: string | null;
        mismatchRisk: MismatchRisk;
        createdAt: TimestampString;
        updatedAt: TimestampString;
      } & Match_Key;
  } & Topic_Key;
}

export interface GetTopicDetailVariables {
  id: string;
}

export interface GetTopicsBySourceTypeData {
  topics: ({
    id: string;
    sourceType: TraeSourceType;
    externalTopicId: string;
    slug: string;
    title: string;
    url: string;
    authorName: string;
    authorAvatarUrl?: string | null;
    track?: string | null;
    tags?: string[] | null;
    replyCount?: number | null;
    viewCount?: number | null;
    likeCount?: number | null;
    createdAtExternal?: TimestampString | null;
    lastActivityAtExternal?: TimestampString | null;
    scrapedAt: TimestampString;
    updatedAt: TimestampString;
    contentText: string;
    contentHtml?: string | null;
    excerpt: string;
    demoUrl?: string | null;
    attachmentUrls?: string[] | null;
    imageUrls?: string[] | null;
    sessionIds?: string[] | null;
    traeEvidence?: unknown | null;
    contentHash: string;
    status: TraeTopicStatus;
    totalScore?: number | null;
    innovationScore?: number | null;
    practicalityScore?: number | null;
    completionScore?: number | null;
    designScore?: number | null;
    complianceRiskScore?: number | null;
    directionConsistencyScore?: number | null;
    confidenceScore?: number | null;
    competitionLevel?: CompetitionLevel | null;
    evaluatedAt?: TimestampString | null;
  } & Topic_Key)[];
}

export interface GetTopicsBySourceTypeVariables {
  sourceType: TraeSourceType;
  offset?: number | null;
}

export interface ListRunsData {
  runs: ({
    id: string;
    type: TraeRunType;
    sourceType?: TraeSourceType | null;
    startedAt: TimestampString;
    finishedAt?: TimestampString | null;
    status: TraeRunStatus;
    pagesScanned?: number | null;
    topicsFound?: number | null;
    topicsCreated?: number | null;
    topicsUpdated?: number | null;
    evaluatedCount?: number | null;
    failedCount?: number | null;
    matchedCount?: number | null;
    logs?: string[] | null;
    error?: string | null;
  } & Run_Key)[];
}

export interface ListRunsVariables {
  limit: number;
}

export interface Match_Key {
  id: string;
  __typename?: 'Match_Key';
}

export interface MigrateEvaluationData {
  evaluation_upsert: Evaluation_Key;
}

export interface MigrateEvaluationVariables {
  id: string;
  topicId: string;
  sourceType: string;
  provider?: TraeAiProvider | null;
  model: string;
  promptVersion: string;
  totalScore: number;
  innovationScore: number;
  practicalityScore: number;
  completionScore: number;
  designScore: number;
  complianceRiskScore: number;
  directionConsistencyScore?: number | null;
  confidenceScore: number;
  competitionLevel: CompetitionLevel;
  summary: string;
  strengths?: string[] | null;
  weaknesses?: string[] | null;
  suggestions?: string[] | null;
  complianceRisks?: string[] | null;
  dimensionComments?: unknown | null;
  matchComment?: string | null;
  promptText?: string | null;
  systemPrompt?: string | null;
  inputTokens?: number | null;
  outputTokens?: number | null;
  rawModelResponse: string;
  llmCallLogs?: unknown[] | null;
  error?: string | null;
  createdAt: TimestampString;
}

export interface MigrateMatchData {
  match_upsert: Match_Key;
}

export interface MigrateMatchVariables {
  id: string;
  preliminaryTopicId: string;
  signupTopicId?: string | null;
  preliminaryAuthorName: string;
  signupAuthorName?: string | null;
  matchMethod: MatchMethod;
  matchConfidence: number;
  titleSimilarity?: number | null;
  directionConsistencyScore?: number | null;
  directionConsistencyComment?: string | null;
  mismatchRisk: MismatchRisk;
  createdAt: TimestampString;
  updatedAt: TimestampString;
}

export interface MigrateRunData {
  run_upsert: Run_Key;
}

export interface MigrateRunVariables {
  id: string;
  type: TraeRunType;
  sourceType?: TraeSourceType | null;
  startedAt: TimestampString;
  finishedAt?: TimestampString | null;
  status: TraeRunStatus;
  pagesScanned?: number | null;
  topicsFound?: number | null;
  topicsCreated?: number | null;
  topicsUpdated?: number | null;
  evaluatedCount?: number | null;
  failedCount?: number | null;
  matchedCount?: number | null;
  logs?: string[] | null;
  error?: string | null;
}

export interface MigrateTopicData {
  topic_upsert: Topic_Key;
}

export interface MigrateTopicVariables {
  id: string;
  sourceType: TraeSourceType;
  externalTopicId: string;
  slug: string;
  title: string;
  url: string;
  authorName: string;
  authorAvatarUrl?: string | null;
  track?: string | null;
  tags?: string[] | null;
  replyCount?: number | null;
  viewCount?: number | null;
  likeCount?: number | null;
  createdAtExternal?: TimestampString | null;
  lastActivityAtExternal?: TimestampString | null;
  scrapedAt: TimestampString;
  updatedAt: TimestampString;
  contentText: string;
  contentHtml?: string | null;
  excerpt: string;
  demoUrl?: string | null;
  attachmentUrls?: string[] | null;
  imageUrls?: string[] | null;
  sessionIds?: string[] | null;
  traeEvidence?: unknown | null;
  contentHash: string;
  status: TraeTopicStatus;
  rawJson?: unknown | null;
  rawHtml?: string | null;
  totalScore?: number | null;
  innovationScore?: number | null;
  practicalityScore?: number | null;
  completionScore?: number | null;
  designScore?: number | null;
  complianceRiskScore?: number | null;
  directionConsistencyScore?: number | null;
  confidenceScore?: number | null;
  competitionLevel?: CompetitionLevel | null;
  evaluatedAt?: TimestampString | null;
}

export interface ModelTokenUsage_Key {
  id: string;
  __typename?: 'ModelTokenUsage_Key';
}

export interface Presence_Key {
  sessionId: string;
  __typename?: 'Presence_Key';
}

export interface Run_Key {
  id: string;
  __typename?: 'Run_Key';
}

export interface ScrapeCursor_Key {
  sourceType: TraeSourceType;
  __typename?: 'ScrapeCursor_Key';
}

export interface Topic_Key {
  id: string;
  __typename?: 'Topic_Key';
}

export interface UpdateTopicEvaluationStateData {
  topic_update?: Topic_Key | null;
}

export interface UpdateTopicEvaluationStateVariables {
  id: string;
  status: TraeTopicStatus;
  totalScore?: number | null;
  innovationScore?: number | null;
  practicalityScore?: number | null;
  completionScore?: number | null;
  designScore?: number | null;
  complianceRiskScore?: number | null;
  directionConsistencyScore?: number | null;
  confidenceScore?: number | null;
  competitionLevel?: CompetitionLevel | null;
}

export interface UpsertEvaluationData {
  evaluation_upsert: Evaluation_Key;
}

export interface UpsertEvaluationVariables {
  id: string;
  topicId: string;
  sourceType: string;
  provider?: TraeAiProvider | null;
  model: string;
  promptVersion: string;
  totalScore: number;
  innovationScore: number;
  practicalityScore: number;
  completionScore: number;
  designScore: number;
  complianceRiskScore: number;
  directionConsistencyScore?: number | null;
  confidenceScore: number;
  competitionLevel: CompetitionLevel;
  summary: string;
  strengths?: string[] | null;
  weaknesses?: string[] | null;
  suggestions?: string[] | null;
  complianceRisks?: string[] | null;
  dimensionComments?: unknown | null;
  matchComment?: string | null;
  promptText?: string | null;
  systemPrompt?: string | null;
  inputTokens?: number | null;
  outputTokens?: number | null;
  rawModelResponse: string;
  llmCallLogs?: unknown[] | null;
  error?: string | null;
}

export interface UpsertMatchData {
  match_upsert: Match_Key;
}

export interface UpsertMatchVariables {
  id: string;
  preliminaryTopicId: string;
  signupTopicId?: string | null;
  preliminaryAuthorName: string;
  signupAuthorName?: string | null;
  matchMethod: MatchMethod;
  matchConfidence: number;
  titleSimilarity?: number | null;
  directionConsistencyScore?: number | null;
  directionConsistencyComment?: string | null;
  mismatchRisk: MismatchRisk;
}

export interface UpsertModelTokenUsageData {
  modelTokenUsage_upsert: ModelTokenUsage_Key;
}

export interface UpsertModelTokenUsageVariables {
  id: string;
  provider: TraeAiProvider;
  model: string;
  input: number;
  output: number;
}

export interface UpsertPresenceData {
  presence_upsert: Presence_Key;
}

export interface UpsertPresenceVariables {
  sessionId: string;
  userAgentHash?: string | null;
}

export interface UpsertRunData {
  run_upsert: Run_Key;
}

export interface UpsertRunVariables {
  id: string;
  type: TraeRunType;
  sourceType?: TraeSourceType | null;
  status: TraeRunStatus;
}

export interface UpsertScrapeCursorData {
  scrapeCursor_upsert: ScrapeCursor_Key;
}

export interface UpsertScrapeCursorVariables {
  sourceType: TraeSourceType;
  nextPage: number;
  totalSeen: number;
  lastCompletedCycleAt?: TimestampString | null;
}

export interface UpsertTopicData {
  topic_upsert: Topic_Key;
}

export interface UpsertTopicVariables {
  id: string;
  sourceType: TraeSourceType;
  externalTopicId: string;
  slug: string;
  title: string;
  url: string;
  authorName: string;
  authorAvatarUrl?: string | null;
  track?: string | null;
  tags?: string[] | null;
  replyCount?: number | null;
  viewCount?: number | null;
  likeCount?: number | null;
  createdAtExternal?: TimestampString | null;
  lastActivityAtExternal?: TimestampString | null;
  contentText: string;
  contentHtml?: string | null;
  excerpt: string;
  demoUrl?: string | null;
  attachmentUrls?: string[] | null;
  imageUrls?: string[] | null;
  sessionIds?: string[] | null;
  traeEvidence?: unknown | null;
  contentHash: string;
  status: TraeTopicStatus;
  rawJson?: unknown | null;
  rawHtml?: string | null;
}

/** Generated Node Admin SDK operation action function for the 'UpsertTopic' Mutation. Allow users to execute without passing in DataConnect. */
export function upsertTopic(dc: DataConnect, vars: UpsertTopicVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpsertTopicData>>;
/** Generated Node Admin SDK operation action function for the 'UpsertTopic' Mutation. Allow users to pass in custom DataConnect instances. */
export function upsertTopic(vars: UpsertTopicVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpsertTopicData>>;

/** Generated Node Admin SDK operation action function for the 'UpdateTopicEvaluationState' Mutation. Allow users to execute without passing in DataConnect. */
export function updateTopicEvaluationState(dc: DataConnect, vars: UpdateTopicEvaluationStateVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpdateTopicEvaluationStateData>>;
/** Generated Node Admin SDK operation action function for the 'UpdateTopicEvaluationState' Mutation. Allow users to pass in custom DataConnect instances. */
export function updateTopicEvaluationState(vars: UpdateTopicEvaluationStateVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpdateTopicEvaluationStateData>>;

/** Generated Node Admin SDK operation action function for the 'UpsertEvaluation' Mutation. Allow users to execute without passing in DataConnect. */
export function upsertEvaluation(dc: DataConnect, vars: UpsertEvaluationVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpsertEvaluationData>>;
/** Generated Node Admin SDK operation action function for the 'UpsertEvaluation' Mutation. Allow users to pass in custom DataConnect instances. */
export function upsertEvaluation(vars: UpsertEvaluationVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpsertEvaluationData>>;

/** Generated Node Admin SDK operation action function for the 'UpsertMatch' Mutation. Allow users to execute without passing in DataConnect. */
export function upsertMatch(dc: DataConnect, vars: UpsertMatchVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpsertMatchData>>;
/** Generated Node Admin SDK operation action function for the 'UpsertMatch' Mutation. Allow users to pass in custom DataConnect instances. */
export function upsertMatch(vars: UpsertMatchVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpsertMatchData>>;

/** Generated Node Admin SDK operation action function for the 'UpsertRun' Mutation. Allow users to execute without passing in DataConnect. */
export function upsertRun(dc: DataConnect, vars: UpsertRunVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpsertRunData>>;
/** Generated Node Admin SDK operation action function for the 'UpsertRun' Mutation. Allow users to pass in custom DataConnect instances. */
export function upsertRun(vars: UpsertRunVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpsertRunData>>;

/** Generated Node Admin SDK operation action function for the 'FinishRun' Mutation. Allow users to execute without passing in DataConnect. */
export function finishRun(dc: DataConnect, vars: FinishRunVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<FinishRunData>>;
/** Generated Node Admin SDK operation action function for the 'FinishRun' Mutation. Allow users to pass in custom DataConnect instances. */
export function finishRun(vars: FinishRunVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<FinishRunData>>;

/** Generated Node Admin SDK operation action function for the 'UpsertPresence' Mutation. Allow users to execute without passing in DataConnect. */
export function upsertPresence(dc: DataConnect, vars: UpsertPresenceVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpsertPresenceData>>;
/** Generated Node Admin SDK operation action function for the 'UpsertPresence' Mutation. Allow users to pass in custom DataConnect instances. */
export function upsertPresence(vars: UpsertPresenceVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpsertPresenceData>>;

/** Generated Node Admin SDK operation action function for the 'UpsertModelTokenUsage' Mutation. Allow users to execute without passing in DataConnect. */
export function upsertModelTokenUsage(dc: DataConnect, vars: UpsertModelTokenUsageVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpsertModelTokenUsageData>>;
/** Generated Node Admin SDK operation action function for the 'UpsertModelTokenUsage' Mutation. Allow users to pass in custom DataConnect instances. */
export function upsertModelTokenUsage(vars: UpsertModelTokenUsageVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpsertModelTokenUsageData>>;

/** Generated Node Admin SDK operation action function for the 'UpsertScrapeCursor' Mutation. Allow users to execute without passing in DataConnect. */
export function upsertScrapeCursor(dc: DataConnect, vars: UpsertScrapeCursorVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpsertScrapeCursorData>>;
/** Generated Node Admin SDK operation action function for the 'UpsertScrapeCursor' Mutation. Allow users to pass in custom DataConnect instances. */
export function upsertScrapeCursor(vars: UpsertScrapeCursorVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpsertScrapeCursorData>>;

/** Generated Node Admin SDK operation action function for the 'MigrateTopic' Mutation. Allow users to execute without passing in DataConnect. */
export function migrateTopic(dc: DataConnect, vars: MigrateTopicVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<MigrateTopicData>>;
/** Generated Node Admin SDK operation action function for the 'MigrateTopic' Mutation. Allow users to pass in custom DataConnect instances. */
export function migrateTopic(vars: MigrateTopicVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<MigrateTopicData>>;

/** Generated Node Admin SDK operation action function for the 'MigrateEvaluation' Mutation. Allow users to execute without passing in DataConnect. */
export function migrateEvaluation(dc: DataConnect, vars: MigrateEvaluationVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<MigrateEvaluationData>>;
/** Generated Node Admin SDK operation action function for the 'MigrateEvaluation' Mutation. Allow users to pass in custom DataConnect instances. */
export function migrateEvaluation(vars: MigrateEvaluationVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<MigrateEvaluationData>>;

/** Generated Node Admin SDK operation action function for the 'MigrateMatch' Mutation. Allow users to execute without passing in DataConnect. */
export function migrateMatch(dc: DataConnect, vars: MigrateMatchVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<MigrateMatchData>>;
/** Generated Node Admin SDK operation action function for the 'MigrateMatch' Mutation. Allow users to pass in custom DataConnect instances. */
export function migrateMatch(vars: MigrateMatchVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<MigrateMatchData>>;

/** Generated Node Admin SDK operation action function for the 'MigrateRun' Mutation. Allow users to execute without passing in DataConnect. */
export function migrateRun(dc: DataConnect, vars: MigrateRunVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<MigrateRunData>>;
/** Generated Node Admin SDK operation action function for the 'MigrateRun' Mutation. Allow users to pass in custom DataConnect instances. */
export function migrateRun(vars: MigrateRunVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<MigrateRunData>>;

/** Generated Node Admin SDK operation action function for the 'GetBoardData' Query. Allow users to execute without passing in DataConnect. */
export function getBoardData(dc: DataConnect, options?: OperationOptions): Promise<ExecuteOperationResponse<GetBoardDataData>>;
/** Generated Node Admin SDK operation action function for the 'GetBoardData' Query. Allow users to pass in custom DataConnect instances. */
export function getBoardData(options?: OperationOptions): Promise<ExecuteOperationResponse<GetBoardDataData>>;

/** Generated Node Admin SDK operation action function for the 'GetBoardPage' Query. Allow users to execute without passing in DataConnect. */
export function getBoardPage(dc: DataConnect, vars: GetBoardPageVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetBoardPageData>>;
/** Generated Node Admin SDK operation action function for the 'GetBoardPage' Query. Allow users to pass in custom DataConnect instances. */
export function getBoardPage(vars: GetBoardPageVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetBoardPageData>>;

/** Generated Node Admin SDK operation action function for the 'GetTopicDetail' Query. Allow users to execute without passing in DataConnect. */
export function getTopicDetail(dc: DataConnect, vars: GetTopicDetailVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetTopicDetailData>>;
/** Generated Node Admin SDK operation action function for the 'GetTopicDetail' Query. Allow users to pass in custom DataConnect instances. */
export function getTopicDetail(vars: GetTopicDetailVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetTopicDetailData>>;

/** Generated Node Admin SDK operation action function for the 'GetStats' Query. Allow users to execute without passing in DataConnect. */
export function getStats(dc: DataConnect, options?: OperationOptions): Promise<ExecuteOperationResponse<GetStatsData>>;
/** Generated Node Admin SDK operation action function for the 'GetStats' Query. Allow users to pass in custom DataConnect instances. */
export function getStats(options?: OperationOptions): Promise<ExecuteOperationResponse<GetStatsData>>;

/** Generated Node Admin SDK operation action function for the 'GetOnlineCount' Query. Allow users to execute without passing in DataConnect. */
export function getOnlineCount(dc: DataConnect, vars: GetOnlineCountVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetOnlineCountData>>;
/** Generated Node Admin SDK operation action function for the 'GetOnlineCount' Query. Allow users to pass in custom DataConnect instances. */
export function getOnlineCount(vars: GetOnlineCountVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetOnlineCountData>>;

/** Generated Node Admin SDK operation action function for the 'GetLatestRun' Query. Allow users to execute without passing in DataConnect. */
export function getLatestRun(dc: DataConnect, options?: OperationOptions): Promise<ExecuteOperationResponse<GetLatestRunData>>;
/** Generated Node Admin SDK operation action function for the 'GetLatestRun' Query. Allow users to pass in custom DataConnect instances. */
export function getLatestRun(options?: OperationOptions): Promise<ExecuteOperationResponse<GetLatestRunData>>;

/** Generated Node Admin SDK operation action function for the 'ListRuns' Query. Allow users to execute without passing in DataConnect. */
export function listRuns(dc: DataConnect, vars: ListRunsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListRunsData>>;
/** Generated Node Admin SDK operation action function for the 'ListRuns' Query. Allow users to pass in custom DataConnect instances. */
export function listRuns(vars: ListRunsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListRunsData>>;

/** Generated Node Admin SDK operation action function for the 'GetScrapeCursor' Query. Allow users to execute without passing in DataConnect. */
export function getScrapeCursor(dc: DataConnect, vars: GetScrapeCursorVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetScrapeCursorData>>;
/** Generated Node Admin SDK operation action function for the 'GetScrapeCursor' Query. Allow users to pass in custom DataConnect instances. */
export function getScrapeCursor(vars: GetScrapeCursorVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetScrapeCursorData>>;

/** Generated Node Admin SDK operation action function for the 'GetTopicsBySourceType' Query. Allow users to execute without passing in DataConnect. */
export function getTopicsBySourceType(dc: DataConnect, vars: GetTopicsBySourceTypeVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetTopicsBySourceTypeData>>;
/** Generated Node Admin SDK operation action function for the 'GetTopicsBySourceType' Query. Allow users to pass in custom DataConnect instances. */
export function getTopicsBySourceType(vars: GetTopicsBySourceTypeVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetTopicsBySourceTypeData>>;

