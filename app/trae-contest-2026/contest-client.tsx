"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Activity, ArrowDownWideNarrow, ExternalLink, Gauge, RefreshCw, Search, ShieldAlert, Trophy } from "lucide-react";
import type { RankingItem, StatsPayload } from "@/lib/trae/types";

const TRACKS = ["全部赛道", "效率工具", "创意娱乐", "教育学习", "生活服务", "开发者工具", "硬件交互", "AI 应用", "游戏", "公益", "商业"];
const SORTS = [
  ["total", "综合分"],
  ["innovation", "创新性"],
  ["practicality", "实用性"],
  ["completion", "完成度"],
  ["design", "设计体验"],
  ["confidence", "置信度"],
  ["views", "浏览量"],
  ["replies", "回复数"],
  ["updated", "更新时间"]
];

function fmtDate(value: string | null | undefined): string {
  if (!value) return "暂无";
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function score(value: number | null | undefined, suffix = ""): string {
  if (typeof value !== "number") return "未评分";
  return `${Math.round(value)}${suffix}`;
}

function Progress({ label, value, max }: { label: string; value?: number | null; max: number }) {
  const percent = typeof value === "number" ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs text-slate-300">
        <span>{label}</span>
        <span>{typeof value === "number" ? `${value}/${max}` : "N/A"}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full bg-gradient-to-r from-cyan-300 via-emerald-300 to-amber-200" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

function StatCard({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.055] p-4 shadow-2xl shadow-black/20 backdrop-blur">
      <div className="text-xs text-slate-400">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-white">{value}</div>
      {hint ? <div className="mt-1 text-xs text-slate-500">{hint}</div> : null}
    </div>
  );
}

function riskLabel(item: RankingItem): string {
  if (!item.evaluation) return "待评分";
  if ((item.evaluation.complianceRisks?.length ?? 0) >= 3 || item.evaluation.complianceRiskScore >= 7) return "高风险";
  if ((item.evaluation.complianceRisks?.length ?? 0) > 0 || item.evaluation.complianceRiskScore >= 3) return "有风险";
  return "低风险";
}

function matchLabel(item: RankingItem): string {
  if (!item.match?.signupTopicId) return "未匹配报名";
  if (item.match.mismatchRisk === "high") return "方向高风险";
  if (item.match.mismatchRisk === "medium") return "需复核";
  return `已匹配 ${item.match.matchConfidence}%`;
}

export default function ContestClient() {
  const [stats, setStats] = useState<StatsPayload | null>(null);
  const [items, setItems] = useState<RankingItem[]>([]);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState("");
  const [track, setTrack] = useState("全部赛道");
  const [sort, setSort] = useState("total");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const queryString = useMemo(() => {
    const params = new URLSearchParams({ page: "1", pageSize: "24", sort });
    if (q.trim()) params.set("q", q.trim());
    if (track !== "全部赛道") params.set("track", track);
    return params.toString();
  }, [q, sort, track]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [statsResponse, topicsResponse] = await Promise.all([
        fetch("/api/trae-contest/stats", { cache: "no-store" }),
        fetch(`/api/trae-contest/topics?${queryString}`, { cache: "no-store" })
      ]);
      if (!statsResponse.ok || !topicsResponse.ok) throw new Error("榜单数据加载失败");
      const statsPayload = (await statsResponse.json()) as StatsPayload;
      const topicsPayload = (await topicsResponse.json()) as { items: RankingItem[]; total: number; message?: string };
      setStats(statsPayload);
      setItems(topicsPayload.items ?? []);
      setTotal(topicsPayload.total ?? 0);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "未知错误");
    } finally {
      setLoading(false);
    }
  }, [queryString]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const key = "trae-contest-session-id";
    const existing = window.sessionStorage.getItem(key);
    const sessionId = existing || crypto.randomUUID();
    window.sessionStorage.setItem(key, sessionId);
    const heartbeat = () => {
      void fetch("/api/trae-contest/presence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId })
      }).catch(() => undefined);
    };
    heartbeat();
    const timer = window.setInterval(heartbeat, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <main className="score-grid min-h-screen overflow-hidden px-4 py-6 text-slate-100 sm:px-6 lg:px-10">
      <section className="mx-auto max-w-7xl">
        <div className="flex flex-col gap-8 py-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-4xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/25 bg-cyan-300/10 px-3 py-1 text-xs font-medium text-cyan-100">
              <Trophy className="h-3.5 w-3.5" />
              第三方 AI 模拟评分榜
            </div>
            <h1 className="mt-5 text-4xl font-black leading-tight text-white sm:text-6xl">
              TRAE AI 创造力大赛 · 第三方 AI 评分榜
            </h1>
            <p className="mt-5 max-w-3xl text-base leading-7 text-slate-300 sm:text-lg">
              本站评分由 AI 根据公开帖子内容生成，仅供学习、观摩和参考，不代表 TRAE 官方结果，也不冒充官方评分或预测最终名次。
            </p>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex w-fit items-center gap-2 rounded-lg border border-white/15 bg-white/10 px-4 py-3 text-sm font-semibold text-white shadow-xl shadow-black/20 transition hover:bg-white/15"
          >
            <RefreshCw className="h-4 w-4" />
            刷新榜单
          </button>
        </div>

        <div className="mb-7 rounded-lg border border-amber-300/25 bg-amber-300/10 px-4 py-3 text-sm leading-6 text-amber-100">
          Disclaimer：本站评分由 AI 根据 TRAE 中文社区公开帖子内容生成，仅供学习、观摩和参考，不代表 TRAE 官方结果。
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <StatCard label="已抓取报名数" value={stats?.signupCount ?? 0} />
          <StatCard label="已抓取初赛数" value={stats?.preliminaryCount ?? 0} />
          <StatCard label="已评分初赛数" value={stats?.evaluatedCount ?? 0} />
          <StatCard label="已匹配报名/初赛数" value={stats?.matchedCount ?? 0} />
          <StatCard label="最后更新时间" value={fmtDate(stats?.lastUpdatedAt)} />
          <StatCard label="当前在线人数" value={stats?.onlineCount ?? 0} hint="2 分钟内心跳" />
        </div>

        <div className="mt-8 flex flex-col gap-3 rounded-lg border border-white/10 bg-black/20 p-3 backdrop-blur lg:flex-row lg:items-center">
          <label className="flex min-h-11 flex-1 items-center gap-2 rounded-md border border-white/10 bg-white/[0.06] px-3 text-sm text-slate-300">
            <Search className="h-4 w-4 text-cyan-200" />
            <input
              value={q}
              onChange={(event) => setQ(event.target.value)}
              placeholder="搜索标题、用户名、摘要或标签"
              className="w-full bg-transparent text-white outline-none placeholder:text-slate-500"
            />
          </label>
          <label className="flex min-h-11 items-center gap-2 rounded-md border border-white/10 bg-white/[0.06] px-3 text-sm text-slate-300">
            <Gauge className="h-4 w-4 text-emerald-200" />
            <select value={track} onChange={(event) => setTrack(event.target.value)} className="bg-transparent text-white outline-none">
              {TRACKS.map((item) => (
                <option key={item} value={item} className="bg-slate-950 text-white">
                  {item}
                </option>
              ))}
            </select>
          </label>
          <label className="flex min-h-11 items-center gap-2 rounded-md border border-white/10 bg-white/[0.06] px-3 text-sm text-slate-300">
            <ArrowDownWideNarrow className="h-4 w-4 text-amber-200" />
            <select value={sort} onChange={(event) => setSort(event.target.value)} className="bg-transparent text-white outline-none">
              {SORTS.map(([value, label]) => (
                <option key={value} value={value} className="bg-slate-950 text-white">
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-6 flex items-center justify-between text-sm text-slate-400">
          <span>主榜单仅展示初赛 Demo 帖，共 {total} 个结果</span>
          <span>报名帖仅用于匹配，不进入榜单</span>
        </div>

        {error ? (
          <div className="mt-6 rounded-lg border border-rose-300/25 bg-rose-400/10 p-6 text-rose-100">{error}</div>
        ) : null}

        {loading ? (
          <div className="mt-8 grid gap-4 lg:grid-cols-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-72 animate-pulse rounded-lg border border-white/10 bg-white/[0.055]" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="mt-8 rounded-lg border border-white/10 bg-white/[0.055] p-10 text-center shadow-2xl shadow-black/20 backdrop-blur">
            <Activity className="mx-auto h-10 w-10 text-cyan-200" />
            <h2 className="mt-4 text-2xl font-bold text-white">榜单暂时为空</h2>
            <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-slate-300">
              还没有可展示的初赛评分数据。配置 Firestore 与 OpenRouter 后，可在 admin 页面或本地脚本抓取公开帖子、执行匹配并启动评分。
            </p>
            {stats?.message ? <p className="mt-3 text-xs text-slate-500">{stats.message}</p> : null}
          </div>
        ) : (
          <div className="mt-8 grid gap-4 lg:grid-cols-2">
            {items.map((item) => (
              <article key={item.topic.id} className="relative overflow-hidden rounded-lg border border-white/10 bg-white/[0.065] p-5 shadow-2xl shadow-black/25 backdrop-blur">
                <div className="absolute right-4 top-4 rounded-full border border-white/10 bg-black/30 px-3 py-1 text-sm font-black text-cyan-100">
                  #{item.rank}
                </div>
                <div className="pr-16">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                    <span>{item.topic.authorName}</span>
                    <span className="h-1 w-1 rounded-full bg-slate-600" />
                    <span>{item.topic.track ?? "未知赛道"}</span>
                  </div>
                  <h2 className="mt-2 line-clamp-2 text-xl font-bold leading-snug text-white">{item.topic.title}</h2>
                </div>

                <div className="mt-5 flex items-end justify-between gap-4">
                  <div>
                    <div className="text-xs text-slate-400">综合分</div>
                    <div className="text-5xl font-black text-white">{score(item.evaluation?.totalScore)}</div>
                  </div>
                  <div className="text-right text-xs text-slate-400">
                    <div>置信度 {score(item.evaluation?.confidenceScore, "%")}</div>
                    <div>浏览 {item.topic.viewCount ?? "N/A"} · 回复 {item.topic.replyCount ?? "N/A"}</div>
                  </div>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <Progress label="创新性" value={item.evaluation?.innovationScore} max={30} />
                  <Progress label="实用性" value={item.evaluation?.practicalityScore} max={30} />
                  <Progress label="完成度" value={item.evaluation?.completionScore} max={20} />
                  <Progress label="设计体验" value={item.evaluation?.designScore} max={20} />
                </div>

                <p className="mt-5 line-clamp-2 text-sm leading-6 text-slate-300">
                  {item.evaluation?.summary ?? "该初赛作品已抓取，正在等待 AI 评分。"}
                </p>

                <div className="mt-5 flex flex-wrap gap-2">
                  <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-xs text-cyan-100">{matchLabel(item)}</span>
                  <span className="inline-flex items-center gap-1 rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-1 text-xs text-amber-100">
                    <ShieldAlert className="h-3 w-3" />
                    {riskLabel(item)}
                  </span>
                </div>

                <div className="mt-6 flex flex-wrap gap-3">
                  <a
                    href={item.topic.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-4 py-2 text-sm text-slate-200 transition hover:bg-white/10"
                  >
                    <ExternalLink className="h-4 w-4" />
                    原帖链接
                  </a>
                  <Link
                    href={`/trae-contest-2026/project/${encodeURIComponent(item.topic.id)}`}
                    className="inline-flex items-center gap-2 rounded-lg bg-cyan-300 px-4 py-2 text-sm font-bold text-slate-950 transition hover:bg-cyan-200"
                  >
                    查看详情
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
