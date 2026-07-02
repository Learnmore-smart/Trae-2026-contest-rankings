# app/api/trae-contest/submit/route.ts

> Last updated: 2026-07-02 | Protection: STANDARD

## Purpose

Provides a public, single-topic crawl endpoint for users whose TRAE preliminary post is not yet visible in the ranking.

## What It Does

- Accepts `POST` JSON with a `url` field.
- Rejects non-TRAE URLs; only `https://forum.trae.cn/t/.../<id>` topic links are accepted.
- Fetches that public Discourse topic through the existing scraper helpers as a preliminary topic.
- Upserts the topic into Data Connect and refreshes the public board snapshot best-effort.

## Public API

| Name | Type | Description |
|------|------|-------------|
| `POST /api/trae-contest/submit` | route | Crawls one user-submitted TRAE forum topic URL. |

## Dependencies

- Internal: `lib/trae/scraper` for URL validation, topic fetch, and topic upsert.
- Internal: `lib/trae/api` for best-effort board snapshot refresh.

## Agent Decisions / Thoughts

- 2026-07-02 Codex: Keep this endpoint narrower than the public full pipeline. It should crawl exactly one submitted topic and queue it for existing judging instead of running match/judge work inline.
- 2026-07-02 Codex: URL validation must be server-side and origin-strict to avoid opening an arbitrary URL fetch primitive.
- 2026-07-02 Codex: Implemented the route by parsing `body.url`, using `fetchTopic("preliminary", ref)`, writing with `upsertTopic(topic)`, and refreshing `writeBoardSnapshot()` best-effort.
- 2026-07-02 Codex: Owner clarified the public submit flow must only crawl preliminary posts, and the verdict is the published category text `大赛初赛专区`, not a numeric category id.
- 2026-07-02 Codex: Change the route to a background job with `GET` status so refreshing the page while a submitted URL is crawling still shows that crawler state and keeps polling.
- 2026-07-02 Codex: Implemented global `__traeTopicSubmit` status, `GET` status reads, `POST` start-only behavior, and background `runSubmittedTopic()` using `fetchTopic("preliminary", ref, { requirePreliminaryCategory: true })`.

## Important Notes / NEVER Change

- Do not accept arbitrary URLs, redirects, or lookalike hosts.
- Do not require an admin token unless the public UI is changed to explain that requirement.
- Do not expose raw scraped HTML or secrets in the response.

## Bug Fixes

| Date | Bug | Cause | Fix |
|------|-----|-------|-----|

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-07-02 | Planned public single-topic submit route. | Codex |
| 2026-07-02 | Implemented public single-topic submit route. | Codex |
| 2026-07-02 | Planned strict preliminary-only text validation and refresh-surviving submit status. | Codex |
| 2026-07-02 | Implemented refresh-surviving preliminary-only submit status. | Codex |
