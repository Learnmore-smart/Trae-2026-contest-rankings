"use client";

import { useState } from "react";
import { Play, RefreshCw } from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_BASE_PATH || "";

const TASKS = [
  { task: "scrape-signup", label: "抓取报名区", hint: "更新报名帖，只用于后续匹配。" },
  { task: "scrape-preliminary", label: "抓取初赛区", hint: "更新会进入榜单的 Demo 帖。" },
  { task: "match", label: "执行匹配", hint: "把初赛帖和报名帖做自动关联。" },
  { task: "judge", label: "评分未评分作品", hint: "调用免费模型评分未评初赛作品。" },
  { task: "run-all", label: "跑完整流水线", hint: "抓取两个分区、匹配、评分。" }
] as const;

export default function DevClient() {
  const [busy, setBusy] = useState<string | null>(null);
  const [output, setOutput] = useState<string>("等待执行本地任务。");

  async function run(task: (typeof TASKS)[number]["task"]) {
    setBusy(task);
    setOutput("任务运行中，长任务可能需要几分钟...");
    try {
      const response = await fetch(`${API_BASE}/api/trae-contest/dev/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task })
      });
      const text = await response.text();
      if (!response.ok) throw new Error(text);
      setOutput(text);
    } catch (error) {
      setOutput(error instanceof Error ? error.message : "任务失败");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mt-8 grid gap-5 lg:grid-cols-[1fr_1.1fr]">
      <section className="surface-panel p-5">
        <div className="flex items-center gap-2 text-sm font-semibold text-white">
          <RefreshCw className="h-4 w-4 text-emerald-300" />
          本地任务
        </div>
        <div className="mt-4 grid gap-3">
          {TASKS.map((item) => (
            <button
              key={item.task}
              type="button"
              disabled={Boolean(busy)}
              onClick={() => void run(item.task)}
              className="group rounded-lg border border-white/10 bg-white/[0.045] p-4 text-left transition hover:border-emerald-300/40 hover:bg-emerald-300/10 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span className="flex items-center justify-between gap-3 font-bold text-white">
                {item.label}
                <Play className="h-4 w-4 text-stone-400 transition group-hover:text-emerald-200" />
              </span>
              <span className="mt-1 block text-xs leading-5 text-stone-400">{item.hint}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="surface-panel p-5">
        <h2 className="text-sm font-semibold text-white">输出</h2>
        <pre className="mt-4 max-h-[34rem] overflow-auto rounded-lg border border-white/10 bg-black/40 p-4 text-xs leading-5 text-stone-200">
          {busy ? `正在执行 ${busy}\n\n` : ""}
          {output}
        </pre>
      </section>
    </div>
  );
}
