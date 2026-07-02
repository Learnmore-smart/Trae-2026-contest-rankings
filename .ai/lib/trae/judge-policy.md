# lib/trae/judge-policy.ts

> Last updated: 2026-07-02 | Protection: STANDARD

## Purpose

Defines non-secret default throughput policy for TRAE judging.

## What It Does

- Centralizes the default judge batch size and topic-level concurrency.
- Uses an overnight-sized batch cap with 8 topic teams, matching a 40 rpm API quota at 5 LLM calls per consensus team.
- Lets public run routes, admin UI actions, and server config share the same hard-coded defaults.
- Keeps these values out of Cloud Run env unless an operator deliberately wants an override.

## Public API

| Name | Type | Description |
|------|------|-------------|
| `DEFAULT_JUDGE_BATCH_MAX` | constant | Default number of topics requested per judge batch. |
| `DEFAULT_JUDGE_CONCURRENCY` | constant | Default number of topics judged in parallel. |

## Dependencies

- Internal: none.

## Agent Decisions / Thoughts

- 2026-07-01 Codex: Owner wants grading faster and does not want to repeatedly edit Cloud Run public env vars. Use code constants for non-secret throughput defaults.
- 2026-07-01 Codex: Move from `12 / 3` to `24 / 6`. This doubles per-batch size and worker count without jumping straight to a high-risk rate-limit setting.
- 2026-07-01 Codex: Implemented as pure constants so the file is safe to import from `app/admin/admin-client.tsx`.
- 2026-07-01 Codex: Owner asked to increase further. Move defaults to `48 / 8`, a larger but still bounded setting.
- 2026-07-01 Codex: Owner observed scoring stuck at `149/3,702` for days and asked for at least about 100 topics/hour. Move default judge throughput to `100 / 20` so one public/admin batch has enough capacity while still bounding in-process workers.
- 2026-07-02 Codex: Owner explicitly wants many evaluator teams in parallel. Raise default topic-level concurrency to `100`, so a 100-topic batch can run 100 consensus teams at once: about 400 evaluator requests in the first wave, then about 100 referee requests.
- 2026-07-02 Codex: Owner clarified the API quota is 40 rpm. Correct the throughput policy to 8 consensus teams because each team consumes 5 LLM calls, and raise the batch cap so scheduled jobs can drain thousands of newly found topics.

## Important Notes / NEVER Change

- Never put API keys, admin tokens, or service-account values in this file.
- Keep this file import-safe from client components; it must remain pure constants only.

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-07-01 | Planned shared judge throughput policy constants. | Codex |
| 2026-07-01 | Added `DEFAULT_JUDGE_BATCH_MAX = 24` and `DEFAULT_JUDGE_CONCURRENCY = 6`. | Codex |
| 2026-07-01 | Planned throughput bump to `48 / 8`. | Codex |
| 2026-07-01 | Updated constants to `DEFAULT_JUDGE_BATCH_MAX = 48` and `DEFAULT_JUDGE_CONCURRENCY = 8`. | Codex |
| 2026-07-01 | Planned throughput bump to `100 / 20`. | Codex |
| 2026-07-01 | Updated constants to `DEFAULT_JUDGE_BATCH_MAX = 100` and `DEFAULT_JUDGE_CONCURRENCY = 20`. | Codex |
| 2026-07-02 | Planned topic-level concurrency bump to 100 for parallel evaluator teams. | Codex |
| 2026-07-02 | Updated constants to `DEFAULT_JUDGE_BATCH_MAX = 100` and `DEFAULT_JUDGE_CONCURRENCY = 100`. | Codex |
| 2026-07-02 | Implemented correction to `DEFAULT_JUDGE_BATCH_MAX = 4000` and `DEFAULT_JUDGE_CONCURRENCY = 8` for 40 rpm overnight judging. | Codex |

## Implemented Change: 40 RPM Throughput Defaults

- `DEFAULT_JUDGE_CONCURRENCY` is now 8, because 8 consensus teams per minute times 5 LLM calls per team equals the 40 rpm quota.
- `DEFAULT_JUDGE_BATCH_MAX` is now 4000 so a scheduled overnight worker can keep grading past the old 100-topic cap and still clear more than 3000 topics if enough unjudged 初赛 posts exist.
- Keep the constants pure and client-import safe.
