import { describe, expect, it } from "vitest";
import { confusionMatrix, rates, selfConsistency, thresholdSweep } from "../../src/agreement.ts";
import type { GradeOutcome, HumanLabel } from "../../src/promptfooResult.ts";

const pairs = (human: HumanLabel, outcomes: GradeOutcome[]) =>
  outcomes.map((outcome) => ({ human, outcome }));

describe("confusionMatrix", () => {
  it("人の判定と採点の結果の組を数える", () => {
    const matrix = confusionMatrix([
      ...pairs("pass", ["pass", "pass", "fail", "unknown"]),
      ...pairs("fail", ["fail", "pass", "error"]),
    ]);
    expect(matrix).toEqual({
      pass: { pass: 2, fail: 1, unknown: 1, error: 0 },
      fail: { pass: 1, fail: 1, unknown: 0, error: 1 },
    });
  });
});

describe("rates", () => {
  const matrix = confusionMatrix([
    ...pairs("pass", ["pass", "pass", "pass", "fail", "unknown"]),
    ...pairs("fail", ["fail", "fail", "pass", "error"]),
  ]);

  it("TPRは，人が合格とした試行のうち，採点器も合格とした割合である(unknownとerrorを除く)", () => {
    expect(rates(matrix).tpr).toBeCloseTo(3 / 4);
  });

  it("TNRは，人が不合格とした試行のうち，採点器も不合格とした割合である(unknownとerrorを除く)", () => {
    expect(rates(matrix).tnr).toBeCloseTo(2 / 3);
  });

  it("判定できた試行の数を，人の判定ごとに数える", () => {
    expect(rates(matrix)).toMatchObject({ positives: 4, negatives: 3 });
  });

  it("人が合格とした試行がなければ，TPRを求めない", () => {
    expect(rates(confusionMatrix(pairs("fail", ["fail"]))).tpr).toBeUndefined();
  });
});

describe("selfConsistency", () => {
  it("すべての試行で採点の結果がそろった項目の割合である", () => {
    expect(
      selfConsistency([
        ["pass", "pass", "pass"],
        ["pass", "fail", "pass"],
        ["fail", "fail", "fail"],
        ["unknown", "unknown", "unknown"],
      ]),
    ).toBeCloseTo(3 / 4);
  });

  it("項目がなければ0である", () => {
    expect(selfConsistency([])).toBe(0);
  });
});

describe("thresholdSweep", () => {
  const labeled = [
    { human: "pass" as const, probability: 0.9 },
    { human: "pass" as const, probability: 0.6 },
    { human: "fail" as const, probability: 0.55 },
    { human: "fail" as const, probability: 0.2 },
  ];

  it("しきい値ごとに，確率がしきい値以上を合格としたときのTPRとTNRを求める", () => {
    expect(thresholdSweep(labeled, [0.5, 0.58, 0.95])).toEqual([
      { threshold: 0.5, tpr: 1, tnr: 0.5 },
      { threshold: 0.58, tpr: 1, tnr: 1 },
      { threshold: 0.95, tpr: 0, tnr: 1 },
    ]);
  });
});
