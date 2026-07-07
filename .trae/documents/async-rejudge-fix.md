# 修复重新评分超时：改为异步 fire-and-forget 模式

## Context

重新评分（rejudge）按钮在生产环境报 "重新评分失败，请稍后再试"。根因：`rejudgeTopicById` 涉及视觉证据抓取 + 4 个评估器 LLM 调用 + 1 个共识调用，实测耗时 ~400 秒，远超 Cloud Run 的 60 秒请求超时（`maxDuration = 60`）。请求总是超时，客户端拿到错误。

已有的 `/run` 路由（`app/api/trae-contest/run/route.ts`）用 fire-and-forget 模式解决了同样的问题：POST 立即返回，后台执行 `void runPipeline(state)`，客户端轮询 GET 获取状态。本次修复复用同一模式。

## 修改文件

### 1. `app/api/trae-contest/topics/[id]/rejudge/route.ts` — 改为异步

**POST 处理：**
- 检查 inFlight / cooldown / 并发上限（逻辑不变）
- 将 `rejudgeTopicById(id)` 改为 fire-and-forget：`void runRejudgeInBackground(state, id)`
- 立即返回 `{ ok: true, started: true }`（不再等待评分完成）
- 后台任务完成后更新 `lastError` map 和 `lastFinishedAt`

**新增 GET 处理：**
- 返回该 topic 的 rejudge 状态：`{ running: boolean, error: string | null }`
- 从 `inFlight` 和 `lastError` 读取

**状态扩展：**
```typescript
interface RejudgeState {
  inFlight: Set<string>;
  lastFinishedAt: Map<string, number>;
  lastError: Map<string, string | null>;  // 新增：topic id → error (null = 成功)
}
```

**后台函数：**
```typescript
async function runRejudgeInBackground(state: RejudgeState, id: string): Promise<void> {
  try {
    const result = await rejudgeTopicById(id);
    if (result.status !== "ok") {
      state.lastError.set(id, result.status);  // not_found / empty
    } else {
      state.lastError.set(id, null);  // 成功
    }
    // 刷新看板快照（best-effort）
    await writeBoardSnapshot().catch((e) => console.error("[trae] writeBoardSnapshot failed:", e));
  } catch (error) {
    state.lastError.set(id, error instanceof Error ? error.message : "Pipeline failed.");
  } finally {
    const finishedAt = Date.now();
    pruneLastFinished(state, finishedAt);
    state.lastFinishedAt.set(id, finishedAt);
    state.inFlight.delete(id);
  }
}
```

### 2. `app/project/project-detail-client.tsx` — 客户端轮询

**`handleRejudge` 改造：**
- POST 后如果返回 `{ ok: true, started: true }`，不立即显示成功/失败
- 保持 `rejudging = true`，启动轮询
- 每 3 秒 GET rejudge 状态端点
- `running: false` 时：如果 `error === null` → 拉取最新 topic detail 显示成功；否则显示失败
- 超时 10 分钟停止轮询并提示超时

**轮询模式参考** `app/contest-client.tsx` 的 `RunButton` 组件（L621-663）：
- `useRef<number | null>` 存 interval id
- `setInterval` 3000ms
- 组件卸载时 `clearInterval`

**类型更新：** `RejudgeResponse` 增加 `started?: boolean`

## 不改的部分

- `lib/trae/judge.ts` 的 `rejudgeTopicById` 逻辑不变（评分流程本身正确）
- `maxDuration = 60` 保留（POST 现在立即返回，不再需要长时间运行）
- cooldown / 并发限制逻辑不变

## 验证

1. 本地启动 dev server，打开项目详情页，点击"重新评分"
2. 确认 POST 立即返回 `{ ok: true, started: true }`，UI 显示"评分已经开始，请耐心等待"
3. 等待几分钟后，确认轮询检测到完成并显示新分数
4. 运行现有测试：`npm test` 确认无回归
5. 检查 `tests/contest-route-pages.test.ts` 中 rejudge 相关的断言是否需要更新
