import nextEnv from "@next/env";
import { scrapeTraeSource } from "../lib/trae/scraper.ts";
import type { TraeSourceType } from "../lib/trae/types.ts";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

// Walk a whole forum category to the end by repeatedly running the bounded, resumable
// scraper until the cursor wraps (reachedEnd). One long-lived process, so it isn't bound
// by a per-command timeout. Writes are content-hash deduped, so already-stored topics cost
// reads only — this does not "explode" Firestore.
async function fullScrape(source: TraeSourceType, maxIterations: number): Promise<void> {
  let totalCreated = 0;
  let totalFound = 0;
  for (let i = 0; i < maxIterations; i += 1) {
    const result = await scrapeTraeSource(source, { maxPages: 10, maxDetails: 120, resume: true });
    totalCreated += result.topicsCreated;
    totalFound += result.topicsFound;
    console.log(
      `[${source} iter ${i + 1}] pages ${result.startPage}..${result.startPage + result.pagesScanned - 1} ` +
        `found=${result.topicsFound} created=${result.topicsCreated} updated=${result.topicsUpdated} ` +
        `failed=${result.failedCount} nextPage=${result.nextPage} end=${result.reachedEnd} ` +
        `| cumulative created=${totalCreated}`
    );
    if (result.reachedEnd) {
      console.log(`[${source}] reached end of category after ${i + 1} iterations. total created=${totalCreated}, scanned refs=${totalFound}.`);
      return;
    }
  }
  console.log(`[${source}] stopped after ${maxIterations} iterations (safety cap). total created=${totalCreated}.`);
}

async function main(): Promise<void> {
  const source = (process.argv[2] as TraeSourceType) || "preliminary";
  const maxIterations = process.argv[3] ? Number(process.argv[3]) : 60;
  console.log(`fullScrape start: source=${source} maxIterations=${maxIterations}`);
  await fullScrape(source, maxIterations);
  console.log("fullScrape done.");
}

main().then(() => process.exit(0)).catch((err) => { console.error(err); process.exit(1); });
