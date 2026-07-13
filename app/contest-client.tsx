"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowDownWideNarrow,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Crown,
  ExternalLink,
  Globe,
  Github,
  Home,
  LayoutGrid,
  Loader2,
  Lock,
  Monitor,
  Moon,
  RefreshCw,
  Rows3,
  Search,
  ShieldAlert,
  Sparkles,
  Sun,
  Tag,
  X
} from "lucide-react";
import { useContestLanguage, type ContestLanguage } from "./i18n";
import { useContestTheme, type ContestTheme } from "./theme";
import type { RankingItem, StatsPayload } from "@/lib/trae/types";

const API_BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "/trae-contest-2026";
const DEFAULT_RANKING_PAGE_SIZE = 50;
const RANKING_PAGE_SIZE_OPTIONS = [25, 50, 100, 200] as const;

const TRACKS = ["全部赛道", "生活娱乐", "学习工作", "社会服务", "硬件交互", "社会公益"];
const SORTS = ["total", "innovation", "practicality", "completion", "design", "confidence", "views", "replies", "updated"] as const;

type Phase = "prelim" | "semi" | "final";
type MainTab = "landing" | "ranking";
type RunPhase = "idle" | "scrape" | "match" | "judge" | "done" | "error";
type SortValue = (typeof SORTS)[number];
type SortDirection = "desc" | "asc";
type RingTone = "cyan" | "green" | "amber" | "violet" | "red";
type ViewMode = "list" | "grid";

function statsWithOnlineCount(current: StatsPayload | null, onlineCount: number): StatsPayload {
  return {
    signupCount: current?.signupCount ?? 0,
    preliminaryCount: current?.preliminaryCount ?? 0,
    evaluatedCount: current?.evaluatedCount ?? 0,
    matchedCount: current?.matchedCount ?? 0,
    totalInputTokens: current?.totalInputTokens ?? 0,
    totalOutputTokens: current?.totalOutputTokens ?? 0,
    lastUpdatedAt: current?.lastUpdatedAt ?? null,
    sourceUnavailable: current?.sourceUnavailable,
    message: current?.message,
    onlineCount
  };
}

interface PipelineStatus {
  running: boolean;
  phase: RunPhase;
  startedAt: string | null;
  finishedAt: string | null;
  message: string;
  error: string | null;
}

interface SubmittedTopicStatus {
  running: boolean;
  phase: "idle" | "crawling" | "done" | "error";
  startedAt: string | null;
  finishedAt: string | null;
  submittedUrl: string | null;
  message: string;
  error: string | null;
  result: "created" | "updated" | "unchanged" | null;
  topic: { id: string; title: string; url: string; status: string } | null;
}

const SEMIFINAL_START = new Date("2026-07-15T00:00:00+08:00");

const TRACK_LABELS: Record<string, Record<ContestLanguage, string>> = {
  全部赛道: { zh: "全部赛道", en: "All tracks" },
  生活娱乐: { zh: "生活娱乐", en: "Life & Entertainment" },
  学习工作: { zh: "学习工作", en: "Study & Work" },
  社会服务: { zh: "社会服务", en: "Social Services" },
  硬件交互: { zh: "硬件交互", en: "Hardware Interaction" },
  社会公益: { zh: "社会公益", en: "Social Good" }
};

const OFFICERS = [
  {
    name: { zh: "影视飓风Tim", en: "Tim" },
    title: { zh: "影像工程 / 内容系统", en: "Imaging systems / content craft" },
    src: "/super-star/TIM-影视飓风.png"
  },
  {
    name: { zh: "楼天城", en: "Lou Tiancheng" },
    title: { zh: "算法竞技 / 工程判断", en: "Algorithms / engineering judgment" },
    src: "/super-star/楼天城.png"
  },
  {
    name: { zh: "罗永浩", en: "Luo Yonghao" },
    title: { zh: "产品表达 / 商业落地", en: "Product narrative / business fit" },
    src: "/super-star/罗永浩.png"
  },
  {
    name: { zh: "胡彦斌", en: "Tiger Hu" },
    title: { zh: "音乐科技 / 创意生产", en: "Music technology / creative production" },
    src: "/super-star/胡彦斌.png"
  }
];

const COPY = {
  zh: {
    brand: "TRAE 创造力大赛",
    navLanding: "首页",
    navRanking: "榜单",
    language: "中文",
    chooseLanguage: "切换语言",
    languageZh: "中文",
    languageEn: "English",
    chooseTheme: "切换主题",
    themeLight: "浅色",
    themeDark: "深色",
    themeSystem: "跟随系统",
    viewListLabel: "列表视图",
    viewGridLabel: "网格视图",
    tokens: "词元",
    tokensIn: "输入",
    tokensOut: "输出",
    online: "在线",
    heroKicker: "第三方评分台",
    heroTitle: "我们把公开作品整理成一张可追踪的评分榜",
    heroBody:
      "本站抓取 TRAE 中文社区公开报名帖与初赛 Demo 帖，匹配同一作品，再用免费模型生成模拟评分。它不是官方结果，而是给参赛者和观察者一个透明的数据视角：哪些作品已被收录，哪些已经评分，为什么排名会变化。",
    purposeTitle: "这个网站存在的意义",
    purposeBody:
      "比赛帖分散、更新快、人工逐个比较成本高。这个页面把公开信息变成结构化榜单：先看收录进度，再看评分维度，最后进入详情页查看每个作品的证据、优势、风险和建议。",
    officers: "大赛领造官",
    officerNote: "本届特邀展示，与本站评分无关。",
    start: "开始评分",
    running: "运行中",
    retry: "重试评分",
    done: "已完成",
    scraping: "抓取公开帖…",
    matching: "匹配报名方向…",
    judging: "生成评分…",
    failed: "运行失败",
    disclaimer:
      "免责声明：本站评分由 AI 根据 TRAE 中文社区公开帖子内容生成，仅供学习、观摩和参考，不代表 TRAE 官方结果，也不冒充官方评分或预测最终名次。",
    prelim: "初赛",
    semi: "复赛",
    final: "总决赛",
    live: "进行中",
    starts: "7 月 15 日开启",
    tbd: "赛制待定",
    scoredProgress: "已评分",
    lastUpdated: "最后更新",
    search: "搜索作品 / 作者 / 赛道 / 标签",
    clearSearch: "清除搜索",
    searchAction: "搜索",
    loading: "加载榜单中…",
    track: "赛道",
    sort: "排序",
    pageSize: "每页",
    sortDirection: "顺序",
    sortDesc: "高到低",
    sortAsc: "低到高",
    totalResults: "个作品",
    previousPage: "上一页",
    nextPage: "下一页",
    pageLabel: "页",
    emptyTitle: "榜单正在候场",
    emptyBody: "公开帖抓取成功后，初赛作品会出现在这里；评分完成后会显示名次和详情。",
    lockedSemi: "复赛暂未开放",
    lockedFinal: "总决赛暂未开放",
    lockedBody: "当前只展示初赛评分。对应阶段开启后会切换到新的榜单数据。",
    original: "原帖",
    details: "查看详情",
    totalScore: "综合分",
    confidence: "置信度",
    views: "浏览",
    replies: "回复",
    innovation: "创新性",
    practicality: "实用性",
    completion: "完成度",
    design: "设计体验",
    waitingScore: "等待评分",
    noEvaluation: "已抓取，等待评分。",
    matched: "已匹配",
    unmatched: "未匹配报名",
    reviewNeeded: "需复核",
    mismatch: "方向高风险",
    riskHigh: "高风险",
    riskSome: "有风险",
    riskLow: "低风险",
    hasDemo: "有 Demo",
    top: "当前最高分",
    openDetail: "查看作品详情",
    submitUrlTitle: "请你爬我",
    submitUrlPlaceholder: "粘贴 TRAE 初赛帖链接",
    submitUrlAction: "提交链接",
    submitUrlBusy: "抓取中",
    submitUrlRequired: "请先粘贴 TRAE 论坛帖子链接。",
    submitUrlCreated: "已抓取并加入待评分队列。",
    submitUrlUpdated: "帖子内容已更新，等待评分。",
    submitUrlUnchanged: "这个帖子已经在队列里。",
    submitUrlFailed: "提交失败，请稍后重试。",
    sortLabels: {
      total: "综合分",
      innovation: "创新性",
      practicality: "实用性",
      completion: "完成度",
      design: "设计体验",
      confidence: "置信度",
      views: "浏览量",
      replies: "回复数",
      updated: "更新时间"
    } satisfies Record<SortValue, string>
  },
  en: {
    brand: "TRAE Creativity Contest",
    navLanding: "Landing",
    navRanking: "Ranking",
    language: "EN",
    chooseLanguage: "Change language",
    languageZh: "中文",
    languageEn: "English",
    chooseTheme: "Change theme",
    themeLight: "Light",
    themeDark: "Dark",
    themeSystem: "System",
    viewListLabel: "List view",
    viewGridLabel: "Grid view",
    tokens: "Tokens",
    tokensIn: "in",
    tokensOut: "out",
    online: "Online",
    heroKicker: "Independent scoring desk",
    heroTitle: "A public contest signal board for TRAE projects",
    heroBody:
      "This site reads public signup and preliminary Demo posts from the TRAE Chinese forum, matches the same project across stages, and produces simulated scores with free models. It is not an official result. It exists to make collection progress, scoring status, rank movement, and project evidence easier to inspect.",
    purposeTitle: "Why this site exists",
    purposeBody:
      "Contest posts move quickly and are hard to compare manually. This page turns public information into a structured ranking workflow: see what has been collected, what has been scored, then open a project detail to inspect evidence, strengths, risks, and suggestions.",
    officers: "Lead Creators",
    officerNote: "Featured guests. They are not related to this independent scoring.",
    start: "Start scoring",
    running: "Running",
    retry: "Retry scoring",
    done: "Completed",
    scraping: "Scraping public posts…",
    matching: "Matching signup direction…",
    judging: "Generating scores…",
    failed: "Run failed",
    disclaimer:
      "Disclaimer: scores are generated from public TRAE Chinese forum posts for learning and observation only. They are not official TRAE results and do not predict final placement.",
    prelim: "Preliminary",
    semi: "Semifinal",
    final: "Final",
    live: "Live",
    starts: "Opens Jul 15",
    tbd: "Schedule TBD",
    scoredProgress: "Scored",
    lastUpdated: "Last updated",
    search: "Search project / author / track / tag",
    clearSearch: "Clear search",
    searchAction: "Search",
    loading: "Loading rankings…",
    track: "Track",
    sort: "Sort",
    pageSize: "Rows",
    sortDirection: "Order",
    sortDesc: "High to low",
    sortAsc: "Low to high",
    totalResults: "projects",
    previousPage: "Previous page",
    nextPage: "Next page",
    pageLabel: "Page",
    emptyTitle: "Ranking is waiting",
    emptyBody: "Once public posts are collected, preliminary projects will appear here; after scoring, ranks and detail pages will be available.",
    lockedSemi: "Semifinal is not open yet",
    lockedFinal: "Final is not open yet",
    lockedBody: "Only preliminary scoring is visible right now. This phase will switch to its own ranking data after it opens.",
    original: "Original",
    details: "Details",
    totalScore: "Total score",
    confidence: "Confidence",
    views: "Views",
    replies: "Replies",
    innovation: "Innovation",
    practicality: "Practicality",
    completion: "Completion",
    design: "Design",
    waitingScore: "Pending",
    noEvaluation: "Collected, waiting for scoring.",
    matched: "Matched",
    unmatched: "No signup match",
    reviewNeeded: "Review needed",
    mismatch: "Direction mismatch",
    riskHigh: "High risk",
    riskSome: "Some risk",
    riskLow: "Low risk",
    hasDemo: "Demo",
    top: "Top score",
    openDetail: "Open project detail",
    submitUrlTitle: "Crawl my post",
    submitUrlPlaceholder: "Paste a TRAE preliminary topic link",
    submitUrlAction: "Submit link",
    submitUrlBusy: "Crawling",
    submitUrlRequired: "Paste a TRAE forum topic link first.",
    submitUrlCreated: "Collected and queued for scoring.",
    submitUrlUpdated: "Post content updated and queued.",
    submitUrlUnchanged: "This post is already in the queue.",
    submitUrlFailed: "Submit failed. Try again later.",
    sortLabels: {
      total: "Total score",
      innovation: "Innovation",
      practicality: "Practicality",
      completion: "Completion",
      design: "Design",
      confidence: "Confidence",
      views: "Views",
      replies: "Replies",
      updated: "Updated"
    } satisfies Record<SortValue, string>
  }
};

function fmtDate(value: string | null | undefined, language: ContestLanguage): string {
  if (!value) return language === "zh" ? "暂无" : "None";
  return new Intl.DateTimeFormat(language === "zh" ? "zh-CN" : "en-US", {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function fmtInteger(value: number | null | undefined, language: ContestLanguage): string {
  return new Intl.NumberFormat(language === "zh" ? "zh-CN" : "en-US").format(value ?? 0);
}

function score(value: number | null | undefined, language: ContestLanguage, suffix = ""): string {
  if (typeof value !== "number") return COPY[language].waitingScore;
  return `${Math.round(value)}${suffix}`;
}

function scoreTone(value: number | null | undefined, max: number): RingTone {
  if (typeof value !== "number") return "cyan";
  const percent = (value / max) * 100;
  if (percent >= 90) return "amber";
  if (percent >= 80) return "green";
  if (percent >= 70) return "cyan";
  if (percent >= 60) return "violet";
  return "red";
}

function diffParts(targetMs: number, nowMs: number) {
  const ms = Math.max(0, targetMs - nowMs);
  return {
    days: Math.floor(ms / 86_400_000),
    hours: Math.floor((ms % 86_400_000) / 3_600_000),
    minutes: Math.floor((ms % 3_600_000) / 60_000),
    totalDays: Math.ceil(ms / 86_400_000)
  };
}

function ScoreRing({
  label,
  value,
  max,
  language,
  tone = "cyan",
  size = "small"
}: {
  label: string;
  value?: number | null;
  max: number;
  language: ContestLanguage;
  tone?: RingTone;
  size?: "small" | "large";
}) {
  const displayValue = typeof value === "number" ? Math.round(value) : "--";
  const ariaValue = typeof value === "number" ? `${Math.round(value)}/${max}` : COPY[language].waitingScore;

  return (
    <div className="score-stat" data-tone={tone} data-size={size} aria-label={`${label} ${ariaValue}`}>
      <span className="score-stat__value">{displayValue}</span>
      <span className="score-stat__label">{label}</span>
    </div>
  );
}

function Dropdown({
  icon,
  label,
  value,
  options,
  onChange
}: {
  icon: ReactNode;
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  const current = options.find((option) => option.value === value) ?? options[0];

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative min-w-40">
      <button
        type="button"
        onClick={() => setOpen((state) => !state)}
        className="focus-ring control-field flex min-h-10 w-full items-center justify-between gap-2 px-3 text-left text-sm text-white"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="flex min-w-0 items-center gap-2">
          <span className="text-cyan-300">{icon}</span>
          <span className="min-w-0">
            <span className="block text-[0.68rem] font-bold uppercase text-slate-500">{label}</span>
            <span className="block truncate font-semibold">{current?.label}</span>
          </span>
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition ${open ? "rotate-180" : ""}`} />
      </button>
      <div
        className={`dropdown-menu absolute right-0 z-40 mt-2 max-h-80 w-full min-w-56 overflow-auto rounded-md p-2 backdrop-blur-xl transition ${
          open ? "translate-y-0 opacity-100" : "pointer-events-none -translate-y-1 opacity-0"
        }`}
        role="listbox"
      >
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => {
              onChange(option.value);
              setOpen(false);
            }}
            className="dropdown-option"
            data-active={option.value === value}
          >
            <span>{option.label}</span>
            {option.value === value ? <Check className="h-4 w-4 text-cyan-300" /> : null}
          </button>
        ))}
      </div>
    </div>
  );
}

export function NavMenu({
  triggerIcon,
  triggerLabel,
  ariaLabel,
  activeValue,
  options,
  onSelect,
  align = "right"
}: {
  triggerIcon: ReactNode;
  triggerLabel?: ReactNode;
  ariaLabel: string;
  activeValue: string;
  options: Array<{ value: string; label: string; icon?: ReactNode }>;
  onSelect: (value: string) => void;
  align?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent | TouchEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("touchstart", close);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("touchstart", close);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((state) => !state)}
        className="nav-control focus-ring"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={ariaLabel}
      >
        <span className="inline-flex text-cyan-300">{triggerIcon}</span>
        {triggerLabel ? <span>{triggerLabel}</span> : null}
        <ChevronDown className={`h-3.5 w-3.5 text-slate-400 transition ${open ? "rotate-180" : ""}`} />
      </button>
      <div
        className={`dropdown-menu absolute z-50 mt-2 w-48 rounded-md p-2 backdrop-blur-xl transition ${
          align === "left" ? "left-0" : "right-0"
        } ${
          open ? "translate-y-0 opacity-100" : "pointer-events-none -translate-y-1 opacity-0"
        }`}
        role="menu"
      >
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            role="menuitemradio"
            aria-checked={option.value === activeValue}
            onClick={() => {
              onSelect(option.value);
              setOpen(false);
            }}
            className="dropdown-option"
            data-active={option.value === activeValue}
          >
            <span className="inline-flex items-center gap-2">
              {option.icon ? <span className="inline-flex text-cyan-300">{option.icon}</span> : null}
              {option.label}
            </span>
            {option.value === activeValue ? <Check className="h-4 w-4 text-cyan-300" /> : null}
          </button>
        ))}
      </div>
    </div>
  );
}

function ViewToggle({ value, onChange, labels }: { value: ViewMode; onChange: (value: ViewMode) => void; labels: { list: string; grid: string } }) {
  return (
    <div className="view-toggle" role="group" aria-label={`${labels.list} / ${labels.grid}`}>
      <button
        type="button"
        onClick={() => onChange("list")}
        className={`view-toggle__btn ${value === "list" ? "is-active" : ""}`}
        aria-pressed={value === "list"}
        aria-label={labels.list}
        title={labels.list}
      >
        <Rows3 className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={() => onChange("grid")}
        className={`view-toggle__btn ${value === "grid" ? "is-active" : ""}`}
        aria-pressed={value === "grid"}
        aria-label={labels.grid}
        title={labels.grid}
      >
        <LayoutGrid className="h-4 w-4" />
      </button>
    </div>
  );
}

function PageSwitch({
  page,
  totalPages,
  loading,
  language,
  onPrev,
  onNext
}: {
  page: number;
  totalPages: number;
  loading: boolean;
  language: ContestLanguage;
  onPrev: () => void;
  onNext: () => void;
}) {
  const t = COPY[language];
  return (
    <div className="ranking-page-switch" aria-label={`${t.pageLabel} ${fmtInteger(page, language)} / ${fmtInteger(totalPages, language)}`}>
      <button
        type="button"
        aria-label={t.previousPage}
        disabled={page <= 1 || loading}
        onClick={onPrev}
        className="ranking-page-switch__button"
      >
        <ChevronLeft className="h-4 w-4" />
        <span className="ranking-page-switch__text">{t.previousPage}</span>
      </button>
      <span className="ranking-page-switch__label" aria-live="polite">
        <span>{t.pageLabel}</span>
        <strong>{fmtInteger(page, language)} / {fmtInteger(totalPages, language)}</strong>
      </span>
      <button
        type="button"
        aria-label={t.nextPage}
        disabled={page >= totalPages || loading}
        onClick={onNext}
        className="ranking-page-switch__button"
      >
        <span className="ranking-page-switch__text">{t.nextPage}</span>
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}

function riskLabel(item: RankingItem, language: ContestLanguage): string {
  const t = COPY[language];
  if (!item.evaluation) return t.waitingScore;
  if ((item.evaluation.complianceRisks?.length ?? 0) >= 3 || item.evaluation.complianceRiskScore >= 7) return t.riskHigh;
  if ((item.evaluation.complianceRisks?.length ?? 0) > 0 || item.evaluation.complianceRiskScore >= 3) return t.riskSome;
  return t.riskLow;
}

function matchLabel(item: RankingItem, language: ContestLanguage): string {
  const t = COPY[language];
  if (!item.match?.signupTopicId) return t.unmatched;
  if (item.match.mismatchRisk === "high") return t.mismatch;
  if (item.match.mismatchRisk === "medium") return t.reviewNeeded;
  return `${t.matched} ${item.match.matchConfidence}%`;
}

function phaseMessage(phase: RunPhase, language: ContestLanguage): string {
  const t = COPY[language];
  if (phase === "scrape") return t.scraping;
  if (phase === "match") return t.matching;
  if (phase === "judge") return t.judging;
  if (phase === "done") return t.done;
  if (phase === "error") return t.failed;
  return t.running;
}

// After POST /run kicks off the server-side pipeline, the first RUNNING row can take a few
// seconds to appear in the runs table (and a poll may land on an instance that knows nothing
// yet). During this window, ignore "not running" polls instead of silently resetting the
// button — the old behavior that made the click look like it did nothing.
const RUN_START_GRACE_MS = 15_000;

function RunButton({ language, onCompleted }: { language: ContestLanguage; onCompleted: () => void }) {
  const t = COPY[language];
  const [status, setStatus] = useState<PipelineStatus | null>(null);
  const pollRef = useRef<number | null>(null);
  const doneTimerRef = useRef<number | null>(null);
  const graceUntilRef = useRef(0);
  const completedRef = useRef(onCompleted);
  completedRef.current = onCompleted;

  const stopPolling = useCallback(() => {
    if (pollRef.current !== null) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const handleSettled = useCallback(
    (next: PipelineStatus) => {
      if (next.phase === "done") {
        completedRef.current();
        if (doneTimerRef.current !== null) window.clearTimeout(doneTimerRef.current);
        doneTimerRef.current = window.setTimeout(() => {
          setStatus((current) => (current && current.phase === "done" ? null : current));
        }, 3000);
      }
    },
    []
  );

  const startPolling = useCallback(() => {
    stopPolling();
    pollRef.current = window.setInterval(async () => {
      try {
        const response = await fetch(`${API_BASE}/api/trae-contest/run`, { cache: "no-store" });
        const next = (await response.json()) as PipelineStatus;
        if (!next.running && Date.now() < graceUntilRef.current) return;
        setStatus(next);
        if (!next.running) {
          stopPolling();
          handleSettled(next);
        }
      } catch {
        // keep polling; transient network errors should not break the UI
      }
    }, 2000);
  }, [handleSettled, stopPolling]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch(`${API_BASE}/api/trae-contest/run`, { cache: "no-store" });
        const next = (await response.json()) as PipelineStatus;
        if (cancelled) return;
        if (next.running) {
          setStatus(next);
          startPolling();
        }
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [startPolling]);

  useEffect(() => {
    return () => {
      stopPolling();
      if (doneTimerRef.current !== null) window.clearTimeout(doneTimerRef.current);
    };
  }, [stopPolling]);

  const trigger = useCallback(async () => {
    if (status?.running) return;
    graceUntilRef.current = Date.now() + RUN_START_GRACE_MS;
    setStatus({ running: true, phase: "judge", startedAt: null, finishedAt: null, message: t.judging, error: null });
    // Poll immediately: POST may hold open for handoff (seconds) or in-process fallback
    // (minutes). Waiting for the body before polling left the UI frozen on optimistic state.
    startPolling();
    try {
      const response = await fetch(`${API_BASE}/api/trae-contest/run`, { method: "POST" });
      const next = (await response.json()) as PipelineStatus;
      // Server used to return silent idle after a failed self-invoke; surface that as retryable
      // error so the button does not look dead.
      const normalized =
        !next.running && next.phase === "idle"
          ? { ...next, phase: "error" as const, message: t.failed, error: next.message || t.failed }
          : next;
      setStatus(normalized);
      if (normalized.running) startPolling();
      else {
        stopPolling();
        handleSettled(normalized);
      }
    } catch {
      // Keep polling through the grace window — the server request may still be scoring.
      setStatus({ running: true, phase: "judge", startedAt: null, finishedAt: null, message: t.judging, error: null });
    }
  }, [handleSettled, startPolling, stopPolling, status?.running, t.failed, t.judging]);

  const phase: RunPhase = status?.phase ?? "idle";
  const running = status?.running ?? false;
  const label = running ? t.running : phase === "done" ? t.done : phase === "error" ? t.retry : t.start;
  const buttonIcon = running ? <Loader2 className="h-4 w-4 animate-spin" /> : phase === "done" ? <Check className="h-4 w-4" /> : <RefreshCw className="h-4 w-4" />;

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button type="button" onClick={() => void trigger()} disabled={running} className="control-button primary">
        {buttonIcon}
        {label}
      </button>
      {!running && (phase === "done" || phase === "error") ? (
        <span className={`pipeline-status ${phase === "error" ? "is-error" : phase === "done" ? "is-done" : ""}`}>
          <span className="min-w-0">
            <span className="block">{status?.message ?? phaseMessage(phase, language)}</span>
            {phase === "error" && status?.error ? (
              <span className="mt-1 block max-w-[42rem] truncate text-xs font-semibold text-rose-900 dark:text-rose-100/80">
                {status.error}
              </span>
            ) : null}
          </span>
        </span>
      ) : null}
    </div>
  );
}

function submitSuccessMessage(result: unknown, language: ContestLanguage): string {
  const t = COPY[language];
  if (result === "created") return t.submitUrlCreated;
  if (result === "updated") return t.submitUrlUpdated;
  return t.submitUrlUnchanged;
}

function UserTopicSubmit({ language, onSubmitted }: { language: ContestLanguage; onSubmitted: () => void }) {
  const t = COPY[language];
  const [url, setUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const pollRef = useRef<number | null>(null);
  const completedRef = useRef<string | null>(null);
  const submittedRef = useRef(onSubmitted);
  submittedRef.current = onSubmitted;

  const stopPolling = useCallback(() => {
    if (pollRef.current !== null) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const applyStatus = useCallback(
    (next: SubmittedTopicStatus) => {
      setSubmitting(next.running);

      if (next.running) {
        setMessage({ tone: "success", text: next.message });
        return;
      }

      if (next.phase === "done") {
        const completedKey = `${next.finishedAt ?? ""}:${next.result ?? ""}:${next.topic?.id ?? ""}`;
        setUrl("");
        setMessage({ tone: "success", text: submitSuccessMessage(next.result, language) });
        if (completedRef.current !== completedKey) {
          completedRef.current = completedKey;
          submittedRef.current();
        }
        return;
      }

      if (next.phase === "error") {
        setMessage({ tone: "error", text: next.error || next.message || t.submitUrlFailed });
      }
    },
    [language, t.submitUrlFailed]
  );

  const readStatus = useCallback(async (): Promise<SubmittedTopicStatus | null> => {
    try {
      const response = await fetch(`${API_BASE}/api/trae-contest/submit`, { cache: "no-store" });
      if (!response.ok) return null;
      return (await response.json()) as SubmittedTopicStatus;
    } catch {
      return null;
    }
  }, []);

  const startPolling = useCallback(() => {
    stopPolling();
    pollRef.current = window.setInterval(async () => {
      const next = await readStatus();
      if (!next) return;
      applyStatus(next);
      if (!next.running) stopPolling();
    }, 1500);
  }, [applyStatus, readStatus, stopPolling]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const next = await readStatus();
      if (!next || cancelled) return;
      if (next.running) {
        applyStatus(next);
        startPolling();
      }
    })();
    return () => {
      cancelled = true;
      stopPolling();
    };
  }, [applyStatus, readStatus, startPolling, stopPolling]);

  const submit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const trimmed = url.trim();
      if (!trimmed) {
        setMessage({ tone: "error", text: t.submitUrlRequired });
        return;
      }

      setSubmitting(true);
      setMessage(null);
      try {
        const response = await fetch(`${API_BASE}/api/trae-contest/submit`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: trimmed })
        });
        const payload = (await response.json().catch(() => ({}))) as Partial<SubmittedTopicStatus> & { error?: string };
        if (!response.ok) throw new Error(payload.error || t.submitUrlFailed);

        applyStatus(payload as SubmittedTopicStatus);
        if (payload.running) startPolling();
      } catch (error) {
        stopPolling();
        setMessage({ tone: "error", text: error instanceof Error ? error.message : t.submitUrlFailed });
        setSubmitting(false);
      }
    },
    [applyStatus, startPolling, stopPolling, t.submitUrlFailed, t.submitUrlRequired, url]
  );

  return (
    <form className="user-crawl-panel" onSubmit={(event) => void submit(event)}>
      <label className="user-crawl-panel__label" htmlFor="user-topic-url">
        {t.submitUrlTitle}
      </label>
      <div className="user-crawl-panel__control">
        <input
          id="user-topic-url"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          placeholder={t.submitUrlPlaceholder}
          className="user-crawl-panel__input"
          disabled={submitting}
        />
        <button type="submit" className="user-crawl-panel__button" disabled={submitting}>
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
          <span>{submitting ? t.submitUrlBusy : t.submitUrlAction}</span>
        </button>
      </div>
      {message ? (
        <p className="user-crawl-panel__message" data-tone={message.tone} role={message.tone === "error" ? "alert" : "status"}>
          {message.text}
        </p>
      ) : null}
    </form>
  );
}

function LeadOfficerBand({ language }: { language: ContestLanguage }) {
  const t = COPY[language];
  return (
    <section className="officer-band">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="kicker">{language === "zh" ? "领造官阵容" : "LEAD CREATORS"}</p>
          <h2 className="mt-1 text-xl font-semibold text-white sm:text-2xl">{t.officers}</h2>
        </div>
        <span className="text-xs text-slate-500">{t.officerNote}</span>
      </div>
      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {OFFICERS.map((officer) => (
          <article key={officer.src} className="officer-card">
            <div className="officer-frame">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="officer-portrait" src={`${API_BASE}${officer.src}`} alt={`${officer.name[language]} · ${t.officers}`} loading="lazy" />
            </div>
            <div className="officer-meta">
              <div className="text-base font-semibold text-white">{officer.name[language]}</div>
              <div className="mt-1 text-xs text-slate-500">{officer.title[language]}</div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function RankCard({ item, language, viewMode }: { item: RankingItem; language: ContestLanguage; viewMode: ViewMode }) {
  const t = COPY[language];
  const router = useRouter();
  const tier = item.rank === 1 ? "gold" : item.rank === 2 ? "silver" : item.rank === 3 ? "bronze" : null;
  const trackName = item.topic.track ? (TRACK_LABELS[item.topic.track]?.[language] ?? item.topic.track) : null;
  const detailHref = `/project/${encodeURIComponent(item.topic.id)}`;
  const openDetail = () => router.push(detailHref);
  const hasSummary = Boolean(item.evaluation?.summary);

  return (
    <article
      className={`rank-row ${viewMode === "grid" ? "rank-row--grid" : ""} ${tier ? `rank-row--podium rank-row--${tier}` : ""} ${!hasSummary ? "rank-row--no-summary" : ""}`}
      onClick={openDetail}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          openDetail();
        }
      }}
      role="link"
      tabIndex={0}
      aria-label={`${item.topic.title} — ${t.openDetail}`}
    >

      <div className="rank-row__rank">
        <div className={`rank-badge ${tier ? `rank-badge--${tier}` : ""}`}>
          <span>{item.rank}</span>
        </div>
      </div>

      <div className="rank-row__content">
          <div className="rank-row__meta">
            <span>{item.topic.authorName}</span>
            {trackName ? (
              <>
                <span className="rank-row__dot" />
                <span>{trackName}</span>
              </>
            ) : null}
            <span className="rank-row__dot" />
            <span>{fmtDate(item.topic.updatedAt, language)}</span>
          </div>
          <h2 className="rank-row__title">{item.topic.title}</h2>
          <div className="rank-row__chips">
            <span className="chip chip--green">{matchLabel(item, language)}</span>
            <span className={`chip ${riskLabel(item, language) === t.riskHigh ? "chip--danger" : "chip--amber"}`}>
              <ShieldAlert className="h-3 w-3" />
              {riskLabel(item, language)}
            </span>
            {item.topic.demoUrl ? (
              <span className="chip chip--cyan">
                <Sparkles className="h-3 w-3" />
                {t.hasDemo}
              </span>
            ) : null}
          </div>
      </div>

      <div className="rank-row__score-panel">
        <div className="rank-row__score-row">
          <div className="rank-row__scores" aria-label={t.totalScore}>
            <ScoreRing label={t.totalScore} value={item.evaluation?.totalScore} max={100} language={language} tone={scoreTone(item.evaluation?.totalScore, 100)} size="large" />
            <div className="rank-row__signals">
              <div>{t.confidence} {score(item.evaluation?.confidenceScore, language, "%")}</div>
              <div>
                {t.views} {item.topic.viewCount ?? "N/A"} / {t.replies} {item.topic.replyCount ?? "N/A"}
              </div>
            </div>
          </div>
          <div className="rank-row__aspects">
            <ScoreRing label={t.innovation} value={item.evaluation?.innovationScore} max={30} language={language} tone="cyan" />
            <ScoreRing label={t.practicality} value={item.evaluation?.practicalityScore} max={30} language={language} tone="green" />
            <ScoreRing label={t.completion} value={item.evaluation?.completionScore} max={20} language={language} tone="amber" />
            <ScoreRing label={t.design} value={item.evaluation?.designScore} max={20} language={language} tone="violet" />
          </div>
        </div>
        {item.evaluation?.summary ? <p className="rank-row__summary">{item.evaluation.summary}</p> : null}
      </div>

      <div className="rank-row__actions">
        <a href={item.topic.url} target="_blank" rel="noreferrer" className="control-button ghost" onClick={(event) => event.stopPropagation()}>
          <ExternalLink className="h-4 w-4" />
          {t.original}
        </a>
        <Link href={detailHref} className="control-button primary" onClick={(event) => event.stopPropagation()}>
          {t.details}
        </Link>
      </div>
    </article>
  );
}

function EmptyState({ language, onRun }: { language: ContestLanguage; onRun: ReactNode }) {
  const t = COPY[language];
  return (
    <div className="ranking-empty surface-panel-strong p-10 text-center">
      <div className="mx-auto flex flex-col items-center">
        <span className="locked-medallion">
          <Sparkles className="h-8 w-8" />
        </span>
        <h2 className="mt-6 text-2xl font-semibold text-white">{t.emptyTitle}</h2>
        <p className="mt-3 max-w-xl text-sm leading-6 text-slate-300">{t.emptyBody}</p>
        <div className="mt-6">{onRun}</div>
      </div>
    </div>
  );
}

function LockedPanel({ phase, language }: { phase: Exclude<Phase, "prelim">; language: ContestLanguage }) {
  const t = COPY[language];
  return (
    <section className="ranking-empty surface-panel-strong p-10 text-center">
      <span className="locked-medallion">
        {phase === "semi" ? <Lock className="h-8 w-8" /> : <Sparkles className="h-8 w-8" />}
      </span>
      <h2 className="mt-6 text-2xl font-semibold text-white">{phase === "semi" ? t.lockedSemi : t.lockedFinal}</h2>
      <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-300">{t.lockedBody}</p>
    </section>
  );
}

function LoadingGrid({ viewMode, language }: { viewMode: ViewMode; language: ContestLanguage }) {
  const t = COPY[language];
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3 text-sm text-slate-400">
        <Loader2 className="h-5 w-5 shrink-0 animate-spin text-cyan-300" />
        <span>{t.loading}</span>
      </div>
      <div className={viewMode === "grid" ? "ranking-grid" : "ranking-list"}>
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="skeleton-block h-32 animate-pulse rounded-md" />
        ))}
      </div>
    </div>
  );
}

const useIsomorphicLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

// Module-scoped so the previously active tab survives the route change between
// /trae-contest-2026 and /ranking (the nav remounts), letting the pill slide from
// the old tab to the new one instead of snapping.
let lastActiveTab: MainTab | null = null;

function MainTabs({ activeTab, items }: { activeTab: MainTab; items: Array<{ key: MainTab; label: string; href: string }> }) {
  const tabRefs = useRef(new Map<MainTab, HTMLAnchorElement>());
  const indicatorRef = useRef<HTMLSpanElement | null>(null);
  const labelSignature = items.map((item) => item.label).join("|");

  useIsomorphicLayoutEffect(() => {
    const indicator = indicatorRef.current;
    const target = tabRefs.current.get(activeTab);
    if (!indicator || !target) return;
    const moveTo = (el: HTMLElement) => {
      indicator.style.transform = `translateX(${el.offsetLeft}px)`;
      indicator.style.width = `${el.offsetWidth}px`;
      indicator.style.opacity = "1";
    };
    const previous = lastActiveTab && lastActiveTab !== activeTab ? tabRefs.current.get(lastActiveTab) : null;
    if (previous) {
      indicator.style.transition = "none";
      moveTo(previous);
      void indicator.offsetWidth; // flush the start position so the next change animates
      requestAnimationFrame(() => {
        indicator.style.transition = "";
        moveTo(target);
      });
    } else {
      indicator.style.transition = "none";
      moveTo(target);
    }
    lastActiveTab = activeTab;
    // labelSignature: a language toggle changes label widths without navigating — snap to the new width.
  }, [activeTab, labelSignature]);

  useEffect(() => {
    const snap = () => {
      const indicator = indicatorRef.current;
      const target = tabRefs.current.get(activeTab);
      if (!indicator || !target) return;
      indicator.style.transition = "none";
      indicator.style.transform = `translateX(${target.offsetLeft}px)`;
      indicator.style.width = `${target.offsetWidth}px`;
    };
    window.addEventListener("resize", snap);
    return () => window.removeEventListener("resize", snap);
  }, [activeTab, labelSignature]);

  return (
    <div className="main-tabs" role="tablist" aria-label="Main sections" data-first-active={activeTab === items[0]?.key ? "true" : "false"}>
      <span ref={indicatorRef} className="main-tabs__indicator" aria-hidden />
      {items.map((item) => (
        <Link key={item.key} href={item.href}
          ref={(node) => {
            if (node) tabRefs.current.set(item.key, node);
            else tabRefs.current.delete(item.key);
          }}
          role="tab"
          aria-selected={activeTab === item.key}
          aria-current={activeTab === item.key ? "page" : undefined}
          className={`main-tab ${activeTab === item.key ? "is-active" : ""}`}
        >
          {item.label}
        </Link>
      ))}
    </div>
  );
}

export default function ContestClient({ activeTab }: { activeTab: MainTab }) {
  const { language, setLanguage } = useContestLanguage();
  const { theme, setTheme } = useContestTheme();
  const t = COPY[language];
  const [stats, setStats] = useState<StatsPayload | null>(null);
  const [items, setItems] = useState<RankingItem[]>([]);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState("");
  const [pendingQ, setPendingQ] = useState("");
  const [track, setTrack] = useState("全部赛道");
  const [sort, setSort] = useState<SortValue>("total");
  const [sortDir, setSortDir] = useState<SortDirection>("desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_RANKING_PAGE_SIZE);
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [loading, setLoading] = useState(true);
  const [statsLoaded, setStatsLoaded] = useState(false);
  const [loadedQueryString, setLoadedQueryString] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("prelim");
  const [now, setNow] = useState<number>(() => SEMIFINAL_START.getTime());

  useEffect(() => {
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const semifinalDays = useMemo(() => diffParts(SEMIFINAL_START.getTime(), now).totalDays, [now]);
  const totalTokens = (stats?.totalInputTokens ?? 0) + (stats?.totalOutputTokens ?? 0);
  const progressTotal = stats?.preliminaryCount ?? 0;
  const progressDone = stats?.evaluatedCount ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const queryString = useMemo(() => {
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize), sort, dir: sortDir });
    if (q.trim()) params.set("q", q.trim());
    if (track !== "全部赛道") params.set("track", track);
    return params.toString();
  }, [page, pageSize, q, sort, sortDir, track]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const statsRequest = fetch(`${API_BASE}/api/trae-contest/stats`, { cache: "no-store" });
      const topicsRequest = fetch(`${API_BASE}/api/trae-contest/topics?${queryString}`, { cache: "no-store" });
      void statsRequest
        .then(async (statsResponse) => {
          if (!statsResponse.ok) return;
          const statsPayload = (await statsResponse.json()) as StatsPayload;
          setStats(statsPayload);
          setStatsLoaded(true);
        })
        .catch(() => undefined);

      const topicsResponse = await topicsRequest;
      const statsResponse = { ok: true }; // Stats are handled above and must not gate the topic list.
      if (!statsResponse.ok || !topicsResponse.ok) throw new Error(language === "zh" ? "榜单数据加载失败" : "Failed to load ranking data");
      const topicsPayload = (await topicsResponse.json()) as { items: RankingItem[]; total: number; message?: string };
      setItems(topicsPayload.items ?? []);
      setTotal(topicsPayload.total ?? 0);
      setLoadedQueryString(queryString);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : language === "zh" ? "未知错误" : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [language, queryString]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  useEffect(() => {
    const key = "trae-contest-session-id";
    const existing = window.sessionStorage.getItem(key);
    const sessionId = existing || crypto.randomUUID();
    window.sessionStorage.setItem(key, sessionId);
    const heartbeat = () => {
      void fetch(`${API_BASE}/api/trae-contest/presence`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId })
      })
        .then(async (response) => {
          if (!response.ok) return;
          const payload = (await response.json()) as { onlineCount?: unknown };
          if (typeof payload.onlineCount === "number") {
            setStats((current) => statsWithOnlineCount(current, payload.onlineCount as number));
          }
        })
        .catch(() => undefined);
    };
    heartbeat();
    const timer = window.setInterval(heartbeat, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const trackOptions = TRACKS.map((item) => ({ value: item, label: TRACK_LABELS[item]?.[language] ?? item }));
  const sortOptions = SORTS.map((item) => ({ value: item, label: t.sortLabels[item] }));
  const pageSizeOptions = RANKING_PAGE_SIZE_OPTIONS.map((value) => ({ value: String(value), label: `${fmtInteger(value, language)}` }));
  const sortDirectionOptions = [
    { value: "desc", label: t.sortDesc },
    { value: "asc", label: t.sortAsc }
  ];
  const runControl = <RunButton language={language} onCompleted={load} />;
  const themeIcon = theme === "dark" ? <Moon className="h-4 w-4" /> : theme === "light" ? <Sun className="h-4 w-4" /> : <Monitor className="h-4 w-4" />;
  const showQueryChangeSkeleton = loading && queryString !== loadedQueryString;
  const fmtN = (value: number | null | undefined) => !statsLoaded ? "…" : fmtInteger(value ?? 0, language);
  const fmtD = (value: string | null | undefined) => !statsLoaded ? "…" : fmtDate(value, language);

  return (
    <main className="score-grid tech-shell min-h-screen text-slate-100">
      <nav className="site-nav">
        <div className="site-nav__group">
          <MainTabs
            activeTab={activeTab}
            items={[
              { key: "landing" as const, label: t.navLanding, href: "/" },
              { key: "ranking" as const, label: t.navRanking, href: "/ranking" }
            ]}
          />
          <div className="site-nav__brand">
            <span className="brand-mark" aria-hidden />
            <span>{t.brand}</span>
            <span className="brand-code">SYS/26</span>
          </div>
        </div>
        <div className="site-nav__group site-nav__group--right">
          <div className="nav-metrics">
            <span>
              {t.tokens} {fmtN(totalTokens)}
              <span className="nav-metrics__detail text-slate-500"> · {t.tokensIn} {fmtN(stats?.totalInputTokens)} / {t.tokensOut} {fmtN(stats?.totalOutputTokens)}</span>
            </span>
            <span>{t.online}: {fmtN(stats?.onlineCount)}</span>
          </div>
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
          <a
            href="https://github.com/Learnmore-smart/Trae-2026-contest-rankings"
            className="nav-control focus-ring"
            aria-label="Open GitHub repository"
          >
            <span className="inline-flex text-cyan-300">
              <Github className="h-4 w-4" />
            </span>
          </a>
          <a
            href="https://trae-2026-contest-rankings-494660453737.asia-east1.run.app"
            className="nav-control focus-ring"
            aria-label="Open RateMinistere home"
          >
            <span className="inline-flex text-cyan-300">
              <Home className="h-4 w-4" />
            </span>
          </a>
        </div>
      </nav>

      <section className="mx-auto max-w-[1480px] px-4 pb-10 pt-6 sm:px-6 lg:px-10">
        {activeTab === "landing" ? (
          <div className="landing-shell">
            <section className="landing-hero">
              <figure className="contest-official-banner">
                <Image
                  src={`${API_BASE}/Banner-Trae-contest-2026.jpg`}
                  alt="TRAE AI Creativity Contest official banner"
                  width={3000}
                  height={600}
                  priority
                  sizes="(max-width: 1480px) 100vw, 1480px"
                  className="contest-official-banner__image"
                  decoding="async"
                />
              </figure>
              <div className="hero-command-deck">
                <div className="landing-hero-copy">
                  <p className="kicker">{t.heroKicker}</p>
                  <h1 className="landing-hero-title mt-4 max-w-4xl text-4xl font-semibold leading-tight text-white sm:text-5xl lg:text-6xl">{t.heroTitle}</h1>
                  <p className="mt-6 max-w-3xl text-base leading-8 text-slate-300">{t.heroBody}</p>
                  <div className="hero-signal-strip" aria-label="Contest signals">
                    <div>
                      <span>{t.scoredProgress}</span>
                      <strong>{fmtN(progressDone)}/{fmtN(progressTotal)}</strong>
                    </div>
                    <div>
                      <span>{t.tokens}</span>
                      <strong>{fmtN(totalTokens)}</strong>
                    </div>
                    <div>
                      <span>{t.online}</span>
                      <strong>{fmtN(stats?.onlineCount)}</strong>
                    </div>
                  </div>
                </div>
                <div className="landing-hero-side">
                  <div className="telemetry-grid" aria-label="Contest telemetry">
                    <div>
                      <span>{t.scoredProgress}</span>
                      <strong>{fmtN(progressDone)}/{fmtN(progressTotal)}</strong>
                    </div>
                    <div>
                      <span>{t.tokens}</span>
                      <strong>{fmtN(totalTokens)}</strong>
                    </div>
                    <div>
                      <span>{t.online}</span>
                      <strong>{fmtN(stats?.onlineCount)}</strong>
                    </div>
                    <div>
                      <span>{t.lastUpdated}</span>
                      <strong>{fmtD(stats?.lastUpdatedAt)}</strong>
                    </div>
                  </div>
                  <div className="purpose-panel">
                    <p className="kicker">{t.purposeTitle}</p>
                    <p className="mt-4 text-sm leading-7 text-slate-300">{t.purposeBody}</p>
                  </div>
                  <div className="hero-actions">
                    <Link href="/ranking" className="control-button primary">
                      <Crown className="h-4 w-4" />
                      {t.navRanking}
                    </Link>
                    {runControl}
                  </div>
                  <UserTopicSubmit language={language} onSubmitted={load} />
                </div>
              </div>
            </section>

            <LeadOfficerBand language={language} />

            <div className="notice-bar">{t.disclaimer}</div>
          </div>
        ) : (
          <div className="ranking-command-shell">
            <section className="ranking-toolbar surface-panel">
              <div>
                <p className="kicker">{t.navRanking}</p>
                <h1 className="mt-1 text-2xl font-semibold text-white">{t.scoredProgress} {fmtN(progressDone)}/{fmtN(progressTotal)}</h1>
                <p className="mt-2 text-sm text-slate-500">{t.lastUpdated}: {fmtD(stats?.lastUpdatedAt)}</p>
              </div>
              <div className="phase-switch" role="tablist" aria-label="Contest phase">
                {[
                  { key: "prelim" as const, label: t.prelim, meta: t.live },
                  { key: "semi" as const, label: t.semi, meta: `${t.starts}${language === "zh" ? ` · ${semifinalDays} 天` : ` · ${semifinalDays}d`}` },
                  { key: "final" as const, label: t.final, meta: t.tbd }
                ].map((item) => (
                  <button key={item.key} type="button" role="tab" aria-selected={phase === item.key} onClick={() => setPhase(item.key)} className={`phase-pill ${phase === item.key ? "is-active" : ""}`}>
                    <span>{item.label}</span>
                    <small>{item.meta}</small>
                  </button>
                ))}
              </div>
              {runControl}
            </section>

            <div className="notice-bar">{t.disclaimer}</div>

            {phase === "prelim" ? (
              <>
                <section className="ranking-filters surface-panel">
                  <form
                    className="search-field control-field flex min-h-10 items-center gap-2 px-3 text-sm text-slate-300"
                    onSubmit={(event) => {
                      event.preventDefault();
                      setPage(1);
                      setQ(pendingQ);
                    }}
                  >
                    <Search className="h-4 w-4 shrink-0 text-cyan-300" aria-hidden />
                    <input
                      value={pendingQ}
                      onChange={(event) => setPendingQ(event.target.value)}
                      placeholder={t.search}
                      aria-label={t.search}
                      className="w-full bg-transparent text-white outline-none placeholder:text-slate-500"
                    />
                    {(pendingQ || q) ? (
                      <button
                        type="button"
                        onClick={() => {
                          setPendingQ("");
                          setPage(1);
                          setQ("");
                        }}
                        aria-label={t.clearSearch}
                        className="shrink-0 text-slate-500 transition hover:text-white"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    ) : null}
                    <button
                      type="submit"
                      className="shrink-0 border-l border-white/10 pl-2 text-xs font-bold text-cyan-300 transition hover:text-cyan-200"
                    >
                      {t.searchAction}
                    </button>
                  </form>
                  <Dropdown
                    icon={<Tag className="h-4 w-4" />}
                    label={t.track}
                    value={track}
                    options={trackOptions}
                    onChange={(value) => {
                      setPage(1);
                      setTrack(value);
                    }}
                  />
                  <Dropdown
                    icon={<ArrowDownWideNarrow className="h-4 w-4" />}
                    label={t.sort}
                    value={sort}
                    options={sortOptions}
                    onChange={(value) => {
                      setPage(1);
                      setSort(value as SortValue);
                    }}
                  />
                  <Dropdown
                    icon={<Rows3 className="h-4 w-4" />}
                    label={t.pageSize}
                    value={String(pageSize)}
                    options={pageSizeOptions}
                    onChange={(value) => {
                      setPage(1);
                      setPageSize(Number(value));
                    }}
                  />
                  <Dropdown
                    icon={<ArrowDownWideNarrow className="h-4 w-4" />}
                    label={t.sortDirection}
                    value={sortDir}
                    options={sortDirectionOptions}
                    onChange={(value) => {
                      setPage(1);
                      setSortDir(value as SortDirection);
                    }}
                  />
                  <ViewToggle value={viewMode} onChange={setViewMode} labels={{ list: t.viewListLabel, grid: t.viewGridLabel }} />
                </section>
                <UserTopicSubmit language={language} onSubmitted={load} />

                <div className="ranking-inline-meta">
                  <div className="ranking-inline-meta__stats">
                    <span>{fmtInteger(total, language)} {t.totalResults}</span>
                    <span>{t.scoredProgress} {fmtN(progressDone)}/{fmtN(progressTotal)}</span>
                  </div>
                  <PageSwitch
                    page={page}
                    totalPages={totalPages}
                    loading={loading}
                    language={language}
                    onPrev={() => setPage((current) => Math.max(1, current - 1))}
                    onNext={() => setPage((current) => Math.min(totalPages, current + 1))}
                  />
                </div>

                {error ? (
                  <div role="alert" className="rounded-md border border-rose-300 bg-white p-6 font-semibold text-rose-900 shadow-sm dark:border-rose-300/25 dark:bg-rose-400/10 dark:text-rose-100">
                    {error}
                  </div>
                ) : null}

                {loading && items.length === 0 ? (
                  <LoadingGrid viewMode={viewMode} language={language} />
                ) : showQueryChangeSkeleton ? (
                  <LoadingGrid viewMode={viewMode} language={language} />
                ) : items.length === 0 ? (
                  <EmptyState language={language} onRun={runControl} />
                ) : (
                  <>
                    <div className={viewMode === "grid" ? "ranking-grid" : "ranking-list"}>
                      {items.map((item) => (
                        <RankCard key={item.topic.id} item={item} language={language} viewMode={viewMode} />
                      ))}
                    </div>
                    <div className="ranking-inline-meta ranking-inline-meta--bottom">
                      <PageSwitch
                        page={page}
                        totalPages={totalPages}
                        loading={loading}
                        language={language}
                        onPrev={() => setPage((current) => Math.max(1, current - 1))}
                        onNext={() => setPage((current) => Math.min(totalPages, current + 1))}
                      />
                    </div>
                  </>
                )}
              </>
            ) : (
              <LockedPanel phase={phase} language={language} />
            )}
          </div>
        )}
      </section>
    </main>
  );
}
