"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, KeyRound, Play, RefreshCw, ShieldCheck } from "lucide-react";
import type { TraeRun } from "@/lib/trae/types";

const API_BASE = process.env.NEXT_PUBLIC_BASE_PATH || "";

interface Action {
  label: string;
  description: string;
  endpoint: string;
  body?: Record<string, unknown>;
  // Judging now runs vision + 4-evaluator + consensus calls per topic, so a single
  // request asking for 50 topics can never finish inside a serverless timeout. Loop
  // small batches client-side instead, so each request fits and progress is visible.
  loop?: boolean;
  batchMax?: number;
}

const ACTIONS: Action[] = [
  { label: "抓取报名专区", description: "更新报名帖，供后续方向匹配使用。", endpoint: "/api/trae-contest/admin/scrape", body: { sourceType: "signup" } },
  { label: "抓取初赛专区", description: "更新会进入榜单候选池的 Demo 帖。", endpoint: "/api/trae-contest/admin/scrape", body: { sourceType: "preliminary" } },
  { label: "执行报名/初赛匹配", description: "按作者和标题相似度关联报名帖。", endpoint: "/api/trae-contest/admin/match" },
  { label: "评分未评分作品", description: "只评尚未生成结果的初赛作品。每批少量提交，自动循环直到评完。", endpoint: "/api/trae-contest/admin/judge", body: { mode: "unjudged" }, loop: true, batchMax: 3 },
  { label: "重评内容变化作品", description: "内容 hash 变化后重新评分。每批少量提交，自动循环直到评完。", endpoint: "/api/trae-contest/admin/judge", body: { mode: "changed" }, loop: true, batchMax: 3 },
  { label: "重评低置信度作品", description: "复跑低置信度模型输出。每批少量提交，自动循环直到评完。", endpoint: "/api/trae-contest/admin/judge", body: { mode: "low-confidence" }, loop: true, batchMax: 3 }
];

function fmt(value: string | null): string {
  if (!value) return "进行中";
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function statusClass(status: TraeRun["status"]): string {
  if (status === "success") return "border-emerald-300/20 bg-emerald-300/10 text-emerald-100";
  if (status === "partial") return "border-amber-300/20 bg-amber-300/10 text-amber-100";
  if (status === "error") return "border-red-300/20 bg-red-300/10 text-red-100";
  return "border-blue-300/20 bg-blue-300/10 text-blue-100";
}

export default function AdminClient() {
  const [token, setToken] = useState("");
  const [runs, setRuns] = useState<TraeRun[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setToken(window.localStorage.getItem("trae-admin-token") ?? "");
  }, []);

  function saveToken(value: string) {
    setToken(value);
    window.localStorage.setItem("trae-admin-token", value);
  }

  async function loadRuns() {
    if (!token) return;
    setBusy("runs");
    setMessage(null);
    try {
      const response = await fetch(`${API_BASE}/api/trae-contest/admin/runs`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store"
      });
      if (!response.ok) throw new Error(await response.text());
      const payload = (await response.json()) as { runs: TraeRun[] };
      setRuns(payload.runs ?? []);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "加载 runs 失败");
    } finally {
      setBusy(null);
    }
  }

  async function postAction(action: Action, body: Record<string, unknown>) {
    const response = await fetch(`${API_BASE}${action.endpoint}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });
    const text = await response.text();
    if (!response.ok) throw new Error(text);
    return text;
  }

  async function runAction(action: Action) {
    if (!token) {
      setMessage("请输入 TRAE_ADMIN_TOKEN");
      return;
    }
    setBusy(action.label);
    setMessage(null);
    try {
      if (!action.loop) {
        const text = await postAction(action, action.body ?? {});
        setMessage(`${action.label} 已触发：${text.slice(0, 500)}`);
        await loadRuns();
        return;
      }

      // Each topic now runs vision + 4-evaluator + consensus calls, so one big
      // request can never finish inside a serverless timeout. Loop small batches
      // until a batch judges nothing, so this reliably drains the whole backlog
      // instead of silently dying mid-request after a couple of topics.
      let totalEvaluated = 0;
      let totalFailed = 0;
      const maxIterations = 500;
      for (let i = 0; i < maxIterations; i += 1) {
        const text = await postAction(action, { ...(action.body ?? {}), max: action.batchMax ?? 3 });
        const payload = JSON.parse(text) as { result?: { evaluatedCount?: number; failedCount?: number } };
        const evaluatedCount = payload.result?.evaluatedCount ?? 0;
        const failedCount = payload.result?.failedCount ?? 0;
        totalEvaluated += evaluatedCount;
        totalFailed += failedCount;
        setMessage(`${action.label} 进行中：已评 ${totalEvaluated}，失败 ${totalFailed} …`);
        if (evaluatedCount + failedCount === 0) break;
      }
      setMessage(`${action.label} 完成：共评 ${totalEvaluated}，失败 ${totalFailed}。`);
      await loadRuns();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "操作失败");
    } finally {
      setBusy(null);
    }
  }

  return (
    <main className="score-grid min-h-screen px-4 py-6 text-stone-100 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-7xl">
        <Link href="/" className="control-button ghost w-fit">
          <ArrowLeft className="h-4 w-4" />
          返回公开榜单
        </Link>

        <header className="surface-panel-strong mt-6 p-6 sm:p-8">
          <p className="eyebrow">Operator console</p>
          <div className="mt-3 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-4xl font-black text-white sm:text-5xl">TRAE 评分榜运行台</h1>
              <p className="mt-4 max-w-3xl text-sm leading-6 text-stone-300">
                手动触发抓取、匹配和评分。自动抓取由 cron endpoint 负责；这里用于立即补跑或排查最近 run 记录。
              </p>
            </div>
            <Link href="/dev" className="control-button ghost">
              本地 /dev
            </Link>
          </div>
        </header>

        <section className="mt-5 grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
          <div className="surface-panel p-5">
            <div className="flex items-center gap-2 text-sm font-bold text-white">
              <KeyRound className="h-4 w-4 text-[#f4c96b]" />
              TRAE_ADMIN_TOKEN
            </div>
            <input
              value={token}
              onChange={(event) => saveToken(event.target.value)}
              type="password"
              className="mt-4 min-h-12 w-full rounded-lg border border-white/12 bg-black/30 px-4 text-white outline-none transition focus:border-[#f4c96b]/70"
              placeholder="输入 admin token"
            />
            <div className="mt-4 rounded-lg border border-white/10 bg-black/20 p-4 text-xs leading-5 text-stone-400">
              token 只存在浏览器 localStorage，并在请求时作为 Bearer header 发给服务端，不会从环境变量打包进前端。
            </div>
          </div>

          <div className="surface-panel p-5">
            <div className="flex items-center gap-2 text-sm font-bold text-white">
              <ShieldCheck className="h-4 w-4 text-emerald-300" />
              自动抓取确认
            </div>
            <p className="mt-3 text-sm leading-6 text-stone-300">
              后台具备自动路径：`vercel.json` 会定时请求 `/api/trae-contest/cron/run-all`，route 会校验 `TRAE_CRON_SECRET`。本页动作是手动补跑，不是心跳触发。
            </p>
          </div>
        </section>

        <section className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {ACTIONS.map((action) => (
            <button
              key={action.label}
              type="button"
              disabled={Boolean(busy)}
              onClick={() => void runAction(action)}
              className="group rounded-lg border border-white/10 bg-white/[0.055] p-5 text-left transition hover:border-[#f4c96b]/40 hover:bg-[#f4c96b]/10 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span className="flex items-center justify-between gap-3 text-base font-black text-white">
                {action.label}
                <Play className="h-4 w-4 text-stone-400 transition group-hover:text-[#f4c96b]" />
              </span>
              <span className="mt-2 block text-sm leading-6 text-stone-400">{action.description}</span>
            </button>
          ))}
        </section>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button type="button" onClick={() => void loadRuns()} disabled={!token || Boolean(busy)} className="control-button">
            <RefreshCw className="h-4 w-4" />
            刷新 runs
          </button>
          {busy ? (
            <span
              role="status"
              className="inline-flex items-center gap-2 rounded-full border border-[#f4c96b]/20 bg-[#f4c96b]/10 px-3 py-1 text-sm font-medium text-[#f4c96b]"
            >
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              运行中
            </span>
          ) : null}
        </div>

        {message ? <div className="mt-5 rounded-lg border border-white/10 bg-black/30 p-4 text-sm leading-6 text-stone-300">{message}</div> : null}

        <section className="surface-panel mt-6 p-5">
          <h2 className="text-xl font-black text-white">最近 runs</h2>
          {runs.length ? (
            <div className="mt-4 grid gap-3">
              {runs.map((run) => (
                <div key={run.id} className="rounded-lg border border-white/10 bg-black/20 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="font-bold text-white">
                      {run.type} · {run.sourceType ?? "all"}
                    </div>
                    <div className={`rounded-full border px-3 py-1 text-xs font-bold ${statusClass(run.status)}`}>
                      {run.status} · {fmt(run.finishedAt)}
                    </div>
                  </div>
                  <div className="mt-3 grid gap-2 text-xs text-stone-400 sm:grid-cols-4">
                    <span>pages {run.pagesScanned ?? "-"}</span>
                    <span>topics {run.topicsFound ?? "-"}</span>
                    <span>evaluated {run.evaluatedCount ?? "-"}</span>
                    <span>failed {run.failedCount ?? "-"}</span>
                  </div>
                  {run.error ? <p className="mt-3 text-sm text-red-200">{run.error}</p> : null}
                  {run.logs?.length ? <p className="mt-3 text-xs leading-5 text-stone-500">{run.logs.at(-1)}</p> : null}
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-4 text-sm text-stone-500">暂无 run 记录，或 Firestore 尚未配置/未授权。</p>
          )}
        </section>
      </div>
    </main>
  );
}
