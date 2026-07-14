"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ExternalLink, ShieldAlert, Sparkles, Globe, Sun, Moon, Monitor, RefreshCw, Loader2 } from "lucide-react";
import { useContestLanguage, type ContestLanguage } from "../i18n";
import { useContestTheme, type ContestTheme } from "../theme";
import { NavMenu } from "../contest-client";
import type { RankingItem } from "@/lib/trae/types";

const API_BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "/trae-contest-2026";

const COPY = {
  zh: {
    settings: "设置",
    language: "语言",
    chooseLanguage: "切换语言",
    themeLight: "浅色",
    themeDark: "深色",
    themeSystem: "跟随系统",
    chooseTheme: "切换主题",
    languageZh: "中文",
    languageEn: "English",
    back: "返回榜单",
    noDate: "暂无",
    unrated: "未评分",
    missingContent: "暂无内容",
    notFound: "作品不存在或不是初赛作品",
    loadError: "详情加载失败",
    unknownError: "未知错误",
    unknownTrack: "未知赛道",
    scoredAt: "评分时间",
    source: "原帖链接",
    demo: "Demo 体验",
    rejudge: "重新评分",
    rejudging: "评分中…",
    rejudgeStarted: "评分已经开始，请耐心等待",
    rejudgeSuccess: "评分已更新。",
    rejudgeFailed: "重新评分失败，请稍后再试。",
    rejudgeTimeout: "评分超时，请稍后再试。",
    rejudgeCooldown: "刚刚已重新评分，请稍后再试。",
    rejudgeBusy: "评分服务繁忙，请稍后再试。",
    rejudgeInFlight: "该作品正在重新评分，请稍候。",
    rejudgeNotFound: "作品不存在或不是初赛作品。",
    rejudgeEmpty: "该作品内容为空或已删除，无法评分。",
    totalScore: "综合分",
    confidence: "置信度",
    dimensions: {
      innovation: "创新性",
      practicality: "实用性",
      completion: "完成度",
      design: "设计体验"
    },
    explanation: "评分解释",
    pending: "该作品尚未完成 AI 评分。",
    strengths: "优势",
    weaknesses: "不足",
    suggestions: "优化建议",
    compliance: "合规/材料风险",
    noRisk: "暂无明显风险",
    matchTitle: "报名匹配与方向一致性",
    matchedTopic: "匹配报名帖",
    matchMethod: "匹配方式",
    matchConfidence: "置信度",
    directionScore: "方向一致性",
    unknown: "未知",
    risk: "风险",
    unmatched: "暂未匹配到报名帖，不代表未报名，可能是用户名或标题无法自动匹配。",
    model: "使用模型",
    promptVersion: "评分版本",
    unofficial: "本站非 TRAE 官方评分。",
    loading: "加载中…"
  },
  en: {
    settings: "Settings",
    language: "Language",
    chooseLanguage: "Change language",
    themeLight: "Light",
    themeDark: "Dark",
    themeSystem: "System",
    chooseTheme: "Change theme",
    languageZh: "中文",
    languageEn: "English",
    back: "Back to rankings",
    noDate: "No data",
    unrated: "Unrated",
    missingContent: "No content yet",
    notFound: "Project does not exist or is not a preliminary entry",
    loadError: "Failed to load details",
    unknownError: "Unknown error",
    unknownTrack: "Unknown track",
    scoredAt: "Scored at",
    source: "Original post",
    demo: "Try Demo",
    rejudge: "Re-score",
    rejudging: "Scoring…",
    rejudgeStarted: "Scoring has started. Please wait.",
    rejudgeSuccess: "Score updated.",
    rejudgeFailed: "Re-scoring failed. Please try again later.",
    rejudgeTimeout: "Re-scoring timed out. Please try again later.",
    rejudgeCooldown: "Just re-scored. Please try again shortly.",
    rejudgeBusy: "Scoring service is busy. Please try again later.",
    rejudgeInFlight: "This project is already being re-scored. Please wait.",
    rejudgeNotFound: "Project not found or not a preliminary entry.",
    rejudgeEmpty: "This project has no content or was deleted; it cannot be scored.",
    totalScore: "Total score",
    confidence: "Confidence",
    dimensions: {
      innovation: "Innovation",
      practicality: "Practicality",
      completion: "Completion",
      design: "Design experience"
    },
    explanation: "Scoring explanation",
    pending: "This project has not completed AI scoring yet.",
    strengths: "Strengths",
    weaknesses: "Weaknesses",
    suggestions: "Suggestions",
    compliance: "Compliance/material risks",
    noRisk: "No obvious risks",
    matchTitle: "Signup match and direction consistency",
    matchedTopic: "Matched signup post",
    matchMethod: "Match method",
    matchConfidence: "confidence",
    directionScore: "Direction consistency",
    unknown: "Unknown",
    risk: "Risk",
    unmatched: "No signup post has been matched yet. This does not mean the project did not sign up; the username or title may not be automatically matchable.",
    model: "Model",
    promptVersion: "Scoring version",
    unofficial: "This site is not official TRAE scoring.",
    loading: "Loading…"
  }
};

function fmt(value: string | null | undefined, language: ContestLanguage): string {
  if (!value) return COPY[language].noDate;
  return new Intl.DateTimeFormat(language === "zh" ? "zh-CN" : "en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function ScoreBlock({ label, value, max, unrated }: { label: string; value?: number | null; max: number; unrated: string }) {
  const percent = typeof value === "number" ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return (
    <div className="surface-panel p-4">
      <div className="flex items-center justify-between text-sm text-[var(--ink-soft)]">
        <span>{label}</span>
        <span>{typeof value === "number" ? `${value}/${max}` : unrated}</span>
      </div>
      <div className="score-bar-track">
        <div className="score-bar-fill" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

function TextList({ title, items, emptyLabel }: { title: string; items?: string[]; emptyLabel: string }) {
  return (
    <section className="surface-panel p-5">
      <h2 className="text-base font-semibold text-white">{title}</h2>
      {items?.length ? (
        <ul className="mt-4 space-y-2 text-sm leading-6 text-slate-300">
          {items.map((item) => (
            <li key={item} className="border-l-2 border-[var(--cyan)]/40 pl-3">
              {item}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-sm text-slate-500">{emptyLabel}</p>
      )}
    </section>
  );
}

type Copy = (typeof COPY)[ContestLanguage];

function rejudgeNoticeTone(code: string | undefined): "info" | "error" {
  return code === "cooldown" || code === "busy" || code === "in_flight" ? "info" : "error";
}

function rejudgeNoticeText(code: string | undefined, t: Copy): string {
  switch (code) {
    case "cooldown":
      return t.rejudgeCooldown;
    case "busy":
      return t.rejudgeBusy;
    case "in_flight":
      return t.rejudgeInFlight;
    case "not_found":
      return t.rejudgeNotFound;
    case "empty":
      return t.rejudgeEmpty;
    default:
      return t.rejudgeFailed;
  }
}

export default function ProjectDetailClient({ id }: { id: string }) {
  const { language, setLanguage } = useContestLanguage();
  const { theme, setTheme } = useContestTheme();
  const t = COPY[language];
  const [item, setItem] = useState<RankingItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rejudging, setRejudging] = useState(false);
  const [rejudgeNotice, setRejudgeNotice] = useState<{ tone: "success" | "info" | "error"; text: string } | null>(null);
  const pollRef = useRef<number | null>(null);
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`${API_BASE}/api/trae-contest/topics/${encodeURIComponent(id)}`, { cache: "no-store" });
        if (!response.ok) throw new Error(response.status === 404 ? t.notFound : t.loadError);
        const payload = (await response.json()) as RankingItem;
        if (!cancelled) setItem(payload);
      } catch (caught) {
        if (!cancelled) setError(caught instanceof Error ? caught.message : t.unknownError);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [id, t.loadError, t.notFound, t.unknownError]);

  const stopRejudgePolling = useCallback(() => {
    if (pollRef.current !== null) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => stopRejudgePolling();
  }, [stopRejudgePolling]);

  const refreshTopicDetail = useCallback(async () => {
    try {
      const detailResponse = await fetch(`${API_BASE}/api/trae-contest/topics/${encodeURIComponent(id)}`, {
        cache: "no-store"
      });
      if (detailResponse.ok) {
        const freshItem = (await detailResponse.json()) as RankingItem;
        setItem(freshItem);
      }
    } catch {
      // Best-effort: scoring may have succeeded even if detail refresh fails.
    }
  }, [id]);

  const startRejudgePolling = useCallback(() => {
    stopRejudgePolling();
    // Fallback path only: older servers returned { started: true } and finished in the
    // background. Current servers await the full rejudge on POST (done: true). Polling
    // must not treat another instance's empty in-memory state as success.
    const baselineCreatedAt = item?.evaluation?.createdAt ?? null;
    pollRef.current = window.setInterval(async () => {
      try {
        const statusResponse = await fetch(`${API_BASE}/api/trae-contest/topics/${encodeURIComponent(id)}/rejudge`, {
          cache: "no-store"
        });
        const status = (await statusResponse.json().catch(() => null)) as
          | { running?: boolean; error?: string | null }
          | null;
        if (!status) return;
        if (status.running) return;

        // When status is not running, confirm via detail payload that a new evaluation exists.
        // Multi-instance Cloud Run GET may report running:false with error:null while work
        // never ran on this instance — do not toast success without a fresher evaluation.
        const detailResponse = await fetch(`${API_BASE}/api/trae-contest/topics/${encodeURIComponent(id)}`, {
          cache: "no-store"
        });
        if (!detailResponse.ok) return;
        const freshItem = (await detailResponse.json()) as RankingItem;
        const nextCreatedAt = freshItem.evaluation?.createdAt ?? null;
        const evaluationAdvanced =
          nextCreatedAt !== null && (baselineCreatedAt === null || nextCreatedAt !== baselineCreatedAt);

        if (evaluationAdvanced) {
          stopRejudgePolling();
          setItem(freshItem);
          setRejudgeNotice({ tone: "success", text: t.rejudgeSuccess });
          setRejudging(false);
          return;
        }

        if (status.error) {
          stopRejudgePolling();
          const code = status.error === "not_found" || status.error === "empty" ? status.error : "error";
          setRejudgeNotice({ tone: rejudgeNoticeTone(code), text: rejudgeNoticeText(code, t) });
          setRejudging(false);
        }
      } catch {
        // Transient network error — keep polling until timeout.
      }
    }, 3000);
    // 10-minute safety timeout: re-judge normally finishes in ~5-7 minutes.
    timeoutRef.current = window.setTimeout(() => {
      stopRejudgePolling();
      setRejudgeNotice({ tone: "error", text: t.rejudgeTimeout });
      setRejudging(false);
    }, 10 * 60 * 1000);
  }, [id, item?.evaluation?.createdAt, stopRejudgePolling, t]);

  async function handleRejudge() {
    if (rejudging) return;
    setRejudging(true);
    setRejudgeNotice({ tone: "info", text: t.rejudgeStarted });
    let polling = false;
    const maxBusyRetries = 3;
    try {
      let lastPayload: { ok?: boolean; done?: boolean; started?: boolean; error?: string; code?: string; retryAfterMs?: number } | null =
        null;
      let response: Response | null = null;

      for (let attempt = 0; attempt <= maxBusyRetries; attempt += 1) {
        response = await fetch(`${API_BASE}/api/trae-contest/topics/${encodeURIComponent(id)}/rejudge`, {
          method: "POST"
        });
        lastPayload = (await response.json().catch(() => null)) as
          | { ok?: boolean; done?: boolean; started?: boolean; error?: string; code?: string; retryAfterMs?: number }
          | null;

        // Current server: POST awaits the full rejudge and returns { ok, done }.
        if (response.ok && lastPayload?.ok && (lastPayload.done || !lastPayload.started)) {
          await refreshTopicDetail();
          setRejudgeNotice({ tone: "success", text: t.rejudgeSuccess });
          return;
        }

        // Legacy/async server: { started: true } then poll until evaluation advances.
        if (response.ok && lastPayload?.started) {
          polling = true;
          startRejudgePolling();
          return;
        }

        // Soft-retry when global slots are full; server may free a slot within seconds.
        if (lastPayload?.code === "busy" && attempt < maxBusyRetries) {
          const waitMs = Math.min(60_000, Math.max(8_000, lastPayload.retryAfterMs ?? 12_000));
          setRejudgeNotice({ tone: "info", text: t.rejudgeBusy });
          await new Promise((resolve) => window.setTimeout(resolve, waitMs));
          setRejudgeNotice({ tone: "info", text: t.rejudgeStarted });
          continue;
        }

        setRejudgeNotice({ tone: rejudgeNoticeTone(lastPayload?.code), text: rejudgeNoticeText(lastPayload?.code, t) });
        return;
      }

      setRejudgeNotice({ tone: rejudgeNoticeTone(lastPayload?.code), text: rejudgeNoticeText(lastPayload?.code, t) });
    } catch {
      setRejudgeNotice({ tone: "error", text: t.rejudgeFailed });
    } finally {
      if (!polling) {
        setRejudging(false);
      }
    }
  }

  const themeIcon = theme === "dark" ? <Moon className="h-4 w-4" /> : theme === "light" ? <Sun className="h-4 w-4" /> : <Monitor className="h-4 w-4" />;

  return (
    <main className="score-grid tech-shell min-h-screen px-4 py-6 text-slate-100 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href="/ranking" className="control-button ghost">
            <ArrowLeft className="h-4 w-4" />
            {t.back}
          </Link>
          <div className="flex items-center gap-2">
            <NavMenu
              ariaLabel={t.chooseLanguage}
              triggerIcon={<Globe className="h-4 w-4" />}
              triggerLabel={language === "zh" ? "中文" : "EN"}
              activeValue={language}
              options={[
                { value: "zh", label: t.languageZh },
                { value: "en", label: t.languageEn }
              ]}
              onSelect={(value) => setLanguage(value as ContestLanguage)}
              align="left"
            />
            <NavMenu
              ariaLabel={t.chooseTheme}
              triggerIcon={themeIcon}
              activeValue={theme}
              options={[
                { value: "light", label: t.themeLight, icon: <Sun className="h-4 w-4" /> },
                { value: "dark", label: t.themeDark, icon: <Moon className="h-4 w-4" /> },
                { value: "system", label: t.themeSystem, icon: <Monitor className="h-4 w-4" /> }
              ]}
              onSelect={(value) => setTheme(value as ContestTheme)}
            />
          </div>
        </div>

        {loading ? (
          <div className="mt-8 flex items-center gap-3 py-24 text-sm text-slate-400">
            <Loader2 className="h-5 w-5 shrink-0 animate-spin text-cyan-300" />
            <span>{t.loading}</span>
          </div>
        ) : null}
        {error ? (
          <div role="alert" className="mt-8 rounded-lg border border-rose-300 bg-white p-8 font-semibold text-rose-900 shadow-sm dark:border-rose-300/25 dark:bg-rose-400/10 dark:text-rose-100">
            {error}
          </div>
        ) : null}

        {!loading && item ? (
          <div className="mt-8">
            <header className="surface-panel-strong p-6">
              <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2 text-sm text-slate-400">
                    <span>{item.topic.authorName}</span>
                    <span>·</span>
                    <span>{item.topic.track ?? t.unknownTrack}</span>
                    <span>·</span>
                    <span>
                      {t.scoredAt} {fmt(item.evaluation?.createdAt, language)}
                    </span>
                  </div>
                  <h1 className="mt-3 max-w-4xl text-2xl font-semibold leading-tight text-white sm:text-4xl">{item.topic.title}</h1>
                  <div className="mt-5 flex flex-wrap gap-3">
                    <a href={item.topic.url} target="_blank" rel="noreferrer" className="control-button ghost">
                      <ExternalLink className="h-4 w-4" />
                      {t.source}
                    </a>
                    {item.topic.demoUrl ? (
                      <a href={item.topic.demoUrl} target="_blank" rel="noreferrer" className="control-button">
                        <Sparkles className="h-4 w-4" />
                        {t.demo}
                      </a>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => void handleRejudge()}
                      disabled={rejudging}
                      aria-busy={rejudging}
                      className="control-button"
                    >
                      {rejudging ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                      {rejudging ? t.rejudging : t.rejudge}
                    </button>
                  </div>
                </div>
                <div className="score-summary">
                  <div className="score-summary__label">{t.totalScore}</div>
                  <div className="score-summary__value">{item.evaluation?.totalScore ?? "N/A"}</div>
                  <div className="score-summary__meta">
                    {t.confidence} {item.evaluation?.confidenceScore ?? "N/A"}%
                  </div>
                </div>
              </div>
            </header>

            <section className="mt-5 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
              <ScoreBlock label={t.dimensions.innovation} value={item.evaluation?.innovationScore} max={30} unrated={t.unrated} />
              <ScoreBlock label={t.dimensions.practicality} value={item.evaluation?.practicalityScore} max={30} unrated={t.unrated} />
              <ScoreBlock label={t.dimensions.completion} value={item.evaluation?.completionScore} max={20} unrated={t.unrated} />
              <ScoreBlock label={t.dimensions.design} value={item.evaluation?.designScore} max={20} unrated={t.unrated} />
            </section>

            <section className="surface-panel mt-5 p-6">
              <h2 className="text-lg font-semibold text-white">{t.explanation}</h2>
              <p className="mt-3 text-sm leading-7 text-slate-300">{item.evaluation?.summary ?? t.pending}</p>
              {item.evaluation?.dimensionComments ? (
                <div className="mt-5 grid gap-3 md:grid-cols-2">
                  {Object.entries(item.evaluation.dimensionComments).map(([key, value]) => (
                    <div key={key} className="surface-panel p-4 text-sm leading-6 text-slate-300">
                      <div className="mb-1 font-semibold text-amber-800 dark:text-amber-100">{key}</div>
                      {value}
                    </div>
                  ))}
                </div>
              ) : null}
            </section>

            <div className="mt-5 grid gap-4 lg:grid-cols-3">
              <TextList title={t.strengths} items={item.evaluation?.strengths} emptyLabel={t.missingContent} />
              <TextList title={t.weaknesses} items={item.evaluation?.weaknesses} emptyLabel={t.missingContent} />
              <TextList title={t.suggestions} items={item.evaluation?.suggestions} emptyLabel={t.missingContent} />
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              <section className="rounded-lg border border-amber-500/20 bg-amber-500/5 dark:bg-amber-300/10 p-5">
                <h2 className="inline-flex items-center gap-2 text-base font-semibold text-amber-900 dark:text-amber-100">
                  <ShieldAlert className="h-5 w-5" />
                  {t.compliance}
                </h2>
                {item.evaluation?.complianceRisks?.length ? (
                  <ul className="mt-4 space-y-2 text-sm leading-6 text-slate-800 dark:text-amber-200">
                    {item.evaluation.complianceRisks.map((risk) => (
                      <li key={risk} className="border-l border-amber-500/30 dark:border-amber-200/50 pl-3">
                        {risk}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-4 text-sm text-amber-800/80 dark:text-amber-100/70">{t.noRisk}</p>
                )}
              </section>

              <section className="surface-panel p-5">
                <h2 className="text-base font-semibold text-white">{t.matchTitle}</h2>
                {item.match?.signupTopicId ? (
                  <div className="mt-4 space-y-2 text-sm leading-6 text-slate-300">
                    <p>
                      {t.matchedTopic}: {item.match.signupTopicId}
                    </p>
                    <p>
                      {t.matchMethod}: {item.match.matchMethod}, {t.matchConfidence} {item.match.matchConfidence}%
                    </p>
                    <p>
                      {t.directionScore}: {item.match.directionConsistencyScore ?? t.unknown}/10
                    </p>
                    <p>
                      {t.risk}: {item.match.mismatchRisk}
                    </p>
                    <p>{item.match.directionConsistencyComment}</p>
                  </div>
                ) : (
                  <p className="mt-4 text-sm leading-6 text-slate-300">{t.unmatched}</p>
                )}
                {item.evaluation?.matchComment ? <p className="mt-4 text-sm leading-6 text-amber-800 dark:text-amber-100">{item.evaluation.matchComment}</p> : null}
              </section>
            </div>

            <footer className="surface-panel mt-6 p-4 text-sm text-slate-400">
              {t.model}: {item.evaluation?.model ?? t.unrated} · {t.promptVersion}: {item.evaluation?.promptVersion ?? "N/A"} · {t.unofficial}
            </footer>
          </div>
        ) : null}
        {rejudgeNotice ? (
          <div
            role="status"
            className={`fixed right-4 top-4 z-50 max-w-sm rounded-lg border px-4 py-3 text-sm font-semibold shadow-xl backdrop-blur sm:right-6 sm:top-6 ${
              rejudgeNotice.tone === "success"
                ? "border-emerald-300/50 bg-emerald-50 text-emerald-900 dark:border-emerald-300/30 dark:bg-emerald-400/15 dark:text-emerald-100"
                : rejudgeNotice.tone === "info"
                  ? "border-amber-300/60 bg-amber-50 text-amber-900 dark:border-amber-300/30 dark:bg-amber-400/15 dark:text-amber-100"
                  : "border-rose-300/60 bg-rose-50 text-rose-900 dark:border-rose-300/30 dark:bg-rose-400/15 dark:text-rose-100"
            }`}
          >
            {rejudgeNotice.text}
          </div>
        ) : null}
      </div>
    </main>
  );
}
