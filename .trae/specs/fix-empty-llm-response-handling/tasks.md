# Tasks

- [ ] Task 1: 在 `lib/trae/llm.ts` 新增 `empty_content_billed` 错误分类与诊断日志
  - 修改 `emptyContentReason(rawResponse, tokenUsage)` 签名，接收 `tokenUsage` 参数；当 HTTP 200 + `choices` 数组非空 + `choices[0].message.content` 为 null/空 + `inputTokens > 0` 时返回 `"empty_content_billed"`
  - 更新 `callOneModel` 中 `emptyContentReason` 的调用点，传入 `tokenUsage`
  - 在 `callOneModel` 返回 `empty_content_billed` 失败前，输出 console 日志：`[trae-llm] empty_content_billed: provider=X model=Y input=N output=M rawResponse=<truncateDiagnostic(rawResponse, 800)>`
  - 修改 `isRetryableError`，确保 `empty_content_billed` 不在重试列表中（直接切下一个模型）

- [x] Task 2: 在 `lib/trae/llm.ts` 导出 `isSystemicLLMFallbackError` 工具函数
  - 新增 `export function isSystemicLLMFallbackError(error: unknown): boolean`
  - 判定逻辑：`error instanceof LLMFallbackError` 且 `error.callLogs.filter(log => log.errorReason === "empty_content_billed").length >= 2`
  - 用于 judge.ts 检测同一个 topic 的 fallback 链路中是否有 ≥2 个模型返回空响应已计费

- [ ] Task 3: 在 `lib/trae/judge.ts` 实现系统性失败提前终止
  - 在 `judgeChangedTraeTopics` 的 `runWithConcurrency` 调用外层维护 `let consecutiveSystemicFailures = 0`
  - 在 catch 块中：若 `isSystemicLLMFallbackError(error)` 为 true，递增 `consecutiveSystemicFailures`；否则重置为 0
  - 若 `consecutiveSystemicFailures >= 2`，抛出新的 `SystemicLLMFailureError`（在 judge.ts 内部定义即可，不需要导出）
  - 修改 `runWithConcurrency` 调用，用 try/catch 包裹，捕获 `SystemicLLMFailureError` 时记录到 run logs 并提前结束
  - 在外层 catch 中（[judge.ts:985-993](file:///d:/Noah/文档/Coding/Trae-2026-contest-rankings/lib/trae/judge.ts#L985-L993)），若捕获到 `SystemicLLMFailureError`，在 `finishRun` 的 logs 中追加 `"pipeline aborted due to systemic LLM failure (N consecutive topics with empty_content_billed)"`，status 设为 `"error"`

- [ ] Task 4: 新增 `app/api/trae-contest/admin/llm-health/route.ts` 健康检查端点
  - 参考 [admin/judge/route.ts](file:///d:/Noah/文档/Coding/Trae-2026-contest-rankings/app/api/trae-contest/admin/judge/route.ts) 的结构：`runtime = "nodejs"`，`maxDuration = 60`，`isValidAdminToken` 鉴权
  - 调用 `buildLLMFallbackPlan(config)` 获取所有配置的模型
  - 对每个模型并发（或串行，简单起见串行即可）做一次轻量 ping：
    - messages: `[{ role: "user", content: "Return {} only." }]`
    - responseFormat: `"json_object"`
    - 不重试，不 fallback（直接调用 `callOneModel` 等价的内联逻辑，或新增一个导出的 `pingOneModel` 工具函数）
  - 返回 `{ results: [{ provider, model, status: "ok"|"error", latencyMs, inputTokens, outputTokens, errorReason?, rawResponseSummary? }] }`
  - `rawResponseSummary` 使用 `truncateDiagnostic(rawResponse, 800)` 复用现有脱敏逻辑（需要从 llm.ts 导出 `truncateDiagnostic`，或新增一个 `summarizeRawResponse` 导出函数）

- [ ] Task 5: 同步更新 `.ai/lib/trae/llm.md` 和 `.ai/lib/trae/judge.md` 文档
  - 在 llm.md 的 "What It Does" 增加空响应已计费分类、诊断日志、不重试直接切下一个模型的描述
  - 在 llm.md 的 "Change History" 增加 2026-07-08 条目
  - 在 judge.md 的 "What It Does" 增加系统性失败提前终止的描述
  - 在 judge.md 的 "Change History" 增加 2026-07-08 条目
  - 新建 `.ai/app/api/trae-contest/admin/llm-health/route.md` 文档

- [x] Task 6: 构建验证 + 实际跑一次健康检查诊断
  - 运行 `npm run build 2>&1` 确认无类型错误
  - 运行现有 LLM 相关测试（`tests/trae.llm.test.ts` 若存在）
  - 启动 dev server（或检查 localhost:3000 是否已在跑），用 curl 调用 `/api/trae-contest/admin/llm-health`（带 TRAE_ADMIN_TOKEN），查看每个模型实际返回的 rawResponse，确认问题根因

# Task Dependencies
- Task 2 依赖 Task 1（需要 `empty_content_billed` 错误分类已就位）
- Task 3 依赖 Task 2（需要 `isSystemicLLMFallbackError` 工具函数）
- Task 4 依赖 Task 1（健康检查端点需要复用 `empty_content_billed` 分类逻辑，且需要导出 `truncateDiagnostic` 或新增 `summarizeRawResponse`）
- Task 5 依赖 Task 1-4 全部完成
- Task 6 依赖 Task 1-5 全部完成
