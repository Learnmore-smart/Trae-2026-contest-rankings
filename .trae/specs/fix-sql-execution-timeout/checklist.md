# Checklist

- [x] `lib/trae/concurrency.ts` 存在并导出 `runWithConcurrency` 和 `mapWithConcurrency`
- [x] `lib/trae/judge.ts` 的 `runWithConcurrency` 已替换为从 `concurrency.ts` 导入(行为不变)
- [x] `lib/trae/matcher.ts` 的 `mapWithConcurrency` 已替换为从 `concurrency.ts` 导入(行为不变)
- [x] `lib/trae/dataconnect.ts` 导出 `isTransientDataConnectError`,能识别 "SQL execution timed out" 等瞬时错误
- [x] `lib/trae/dataconnect.ts` 导出 `withSqlRetry`,默认 3 次重试 + 指数退避,仅对瞬时错误重试,耗尽后抛出原始错误
- [x] `lib/trae/scraper.ts` 批量 getTopicDetail 改用 `mapWithConcurrency(refs, 8, ...)`,不再是无限制 `Promise.all(refs.map(...))`
- [x] `lib/trae/scraper.ts` 的 getTopicDetail 批量读 + upsertTopic 的 DB 调用经由 `withSqlRetry` 包装
- [x] `lib/trae/judge.ts` 的 `fetchJudgeBoardPage`、`persistJudgedTopic`、`recordTokenUsage`、`rejudgeTopicById` 的 DB 调用经由 `withSqlRetry` 包装
- [x] `lib/trae/matcher.ts` 的 `fetchAllTopicsBySourceType`、`upsertMatch` 调用经由 `withSqlRetry` 包装
- [x] `lib/trae/runs.ts` 的 `upsertRun`、`finishRunMutation` 调用经由 `withSqlRetry` 包装
- [x] `npm run build 2>&1` 通过,无类型错误
- [x] 现有测试未被破坏(143/145 通过;2 个失败为预存问题——test 22 检查的变量名 `topics` 早已改名为 `filtered`,test 31 检查的 cron 路由未被本次改动触及,已用 git stash 验证基线即失败)
