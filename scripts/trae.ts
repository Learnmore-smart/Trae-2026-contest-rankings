import { loadEnvConfig } from "@next/env";
import { judgeChangedTraeTopics } from "../lib/trae/judge.ts";
import { runTraeMatching } from "../lib/trae/matcher.ts";
import { scrapeAllTraeSources, scrapeTraeSource } from "../lib/trae/scraper.ts";
import type { TraeSourceType } from "../lib/trae/types.ts";

loadEnvConfig(process.cwd());

async function main(): Promise<void> {
  const [command, subcommand] = process.argv.slice(2);

  if (command === "scrape") {
    if (subcommand === "all") {
      await scrapeAllTraeSources();
      return;
    }
    if (subcommand === "signup" || subcommand === "preliminary") {
      await scrapeTraeSource(subcommand as TraeSourceType);
      return;
    }
  }

  if (command === "match") {
    await runTraeMatching();
    return;
  }

  if (command === "judge") {
    await judgeChangedTraeTopics({ mode: subcommand === "changed" ? "changed" : "unjudged" });
    return;
  }

  if (command === "run-all") {
    await scrapeAllTraeSources();
    await runTraeMatching();
    await judgeChangedTraeTopics({ mode: "unjudged" });
    return;
  }

  throw new Error(
    "Unknown command. Use: scrape signup|preliminary|all, match, judge [changed], run-all."
  );
}

main()
  .then(() => {
    console.log("TRAE worker command finished.");
  })
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
