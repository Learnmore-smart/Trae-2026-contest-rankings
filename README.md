# TRAE AI 创造力大赛第三方 AI 评分榜

公开路径：`/trae-contest-2026`

本站是第三方 AI 模拟评分榜。评分由 AI 根据 TRAE 中文社区公开帖子内容生成，仅供学习、观摩和参考，不代表 TRAE 官方结果，不冒充官方评分，也不预测最终结果。

## 技术栈

- Next.js App Router + TypeScript
- Tailwind CSS
- Firebase Admin SDK + Firestore
- NVIDIA and OpenRouter OpenAI-compatible free chat completions
- Node 22 built-in TypeScript strip for local worker scripts

## 环境变量

复制 `.env.example` 为 `.env.local`，至少配置：

- `NVIDIA_API_KEY`
- `OPENROUTER_API_KEY`
- `TRAE_ADMIN_TOKEN`
- `TRAE_CRON_SECRET`
- `FIREBASE_SERVICE_ACCOUNT_KEY` 或 `GOOGLE_APPLICATION_CREDENTIALS`

AI provider 策略必须保持 zero-budget，只使用免费 endpoint，不接入官方 DeepSeek paid API，也不自动切到任何付费 provider。

Provider 顺序：

1. NVIDIA free endpoint
2. OpenRouter free models

默认模型：

- NVIDIA primary: `deepseek-ai/deepseek-v4-pro`
- NVIDIA fallback: `minimaxai/minimax-m3`
- OpenRouter primary: `openai/gpt-oss-120b`
- OpenRouter fallback: `nvidia/nemotron-3-ultra-550b-a55b:free`, `google/gemma-4-31b-it:free`

所有模型调用统一走 `callLLMWithFallback()`。遇到 429/5xx/timeout/invalid JSON 会按 `AI_MAX_RETRIES_PER_MODEL` 和指数退避处理，再切换同 provider fallback；NVIDIA 全部失败后才尝试 OpenRouter。所有免费模型不可用或 JSON 无法校验时会记录 `judge_error`，等待下次定时任务重试。

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

给 jobs 配置 Firestore、NVIDIA、OpenRouter、TRAE 环境变量，并授予 Firestore 访问权限。

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

没有 Firestore 凭据时，公开页面仍会启动并显示空状态；实际抓取、匹配和评分需要 Firestore、NVIDIA/OpenRouter 免费 endpoint 环境变量。
