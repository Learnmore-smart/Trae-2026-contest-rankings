import nextEnv from "@next/env";
import { writeFileSync, unlinkSync } from "node:fs";
import { execSync } from "node:child_file"; // Wait, in Node.js it's "child_process"
import { execSync as exec } from "node:child_process";
import { join } from "node:path";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

async function main() {
  const rawKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!rawKey) {
    console.error("FIREBASE_SERVICE_ACCOUNT_KEY not found in .env");
    process.exit(1);
  }

  const decoded = rawKey.trim().startsWith("{") 
    ? rawKey 
    : Buffer.from(rawKey, "base64").toString("utf8");

  const tempFile = join(process.cwd(), "scratch_sa_key.json");
  writeFileSync(tempFile, decoded, "utf8");

  try {
    console.log("Running firebase deploy with service account credentials...");
    exec(`npx firebase deploy --only dataconnect --project trae-contest-ranking-2026`, {
      env: {
        ...process.env,
        GOOGLE_APPLICATION_CREDENTIALS: tempFile
      },
      stdio: "inherit"
    });
    console.log("Deployment completed successfully.");
  } catch (error) {
    console.error("Deployment failed:", error);
  } finally {
    try {
      unlinkSync(tempFile);
    } catch (e) {
      // ignore
    }
  }
}

main();
