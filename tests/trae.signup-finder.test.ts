import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  categoryIdFromUrl,
  normalizeUsername,
  parseSearchSignupRefs,
  parseUserTopicsSignupRefs
} from "../lib/trae/signup-finder.ts";
import { usernameFromAvatarUrl } from "../lib/trae/scraper.ts";

const ORIGIN = "https://forum.trae.cn";

describe("categoryIdFromUrl", () => {
  it("extracts the trailing numeric id of a Discourse category URL", () => {
    assert.equal(categoryIdFromUrl("https://forum.trae.cn/c/38-category/39-category/39"), "39");
  });

  it("returns null when there is no numeric segment", () => {
    assert.equal(categoryIdFromUrl("https://forum.trae.cn/c/signup"), null);
    assert.equal(categoryIdFromUrl("not a url"), null);
  });
});

describe("usernameFromAvatarUrl", () => {
  it("recovers the username from an uploaded-avatar URL", () => {
    assert.equal(
      usernameFromAvatarUrl("https://forum.trae.cn/user_avatar/forum.trae.cn/noah_zh/120/4567_2.png"),
      "noah_zh"
    );
  });

  it("returns null for letter-avatar proxies and empty input", () => {
    assert.equal(usernameFromAvatarUrl("https://forum.trae.cn/letter_avatar_proxy/v4/letter/n/ed8c4f/120.png"), null);
    assert.equal(usernameFromAvatarUrl(null), null);
  });
});

describe("parseSearchSignupRefs", () => {
  const payload = {
    posts: [
      { topic_id: 101, post_number: 1, username: "noah_zh" }, // the 报名帖 OP — keep
      { topic_id: 102, post_number: 4, username: "noah_zh" }, // a reply — drop (not first post)
      { topic_id: 103, post_number: 1, username: "someone_else" }, // another user — drop
      { topic_id: 999, post_number: 1, username: "noah_zh" } // no matching topic entry — drop
    ],
    topics: [
      { id: 101, slug: "ai-helper", title: "AI 学习助手 报名", category_id: 39 },
      { id: 102, slug: "reply-thread", title: "闲聊", category_id: 39 },
      { id: 103, slug: "other", title: "别人的报名", category_id: 39 },
      { id: 200, slug: "wrong-cat", title: "不在报名区", category_id: 40 }
    ]
  };

  it("keeps only the target author's first-post topics in the signup category", () => {
    const refs = parseSearchSignupRefs(payload, 39, ORIGIN, "noah_zh");
    assert.equal(refs.length, 1);
    assert.equal(refs[0].externalTopicId, "101");
    assert.equal(refs[0].url, "https://forum.trae.cn/t/ai-helper/101");
  });

  it("matches usernames case-insensitively", () => {
    const refs = parseSearchSignupRefs(payload, 39, ORIGIN, "Noah_ZH");
    assert.equal(refs.length, 1);
    assert.equal(refs[0].externalTopicId, "101");
  });

  it("excludes topics outside the target category", () => {
    const off = {
      posts: [{ topic_id: 200, post_number: 1, username: "noah_zh" }],
      topics: [{ id: 200, slug: "wrong-cat", title: "不在报名区", category_id: 40 }]
    };
    assert.deepEqual(parseSearchSignupRefs(off, 39, ORIGIN, "noah_zh"), []);
  });
});

describe("parseUserTopicsSignupRefs", () => {
  it("returns only signup-category topics from a user's activity feed", () => {
    const payload = {
      topic_list: {
        topics: [
          { id: 101, slug: "ai-helper", title: "AI 学习助手 报名", category_id: 39 },
          { id: 201, slug: "demo", title: "初赛 Demo", category_id: 40 }
        ]
      }
    };
    const refs = parseUserTopicsSignupRefs(payload, 39, ORIGIN);
    assert.equal(refs.length, 1);
    assert.equal(refs[0].externalTopicId, "101");
  });
});

describe("normalizeUsername", () => {
  it("trims and lowercases, tolerating null", () => {
    assert.equal(normalizeUsername("  Noah_ZH "), "noah_zh");
    assert.equal(normalizeUsername(null), "");
  });
});
