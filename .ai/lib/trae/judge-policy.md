# lib/trae/judge-policy.ts

> Last updated: 2026-07-01 | Protection: STANDARD

## Purpose

Defines non-secret default throughput policy for TRAE judging.

## What It Does

- Centralizes the default judge batch size and topic-level concurrency.
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

## Important Notes / NEVER Change

- Never put API keys, admin tokens, or service-account values in this file.
- Keep this file import-safe from client components; it must remain pure constants only.

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-07-01 | Planned shared judge throughput policy constants. | Codex |
| 2026-07-01 | Added `DEFAULT_JUDGE_BATCH_MAX = 24` and `DEFAULT_JUDGE_CONCURRENCY = 6`. | Codex |
