# lib/trae/judge-policy.ts

> Last updated: 2026-07-15 | Protection: STANDARD

## Purpose

Defines the built-in throughput defaults used when judge environment variables are absent.

## Important Notes / NEVER Change

- Keep this module dependency-free so configuration can import its constants safely.
- `DEFAULT_JUDGE_BATCH_MAX` must remain at least as large as `DEFAULT_JUDGE_CONCURRENCY`; otherwise the configured worker count cannot become effective.

## Agent Decisions / Thoughts

- 2026-07-15: The owner requested 1,600 simultaneous topic workers. Keep the batch cap at 4,000 so the default concurrency can be reached, while the shared LLM limiter and bounded retry policy protect individual provider lanes.

## Open Threads / Resume Context

- Update the default and its regression test together with the two-model fallback policy; local `.env` should match the 1,600 worker setting.
