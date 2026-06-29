# lib/trae/scraper.ts

> Last updated: 2026-06-29 | Protection: STANDARD

## Purpose

Scrapes public TRAE Discourse category and topic data for signup and preliminary sources.

## What It Does

- Attempts Discourse category and topic JSON first.
- Falls back to public HTML parsing when JSON is unavailable.
- Limits requests, backs off on 429/403/5xx, and writes incremental Firestore updates.
- Marks preliminary topics as `needs_judging` when content changes.

## Public API

| Name | Type | Description |
|------|------|-------------|
| `scrapeTraeSource` | function | Scrapes one source type and records a `trae_runs` document. |
| `scrapeAllTraeSources` | function | Runs signup then preliminary scraping. |

## Dependencies

- Internal: `config`, `firestore`, `extractors`, `types`.
- External: `cheerio`.

## Agent Decisions / Thoughts

- 2026-06-29 Codex: Use conservative request spacing and bounded pages/details per run to avoid aggressive crawling.

## Important Notes / NEVER Change

- Do not bypass auth, CAPTCHA, robots, or other access restrictions.
- Only public category/topic URLs may be fetched.

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-06-29 | Planned public Discourse scraper. | Codex |
