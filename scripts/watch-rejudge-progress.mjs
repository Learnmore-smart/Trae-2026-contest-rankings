import fs from "node:fs";
import path from "node:path";

const logPath = path.resolve(process.argv[2] ?? "rejudge-kimi-progress.log");
const intervalMs = Number(process.argv[3] ?? 120_000);

function snapshot() {
  if (!fs.existsSync(logPath)) {
    console.log(`${new Date().toISOString()} missing ${logPath}`);
    return;
  }
  const text = fs.readFileSync(logPath, "utf8");
  const lines = text.split(/\r?\n/).filter(Boolean);
  const ok = lines.filter((l) => l.includes(" OK ")).length;
  const fail = lines.filter((l) => l.includes(" FAIL")).length;
  const progress = lines.filter((l) => l.includes("[rejudge-by-model] progress ") || l.includes("summary") || l.includes("found "));
  console.log(`${new Date().toISOString()} ok=${ok} fail=${fail} lines=${lines.length}`);
  for (const line of progress.slice(-3)) console.log(line);
  const tail = lines.slice(-3);
  for (const line of tail) console.log(`  tail: ${line}`);
}

console.log(`watching ${logPath} every ${intervalMs}ms`);
snapshot();
setInterval(snapshot, intervalMs);
