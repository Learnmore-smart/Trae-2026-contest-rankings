/**
 * Rejudge every preliminary topic whose latest evaluation used a given model
 * (default: moonshotai/kimi-k2.6).
 *
 * Usage:
 *   node --experimental-strip-types scripts/rejudge-by-model.ts
 *   node --experimental-strip-types scripts/rejudge-by-model.ts moonshotai/kimi-k2.6 80
 *   node --experimental-strip-types scripts/rejudge-by-model.ts kimi 40
 *
 * Env:
 *   TRAE_JUDGE_CONCURRENCY — worker concurrency (default 80 from .env)
 *   TRAE_JUDGE_VISION_ENABLED — set false for faster text-only bulk rejudge
 *   REJUDGE_SNAPSHOT_EVERY — write board snapshot every N successes (default 25)
 */
import nextEnv from "@next/env";
import * as fs from "node:fs";
import * as path from "node:path";
import { writeBoardSnapshot } from "../lib/trae/api.ts";
import { getDataConnectDb } from "../lib/trae/dataconnect.ts";
import { getTraeConfig } from "../lib/trae/config.ts";
import { runWithConcurrency } from "../lib/trae/concurrency.ts";
import { rejudgeTopicById } from "../lib/trae/judge.ts";
import { getBoardPage } from "@trae-contest/dataconnect-generated";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const modelNeedle = (process.argv[2] ?? "moonshotai/kimi-k2.6").trim().toLowerCase();
const concurrencyArg = process.argv[3] ? Number(process.argv[3]) : NaN;
const snapshotEvery = Math.max(1, Math.floor(Number(process.env.REJUDGE_SNAPSHOT_EVERY ?? 25)));
const progressLogPath = path.join(process.cwd(), process.env.REJUDGE_LOG ?? "rejudge-kimi-progress.log");

function logLine(message: string): void {
  const line = `[${new Date().toISOString()}] ${message}`;
  console.log(line);
  try {
    fs.appendFileSync(progressLogPath, line + "\n", "utf8");
  } catch {
    // ignore disk errors for progress log
  }
}

async function collectTargetIds(): Promise<Array<{ id: string; title: string; score: number | null; model: string }>> {
  const dc = getDataConnectDb();
  const PAGE = 1000;
  const targets: Array<{ id: string; title: string; score: number | null; model: string }> = [];

  for (let offset = 0; ; offset += PAGE) {
    const res = await getBoardPage(dc as any, { limit: PAGE, offset });
    const topics = res.data.topics ?? [];
    for (const t of topics) {
      const ev = t.evaluations_on_topic?.[0];
      if (!ev?.model) continue;
      if (!String(ev.model).toLowerCase().includes(modelNeedle)) continue;
      targets.push({
        id: t.id,
        title: t.title ?? "",
        score: t.totalScore ?? null,
        model: ev.model
      });
    }
    if (topics.length < PAGE) break;
  }

  return targets;
}

async function main(): Promise<void> {
  try {
    fs.writeFileSync(progressLogPath, "", "utf8");
  } catch {
    // ignore
  }

  const config = getTraeConfig();
  const concurrency = Number.isFinite(concurrencyArg) && concurrencyArg > 0
    ? Math.floor(concurrencyArg)
    : config.judgeConcurrency;

  logLine(`[rejudge-by-model] model filter: "${modelNeedle}"`);
  logLine(`[rejudge-by-model] concurrency: ${concurrency}`);
  logLine(`[rejudge-by-model] vision: ${config.judgeVisionEnabled ? "ON" : "OFF"}`);
  logLine(`[rejudge-by-model] provider order: ${config.aiProviderOrder.join(",")}`);
  logLine(`[rejudge-by-model] friend primary: ${config.friendPrimaryModel}`);
  logLine(`[rejudge-by-model] friend fallbacks: ${config.friendFallbackModels.join(",")}`);
  logLine(`[rejudge-by-model] nvidia primary: ${config.nvidiaPrimaryModel}`);
  logLine(`[rejudge-by-model] progress log: ${progressLogPath}`);

  const targets = await collectTargetIds();
  logLine(`[rejudge-by-model] found ${targets.length} topics to rejudge`);
  if (targets.length === 0) {
    logLine("[rejudge-by-model] nothing to do.");
    return;
  }

  // Score histogram before (quick sanity on "kimi scores low")
  const beforeScores = targets.map((t) => t.score).filter((s): s is number => typeof s === "number" && s >= 0);
  if (beforeScores.length > 0) {
    const avg = beforeScores.reduce((a, b) => a + b, 0) / beforeScores.length;
    const sorted = [...beforeScores].sort((a, b) => a - b);
    const mid = sorted[Math.floor(sorted.length / 2)];
    logLine(
      `[rejudge-by-model] before: n=${beforeScores.length} avg=${avg.toFixed(1)} median=${mid} min=${sorted[0]} max=${sorted[sorted.length - 1]}`
    );
  }

  let ok = 0;
  let failed = 0;
  let empty = 0;
  let notFound = 0;
  let sinceSnapshot = 0;
  const startedAt = Date.now();
  const scoreDeltas: number[] = [];
  const failures: Array<{ id: string; error: string }> = [];

  await runWithConcurrency(targets, concurrency, async (item, index) => {
    const label = `[${index + 1}/${targets.length}] ${item.id}`;
    try {
      const result = await rejudgeTopicById(item.id);
      if (result.status === "ok") {
        ok += 1;
        sinceSnapshot += 1;
        const newScore = result.evaluation.totalScore;
        const oldScore = item.score;
        if (typeof oldScore === "number" && typeof newScore === "number") {
          scoreDeltas.push(newScore - oldScore);
        }
        const delta =
          typeof oldScore === "number"
            ? `${newScore - oldScore >= 0 ? "+" : ""}${newScore - oldScore}`
            : "?";
        logLine(
          `${label} OK model=${result.evaluation.model} score ${oldScore ?? "?"} → ${newScore} (Δ${delta})`
        );
        if (sinceSnapshot >= snapshotEvery) {
          sinceSnapshot = 0;
          try {
            await writeBoardSnapshot();
            logLine(`[rejudge-by-model] board snapshot written (ok=${ok} fail=${failed})`);
          } catch (err) {
            logLine(`[rejudge-by-model] snapshot failed: ${err instanceof Error ? err.message : String(err)}`);
          }
        }
      } else if (result.status === "empty") {
        empty += 1;
        logLine(`${label} EMPTY (skipped)`);
      } else {
        notFound += 1;
        logLine(`${label} NOT_FOUND`);
      }
    } catch (err) {
      failed += 1;
      const msg = err instanceof Error ? err.message : String(err);
      failures.push({ id: item.id, error: msg.slice(0, 200) });
      logLine(`${label} FAIL: ${msg.slice(0, 180)}`);
    }

    const done = ok + failed + empty + notFound;
    if (done % 10 === 0 || done === targets.length) {
      const elapsedS = Math.max(1, (Date.now() - startedAt) / 1000);
      const rate = (done / elapsedS) * 60;
      logLine(
        `[rejudge-by-model] progress ${done}/${targets.length} (ok=${ok} fail=${failed} empty=${empty} nf=${notFound}) ` +
          `${rate.toFixed(1)}/min, ${elapsedS.toFixed(0)}s elapsed`
      );
    }
  });

  try {
    await writeBoardSnapshot();
    logLine("[rejudge-by-model] final board snapshot written");
  } catch (err) {
    logLine(`[rejudge-by-model] final snapshot failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  const elapsedS = (Date.now() - startedAt) / 1000;
  logLine("========== rejudge-by-model summary ==========");
  logLine(`filter: ${modelNeedle}`);
  logLine(`total: ${targets.length}`);
  logLine(`ok: ${ok}  fail: ${failed}  empty: ${empty}  not_found: ${notFound}`);
  logLine(`elapsed: ${elapsedS.toFixed(0)}s (${(elapsedS / 60).toFixed(1)} min)`);
  if (scoreDeltas.length > 0) {
    const avgDelta = scoreDeltas.reduce((a, b) => a + b, 0) / scoreDeltas.length;
    const up = scoreDeltas.filter((d) => d > 0).length;
    const down = scoreDeltas.filter((d) => d < 0).length;
    const same = scoreDeltas.filter((d) => d === 0).length;
    logLine(
      `score Δ: avg=${avgDelta >= 0 ? "+" : ""}${avgDelta.toFixed(1)}  up=${up} down=${down} same=${same}`
    );
  }
  if (failures.length > 0) {
    logLine(`sample failures (${Math.min(10, failures.length)}):`);
    for (const f of failures.slice(0, 10)) {
      logLine(`  ${f.id}: ${f.error}`);
    }
  }
  logLine("==============================================");

  if (failed > 0) process.exitCode = 2;
}

main().catch((err) => {
  logLine(String(err instanceof Error ? err.stack ?? err.message : err));
  process.exit(1);
});
