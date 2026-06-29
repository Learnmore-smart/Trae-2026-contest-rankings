"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ExternalLink, ShieldAlert, Sparkles } from "lucide-react";
import type { RankingItem } from "@/lib/trae/types";

function fmt(value: string | null | undefined): string {
  if (!value) return "暂无";
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function ScoreBlock({ label, value, max }: { label: string; value?: number | null; max: number }) {
  const percent = typeof value === "number" ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.055] p-4">
      <div className="flex items-center justify-between text-sm text-slate-300">
        <span>{label}</span>
        <span>{typeof value === "number" ? `${value}/${max}` : "未评分"}</span>
      </div>
      <div className="mt-3 h-2 rounded-full bg-white/10">
        <div className="h-full rounded-full bg-gradient-to-r from-cyan-300 to-emerald-300" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

function TextList({ title, items }: { title: string; items?: string[] }) {
  return (
    <section className="rounded-lg border border-white/10 bg-white/[0.055] p-5">
      <h2 className="text-lg font-bold text-white">{title}</h2>
      {items?.length ? (
        <ul className="mt-4 space-y-2 text-sm leading-6 text-slate-300">
          {items.map((item) => (
            <li key={item} className="border-l border-cyan-300/40 pl-3">
              {item}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-sm text-slate-500">暂无内容</p>
      )}
    </section>
  );
}

export default function ProjectDetailClient({ id }: { id: string }) {
  const [item, setItem] = useState<RankingItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/trae-contest/topics/${encodeURIComponent(id)}`, { cache: "no-store" });
        if (!response.ok) throw new Error(response.status === 404 ? "作品不存在或不是初赛作品" : "详情加载失败");
        const payload = (await response.json()) as RankingItem;
        if (!cancelled) setItem(payload);
      } catch (caught) {
        if (!cancelled) setError(caught instanceof Error ? caught.message : "未知错误");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  return (
    <main className="score-grid min-h-screen px-4 py-6 text-slate-100 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-6xl">
        <Link href="/trae-contest-2026" className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm text-slate-300 hover:bg-white/10">
          <ArrowLeft className="h-4 w-4" />
          返回榜单
        </Link>

        {loading ? <div className="mt-8 h-96 animate-pulse rounded-lg border border-white/10 bg-white/[0.055]" /> : null}
        {error ? <div className="mt-8 rounded-lg border border-rose-300/25 bg-rose-400/10 p-8 text-rose-100">{error}</div> : null}

        {!loading && item ? (
          <div className="mt-8">
            <header className="rounded-lg border border-white/10 bg-white/[0.065] p-6 shadow-2xl shadow-black/25 backdrop-blur">
              <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2 text-sm text-slate-400">
                    <span>{item.topic.authorName}</span>
                    <span>·</span>
                    <span>{item.topic.track ?? "未知赛道"}</span>
                    <span>·</span>
                    <span>评分时间 {fmt(item.evaluation?.createdAt)}</span>
                  </div>
                  <h1 className="mt-3 max-w-4xl text-3xl font-black leading-tight text-white sm:text-5xl">{item.topic.title}</h1>
                  <div className="mt-5 flex flex-wrap gap-3">
                    <a href={item.topic.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-4 py-2 text-sm hover:bg-white/10">
                      <ExternalLink className="h-4 w-4" />
                      原帖链接
                    </a>
                    {item.topic.demoUrl ? (
                      <a href={item.topic.demoUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-lg bg-cyan-300 px-4 py-2 text-sm font-bold text-slate-950 hover:bg-cyan-200">
                        <Sparkles className="h-4 w-4" />
                        Demo 体验
                      </a>
                    ) : null}
                  </div>
                </div>
                <div className="rounded-lg border border-cyan-300/20 bg-cyan-300/10 p-5 text-center">
                  <div className="text-xs text-cyan-100">综合分</div>
                  <div className="text-6xl font-black text-white">{item.evaluation?.totalScore ?? "N/A"}</div>
                  <div className="text-xs text-slate-300">置信度 {item.evaluation?.confidenceScore ?? "N/A"}%</div>
                </div>
              </div>
            </header>

            <section className="mt-5 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
              <ScoreBlock label="创新性" value={item.evaluation?.innovationScore} max={30} />
              <ScoreBlock label="实用性" value={item.evaluation?.practicalityScore} max={30} />
              <ScoreBlock label="完成度" value={item.evaluation?.completionScore} max={20} />
              <ScoreBlock label="设计体验" value={item.evaluation?.designScore} max={20} />
            </section>

            <section className="mt-5 rounded-lg border border-white/10 bg-white/[0.055] p-6">
              <h2 className="text-xl font-bold text-white">评分解释</h2>
              <p className="mt-3 text-sm leading-7 text-slate-300">{item.evaluation?.summary ?? "该作品尚未完成 AI 评分。"}</p>
              {item.evaluation?.dimensionComments ? (
                <div className="mt-5 grid gap-3 md:grid-cols-2">
                  {Object.entries(item.evaluation.dimensionComments).map(([key, value]) => (
                    <div key={key} className="rounded-md border border-white/10 bg-black/20 p-4 text-sm leading-6 text-slate-300">
                      <div className="mb-1 font-semibold text-cyan-100">{key}</div>
                      {value}
                    </div>
                  ))}
                </div>
              ) : null}
            </section>

            <div className="mt-5 grid gap-4 lg:grid-cols-3">
              <TextList title="优势" items={item.evaluation?.strengths} />
              <TextList title="不足" items={item.evaluation?.weaknesses} />
              <TextList title="优化建议" items={item.evaluation?.suggestions} />
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              <section className="rounded-lg border border-amber-300/20 bg-amber-300/10 p-5">
                <h2 className="inline-flex items-center gap-2 text-lg font-bold text-amber-100">
                  <ShieldAlert className="h-5 w-5" />
                  合规/材料风险
                </h2>
                {item.evaluation?.complianceRisks?.length ? (
                  <ul className="mt-4 space-y-2 text-sm leading-6 text-amber-50">
                    {item.evaluation.complianceRisks.map((risk) => (
                      <li key={risk} className="border-l border-amber-200/50 pl-3">
                        {risk}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-4 text-sm text-amber-100/70">暂无明显风险</p>
                )}
              </section>

              <section className="rounded-lg border border-white/10 bg-white/[0.055] p-5">
                <h2 className="text-lg font-bold text-white">报名匹配与方向一致性</h2>
                {item.match?.signupTopicId ? (
                  <div className="mt-4 space-y-2 text-sm leading-6 text-slate-300">
                    <p>匹配报名帖：{item.match.signupTopicId}</p>
                    <p>匹配方式：{item.match.matchMethod}，置信度 {item.match.matchConfidence}%</p>
                    <p>方向一致性：{item.match.directionConsistencyScore ?? "未知"}/10</p>
                    <p>风险：{item.match.mismatchRisk}</p>
                    <p>{item.match.directionConsistencyComment}</p>
                  </div>
                ) : (
                  <p className="mt-4 text-sm leading-6 text-slate-300">
                    暂未匹配到报名帖，不代表未报名，可能是用户名或标题无法自动匹配。
                  </p>
                )}
                {item.evaluation?.matchComment ? <p className="mt-4 text-sm leading-6 text-cyan-100">{item.evaluation.matchComment}</p> : null}
              </section>
            </div>

            <footer className="mt-6 rounded-lg border border-white/10 bg-black/20 p-4 text-sm text-slate-400">
              使用模型：{item.evaluation?.model ?? "未评分"} · 评分版本：{item.evaluation?.promptVersion ?? "N/A"} · 本站非 TRAE 官方评分。
            </footer>
          </div>
        ) : null}
      </div>
    </main>
  );
}
