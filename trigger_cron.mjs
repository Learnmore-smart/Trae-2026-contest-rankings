// Manually trigger the cron run-all endpoint with the secret
import { readFileSync } from "fs";
import { execSync } from "child_process";

// Read the cron secret from .env
const envContent = readFileSync(".env", "utf-8");
const match = envContent.match(/^TRAE_CRON_SECRET=(.+)$/m);
if (!match) {
  console.error("TRAE_CRON_SECRET not found in .env");
  process.exit(1);
}
const cronSecret = match[1].trim();

const URL = "https://trae-2026-contest-rankings-494660453737.asia-east1.run.app/trae-contest-2026/api/trae-contest/cron/run-all";

console.log("Triggering cron run-all...");
console.log("URL:", URL);
console.log("Secret length:", cronSecret.length);

try {
  const res = await fetch(URL, {
    method: "GET",
    headers: {
      "x-trae-cron-secret": cronSecret,
    },
  });
  console.log("status:", res.status, res.statusText);
  const text = await res.text();
  console.log("body:", text.slice(0, 1000));
} catch (e) {
  console.error("Error:", e.message);
}
