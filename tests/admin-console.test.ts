import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const adminClientPath = join(process.cwd(), "app/admin/admin-client.tsx");
const adminClient = readFileSync(adminClientPath, "utf8");

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

test("admin judge actions request twelve-topic batches with three workers", () => {
  const judgeActions = [...adminClient.matchAll(/endpoint: "\/api\/trae-contest\/admin\/judge"[\s\S]*?batchMax: (\d+)[\s\S]*?concurrency: (\d+)/g)];

  assert.equal(judgeActions.length, 3, "expected unjudged, changed, and low-confidence judge actions");
  for (const action of judgeActions) {
    assert.equal(action[1], "12");
    assert.equal(action[2], "3");
  }
});

test("admin console opts into the shared theme shell", () => {
  assert.match(adminClient, /<main className="score-grid tech-shell min-h-screen/);
});

test("admin empty state points operators at SQL Data Connect storage", () => {
  assert.match(adminClient, /SQL\/Data Connect/);
  assert.doesNotMatch(adminClient, /Firestore/);
});
