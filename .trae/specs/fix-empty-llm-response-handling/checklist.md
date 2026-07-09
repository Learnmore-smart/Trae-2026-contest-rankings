# Checklist

- [x] `lib/trae/llm.ts` 的 `emptyContentReason` 能正确区分三种空响应模式：`rate_limited`（choices 数组为空）、`empty_content_billed`（choices 非空 + content 为空 + inputTokens > 0）、`invalid_response`（其他）
- [x] `empty_content_billed` 模式触发时，console 输出形如 `[trae-llm] empty_content_billed: provider=X model=Y input=N output=M rawResponse=<800 字符摘要>` 的诊断日志
- [x] `empty_content_billed` 不在 `isRetryableError` 的重试列表中，触发后直接切下一个模型（不重试同模型）
- [x] `lib/trae/llm.ts` 导出 `isSystemicLLMFallbackError(error)` 函数，能识别"同一次 fallback 链路中 ≥2 个模型返回 empty_content_billed"
- [x] `lib/trae/judge.ts` 在 `runWithConcurrency` worker 的 catch 块中检测系统性失败，连续 2 个 topic 系统性失败时提前终止 pipeline
- [x] 提前终止时，`finishRun` 的 logs 中包含 `"pipeline aborted due to systemic LLM failure (N consecutive topics with empty_content_billed)"`，status 为 `"error"`
- [x] 提前终止不破坏已有评分（复用 `hadValidScore` 守卫，已评分 topic 保持 JUDGED 状态）
- [x] `app/api/trae-contest/admin/llm-health/route.ts` 端点存在，需要 TRAE_ADMIN_TOKEN 鉴权
- [x] 健康检查端点对每个配置模型做一次轻量 ping，返回 `{ provider, model, status, latencyMs, inputTokens, outputTokens, errorReason?, rawResponseSummary? }`
- [x] 健康检查端点在模型返回空响应已计费时，`status: "error"`，`errorReason: "empty_content_billed"`，`rawResponseSummary` 包含截断脱敏的 rawResponse
- [x] 健康检查端点鉴权失败时返回 401 + `{ error: "Unauthorized." }`
- [x] `.ai/lib/trae/llm.md` 文档同步更新（What It Does + Change History）
- [x] `.ai/lib/trae/judge.md` 文档同步更新（What It Does + Change History）
- [x] `.ai/app/api/trae-contest/admin/llm-health/route.md` 文档创建
- [x] `npm run build 2>&1` 无类型错误、无编译失败
- [x] 现有 LLM 相关测试（如 `tests/trae.llm.test.ts`）未被破坏
- [x] 实际调用 `/api/trae-contest/admin/llm-health` 端点，确认能看到每个模型的真实 rawResponse，搞清楚为什么 content 为空
