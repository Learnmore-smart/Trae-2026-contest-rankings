// Deploy the dataconnect connector source (queries.gql + mutations.gql) directly
// via the Firebase Data Connect REST API, using a gcloud access token.
// Use when `firebase deploy --only dataconnect` fails due to CLI account permissions.

import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";

const PROJECT = "trae-contest-ranking-2026";
const LOCATION = "asia-east1";
const SERVICE = "trae-contest-ranking-2026-service";
const CONNECTOR = "trae-contest";
const CONNECTOR_NAME = `projects/${PROJECT}/locations/${LOCATION}/services/${SERVICE}/connectors/${CONNECTOR}`;

const token = execSync("gcloud auth print-access-token", { encoding: "utf8" }).trim();
if (!token.startsWith("ya29.")) {
  console.error("ERROR: gcloud token looks invalid:", token.slice(0, 20));
  process.exit(1);
}

const queriesGql = readFileSync("dataconnect/connector/queries.gql", "utf8");
const mutationsGql = readFileSync("dataconnect/connector/mutations.gql", "utf8");

const body = {
  source: {
    files: [
      { path: "queries.gql", content: queriesGql },
      { path: "mutations.gql", content: mutationsGql },
    ],
  },
};

const url = `https://firebasedataconnect.googleapis.com/v1alpha/${CONNECTOR_NAME}?updateMask=source`;

console.log("PATCH", url);
console.log("queries.gql bytes:", queriesGql.length);
console.log("mutations.gql bytes:", mutationsGql.length);

const resp = await fetch(url, {
  method: "PATCH",
  headers: {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify(body),
});

const text = await resp.text();
console.log("Status:", resp.status, resp.statusText);

let json;
try {
  json = JSON.parse(text);
} catch {
  console.log("Raw response:", text);
  process.exit(resp.ok ? 0 : 1);
}

if (!resp.ok) {
  console.error("ERROR:", JSON.stringify(json, null, 2));
  process.exit(1);
}

// Long-running operation → poll until done.
if (json.name && json.name.startsWith("projects/")) {
  console.log("Long-running operation:", json.name);
  console.log("Done. Connector updated.");
} else if (json.done === false && json.name?.startsWith("operations/")) {
  const opName = json.name;
  console.log("Operation started:", opName);
  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    const opResp = await fetch(
      `https://firebasedataconnect.googleapis.com/v1alpha/${opName}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const opJson = await opResp.json();
    console.log(`  poll ${i + 1}: done=${opJson.done}, error=${opJson.error?.message ?? "none"}`);
    if (opJson.done) {
      if (opJson.error) {
        console.error("Operation failed:", JSON.stringify(opJson.error, null, 2));
        process.exit(1);
      }
      console.log("Operation completed successfully.");
      break;
    }
  }
} else {
  console.log("Response:", JSON.stringify(json, null, 2));
}
