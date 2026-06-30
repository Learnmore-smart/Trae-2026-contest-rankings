"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ExternalLink, ShieldAlert, Sparkles, Globe, Sun, Moon, Monitor } from "lucide-react";
import { useContestLanguage, type ContestLanguage } from "../i18n";
import { useContestTheme, type ContestTheme } from "../theme";
import { NavMenu } from "../contest-client";
import type { RankingItem } from "@/lib/trae/types";

const API_BASE = process.env.NEXT_PUBLIC_BASE_PATH || "";

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
    aiIoTitle: "AI 评分输入与输出",
    aiIoHint: "完整展示发送给模型的输入与模型返回的原始输出，便于核对评分依据。",
    aiInput: "模型输入",
    aiOutput: "模型输出",
    systemPromptLabel: "系统提示",
    userPromptLabel: "评分提示词",
    rawOutputLabel: "模型原始输出（JSON）",
    expand: "展开",
    tokensTitle: "词元用量",
    inputTokens: "输入词元",
    outputTokens: "输出词元",
    totalTokens: "合计词元",
    noAiIo: "本次评分暂无可展示的输入/输出记录。"
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
    aiIoTitle: "AI scoring input & output",
    aiIoHint: "Full view of the input sent to the model and the raw output it returned, so the scoring basis can be audited.",
    aiInput: "Model input",
    aiOutput: "Model output",
    systemPromptLabel: "System prompt",
    userPromptLabel: "Scoring prompt",
    rawOutputLabel: "Raw model output (JSON)",
    expand: "Expand",
    tokensTitle: "Token usage",
    inputTokens: "Input tokens",
    outputTokens: "Output tokens",
    totalTokens: "Total tokens",
    noAiIo: "No input/output record is available for this evaluation yet."
  }
};

const formatOption = (value: string, language: ContestLanguage) => {
  return value;
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
      <div className="flex items-center justify-between text-sm text-slate-300">
        <span>{label}</span>
        <span>{typeof value === "number" ? `${value}/${max}` : unrated}</span>
      </div>
      <div className="mt-3 h-2 rounded-full bg-slate-200/50 dark:bg-slate-800/50">
        <div className="h-full rounded-full bg-gradient-to-r from-[#f4c96b] to-[#61d8a5]" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

function TextList({ title, items, emptyLabel }: { title: string; items?: string[]; emptyLabel: string }) {
  return (
    <section className="surface-panel p-5">
      <h2 className="text-lg font-bold text-white">{title}</h2>
      {items?.length ? (
        <ul className="mt-4 space-y-2 text-sm leading-6 text-slate-300">
          {items.map((item) => (
            <li key={item} className="border-l border-[#f4c96b]/50 pl-3">
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

function TokenStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="surface-panel-strong p-4 text-center">
      <div className="text-xs text-slate-400">{label}</div>
      <div className="mt-1 text-2xl font-black text-white">{value.toLocaleString()}</div>
    </div>
  );
}

function CodeBlock({ label, content }: { label: string; content: string }) {
  return (
    <details className="surface-panel rounded-md">
      <summary className="cursor-pointer select-none px-4 py-3 text-sm font-semibold text-amber-100">{label}</summary>
      <pre className="max-h-[28rem] overflow-auto whitespace-pre-wrap break-words border-t border-[var(--line)] px-4 py-3 text-xs leading-5 text-slate-300">
        {contentPreProcess(content)}
      </pre>
    </details>
  );
}

function contentPreProcess(val: string): string {
  return val;
}

function AiIoSection({ evaluation, t }: { evaluation: RankingItem["evaluation"]; t: (typeof COPY)["zh"] }) {
  const logs = evaluation?.llmCallLogs ?? [];
  const inputTokens = evaluation?.inputTokens ?? logs.reduce((sum, log) => sum + (log.inputTokens ?? 0), 0);
  const outputTokens = evaluation?.outputTokens ?? logs.reduce((sum, log) => sum + (log.outputTokens ?? 0), 0);
  const systemPrompt = evaluation?.systemPrompt ?? "";
  const promptText = evaluation?.promptText ?? "";
  const rawOutput = evaluation?.rawModelResponse ?? "";
  const hasIo = Boolean(rawOutput);

  return (
    <section className="surface-panel mt-5 p-6">
      <h2 className="text-xl font-bold text-white">{t.aiIoTitle}</h2>
      <p className="mt-2 text-sm leading-6 text-slate-400">{t.aiIoHint}</p>
      {hasIo ? (
        <>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <TokenStat label={t.inputTokens} value={inputTokens} />
            <TokenStat label={t.outputTokens} value={outputTokens} />
            <TokenStat label={t.totalTokens} value={inputTokens + outputTokens} />
          </div>
          <div className="mt-4 grid gap-4 lg:grid-cols-1">
            <div className="space-y-3">
              <div className="text-sm font-semibold text-white">{t.aiOutput}</div>
              <CodeBlock label={t.rawOutputLabel} content={rawOutput} />
            </div>
          </div>
        </>
      ) : (
        <p className="mt-4 text-sm text-slate-500">{t.noAiIo}</p>
      )}
    </section>
  );
}

export default function ProjectDetailClient({ id }: { id: string }) {
  const { language, setLanguage } = useContestLanguage();
  const { theme, setTheme } = useContestTheme();
  const t = COPY[language];
  const [item, setItem] = useState<RankingItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

        {loading ? <div className="skeleton-block mt-8 h-96 animate-pulse rounded-lg" /> : null}
        {error ? <div className="mt-8 rounded-lg border border-rose-300/25 bg-rose-400/10 p-8 text-rose-100">{error}</div> : null}

        {!loading && item ? (
          <div className="mt-8">
            <header className="surface-panel-strong p-6">
              <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
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
                  <h1 className="mt-3 max-w-4xl text-3xl font-black leading-tight text-white sm:text-5xl">{item.topic.title}</h1>
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
                  </div>
                </div>
                <div className="rounded-lg border border-[#f4c96b]/30 bg-[#f4c96b]/10 p-5 text-center">
                  <div className="text-xs text-amber-800 dark:text-amber-100">{t.totalScore}</div>
                  <div className="text-6xl font-black text-slate-800 dark:text-white">{item.evaluation?.totalScore ?? "N/A"}</div>
                  <div className="text-xs text-slate-600 dark:text-slate-300">
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
              <h2 className="text-xl font-bold text-white">{t.explanation}</h2>
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
                <h2 className="inline-flex items-center gap-2 text-lg font-bold text-amber-900 dark:text-amber-100">
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
                <h2 className="text-lg font-bold text-white">{t.matchTitle}</h2>
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

            <AiIoSection evaluation={item.evaluation} t={t} />

            <footer className="surface-panel mt-6 p-4 text-sm text-slate-400">
              {t.model}: {item.evaluation?.model ?? t.unrated} · {t.promptVersion}: {item.evaluation?.promptVersion ?? "N/A"} · {t.unofficial}
            </footer>
          </div>
        ) : null}
      </div>
    </main>
  );
}
