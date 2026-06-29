# lib/trae/extractors.ts

> Last updated: 2026-06-29 | Protection: STANDARD

## Purpose

Extracts normalized text, links, images, attachments, Demo URLs, Session IDs, track hints, and TRAE evidence from forum content.

## What It Does

- Converts topic HTML to safe text for judging and display excerpts.
- Finds candidate Demo links without executing or fetching them.
- Identifies material-risk signals such as missing screenshots or Session IDs.

## Public API

| Name | Type | Description |
|------|------|-------------|
| `extractTopicSignals` | function | Returns extracted links, images, demo URL, session IDs, evidence, and track. |
| `contentHash` | function | Stable hash for incremental judging. |

## Dependencies

- External: `cheerio` for HTML parsing.
- Built-in: `crypto` for hashing.

## Agent Decisions / Thoughts

- 2026-06-29 Codex: Keep extraction deterministic and tested so scraper and judge prompts get stable inputs.

## Important Notes / NEVER Change

- Do not sanitize by rendering raw HTML to clients; raw HTML is storage-only.

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-06-29 | Planned extraction helpers. | Codex |
