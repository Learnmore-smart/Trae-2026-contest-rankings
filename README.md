# TRAE AI 创造力大赛第三方 AI 评分榜

https://trae-2026-contest-rankings-494660453737.asia-east1.run.app/trae-contest-2026

公开路径：`/trae-contest-2026`

本站是第三方 AI 模拟评分榜。评分由 AI 根据 TRAE 中文社区公开帖子内容生成，仅供学习、观摩和参考，不代表 TRAE 官方结果，不冒充官方评分，也不预测最终结果。

## 技术栈

- Next.js App Router + TypeScript
- Tailwind CSS
- Firebase Admin SDK + Firestore
- Friend gateway and NVIDIA OpenAI-compatible free chat completions
- Node 22 built-in TypeScript strip for local worker scripts

## 环境变量

复制 `.env.example` 为 `.env.local`，至少配置：

- `TRAE_FRIEND_API`
- `NVIDIA_API_KEY`
- `TRAE_ADMIN_TOKEN`
- `TRAE_CRON_SECRET`
- `FIREBASE_SERVICE_ACCOUNT_KEY` 或 `GOOGLE_APPLICATION_CREDENTIALS`

AI provider 策略必须保持 zero-budget，只使用免费 endpoint，不接入官方 DeepSeek paid API，也不自动切到任何付费 provider。

Provider 顺序：

1. Friend gateway (`TRAE_FRIEND_BASE_URL`)
2. NVIDIA free endpoint

默认模型：

- Friend/NVIDIA text primary: `minimaxai/minimax-m3`
- Friend/NVIDIA text fallback: `google/gemma-4-31b-it`, `deepseek-ai/deepseek-v4-pro`, `z-ai/glm-5.2`
- Friend/NVIDIA image/vision primary: `minimaxai/minimax-m3`（`*_IMAGE_MODEL`）
- Friend/NVIDIA image/vision fallback: `google/gemma-4-31b-it`（`*_IMAGE_FALLBACK_MODEL`）

所有文本评分调用统一走 `callLLMWithFallback()`。遇到 429/5xx/timeout/invalid JSON 会按 `AI_MAX_RETRIES_PER_MODEL` 和指数退避处理，再切换同 provider fallback；Friend 全部失败后才尝试 NVIDIA。所有免费模型不可用或 JSON 无法校验时会记录 `judge_error`，等待下次定时任务重试。

### 多评委共识评分 + 真实视觉证据

每个帖子由 4 个独立 evaluator（产品价值、技术完成度、UX/设计、证据合规）各自打一次分，再由一个 consensus 裁判对比 4 份结果、给出唯一最终分——避免单一 LLM 主观打分（详见 `lib/trae/judge.ts` 的 `JUDGE_EVALUATOR_PROFILES` 和 `buildConsensusJudgePrompt`）。

评分前会先收集真实视觉证据（`lib/trae/vision.ts`），而不是只把图片链接和 Demo 网址当文字塞进 prompt：

- **帖子图片**：把帖子里最多 4 张图片以 `image_url` 形式发给 NVIDIA 视觉模型，要求客观描述实际看到的内容（真实产品界面 vs. 营销/概念图）。
- **Demo 截图**：通过免费、无需 API key 的 `image.thum.io` 截图代理渲染 Demo 网址并截图（等同于人类打开链接第一眼看到的画面），再让视觉模型描述这是可交互产品、纯静态落地页，还是打不开/报错页面——这正是用来纠正"静态网页也能拿高分"问题的证据来源。
- 任一环节失败（无图片、无 Demo、模型限流、截图失败）都会优雅降级为原有的"本轮未进行视觉识别/未进行交互式浏览"免责声明，不会让模型编造证据。
- 未做持久化缓存：每次评分都会重新采集视觉证据（未写入 Data Connect schema），后续如评分量增大可考虑按 `contentHash`/`demoUrl` 缓存。

## Firestore 设置

创建 Firestore Native mode 数据库。服务端使用 Firebase Admin SDK 写入这些 collections：

- `trae_topics`
- `trae_matches`
- `trae_evaluations`
- `trae_runs`
- `trae_presence`

部署 `firestore.rules` 可阻止客户端直接读写 Firestore。公开页面通过 Next.js API 返回经过清理的数据，不返回 raw HTML。

## 本地运行

```bash
npm install
npm run dev
```

Windows PowerShell 如果阻止 `npm.ps1`，使用：

```powershell
npm.cmd run dev
```

访问：

- Public: `http://localhost:5000/trae-contest-2026`
- Detail: `http://localhost:5000/trae-contest-2026/project/<topicId>`
- Admin: `http://localhost:5000/trae-contest-2026/admin`

## Worker scripts

```bash
npm run trae:scrape:signup
npm run trae:scrape:preliminary
npm run trae:scrape:all
npm run trae:match
npm run trae:judge
npm run trae:judge:changed
npm run trae:run-all
```

爬虫优先请求 Discourse JSON：category `.json`、分页 JSON、topic `.json`。JSON 不可用时 fallback 到公开 HTML 解析。每个域名请求至少间隔 800ms，每次 run 由这些变量限制规模：

- `TRAE_MAX_SCRAPE_PAGES_PER_RUN`
- `TRAE_MAX_TOPIC_DETAILS_PER_RUN`
- `TRAE_MAX_JUDGE_PER_RUN`

## Vercel 部署

1. 导入仓库到 Vercel。
2. 配置 `.env.example` 中的环境变量。
3. 部署后访问 `/trae-contest-2026`。
4. Admin 页面可手动触发 scrape/match/judge，但长任务更适合 Cloud Run Job。

## Google Cloud Run Job

构建并推送镜像：

```bash
gcloud builds submit --tag gcr.io/PROJECT_ID/trae-contest-rankings
```

创建 jobs，分别覆盖命令：

```bash
gcloud run jobs create trae-scrape-signup --image gcr.io/PROJECT_ID/trae-contest-rankings --region us-central1 --command npm --args run,trae:scrape:signup
gcloud run jobs create trae-scrape-preliminary --image gcr.io/PROJECT_ID/trae-contest-rankings --region us-central1 --command npm --args run,trae:scrape:preliminary
gcloud run jobs create trae-match --image gcr.io/PROJECT_ID/trae-contest-rankings --region us-central1 --command npm --args run,trae:match
gcloud run jobs create trae-judge --image gcr.io/PROJECT_ID/trae-contest-rankings --region us-central1 --command npm --args run,trae:judge
```

给 jobs 配置 Firestore、Friend、NVIDIA、TRAE 环境变量，并授予 Firestore 访问权限。

## Cloud Scheduler

默认北京时间可按你的 Cloud Scheduler 时区设置；示例使用 `America/Toronto`：

- 每天 03:00：执行 `trae-scrape-signup`
- 每天 03:20：执行 `trae-scrape-preliminary`
- 每天 03:40：执行 `trae-match`
- 每天 04:00：执行 `trae-judge`

也可以调用 API cron endpoint：

```bash
POST /api/trae-contest/cron/scrape-signup
POST /api/trae-contest/cron/scrape-preliminary
POST /api/trae-contest/cron/match
POST /api/trae-contest/cron/judge
```

Header:

```text
Authorization: Bearer $TRAE_CRON_SECRET
```

## 验证

```bash
npm run test
npm run typecheck
npm run lint
npm run build
```

没有 Firestore 凭据时，公开页面仍会启动并显示空状态；实际抓取、匹配和评分需要 Firestore、Friend/NVIDIA 免费 endpoint 环境变量。
