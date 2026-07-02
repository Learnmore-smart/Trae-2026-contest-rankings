# lib/trae/scraper.ts

> Last updated: 2026-07-02 | Protection: STANDARD

## Purpose

Scrapes public TRAE Discourse category and topic data for signup and preliminary sources.

## What It Does

- Attempts Discourse category and topic JSON first.
- Falls back to public HTML parsing when JSON is unavailable.
- Throttles per host with a concurrency-safe start-slot allocator (configurable `forumMinRequestMs`) and writes incremental Data Connect updates. Safe for the matcher's parallel forum lookups.
- Handles rate limiting robustly: retries 429/403/5xx up to `forumMaxRetries`, honors the server's `Retry-After` header, and on 429/403/503 applies a **host-wide cooldown** so every concurrent worker backs off together (no 429 storm). Exhausted requests fail soft and are retried on the next scrape/match run (cron + resume cursor).
- Marks new preliminary topics as `needs_judging`; preserves already-judged topics' public judged status when scraped content changes so the live scored count does not drop before a rejudge can catch up.
- Skips Discourse category topics that are pinned/global-pinned/non-visible before fetching topic details, so guide posts do not enter the ranking pool.
- Stores raw Discourse topic payloads as bounded JSON strings so persistence receives stable, size-bounded raw snapshots.
- Captures the first-post author's Discourse `username` (distinct from display name) **in-memory** as `TraeTopic.authorUsername`; not persisted to Data Connect — used by `signup-finder`/`matcher` to key forum lookups by identity.
- Adds sample per-topic failure messages to scrape run logs.

## Public API

| Name | Type | Description |
|------|------|-------------|
| `scrapeTraeSource` | function | Scrapes one source type and records a `trae_runs` document. |
| `scrapeAllTraeSources` | function | Runs signup then preliminary scraping. |
| `sanitizeRawJsonForDataConnect` | function | Serializes raw Discourse payloads into bounded SQL/Data Connect-safe strings. |
| `isRankableDiscourseTopic` | function | Filters category topic refs before detail fetches. |
| `fetchTopic` | function | Fetches+builds one `TraeTopic` from a category ref (reused by the matcher's forum lookup). |
| `upsertTopic` | function | Upserts a topic via Data Connect (reused to cache forum-found signups). |
| `tryFetchJson` | function | Rate-limited, retrying Discourse JSON GET (reused by `signup-finder`). |
| `usernameFromAvatarUrl` | function | Pure: recover username from an uploaded-avatar URL. |
| `parseRetryAfterMs` | function | Pure: parse an HTTP `Retry-After` header (seconds or date) into ms. |

## Dependencies

- Internal: `config`, `dataconnect`, `extractors`, `runs`, `types`.
- Generated SDK: topic and scrape cursor queries/mutations.
- External: `cheerio`.

## Agent Decisions / Thoughts

- 2026-06-29 Codex: Use conservative request spacing and bounded pages/details per run to avoid aggressive crawling.
- 2026-06-29 Codex: Root cause for "start scoring does nothing": category scraping succeeds, but every topic write fails because Discourse topic `rawJson` contains Firestore-invalid nested entities. The scraper swallowed per-topic errors, so runs only showed `failedCount: 100`.
- 2026-06-29 Codex: Implemented raw JSON serialization and sample per-topic failure logging. Limited live scrapes verified `failedCount: 0`; the latest preliminary topic stores `rawJson` as a string snapshot.
- 2026-06-29 Codex: Browser QA revealed the first limited preliminary scrape collected a pinned contest guide post. Implemented parser-level filtering for pinned/global-pinned/non-visible Discourse topic refs so public guidance posts are not ranked or judged as projects.
- 2026-06-30 Codex: Scraping should write through Data Connect only; keep conservative network behavior and bounded raw snapshots.
- 2026-07-02 Codex: Owner reported the public scored count regressing from 147 to 125 and then net-negative throughput. Root cause is scraper status reset outpacing judge throughput. Preserve `JUDGED` on content updates to keep old scores live until an explicit rejudge replaces them.

## Planned Change: SQL Connect Runtime

- 2026-06-30 Codex: Rename the raw JSON sanitizer away from Firestore terminology, update tests, and replace the legacy helper import with `dataconnect.ts`.
- 2026-06-30 Codex: Live SQL scrape smoke test failed because `topicToVariables()` omitted required `contentText` and `excerpt` variables for `UpsertTopic`. Add the missing content fields and re-run a bounded scrape.
- Implemented: `topicToVariables()` now includes `contentText`, `contentHtml`, and `excerpt`; live signup and preliminary one-page scrapes both created 28 SQL rows with zero failures.

## Important Notes / NEVER Change

- Do not bypass auth, CAPTCHA, robots, or other access restrictions.
- Only public category/topic URLs may be fetched.
- Tests for raw JSON sanitization must not hit the network or Data Connect.

## Bug Fixes

| Date | Bug | Cause | Fix |
|------|-----|-------|-----|
| 2026-06-29 | Start scoring appeared to do nothing because no topics were written. | Firestore rejected nested `rawJson` entities from Discourse topic payloads. | Store `rawJson` as a bounded JSON string and log sample per-topic failures. |
| 2026-06-29 | Preliminary ranking could include pinned guide posts. | Category parser accepted every Discourse topic ref with an id. | Filter pinned/global-pinned/non-visible topic refs before detail fetches. |
| 2026-06-30 | SQL scrape wrote zero topics. | `UpsertTopic` variables omitted required `contentText` and `excerpt`. | Include `contentText`, `contentHtml`, and `excerpt` in `topicToVariables()`. |
| 2026-07-02 | Public scored count decreased during scraping. | Content updates reset already judged topics to `needs_judging` before new scores were ready. | Preserve `judged` status for already judged preliminary topics on scrape updates. |

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-06-29 | Planned public Discourse scraper. | Codex |
| 2026-06-29 | Planned Firestore rawJson serialization fix and better per-topic scrape diagnostics. | Codex |
| 2026-06-29 | Implemented Firestore-safe rawJson snapshots and scrape failure diagnostics. | Codex |
| 2026-06-29 | Implemented pinned-guide filtering for category topic refs. | Codex |
| 2026-06-30 | Planned Data Connect scraper runtime cleanup. | Codex |
| 2026-06-30 | Implemented Data Connect sanitizer rename and verified live SQL scrape writes. | Codex |
| 2026-06-30 | Capture `authorUsername` in-memory; export `fetchTopic`/`upsertTopic`/`tryFetchJson`/`usernameFromAvatarUrl` for the matcher's forum lookup. | Claude |
| 2026-06-30 | Replaced `waitForHost` with a concurrency-safe start-slot allocator (configurable `forumMinRequestMs`, default 150). | Claude |
| 2026-06-30 | Robust 429 handling: honor `Retry-After`, host-wide cooldown on 429/403/503, configurable `forumMaxRetries`. | Claude |
| 2026-07-02 | Planned preserving judged status across scrape content updates to stop net-negative scored-count movement. | Codex |
