"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, KeyRound, Play, RefreshCw } from "lucide-react";
import type { TraeRun } from "@/lib/trae/types";

interface Action {
  label: string;
  endpoint: string;
  body?: Record<string, unknown>;
}

const ACTIONS: Action[] = [
  { label: "抓取报名专区", endpoint: "/api/trae-contest/admin/scrape", body: { sourceType: "signup" } },
  { label: "抓取初赛专区", endpoint: "/api/trae-contest/admin/scrape", body: { sourceType: "preliminary" } },
  { label: "执行报名/初赛匹配", endpoint: "/api/trae-contest/admin/match" },
  { label: "评分未评分初赛作品", endpoint: "/api/trae-contest/admin/judge", body: { mode: "unjudged" } },
  { label: "重评内容变化作品", endpoint: "/api/trae-contest/admin/judge", body: { mode: "changed" } },
  { label: "重评低置信度作品", endpoint: "/api/trae-contest/admin/judge", body: { mode: "low-confidence" } }
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
      const response = await fetch("/api/trae-contest/admin/runs", {
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

  async function runAction(action: Action) {
    if (!token) {
      setMessage("请输入 TRAE_ADMIN_TOKEN");
      return;
    }
    setBusy(action.label);
    setMessage(null);
    try {
      const response = await fetch(action.endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(action.body ?? {})
      });
      const text = await response.text();
      if (!response.ok) throw new Error(text);
      setMessage(`${action.label} 已触发：${text.slice(0, 300)}`);
      await loadRuns();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "操作失败");
    } finally {
      setBusy(null);
    }
  }

  return (
    <main className="score-grid min-h-screen px-4 py-6 text-slate-100 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-6xl">
        <Link href="/trae-contest-2026" className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm text-slate-300 hover:bg-white/10">
          <ArrowLeft className="h-4 w-4" />
          返回公开榜单
        </Link>

        <header className="mt-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/25 bg-cyan-300/10 px-3 py-1 text-xs text-cyan-100">
            <KeyRound className="h-3.5 w-3.5" />
            Admin
          </div>
          <h1 className="mt-4 text-4xl font-black text-white">TRAE 评分榜运维面板</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
            输入 admin token 后可手动触发公开数据抓取、报名匹配和 OpenRouter 评分。长任务更适合放到 Cloud Run Job。
          </p>
        </header>

        <section className="mt-6 rounded-lg border border-white/10 bg-white/[0.06] p-5">
          <label className="text-sm text-slate-300">TRAE_ADMIN_TOKEN</label>
          <input
            value={token}
            onChange={(event) => saveToken(event.target.value)}
            type="password"
            className="mt-2 w-full rounded-lg border border-white/10 bg-black/30 px-4 py-3 text-white outline-none focus:border-cyan-300/50"
            placeholder="输入 admin token"
          />
        </section>

        <section className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {ACTIONS.map((action) => (
            <button
              key={action.label}
              type="button"
              disabled={Boolean(busy)}
              onClick={() => void runAction(action)}
              className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.06] p-4 text-left text-sm font-semibold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {action.label}
              <Play className="h-4 w-4 text-cyan-200" />
            </button>
          ))}
        </section>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => void loadRuns()}
            disabled={!token || Boolean(busy)}
            className="inline-flex items-center gap-2 rounded-lg bg-cyan-300 px-4 py-2 text-sm font-bold text-slate-950 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RefreshCw className="h-4 w-4" />
            刷新 runs
          </button>
          {busy ? <span className="text-sm text-cyan-100">正在执行：{busy}</span> : null}
        </div>

        {message ? <div className="mt-5 rounded-lg border border-white/10 bg-black/30 p-4 text-sm leading-6 text-slate-300">{message}</div> : null}

        <section className="mt-6 rounded-lg border border-white/10 bg-white/[0.055] p-5">
          <h2 className="text-xl font-bold text-white">最近 runs</h2>
          {runs.length ? (
            <div className="mt-4 space-y-3">
              {runs.map((run) => (
                <div key={run.id} className="rounded-lg border border-white/10 bg-black/20 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="font-semibold text-white">{run.type} · {run.sourceType ?? "all"}</div>
                    <div className="text-sm text-slate-400">{run.status} · {fmt(run.finishedAt)}</div>
                  </div>
                  <div className="mt-2 grid gap-2 text-xs text-slate-400 sm:grid-cols-4">
                    <span>pages {run.pagesScanned ?? "-"}</span>
                    <span>topics {run.topicsFound ?? "-"}</span>
                    <span>evaluated {run.evaluatedCount ?? "-"}</span>
                    <span>failed {run.failedCount ?? "-"}</span>
                  </div>
                  {run.error ? <p className="mt-3 text-sm text-rose-200">{run.error}</p> : null}
                  {run.logs?.length ? <p className="mt-3 text-xs text-slate-500">{run.logs.at(-1)}</p> : null}
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-4 text-sm text-slate-500">暂无 run 记录，或 Firestore 尚未配置。</p>
          )}
        </section>
      </div>
    </main>
  );
}
