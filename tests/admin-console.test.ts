import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const adminClientPath = join(process.cwd(), "app/trae-contest-2026/admin/admin-client.tsx");
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
