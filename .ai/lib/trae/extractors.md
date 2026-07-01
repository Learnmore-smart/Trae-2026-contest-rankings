# lib/trae/extractors.ts

> Last updated: 2026-06-29 | Protection: STANDARD

## Purpose

Extracts normalized text, links, images, attachments, Demo URLs, Session IDs, track hints, and TRAE evidence from forum content.

## What It Does

- Converts topic HTML to safe text for judging and display excerpts.
- Finds candidate Demo links without executing or fetching them, retaining all detected Demo-like URLs in evidence metadata while preserving one canonical `demoUrl`.
- Identifies material-risk signals such as missing screenshots or Session IDs.

## Public API

| Name | Type | Description |
|------|------|-------------|
| `extractTopicSignals` | function | Returns extracted links, images, demo URLs, session IDs, evidence, and track. |
| `contentHash` | function | Stable hash for incremental judging. |

## Dependencies

- External: `cheerio` for HTML parsing.
- Built-in: `crypto` for hashing.

## Agent Decisions / Thoughts

- 2026-06-29 Codex: Keep extraction deterministic and tested so scraper and judge prompts get stable inputs.
- 2026-07-01 Codex: Reported bug shows Trae CN posts use full conversation IDs shaped like `.415...:<hex>_<hex>.<hex>.<hex>:Trae CN.T(...)`. These are valid material evidence even though they are not UUIDs or `session-*` IDs. The extractor should count them once each, preserve stable order, and avoid broad URL/hash false positives by requiring the underscore plus at least two dot-separated tail segments.
- 2026-07-01 Codex: Track all Demo-like URL candidates in `traeEvidence` while keeping `demoUrl` as the canonical first URL for existing schema/UI. This lets judge prompts say Demo links exist even when screenshot/vision automation fails.
- 2026-07-01 Codex: Expand Demo evidence beyond web URLs. App/desktop/mobile submissions can provide downloadable artifacts (`zip`, `apk`, `ipa`, `exe`, `dmg`, etc.); WeChat mini-program submissions can provide QR/scan images. Extractors should record these as Demo evidence rather than letting the judge say "missing Demo".
- 2026-07-01 Codex: Image extraction must include Discourse lightbox/original image sources, not only `img src`/`data-src`, because visible forum images may be stored as linked uploads or lazy-loaded attributes.

## Important Notes / NEVER Change

- Do not sanitize by rendering raw HTML to clients; raw HTML is storage-only.

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-06-29 | Planned extraction helpers. | Codex |
| 2026-07-01 | Planned long Trae Session ID recognition and Demo-candidate evidence metadata. | Codex |
| 2026-07-01 | Implemented long Trae conversation ID extraction and Demo-like URL evidence metadata. | Codex |
| 2026-07-01 | Planned multi-shape Demo evidence and Discourse image-source extraction. | Codex |
| 2026-07-01 | Implemented multi-shape Demo evidence (`web_url`, `download`, `qr_or_image`) and Discourse lightbox/lazy/srcset image extraction. | Codex |
