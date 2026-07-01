import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const adminClientPath = join(process.cwd(), "app/admin/admin-client.tsx");
const judgePolicyPath = join(process.cwd(), "lib/trae/judge-policy.ts");
const adminClient = readFileSync(adminClientPath, "utf8");
const judgePolicy = readFileSync(judgePolicyPath, "utf8");

test("admin console busy badge stays generic while actions run", () => {
  assert.match(
    adminClient,
    /<RefreshCw className="h-3\.5 w-3\.5 animate-spin" \/>[\s\S]*?运行中/,
    "busy badge should show generic running copy"
  );
  assert.doesNotMatch(
    adminClient,
    /正在执行：\{busy\}/,
    "busy badge should not expose the raw action label"
  );
});

test("admin judge actions use the shared aggressive judge policy", () => {
  const judgeActions = [...adminClient.matchAll(/endpoint: "\/api\/trae-contest\/admin\/judge"[\s\S]*?batchMax: DEFAULT_JUDGE_BATCH_MAX[\s\S]*?concurrency: DEFAULT_JUDGE_CONCURRENCY/g)];

  assert.match(judgePolicy, /export const DEFAULT_JUDGE_BATCH_MAX = 24;/);
  assert.match(judgePolicy, /export const DEFAULT_JUDGE_CONCURRENCY = 6;/);
  assert.match(adminClient, /import \{ DEFAULT_JUDGE_BATCH_MAX, DEFAULT_JUDGE_CONCURRENCY \} from "@\/lib\/trae\/judge-policy";/);
  assert.equal(judgeActions.length, 3, "expected unjudged, changed, and low-confidence judge actions");
});

test("admin console opts into the shared theme shell", () => {
  assert.match(adminClient, /<main className="score-grid tech-shell min-h-screen/);
});

test("admin empty state points operators at SQL Data Connect storage", () => {
  assert.match(adminClient, /SQL\/Data Connect/);
  assert.doesNotMatch(adminClient, /Firestore/);
});
