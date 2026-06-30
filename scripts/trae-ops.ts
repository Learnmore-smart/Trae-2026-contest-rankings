import nextEnv from "@next/env";
import { scrapeTraeSource } from "../lib/trae/scraper.ts";
import { runTraeMatching } from "../lib/trae/matcher.ts";
import { judgeChangedTraeTopics } from "../lib/trae/judge.ts";
import type { TraeSourceType } from "../lib/trae/types.ts";
import { getDataConnectDb } from "../lib/trae/dataconnect.ts";
import { TraeSourceType as DataConnectSourceType, upsertScrapeCursor } from "@trae-contest/dataconnect-generated";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

async function cleanup(): Promise<void> {
  const dc = getDataConnectDb();
  for (const sourceType of [DataConnectSourceType.SIGNUP, DataConnectSourceType.PRELIMINARY]) {
    await upsertScrapeCursor(dc, {
      sourceType,
      nextPage: 0,
      totalSeen: 0,
      lastCompletedCycleAt: null
    });
  }
  console.log("cleanup done: SQL scrape cursors reset. Topic deletion requires an explicit Data Connect delete mutation.");
}

async function main(): Promise<void> {
  const [cmd, a, b, c, d] = process.argv.slice(2);
  if (cmd === "cleanup") return void (await cleanup());
  if (cmd === "scrape") {
    const source = a as TraeSourceType;
    const result = await scrapeTraeSource(source, {
      maxPages: b ? Number(b) : undefined,
      maxDetails: c ? Number(c) : undefined,
      resume: d === "false" ? false : true
    });
    console.log("scrape result:", JSON.stringify(result));
    return;
  }
  if (cmd === "match") {
    console.log("match result:", JSON.stringify(await runTraeMatching()));
    return;
  }
  if (cmd === "judge") {
    const result = await judgeChangedTraeTopics({ mode: "unjudged", max: a ? Number(a) : undefined });
    console.log("judge result:", JSON.stringify(result));
    return;
  }
  throw new Error("usage: cleanup | scrape <source> <pages> <details> [resume] | match | judge [max]");
}

main().then(() => process.exit(0)).catch((err) => { console.error(err); process.exit(1); });
