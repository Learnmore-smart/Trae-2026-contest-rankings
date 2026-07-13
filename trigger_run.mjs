// Trigger POST /run to start scoring with the new fire-and-forget pipeline
const URL = "https://trae-2026-contest-rankings-494660453737.asia-east1.run.app/trae-contest-2026/api/trae-contest/run";

async function main() {
  console.log("POST /run ...");
  try {
    const res = await fetch(URL, { method: "POST" });
    console.log("status:", res.status, res.statusText);
    const data = await res.json();
    console.log("response:", JSON.stringify(data, null, 2));
  } catch (e) {
    console.error("Error:", e.message);
  }

  // Wait 5s then check status
  await new Promise((r) => setTimeout(r, 5000));
  console.log("\n--- Checking status after 5s ---");
  const statusRes = await fetch(`${URL}`);
  const status = await statusRes.json();
  console.log("status:", JSON.stringify(status, null, 2));
}
main();
