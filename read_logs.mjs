// Check logs for judge-related messages and errors
import { execSync } from "child_process";

const token = execSync('gcloud auth print-access-token', { shell: 'powershell.exe' }).toString().trim();

const filter = 'resource.type="cloud_run_revision" resource.labels.service_name="trae-2026-contest-rankings" (textPayload:("judge" OR "trae" OR "error" OR "Error" OR "429" OR "rate" OR "fail" OR "throttl") OR jsonPayload.message:("judge" OR "trae" OR "error" OR "429")) timestamp>="2026-07-13T00:06:00Z"';

const body = {
  resourceNames: ["projects/trae-contest-ranking-2026"],
  filter: filter,
  orderBy: "timestamp asc",
  pageSize: 50,
};

const res = await fetch("https://logging.googleapis.com/v2/entries:list", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify(body),
});

const data = await res.json();
if (data.entries) {
  console.log(`Found ${data.entries.length} entries:\n`);
  for (const e of data.entries) {
    const ts = e.timestamp;
    const sev = e.severity || "DEFAULT";
    let msg = "";
    if (e.textPayload) msg = e.textPayload;
    else if (e.jsonPayload) msg = e.jsonPayload.message || JSON.stringify(e.jsonPayload);
    if (msg) console.log(`[${ts}] ${sev}: ${msg.slice(0, 800)}`);
  }
} else {
  console.log("No entries matched.");
}
