const { validateAdminArgs } = require('firebase-admin/data-connect');

const CompetitionLevel = {
  HIGHLY_COMPETITIVE: "HIGHLY_COMPETITIVE",
  COMPETITIVE: "COMPETITIVE",
  AVERAGE: "AVERAGE",
  WEAK: "WEAK",
}
exports.CompetitionLevel = CompetitionLevel;

const MatchMethod = {
  SAME_AUTHOR: "SAME_AUTHOR",
  TITLE_SIMILARITY: "TITLE_SIMILARITY",
  MANUAL: "MANUAL",
  NONE: "NONE",
}
exports.MatchMethod = MatchMethod;

const MismatchRisk = {
  NONE: "NONE",
  LOW: "LOW",
  MEDIUM: "MEDIUM",
  HIGH: "HIGH",
  UNKNOWN: "UNKNOWN",
}
exports.MismatchRisk = MismatchRisk;

const TraeAiProvider = {
  NVIDIA: "NVIDIA",
  OPENROUTER: "OPENROUTER",
}
exports.TraeAiProvider = TraeAiProvider;

const TraeRunStatus = {
  RUNNING: "RUNNING",
  SUCCESS: "SUCCESS",
  PARTIAL: "PARTIAL",
  ERROR: "ERROR",
}
exports.TraeRunStatus = TraeRunStatus;

const TraeRunType = {
  SCRAPE: "SCRAPE",
  JUDGE: "JUDGE",
  MATCH: "MATCH",
}
exports.TraeRunType = TraeRunType;

const TraeSourceType = {
  SIGNUP: "SIGNUP",
  PRELIMINARY: "PRELIMINARY",
}
exports.TraeSourceType = TraeSourceType;

const TraeTopicStatus = {
  SCRAPED: "SCRAPED",
  NEEDS_JUDGING: "NEEDS_JUDGING",
  JUDGED: "JUDGED",
  SCRAPE_ERROR: "SCRAPE_ERROR",
  JUDGE_ERROR: "JUDGE_ERROR",
}
exports.TraeTopicStatus = TraeTopicStatus;

const connectorConfig = {
  connector: 'trae-contest',
  serviceId: 'trae-contest-ranking-2026-service',
  location: 'asia-east1'
};
exports.connectorConfig = connectorConfig;

function upsertTopic(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('UpsertTopic', inputVars, inputOpts);
}
exports.upsertTopic = upsertTopic;

function updateTopicEvaluationState(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('UpdateTopicEvaluationState', inputVars, inputOpts);
}
exports.updateTopicEvaluationState = updateTopicEvaluationState;

function upsertEvaluation(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('UpsertEvaluation', inputVars, inputOpts);
}
exports.upsertEvaluation = upsertEvaluation;

function upsertMatch(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('UpsertMatch', inputVars, inputOpts);
}
exports.upsertMatch = upsertMatch;

function upsertRun(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('UpsertRun', inputVars, inputOpts);
}
exports.upsertRun = upsertRun;

function finishRun(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('FinishRun', inputVars, inputOpts);
}
exports.finishRun = finishRun;

function upsertPresence(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('UpsertPresence', inputVars, inputOpts);
}
exports.upsertPresence = upsertPresence;

function upsertModelTokenUsage(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('UpsertModelTokenUsage', inputVars, inputOpts);
}
exports.upsertModelTokenUsage = upsertModelTokenUsage;

function upsertScrapeCursor(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('UpsertScrapeCursor', inputVars, inputOpts);
}
exports.upsertScrapeCursor = upsertScrapeCursor;

function migrateTopic(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('MigrateTopic', inputVars, inputOpts);
}
exports.migrateTopic = migrateTopic;

function migrateEvaluation(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('MigrateEvaluation', inputVars, inputOpts);
}
exports.migrateEvaluation = migrateEvaluation;

function migrateMatch(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('MigrateMatch', inputVars, inputOpts);
}
exports.migrateMatch = migrateMatch;

function migrateRun(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('MigrateRun', inputVars, inputOpts);
}
exports.migrateRun = migrateRun;

function getBoardData(dcOrOptions, options) {
  const { dc: dcInstance, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrOptions, options, undefined);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('GetBoardData', undefined, inputOpts);
}
exports.getBoardData = getBoardData;

function getTopicDetail(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('GetTopicDetail', inputVars, inputOpts);
}
exports.getTopicDetail = getTopicDetail;

function getStats(dcOrOptions, options) {
  const { dc: dcInstance, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrOptions, options, undefined);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('GetStats', undefined, inputOpts);
}
exports.getStats = getStats;

function getOnlineCount(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('GetOnlineCount', inputVars, inputOpts);
}
exports.getOnlineCount = getOnlineCount;

function getLatestRun(dcOrOptions, options) {
  const { dc: dcInstance, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrOptions, options, undefined);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('GetLatestRun', undefined, inputOpts);
}
exports.getLatestRun = getLatestRun;

function listRuns(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('ListRuns', inputVars, inputOpts);
}
exports.listRuns = listRuns;

function getScrapeCursor(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('GetScrapeCursor', inputVars, inputOpts);
}
exports.getScrapeCursor = getScrapeCursor;

function getTopicsBySourceType(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('GetTopicsBySourceType', inputVars, inputOpts);
}
exports.getTopicsBySourceType = getTopicsBySourceType;

