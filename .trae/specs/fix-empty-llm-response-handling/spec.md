# Fix Empty LLM Response Handling Spec

## Why
2026-07-08 21:39-21:40 的 44 秒窗口内，11 次评分 API 调用全部"只有输入 token（~4728）、0 输出 token"，单 topic 走完整条 fallback 链路（4 模型 × 3 重试 ≈ 12 次）却 0 产出，总花费约 $0.052 无效。当前 [lib/trae/llm.ts](file:///d:/Noah/文档/Coding/Trae-2026-contest-rankings/lib/trae/llm.ts) 在这种"API 返回 200 OK + 有 input token 计费 + content 为空"模式下存在三个问题：

1. **诊断盲点**：`rawResponse` 只写到数据库 `llmCallLogs`，不输出到 console / run logs，无法快速看清 API 实际返回了什么（是 `choices[0].message.content = null`？还是 `choices = []`？还是别的字段？）
2. **浪费 token 的重试**：content 为空但已计费 input token 时仍重试同模型 2 次（[llm.ts:236-241](file:///d:/Noah/文档/Coding/Trae-2026-contest-rankings/lib/trae/llm.ts#L236-L241)），这种失败通常是模型/网关级问题，重试只是浪费 token
3. **无提前终止**：所有模型都返回相同空响应失败时，pipeline 仍会继续处理后续 topic，一个 cron 周期可能烧光预算却 0 产出

## What Changes
- **诊断日志增强**：当 content 为空但有 input token 时，把 rawResponse 摘要（截断 + 脱敏）输出到 console，并在 run logs 中记录失败模式摘要
- **停止无效重试**：新增 `empty_content_billed` 错误类型，识别"有 input token 但 content 为空"模式，不重试同模型，直接切下一个模型
- **系统性失败提前终止**：当连续 2 个模型都返回 `empty_content_billed` 时，停止整个 judge pipeline，避免一个 cron 周期烧光预算却 0 产出
- **新增健康检查端点**：`POST /api/trae-contest/admin/llm-health` 端点，对每个配置的模型做一次轻量 ping 调用，返回每个模型的状态，用于启动大规模评分前确认 API 可用

## Impact
- Affected code:
  - [lib/trae/llm.ts](file:///d:/Noah/文档/Coding/Trae-2026-contest-rankings/lib/trae/llm.ts) — 新增 `empty_content_billed` 错误分类，跳过同模型重试，新增 console 诊断日志，导出 `isSystemicLLMFallbackError` 供 judge 检测系统性失败
  - [lib/trae/judge.ts](file:///d:/Noah/文档/Coding/Trae-2026-contest-rankings/lib/trae/judge.ts) — 在 `runWithConcurrency` worker 中检测连续系统性失败，提前终止，在 run logs 中记录
  - `app/api/trae-contest/admin/llm-health/route.ts` — 新增健康检查端点（参考 [admin/judge/route.ts](file:///d:/Noah/文档/Coding/Trae-2026-contest-rankings/app/api/trae-contest/admin/judge/route.ts) 的鉴权模式）
  - `.ai/lib/trae/llm.md` / `.ai/lib/trae/judge.md` — 文档同步（由 file-guardian skill 处理）
- 不影响公开 API 形状；不影响 schema；不涉及 BREAKING 变更
- 不修改 .env 配置（model 链路保持 minimax-m3 主 + 3 fallback）
- 复用现有 `extractTokenUsage`、`truncateDiagnostic`、`failedAttempt` 工具，不新建重复实现

## ADDED Requirements

### Requirement: 空响应已计费模式诊断日志
系统 SHALL 在 LLM 调用返回 HTTP 200 + 有 input token 计费（inputTokens > 0）+ content 为空时，输出诊断日志到 console，包括：provider、model、inputTokens、outputTokens、rawResponse 截断摘要（复用 `truncateDiagnostic` 脱敏后截断到 800 字符）。该日志 SHALL 用明确前缀 `[trae-llm] empty_content_billed:` 标识，便于 grep。

#### Scenario: 单次空响应已计费
- **WHEN** 一个 LLM 调用返回 200 OK + inputTokens=4728 + content 为空
- **THEN** console 输出形如 `[trae-llm] empty_content_billed: provider=friend model=minimaxai/minimax-m3 input=4728 output=0 rawResponse=<800 字符摘要>`
- **AND** 该次调用在 `callLogs` 中的 `errorReason` 字段被设置为 `empty_content_billed`

### Requirement: 停止空响应已计费模式的重试
系统 SHALL 在 LLM 调用返回 `empty_content_billed` 失败模式时，跳过同一模型的 `aiMaxRetriesPerModel` 重试预算，直接切到 fallback 链路的下一个模型。`empty_content_billed` SHALL NOT 被纳入 `isRetryableError` 的重试判定。

#### Scenario: 单模型空响应已计费
- **WHEN** minimax-m3 返回 200 OK + inputTokens=4728 + content 为空
- **THEN** 系统不重试 minimax-m3，直接切到 gemma-4-31b-it
- **AND** 节省 2 次无效重试的 token 消耗（约 $0.0094）

#### Scenario: 空响应 vs 软 429 区分
- **WHEN** API 返回 200 OK + choices 数组为空（NVIDIA 软 429）
- **THEN** 仍按现有 `rate_limited` 分类处理（重试同模型，轮换 key）
- **AND** 不被误分类为 `empty_content_billed`

### Requirement: 系统性 LLM 失败提前终止
系统 SHALL 在 judge pipeline 中检测到同一个 topic 的 fallback 链路中有 ≥2 个模型返回 `empty_content_billed` 失败时，将该次调用标记为"系统性 LLM 失败"（通过 `LLMFallbackError` 的 `callLogs` 检测）。SHALL 在连续 2 个 topic 都发生系统性 LLM 失败时，提前终止 `runWithConcurrency`，停止处理剩余 topic。SHALL 在 run logs 中明确记录 `"pipeline aborted due to systemic LLM failure (N consecutive topics with empty_content_billed)"`。

#### Scenario: 所有模型空响应已计费
- **WHEN** 一个 topic 的 minimax-m3 和 gemma-4-31b-it 都返回 empty_content_billed
- **THEN** 该 topic 被标记为系统性失败
- **AND** 不写入 JUDGE_ERROR（保持已有评分不变，复用 [judge.ts:894-898](file:///d:/Noah/文档/Coding/Trae-2026-contest-rankings/lib/trae/judge.ts#L894-L898) 的 `hadValidScore` 守卫）

#### Scenario: 连续 2 个 topic 系统性失败
- **WHEN** 连续 2 个 topic 都被标记为系统性 LLM 失败
- **THEN** 系统停止处理剩余 topic
- **AND** run 状态标记为 `error`，logs 中包含 `"pipeline aborted due to systemic LLM failure (2 consecutive topics with empty_content_billed)"`
- **AND** 已处理的 topic 评分状态保持不变

### Requirement: LLM 健康检查端点
系统 SHALL 提供 `POST /api/trae-contest/admin/llm-health` 端点：
- 需要 `TRAE_ADMIN_TOKEN` bearer 鉴权（复用 [auth.ts](file:///d:/Noah/文档/Coding/Trae-2026-contest-rankings/lib/trae/auth.ts) 的 `isValidAdminToken`）
- 对 `buildLLMFallbackPlan(config)` 中的每个模型做一次轻量 ping 调用（最小 prompt："返回 JSON `{}`"，response_format=json_object）
- 返回每个模型的状态：`{ provider, model, status: "ok"|"error", latencyMs, inputTokens, outputTokens, errorReason?, rawResponseSummary? }`
- 不重试（每个模型只调一次，便于快速诊断）
- `runtime = "nodejs"`，`maxDuration = 60`

#### Scenario: 所有模型可用
- **WHEN** 管理员调用 `/api/trae-contest/admin/llm-health`
- **THEN** 返回 200 + `{ results: [{ provider: "friend", model: "minimaxai/minimax-m3", status: "ok", latencyMs: 1200, inputTokens: 12, outputTokens: 2 }, ...] }`

#### Scenario: 某模型空响应已计费
- **WHEN** minimax-m3 返回空 content 但有 input token
- **THEN** 该模型 `status: "error"`，`errorReason: "empty_content_billed"`，`rawResponseSummary` 包含截断脱敏的 rawResponse（前 800 字符）

#### Scenario: 鉴权失败
- **WHEN** 调用不带 token 或 token 无效
- **THEN** 返回 401 + `{ error: "Unauthorized." }`（与 [admin/judge/route.ts](file:///d:/Noah/文档/Coding/Trae-2026-contest-rankings/app/api/trae-contest/admin/judge/route.ts) 行为一致）

## MODIFIED Requirements

### Requirement: LLM 调用失败分类
当前 [llm.ts:481-489](file:///d:/Noah/文档/Coding/Trae-2026-contest-rankings/lib/trae/llm.ts#L481-L489) 的 `emptyContentReason` 在 content 为空时只区分两种：`rate_limited`（choices 数组为空）和 `invalid_response`（其他）。修改后 SHALL 区分第三种 `empty_content_billed`：

- HTTP 200 + `choices` 数组非空 + `choices[0].message.content` 为 null/空字符串 + `inputTokens > 0` → `empty_content_billed`
- HTTP 200 + `choices` 数组为空 → `rate_limited`（不变）
- 其他 content 为空 → `invalid_response`（不变）

`empty_content_billed` SHALL NOT 被纳入 `isRetryableError`，因此不会触发同模型重试；SHALL 直接切到 fallback 链路的下一个模型。

### Requirement: Judge pipeline 失败处理
当前 [judge.ts:876-976](file:///d:/Noah/文档/Coding/Trae-2026-contest-rankings/lib/trae/judge.ts#L876-L976) 的 `runWithConcurrency` worker 在 catch 块中记录 `failedCount += 1` 并继续下一个 topic。修改后 SHALL：

- 在 catch 块中检查 `error.callLogs` 中是否有 ≥2 个 `empty_content_billed` 失败
- 若有，标记当前 topic 为"系统性 LLM 失败"，递增一个共享的 `consecutiveSystemicFailures` 计数器
- 若 `consecutiveSystemicFailures >= 2`，抛出一个特殊的 `SystemicLLMFailureError`（或等价机制）让 `runWithConcurrency` 停止领取新 topic
- 在 `finishRun` 的 logs 中记录提前终止原因
- 若连续失败计数被任一成功调用重置为 0（避免临时抖动误触发）
