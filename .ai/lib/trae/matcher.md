# lib/trae/matcher.ts

> Last updated: 2026-07-12 | Protection: STANDARD

## Purpose

Matches preliminary Demo topics to their author's signup (报名) topic and estimates direction consistency.

## What It Does

- Cheap in-pool pass: scores each preliminary against signups already in the DB (`scoreTopicMatch`).
- When the in-pool pass has no confident same-author match, does a bounded, cached **forum lookup by username** (`signup-finder`) to fetch the author's 报名帖 directly out of ~20K posts — instead of relying on the slowly-scraped subset and title similarity.
- Confirms a forum candidate by Discourse username, caches it back to the DB (so it joins the in-pool path and shows in stats), and scores it with `scoreConfirmedAuthorMatch` — match **existence** no longer depends on title similarity.
- Runs forum lookups **concurrently** (`config.forumLookupConcurrency`) and **deduped per username** via an in-flight promise map, so duplicate authors never trigger duplicate calls. `maxForumLookupsPerRun` defaults to unlimited (one-pass convergence); set >0 to throttle. Forum throughput is governed by `forumMinRequestMs`.
- Accepts an optional `deadlineMs` parameter (default 0 = no deadline). When the deadline is exceeded, remaining topics are skipped (no forum lookup, no DB write) and the run finishes with `status: "partial"`. Skipped topics are picked up by the next run. This prevents the match phase from running past Cloud Run's 900s request timeout and killing the entire pipeline (the root cause of the 2026-07-12 "开始评分" bug).
- Writes SQL `matches` rows through Data Connect with confidence and mismatch risk.

## Public API

| Name | Type | Description |
|------|------|-------------|
| `scoreTopicMatch` | function | Pure fuzzy scorer for one preliminary/signup pair (author + title/content). |
| `scoreConfirmedAuthorMatch` | function | Pure scorer for an identity-confirmed pair; confidence from identity, direction from title/content only. |
| `runTraeMatching` | function | Data Connect-backed matching run with bounded forum username lookups. Accepts optional `deadlineMs` (0 = no deadline). Returns `{ matchedCount, failedCount, forumMatchedCount, forumLookups, skippedCount }`. |

## Dependencies

- Internal: `config`, `dataconnect`, `scraper` (`fetchTopic`/`upsertTopic`), `signup-finder`, `runs`, `types`.
- Generated SDK: `getTopicsBySourceType`, `upsertMatch`.

## Agent Decisions / Thoughts

- 2026-06-29 Codex: Keep first version rules-based to avoid O(N*M) LLM calls; only future candidate-pair LLM checks should be added if needed.
- 2026-06-30 Codex: Matching should only read/write Data Connect and should not depend on Firestore collections.
- 2026-06-30 Claude: Root cause of "未检测到官方报名帖匹配信息" on nearly every entry — matching only ever compared against the scraped signup subset, which is a sliver of ~20K posts, and over-weighted title similarity (报名帖 and Demo titles legitimately differ). Fix: search the forum by the **author's username** (`@username category:<id> in:first`, with a `/u/<username>/activity/topics.json` fallback), confirm identity in-memory, and make confirmed-author matches authoritative regardless of title. Migration-free: no new persisted column (username carried in-memory only); found signups cached as normal rows so runs converge.

## Planned Change: SQL Connect Runtime

- 2026-06-30 Codex: Replace legacy Firestore helper import with `dataconnect.ts`; keep the pure `scoreTopicMatch` tests as regression coverage.
- Implemented: matcher imports `dataconnect.ts` and lint warnings were cleaned up.

## Important Notes / NEVER Change

- A missing match should not directly punish score; it is surfaced as uncertainty.

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-06-29 | Planned matching module. | Codex |
| 2026-06-30 | Planned Data Connect matcher runtime cleanup. | Codex |
| 2026-06-30 | Implemented Data Connect matcher import cleanup; live matcher run was blocked by escalation usage limits. | Codex |
| 2026-06-30 | Implemented forum username lookup + `scoreConfirmedAuthorMatch`; match no longer depends on title similarity or the pre-scraped signup subset. | Claude |
| 2026-06-30 | Made lookups concurrent + deduped per username; default unlimited per run for fastest convergence. | Claude |
| 2026-07-12 | Added `deadlineMs` parameter and `skippedCount` return field. When the deadline is exceeded, remaining topics are skipped instead of processed, preventing the match phase from killing the Cloud Run request. | GLM |
