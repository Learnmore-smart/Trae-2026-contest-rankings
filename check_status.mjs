// Check LLM health
const URL = "https://trae-2026-contest-rankings-494660453737.asia-east1.run.app/trae-contest-2026/api/trae-contest/admin/llm-health";

async function main() {
  const res = await fetch(URL);
  console.log("status:", res.status, res.statusText);
  const text = await res.text();
  console.log("body:", text.slice(0, 2000));
}
main();
