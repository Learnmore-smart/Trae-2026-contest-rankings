import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isRankableDiscourseTopic,
  isSubmittedPreliminaryTopicPayload,
  nextScrapedTopicStatus,
  parseRetryAfterMs,
  parseTraeForumTopicUrl,
  sanitizeRawJsonForDataConnect,
  TraeForumUrlError
} from "../lib/trae/scraper.ts";

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

describe("parseTraeForumTopicUrl", () => {
  it("accepts canonical TRAE forum topic links and normalizes query strings away", () => {
    const ref = parseTraeForumTopicUrl("https://forum.trae.cn/t/demo-project/22552?u=noah#reply");

    assert.deepEqual(ref, {
      externalTopicId: "22552",
      slug: "demo-project",
      title: "Topic 22552",
      url: "https://forum.trae.cn/t/demo-project/22552"
    });
  });

  it("accepts short TRAE topic links without a category id in the URL", () => {
    const ref = parseTraeForumTopicUrl("https://forum.trae.cn/t/topic/66965");

    assert.deepEqual(ref, {
      externalTopicId: "66965",
      slug: "topic",
      title: "Topic 66965",
      url: "https://forum.trae.cn/t/topic/66965"
    });
  });

  it("rejects non-TRAE hosts, insecure schemes, and category URLs", () => {
    assert.throws(() => parseTraeForumTopicUrl("https://forum.trae.cn.evil.test/t/demo/22552"), TraeForumUrlError);
    assert.throws(() => parseTraeForumTopicUrl("http://forum.trae.cn/t/demo/22552"), TraeForumUrlError);
    assert.throws(() => parseTraeForumTopicUrl("https://forum.trae.cn/c/contest/1"), TraeForumUrlError);
  });
});

describe("isSubmittedPreliminaryTopicPayload", () => {
  it("accepts the visible preliminary category label from the forum page title", () => {
    assert.equal(
      isSubmittedPreliminaryTopicPayload("社会服务 - 「书在架上」图书馆实时排架核查系统 - TRAE AI 创造力大赛 / 【大赛初赛专区】 - TRAE 官方中文社区"),
      true
    );
    assert.equal(
      isSubmittedPreliminaryTopicPayload("社会服务 - 「书在架上」图书馆实时排架核查系统 - TRAE AI 创造力大赛 / 【大赛报名专区】 - TRAE 官方中文社区"),
      false
    );
  });

  it("accepts only category-named JSON fields, not user-controlled topic content", () => {
    assert.equal(isSubmittedPreliminaryTopicPayload({ category_name: "【大赛初赛专区】" }), true);
    assert.equal(isSubmittedPreliminaryTopicPayload({ cooked: "我写了【大赛初赛专区】这几个字" }), false);
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
