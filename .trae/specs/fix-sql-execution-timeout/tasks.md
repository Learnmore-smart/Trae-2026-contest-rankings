# Tasks

- [x] Task 1: 提取共享有界并发工具 `lib/trae/concurrency.ts`
  - 从 `lib/trae/judge.ts` 的 `runWithConcurrency` 和 `lib/trae/matcher.ts` 的 `mapWithConcurrency` 提取共享实现到 `lib/trae/concurrency.ts`
  - 导出 `runWithConcurrency` 和 `mapWithConcurrency` 两个函数
  - 将 `judge.ts` 和 `matcher.ts` 中原有实现替换为从 `concurrency.ts` 的导入

- [x] Task 2: 在 `lib/trae/dataconnect.ts` 新增瞬时 SQL 错误重试
  - 新增 `isTransientDataConnectError(error)`:识别 "SQL execution timed out"、"timeout"、"connection"、"ECONNRESET"、"503"、"unavailable" 等瞬时错误关键词
  - 新增 `withSqlRetry<T>(fn: () => Promise<T>, options?)`:默认 3 次重试,指数退避(500ms / 1000ms / 2000ms),仅对瞬时错误重试,耗尽后抛出原始错误
  - 导出两个函数

- [x] Task 3: 约束 scraper 批量 getTopicDetail 并发并加重试
  - 将 `lib/trae/scraper.ts` 第 762 行 `Promise.all(refs.map(...))` 替换为 `mapWithConcurrency(refs, 8, ...)`
  - 对该批量读中的 `getTopicDetail` 调用包装 `withSqlRetry`
  - 对 `upsertTopic` 中的 `getTopicDetail` + `upsertTopicMutation` + `updateTopicEvaluationState` 调用包装 `withSqlRetry`

- [x] Task 4: 对 judge 的关键 DB 调用加重试
  - 对 `lib/trae/judge.ts` 中 `fetchJudgeBoardPage` 的 `getBoardPageQuery` 调用包装 `withSqlRetry`
  - 对 `persistJudgedTopic` 中的 `upsertEvaluation` + `updateTopicEvaluationState` 调用包装 `withSqlRetry`
  - 对 `recordTokenUsage` 中的 `upsertModelTokenUsage` 调用包装 `withSqlRetry`
  - 对 `rejudgeTopicById` 中的 `getTopicDetailQuery` + `persistJudgedTopic` 调用包装 `withSqlRetry`

- [x] Task 5: 对 matcher 的关键 DB 调用加重试
  - 对 `lib/trae/matcher.ts` 中 `fetchAllTopicsBySourceType` 的 `getTopicsBySourceType` 调用包装 `withSqlRetry`
  - 对 `runTraeMatching` 中的 `upsertMatch` 调用包装 `withSqlRetry`

- [x] Task 6: 对 runs.ts 的 startRun/finishRun 加重试
  - 对 `lib/trae/runs.ts` 中 `upsertRun` 和 `finishRunMutation` 调用包装 `withSqlRetry`,避免 run 记录写入失败击穿 pipeline

- [x] Task 7: 构建验证
  - 运行 `npm run build 2>&1` 确认无类型错误、无编译失败
  - 确认现有测试未被破坏(`npm test 2>&1` 若存在测试)

# Task Dependencies
- Task 2 依赖 Task 1(不严格,可并行,但 concurrency.ts 先就位更干净)
- Task 3 / 4 / 5 / 6 依赖 Task 2(需要 withSqlRetry 可用)
- Task 3 依赖 Task 1(需要 mapWithConcurrency 可用)
- Task 7 依赖 Task 1-6 全部完成
