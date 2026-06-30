import { validateAdminArgs } from 'firebase-admin/data-connect';

export const CompetitionLevel = {
  HIGHLY_COMPETITIVE: "HIGHLY_COMPETITIVE",
  COMPETITIVE: "COMPETITIVE",
  AVERAGE: "AVERAGE",
  WEAK: "WEAK",
}

export const MatchMethod = {
  SAME_AUTHOR: "SAME_AUTHOR",
  TITLE_SIMILARITY: "TITLE_SIMILARITY",
  MANUAL: "MANUAL",
  NONE: "NONE",
}

export const MismatchRisk = {
  NONE: "NONE",
  LOW: "LOW",
  MEDIUM: "MEDIUM",
  HIGH: "HIGH",
  UNKNOWN: "UNKNOWN",
}

export const TraeAiProvider = {
  NVIDIA: "NVIDIA",
  OPENROUTER: "OPENROUTER",
}

export const TraeRunStatus = {
  RUNNING: "RUNNING",
  SUCCESS: "SUCCESS",
  PARTIAL: "PARTIAL",
  ERROR: "ERROR",
}

export const TraeRunType = {
  SCRAPE: "SCRAPE",
  JUDGE: "JUDGE",
  MATCH: "MATCH",
}

export const TraeSourceType = {
  SIGNUP: "SIGNUP",
  PRELIMINARY: "PRELIMINARY",
}

export const TraeTopicStatus = {
  SCRAPED: "SCRAPED",
  NEEDS_JUDGING: "NEEDS_JUDGING",
  JUDGED: "JUDGED",
  SCRAPE_ERROR: "SCRAPE_ERROR",
  JUDGE_ERROR: "JUDGE_ERROR",
}

export const connectorConfig = {
  connector: 'trae-contest',
  serviceId: 'trae-contest-ranking-2026-service',
  location: 'asia-east1'
};

export function upsertTopic(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('UpsertTopic', inputVars, inputOpts);
}

export function updateTopicEvaluationState(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('UpdateTopicEvaluationState', inputVars, inputOpts);
}

export function upsertEvaluation(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('UpsertEvaluation', inputVars, inputOpts);
}

export function upsertMatch(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('UpsertMatch', inputVars, inputOpts);
}

export function upsertRun(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('UpsertRun', inputVars, inputOpts);
}

export function finishRun(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('FinishRun', inputVars, inputOpts);
}

export function upsertPresence(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('UpsertPresence', inputVars, inputOpts);
}

export function upsertModelTokenUsage(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('UpsertModelTokenUsage', inputVars, inputOpts);
}

export function upsertScrapeCursor(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('UpsertScrapeCursor', inputVars, inputOpts);
}

export function migrateTopic(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('MigrateTopic', inputVars, inputOpts);
}

export function migrateEvaluation(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('MigrateEvaluation', inputVars, inputOpts);
}

export function migrateMatch(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('MigrateMatch', inputVars, inputOpts);
}

export function migrateRun(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('MigrateRun', inputVars, inputOpts);
}

export function getBoardData(dcOrOptions, options) {
  const { dc: dcInstance, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrOptions, options, undefined);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('GetBoardData', undefined, inputOpts);
}

export function getTopicDetail(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('GetTopicDetail', inputVars, inputOpts);
}

export function getStats(dcOrOptions, options) {
  const { dc: dcInstance, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrOptions, options, undefined);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('GetStats', undefined, inputOpts);
}

export function getOnlineCount(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('GetOnlineCount', inputVars, inputOpts);
}

export function getLatestRun(dcOrOptions, options) {
  const { dc: dcInstance, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrOptions, options, undefined);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('GetLatestRun', undefined, inputOpts);
}

export function listRuns(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('ListRuns', inputVars, inputOpts);
}

export function getScrapeCursor(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('GetScrapeCursor', inputVars, inputOpts);
}

export function getTopicsBySourceType(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('GetTopicsBySourceType', inputVars, inputOpts);
}

