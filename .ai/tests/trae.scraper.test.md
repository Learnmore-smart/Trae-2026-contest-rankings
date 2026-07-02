# tests/trae.scraper.test.ts

> Last updated: 2026-07-02 | Protection: STANDARD

## Purpose

Regression coverage for TRAE scraper normalization behavior.

## What It Does

- Verifies raw Discourse JSON is converted to a Data Connect-safe snapshot before storage.
- Protects against nested raw JSON structures breaking topic writes.
- Verifies oversized snapshots are bounded and circular payloads become `null`.
- Verifies pinned/global-pinned/non-visible Discourse category topics are excluded before detail fetches.
- Verifies scrape updates preserve already-judged preliminary status instead of dropping public scored progress.
- Verifies user-submitted crawl URLs only accept `https://forum.trae.cn/t/.../<id>` topic links.
- Verifies submitted topic validation only accepts forum category text containing `大赛初赛专区`.

## Public API

| Name | Type | Description |
|------|------|-------------|
| scraper tests | node:test suite | Exercises exported scraper helpers. |

## Dependencies

- Internal: `lib/trae/scraper.ts`.
- External: Node `node:test` and `node:assert/strict`.

## Agent Decisions / Thoughts

- 2026-06-29 Codex: Add test first for the rawJson persistence failure. The production fix should expose a small helper that turns raw JSON into a bounded string or null so storage never sees unstable nested entities under `rawJson`.
- 2026-06-30 Codex: Rename the helper/test from Firestore-specific wording to Data Connect wording without changing serializer behavior.
- 2026-06-29 Codex: Implemented tests for nested payload serialization, size bounding, circular-payload fallback to null, and pinned guide filtering.
- 2026-07-02 Codex: Add a regression test for the net-negative scored-count bug: a changed scrape of an already judged preliminary row must keep `judged`; unjudged/error rows can still go back through `needs_judging`.
- 2026-07-02 Codex: Add parser regression coverage for the public "crawl my post" flow. Keep it pure and network-free by testing `parseTraeForumTopicUrl()` directly.
- 2026-07-02 Codex: Add a pure category guard test for submitted topics. It must be text-based because user-visible forum URLs may not expose numeric category ids.
- 2026-07-02 Codex: Implemented category-text tests that accept a forum title containing `TRAE AI 创造力大赛 / 【大赛初赛专区】` and reject报名专区; also reject user-controlled `cooked` content containing the same words.

 - 2026-07-02 Codex: Add parser coverage for short Discourse topic URLs like `https://forum.trae.cn/t/topic/66965`; the preliminary verdict still comes from category text, not URL/category ids.
 - 2026-07-02 Codex: Add a regression test for the real forum crawler HTML shape where the title is `project - 【大赛初赛专区】 - TRAE 官方中文社区` and the category also appears in `og:article:section` / `.category-name`; this previously failed because the matcher required a slash before the category.

## Important Notes / NEVER Change

- Tests should not hit the network or Data Connect.

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-06-29 | Planned scraper rawJson serialization regression test. | Codex |
| 2026-06-29 | Implemented scraper rawJson serialization regression tests. | Codex |
| 2026-06-29 | Implemented pinned/global-pinned category topic filtering regression test. | Codex |
| 2026-06-30 | Planned Data Connect sanitizer naming update. | Codex |
| 2026-07-02 | Planned scrape-status preservation regression coverage. | Codex |
| 2026-07-02 | Implemented scrape-status preservation regression coverage. | Codex |
| 2026-07-02 | Implemented user-submitted TRAE topic URL parser coverage. | Codex |
| 2026-07-02 | Planned user-submitted preliminary-category text validation coverage. | Codex |
| 2026-07-02 | Implemented user-submitted preliminary-category text validation coverage. | Codex |
| 2026-07-02 | Planned short TRAE topic URL parser coverage for user-submitted crawls. | Codex |
| 2026-07-02 | Planned real crawler HTML category-title regression coverage. | Codex |
| 2026-07-02 | Implemented real crawler HTML category-title regression coverage. | Codex |
