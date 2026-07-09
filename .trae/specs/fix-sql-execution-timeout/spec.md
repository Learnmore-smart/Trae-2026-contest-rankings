# Fix SQL Execution Timeout Spec

## Why
用户点击榜单页"重试评分"按钮后,pipeline 持续以 `SQL execution timed out` 失败,前端一直显示"运行中断，请稍后重试。SQL execution timed out"。根因是 `/api/trae-contest/run` 同时并行运行 judge + scrape + match 三个阶段,其中 scraper 用无并发限制的 `Promise.all(refs.map(...))` 一次性发起多达 100 个 `getTopicDetail` 查询(每个拉取 contentHtml / rawJson / rawModelResponse / llmCallLogs 等重型字段),叠加 judge 的 8 路并发 DB 写入,压垮 1 vCPU / 2 GiB 的 Cloud SQL 实例,触发查询超时;而 pipeline 对瞬时 SQL 超时没有任何重试,单次超时即让整条流水线失败。

## What Changes
- **约束 scraper 批量 getTopicDetail 的并发**:将 `lib/trae/scraper.ts` 中 `Promise.all(refs.map(...))` 的无限制并发替换为有界并发(默认 8),复用已有的并发执行模式。
- **新增瞬时 SQL 错误重试**:在 `lib/trae/dataconnect.ts` 中新增 `isTransientDataConnectError` 判定与 `withSqlRetry` 包装器,对 SQL 执行超时 / 连接错误等瞬时错误按指数退避重试,避免单次超时击穿整条 pipeline。
- **对关键 DB 读写应用重试**:对 scraper 的 `getTopicDetail` 批量读、judge 的 `fetchJudgeBoardPages` 读、以及 `upsertTopic` / `upsertEvaluation` / `updateTopicEvaluationState` / `upsertMatch` 等写入应用 `withSqlRetry`。
- 提取共享并发工具 `lib/trae/concurrency.ts`,统一 scraper / matcher / judge 现有的重复实现(遵循复用而非新建原则,消除已有重复)。

## Impact
- Affected code:
  - `lib/trae/scraper.ts` — getTopicDetail 批量读改有界并发 + 重试;upsertTopic 加重试
  - `lib/trae/dataconnect.ts` — 新增 `isTransientDataConnectError` 与 `withSqlRetry`
  - `lib/trae/judge.ts` — fetchJudgeBoardPages / persistJudgedTopic / recordTokenUsage 的 DB 调用加重试;runWithConcurrency 迁移到共享工具
  - `lib/trae/matcher.ts` — mapWithConcurrency 迁移到共享工具;upsertMatch 加重试
  - `lib/trae/concurrency.ts` — 新增共享并发工具(提取自现有 judge.ts / matcher.ts)
  - `app/api/trae-contest/run/route.ts` — 无需改动(fire-and-forget 结构不变)
- 不影响公开 API 形状;不影响 schema;不涉及 BREAKING 变更。

## ADDED Requirements

### Requirement: 瞬时 SQL 错误重试
系统 SHALL 对 Data Connect / Cloud SQL 的瞬时错误(SQL execution timed out、连接中断、503 等)按指数退避重试,默认最多 3 次,初始退避 500ms。重试耗尽后 SHALL 抛出原始错误,由上层捕获。

#### Scenario: 单次 SQL 超时后重试成功
- **WHEN** 一个 DB 读/写操作首次抛出 `SQL execution timed out`
- **THEN** 系统在短暂退避后重试同一操作,成功后正常返回,不向上层传播错误

#### Scenario: 连续超时耗尽重试后抛出
- **WHEN** 一个 DB 操作连续 3 次抛出瞬时错误
- **THEN** 系统抛出原始错误,上层 pipeline 的 catch 块按现有逻辑记录 run 失败

### Requirement: 共享有界并发工具
系统 SHALL 提供一个共享的有界并发执行工具(从现有 `runWithConcurrency` / `mapWithConcurrency` 提取),供 scraper / matcher / judge 复用,避免并发逻辑重复实现。

## MODIFIED Requirements

### Requirement: Scraper 批量读取并发约束
scraper 在 `scrapeTraeSource` 中批量查询已存在 topic 时(`getTopicDetail` 批量读)SHALL 使用有界并发(默认 8),而非无限制的 `Promise.all(refs.map(...))`。每个 `getTopicDetail` 调用 SHALL 经由 `withSqlRetry` 包装。

#### Scenario: 100 个 topic 的批量存在性检查
- **WHEN** scraper 收集到 100 个 refs 并批量查询 getTopicDetail
- **THEN** 系统以最多 8 路并发执行查询,而非 100 路同时执行,避免压垮 Cloud SQL

### Requirement: Judge DB 调用重试
judge 的 `fetchJudgeBoardPages`、`persistJudgedTopic`(含 `upsertEvaluation` + `updateTopicEvaluationState`)、`recordTokenUsage` 中的 DB 调用 SHALL 经由 `withSqlRetry` 包装,使瞬时 SQL 超时不再击穿整条 judge 阶段。

### Requirement: Matcher DB 调用重试
matcher 的 `upsertMatch` 调用 SHALL 经由 `withSqlRetry` 包装。
