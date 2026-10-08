import type { AssertionValueFunctionContext } from "promptfoo";
import { describe, expect, it } from "vitest";
import decisionAssertion, { gradeWithDecisionModel } from "../../src/decisionAssertion.ts";
import type { DecisionModel } from "../../src/decisionModel.ts";

const instructions = "返信は，問い合わせに答えているか．";

const context = (config: Record<string, unknown>, trial = 0): AssertionValueFunctionContext => ({
  prompt: undefined,
  vars: { inquiry: "本が届きません" },
  test: {},
  logProbs: undefined,
  config,
  provider: undefined,
  providerResponse: { metadata: { trial } },
  metadata: { trial },
});

// 決めた確率を返し，受け取った状態を記録する意思決定モデル．
function fixedModel(probability: number): DecisionModel & { states: string[] } {
  const states: string[] = [];
  return {
    states,
    async noul(state) {
      states.push(state);
      return probability;
    },
  };
}

describe("gradeWithDecisionModel", () => {
  it("確率がしきい値以上なら合格にし，確率をスコアとメタデータに残す", async () => {
    expect(await gradeWithDecisionModel(fixedModel(0.8), instructions, "state", 0.5)).toEqual({
      pass: true,
      score: 0.8,
      reason: "probability 0.80 >= threshold 0.50",
      metadata: { outcome: "pass", probability: 0.8 },
    });
  });

  it("確率がしきい値より小さければ不合格にする", async () => {
    expect(await gradeWithDecisionModel(fixedModel(0.3), instructions, "state", 0.5)).toMatchObject(
      {
        pass: false,
        score: 0.3,
        metadata: { outcome: "fail", probability: 0.3 },
      },
    );
  });

  it("意思決定モデルの呼び出しが失敗したら，errorの採点結果にする", async () => {
    const failing: DecisionModel = {
      async noul() {
        throw new Error("model not found");
      },
    };
    expect(await gradeWithDecisionModel(failing, instructions, "state", 0.5)).toMatchObject({
      pass: false,
      score: 0,
      metadata: { outcome: "error" },
    });
  });
});

describe("decisionAssertion", () => {
  it("設定model.llm: fakeでは，偽の意思決定モデルで判定する", async () => {
    const config = { instructions, model: { llm: "fake" } };
    expect(await decisionAssertion("3営業日以内に発送いたします．", context(config))).toMatchObject(
      {
        pass: true,
        metadata: { outcome: "pass" },
      },
    );
    expect(await decisionAssertion("セールを実施中です．", context(config))).toMatchObject({
      pass: false,
      metadata: { outcome: "fail" },
    });
  });

  it("しきい値を設定で変えられる", async () => {
    const config = { instructions, threshold: 0.95, model: { llm: "fake" } };
    expect(await decisionAssertion("3営業日以内に発送いたします．", context(config))).toMatchObject(
      {
        pass: false,
      },
    );
  });

  it("Ollamaに接続できなければ，errorの採点結果にする", async () => {
    const config = { instructions, model: { llm: "ollama", host: "http://127.0.0.1:9" } };
    expect(await decisionAssertion("返信", context(config))).toMatchObject({
      pass: false,
      metadata: { outcome: "error" },
    });
  });
});
