import nextEnv from "@next/env";
import { getDataConnectDb } from "../lib/trae/dataconnect.ts";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

function normalizeFirebaseServiceAccountEnv(): void {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!raw) return;

  const decoded = raw.trim().startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf8");
  const repaired = decoded.replace("-----END PRVATE Key-----", "-----END PRIVATE KEY-----");
  if (repaired === decoded) return;

  process.env.FIREBASE_SERVICE_ACCOUNT_KEY = raw.trim().startsWith("{")
    ? repaired
    : Buffer.from(repaired, "utf8").toString("base64");
}

normalizeFirebaseServiceAccountEnv();

type CountRow = { _count?: number | null };

interface ClearCounts {
  topics?: CountRow[];
  evaluations?: CountRow[];
  matches?: CountRow[];
  runs?: CountRow[];
  presence?: CountRow[];
  modelTokenUsage?: CountRow[];
  scrapeCursors?: CountRow[];
}

const COUNT_QUERY = `
  query ClearSqlCounts {
    topics { _count }
    evaluations { _count }
    matches { _count }
    runs { _count }
    presence { _count }
    modelTokenUsage { _count }
    scrapeCursors { _count }
  }
`;

const CLEAR_MUTATION = `
  mutation ClearSqlData {
    evaluation_deleteMany(all: true)
    match_deleteMany(all: true)
    run_deleteMany(all: true)
    presence_deleteMany(all: true)
    modelTokenUsage_deleteMany(all: true)
    scrapeCursor_deleteMany(all: true)
    topic_deleteMany(all: true)
  }
`;

function countOf(rows: CountRow[] | undefined): number {
  return rows?.[0]?._count ?? 0;
}

function printCounts(label: string, counts: ClearCounts): void {
  console.log(label);
  console.log(`- topics: ${countOf(counts.topics)}`);
  console.log(`- evaluations: ${countOf(counts.evaluations)}`);
  console.log(`- matches: ${countOf(counts.matches)}`);
  console.log(`- runs: ${countOf(counts.runs)}`);
  console.log(`- presence: ${countOf(counts.presence)}`);
  console.log(`- model_token_usage: ${countOf(counts.modelTokenUsage)}`);
  console.log(`- scrape_cursors: ${countOf(counts.scrapeCursors)}`);
}

async function readCounts(): Promise<ClearCounts> {
  const dc = getDataConnectDb();
  const result = await dc.executeGraphql<ClearCounts, Record<string, never>>(COUNT_QUERY);
  return result.data;
}

async function clearData(): Promise<void> {
  const dc = getDataConnectDb();
  await dc.executeGraphql<Record<string, unknown>, Record<string, never>>(CLEAR_MUTATION);
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes("--dry-run");
  const before = await readCounts();
  printCounts(dryRun ? "Current SQL row counts:" : "SQL row counts before clear:", before);

  if (dryRun) {
    console.log("Dry run only. No rows were deleted.");
    return;
  }

  await clearData();
  const after = await readCounts();
  printCounts("SQL row counts after clear:", after);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
