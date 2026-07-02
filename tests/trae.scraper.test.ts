import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isRankableDiscourseTopic, nextScrapedTopicStatus, parseRetryAfterMs, sanitizeRawJsonForDataConnect } from "../lib/trae/scraper.ts";

describe("sanitizeRawJsonForDataConnect", () => {
  it("stores raw Discourse payloads as bounded JSON strings instead of nested persistence entities", () => {
    const payload = {
      post_stream: {
        posts: [
          {
            cooked: "<p>Demo</p>",
            actions_summary: [["nested", "array"]]
          }
        ]
      }
    };

    const sanitized = sanitizeRawJsonForDataConnect(payload);

    assert.equal(typeof sanitized, "string");
    assert.ok(sanitized);
    assert.ok(sanitized.includes("\"post_stream\""));
    assert.ok(sanitized.length < 100_000);
  });

  it("returns null for unserializable payloads", () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;

    assert.equal(sanitizeRawJsonForDataConnect(circular), null);
  });
});

describe("parseRetryAfterMs", () => {
  it("reads delta-seconds and converts to milliseconds", () => {
    assert.equal(parseRetryAfterMs("30"), 30_000);
    assert.equal(parseRetryAfterMs(" 0 "), 0);
  });

  it("reads an HTTP-date as a future delta (and never negative)", () => {
    const future = new Date(Date.now() + 45_000).toUTCString();
    const ms = parseRetryAfterMs(future);
    assert.ok(ms !== null && ms > 30_000 && ms <= 46_000, `expected ~45s, got ${ms}`);
    // A past date clamps to 0 rather than going negative.
    assert.equal(parseRetryAfterMs(new Date(Date.now() - 60_000).toUTCString()), 0);
  });

  it("returns null for missing or unparseable values", () => {
    assert.equal(parseRetryAfterMs(null), null);
    assert.equal(parseRetryAfterMs(undefined), null);
    assert.equal(parseRetryAfterMs("soon"), null);
  });
});

describe("isRankableDiscourseTopic", () => {
  it("excludes pinned guide topics before fetching topic details", () => {
    assert.equal(isRankableDiscourseTopic({ id: 22549, title: "初赛参赛指南", pinned: true }), false);
    assert.equal(isRankableDiscourseTopic({ id: 22550, title: "Global announcement", pinned_globally: true }), false);
    assert.equal(isRankableDiscourseTopic({ id: 22551, title: "Hidden draft", visible: false }), false);
    assert.equal(isRankableDiscourseTopic({ id: 22552, title: "Actual demo project", pinned: false, visible: true }), true);
  });
});

describe("nextScrapedTopicStatus", () => {
  it("preserves judged preliminary rows on content update so public scored progress does not drop", () => {
    assert.equal(nextScrapedTopicStatus("preliminary", "JUDGED"), "judged");
    assert.equal(nextScrapedTopicStatus("preliminary", "judged"), "judged");
  });

  it("keeps unjudged or failed preliminary rows in the judge queue after content update", () => {
    assert.equal(nextScrapedTopicStatus("preliminary", "NEEDS_JUDGING"), "needs_judging");
    assert.equal(nextScrapedTopicStatus("preliminary", "JUDGE_ERROR"), "needs_judging");
  });

  it("keeps signup scrape updates out of the judge queue", () => {
    assert.equal(nextScrapedTopicStatus("signup", "SCRAPED"), "scraped");
  });
});
