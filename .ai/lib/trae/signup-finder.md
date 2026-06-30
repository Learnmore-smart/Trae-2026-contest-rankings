# lib/trae/signup-finder.ts

> Last updated: 2026-06-30 | Protection: STANDARD

## Purpose

Finds a contestant's signup (报名) topic by **author username** via the public forum, so matching can locate one post out of ~20K without pre-scraping them all.

## What It Does

- Queries Discourse `/search.json?q=@<username> category:<id> in:first` scoped to the signup category, then parses the author's first-post topics.
- Falls back to `/u/<username>/activity/topics.json` (the user's created topics) filtered to the signup category when search returns nothing.
- Resolves a preliminary author's username with zero network where possible: in-memory `authorUsername` → avatar URL → the topic's own JSON (last resort).
- All read-only HTTP against public URLs; nothing new is persisted. Returns `[]` on any failure so the matcher's in-DB fallback still applies.

## Public API

| Name | Type | Description |
|------|------|-------------|
| `findSignupRefsByUsername` | function | Network: candidate signup topic refs for a username (search → activity fallback). |
| `resolveAuthorUsername` | function | Resolves a preliminary topic's Discourse username (in-memory → avatar → JSON). |
| `parseSearchSignupRefs` | function | Pure: filter `/search.json` payload to the author's first-post topics in a category. |
| `parseUserTopicsSignupRefs` | function | Pure: filter a user-activity payload to a category. |
| `categoryIdFromUrl` | function | Pure: trailing numeric id of a Discourse category URL. |
| `normalizeUsername` | function | Pure: trim/lowercase username key for identity comparison. |

## Dependencies

- Internal: `config`, `scraper` (`tryFetchJson`, `usernameFromAvatarUrl`, `CategoryTopicRef`), `types`.

## Agent Decisions / Thoughts

- 2026-06-30 Claude: Discourse's `@` filter keys on **username**, not display name, so the scraper now carries `authorUsername` in-memory and this module keys all lookups off it. Both forum paths are author-authoritative by construction; the matcher re-confirms by username when the fetched post still has one.
- 2026-06-30 Claude: Search primary + activity fallback covers cases where the search index lags or the category filter is restricted.

## Important Notes / NEVER Change

- Do not bypass auth, CAPTCHA, robots, or other access restrictions; only public search/topic/user URLs.
- Pure parse helpers must not hit the network (kept separate from the fetch wrappers for testability).

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-06-30 | Created forum username-based signup finder to fix unmatched 报名帖. | Claude |
