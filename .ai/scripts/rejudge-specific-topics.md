# scripts/rejudge-specific-topics.ts

> Last updated: 2026-07-03 | Protection: STANDARD

## Purpose

One-off script for rejudging selected topic IDs and syncing their new evaluations into Data Connect and the local topic cache.

## What It Does

- Loads target topics from Data Connect.
- Runs `judgeOneTopic()`.
- Upserts the resulting evaluation and denormalized topic scoring fields.
- Optionally updates `lib/trae/topics-cache.json`.

## Dependencies

- Internal: `lib/trae/judge.ts`, `lib/trae/dataconnect.ts`.
- Generated SDK: `getTopicDetail`, `upsertEvaluation`, `updateTopicEvaluationState`.

## Agent Decisions / Thoughts

- 2026-07-03 Codex: Planned removal of REMOVED_PROVIDER provider mapping. New rejudges should only persist Friend/NVIDIA results as `NVIDIA`.

## Important Notes / NEVER Change

- Do not add paid model provider calls; use `judgeOneTopic()` so the shared zero-budget fallback path remains enforced.

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-07-03 | Created doc before removing REMOVED_PROVIDER provider mapping. | Codex |


