import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseEvaluationJson } from "../lib/trae/judge.ts";

const validPayload = {
  totalScore: 82,
  innovationScore: 25,
  practicalityScore: 24,
  completionScore: 17,
  designScore: 16,
  complianceRiskScore: 2,
  directionConsistencyScore: 8,
  confidenceScore: 76,
  competitionLevel: "有竞争力",
  summary: "Demo 完整，方向清晰，但材料仍可补强。",
  strengths: ["有明确用户场景"],
  weaknesses: ["Demo 链接说明不足"],
  suggestions: ["补充更多开发过程截图"],
  complianceRisks: ["缺少 3 个 Session ID"],
  dimensionComments: {
    innovation: "有一定创新",
    practicality: "场景明确",
    completion: "可体验",
    design: "体验完整"
  },
  matchComment: "与报名方向基本一致"
};

describe("parseEvaluationJson", () => {
  it("parses fenced strict JSON into a validated evaluation object", () => {
    const parsed = parseEvaluationJson(`\`\`\`json\n${JSON.stringify(validPayload)}\n\`\`\``);
    assert.equal(parsed.totalScore, 82);
    assert.equal(parsed.competitionLevel, "有竞争力");
  });

  it("rejects invalid score ranges", () => {
    assert.throws(() =>
      parseEvaluationJson(
        JSON.stringify({
          ...validPayload,
          innovationScore: 31
        })
      )
    );
  });
});
