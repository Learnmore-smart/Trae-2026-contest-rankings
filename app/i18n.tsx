"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Languages, Settings } from "lucide-react";

export type ContestLanguage = "zh" | "en";

const STORAGE_KEY = "trae-contest-language";

const OPTIONS: Array<{ value: ContestLanguage; label: string; nativeLabel: string }> = [
  { value: "zh", label: "中文", nativeLabel: "Chinese" },
  { value: "en", label: "English", nativeLabel: "英语" }
];

export function useContestLanguage() {
  const [language, setLanguageState] = useState<ContestLanguage>("zh");

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved === "zh" || saved === "en") setLanguageState(saved);
  }, []);

  const setLanguage = (nextLanguage: ContestLanguage) => {
    setLanguageState(nextLanguage);
    window.localStorage.setItem(STORAGE_KEY, nextLanguage);
  };

  return { language, setLanguage };
}

export function LanguageSettings({
  language,
  onChange,
  labels
}: {
  language: ContestLanguage;
  onChange: (language: ContestLanguage) => void;
  labels: {
    settings: string;
    language: string;
    chooseLanguage: string;
  };
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const current = OPTIONS.find((option) => option.value === language) ?? OPTIONS[0];

  useEffect(() => {
    if (!open) return;
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative w-fit">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-label={labels.chooseLanguage}
        className="focus-ring inline-flex min-h-11 items-center gap-2 rounded-lg border border-white/15 bg-white/[0.07] px-3 py-2 text-sm font-semibold text-white shadow-xl shadow-black/20 transition hover:bg-white/[0.12]"
      >
        <Settings className="h-4 w-4 text-[#f4c96b]" />
        <span className="hidden sm:inline">{labels.settings}</span>
        <span className="rounded-md bg-white/10 px-2 py-1 text-xs text-amber-50">{current.label}</span>
        <ChevronDown className={`h-4 w-4 text-slate-300 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>

      <div
        className={`absolute right-0 z-30 mt-2 w-56 origin-top-right overflow-hidden rounded-lg border border-white/15 bg-[#11110f]/95 p-2 shadow-2xl shadow-black/40 backdrop-blur-xl transition duration-200 ${
          open ? "translate-y-0 scale-100 opacity-100" : "pointer-events-none -translate-y-2 scale-95 opacity-0"
        }`}
      >
        <div className="mb-1 flex items-center gap-2 px-2 py-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
          <Languages className="h-3.5 w-3.5" />
          {labels.language}
        </div>
        {OPTIONS.map((option) => (
          <button
            type="button"
            key={option.value}
            onClick={() => {
              onChange(option.value);
              setOpen(false);
            }}
            className="flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm text-stone-100 transition hover:bg-white/10"
          >
            <span>
              <span className="block font-semibold">{option.label}</span>
              <span className="text-xs text-slate-500">{option.nativeLabel}</span>
            </span>
            {option.value === language ? <Check className="h-4 w-4 text-[#f4c96b]" /> : null}
          </button>
        ))}
      </div>
    </div>
  );
}
