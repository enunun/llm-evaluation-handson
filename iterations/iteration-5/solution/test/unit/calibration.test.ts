import { describe, expect, it } from "vitest";
import {
  calibrate,
  correctedEstimate,
  correctPassRate,
  parseCalibrationFile,
  serializeCalibration,
} from "../../src/calibration.ts";
import type { EvalResult, GradeOutcome, HumanLabel, Trial } from "../../src/promptfooResult.ts";
import { seededRandom } from "../../src/random.ts";

const polite = "judge:polite (QC01-4)";
const answers = "decision:answers (QC01-1)";

const trials = (
  taskId: string,
  grader: string,
  outcomes: GradeOutcome[],
  probability?: number,
): Trial[] =>
  outcomes.map((outcome, index) => ({
    taskId,
    trial: index + 1,
    grader,
    output: "",
    outcome,
    reason: "",
    ...(probability === undefined ? {} : { probability }),
  }));

const label = (taskId: string, split: string, human: Record<string, HumanLabel>) => ({
  taskId,
  split,
  human,
});

const result: EvalResult = {
  suite: "labels",
  provider: "labels",
  metadata: {},
  trials: [
    ...trials("label-01", polite, ["pass", "pass"]),
    ...trials("label-02", polite, ["pass", "fail"]),
    ...trials("label-03", polite, ["fail", "fail"]),
    ...trials("label-04", polite, ["pass", "unknown"]),
    ...trials("label-01", answers, ["pass", "pass"], 0.9),
    ...trials("label-02", answers, ["fail", "fail"], 0.3),
    ...trials("label-03", answers, ["pass", "pass"], 0.7),
    ...trials("label-04", answers, ["fail", "fail"], 0.4),
  ],
  labels: [
    label("label-01", "dev", { [polite]: "pass", [answers]: "pass" }),
    label("label-02", "dev", { [polite]: "pass", [answers]: "fail" }),
    label("label-03", "test", { [polite]: "fail", [answers]: "fail" }),
    label("label-04", "test", { [polite]: "fail", [answers]: "fail" }),
  ],
  graderSettings: {},
};

describe("calibrate", () => {
  it("人の判定がある採点器ごとに，混同行列とTPR，TNRを求める", () => {
    const calibration = calibrate(result, {});
    const judge = calibration.graders.find((g) => g.grader === polite);
    expect(judge?.items).toBe(4);
    expect(judge?.matrix.pass).toEqual({ pass: 3, fail: 1, unknown: 0, error: 0 });
    expect(judge?.matrix.fail).toEqual({ pass: 1, fail: 2, unknown: 1, error: 0 });
    expect(judge?.rates).toMatchObject({ tpr: 0.75, tnr: 2 / 3 });
  });

  it("項目ごとの自己一貫性を求める", () => {
    const judge = calibrate(result, {}).graders.find((g) => g.grader === polite);
    expect(judge?.selfConsistency).toBeCloseTo(2 / 4);
  });

  it("TPRとTNRがどちらも0.8以上なら使える(usable)とする", () => {
    const calibration = calibrate(result, {});
    expect(calibration.graders.map((g) => [g.grader, g.usable])).toEqual([
      [polite, false],
      [answers, false],
    ]);
  });

  it("分割を指定すると，その分割の項目だけで検証する", () => {
    const calibration = calibrate(result, { split: "test" });
    expect(calibration.split).toBe("test");
    expect(calibration.graders.find((g) => g.grader === answers)).toMatchObject({
      items: 2,
      rates: { tpr: undefined, tnr: 0.5 },
    });
  });

  it("確率を残した採点器には，しきい値ごとのTPRとTNRを求める", () => {
    const decision = calibrate(result, {}).graders.find((g) => g.grader === answers);
    expect(decision?.sweep?.find((row) => row.threshold === 0.8)).toEqual({
      threshold: 0.8,
      tpr: 1,
      tnr: 1,
    });
    expect(calibrate(result, {}).graders.find((g) => g.grader === polite)?.sweep).toBeUndefined();
  });
});

describe("correctPassRate", () => {
  it("観測した合格率を，Rogan-Gladen法で補正する", () => {
    expect(correctPassRate(0.8, { tpr: 0.92, tnr: 0.88 })).toBeCloseTo(0.85);
  });

  it("補正した値を0から1の範囲に収める", () => {
    expect(correctPassRate(0.99, { tpr: 0.9, tnr: 0.9 })).toBe(1);
    expect(correctPassRate(0.05, { tpr: 0.9, tnr: 0.9 })).toBe(0);
  });

  it("TPR + TNRが1以下なら補正できない", () => {
    expect(correctPassRate(0.5, { tpr: 0.5, tnr: 0.5 })).toBeUndefined();
  });
});

describe("correctedEstimate", () => {
  const rates = { tpr: 0.9, tnr: 0.85, positives: 50, negatives: 40 };

  it("タスクごとの合格率の平均を補正した値と，ブートストラップによる区間を返す", () => {
    const estimate = correctedEstimate([0.8, 0.9, 1, 0.7], rates, {
      resamples: 1000,
      confidence: 0.95,
      random: seededRandom(1),
    });
    expect(estimate?.corrected).toBeCloseTo((0.85 + 0.85 - 1) / (0.9 + 0.85 - 1));
    expect(estimate?.interval.lower).toBeLessThan(estimate?.corrected ?? 0);
    expect(estimate?.interval.upper).toBeGreaterThan(estimate?.corrected ?? 1);
  });

  it("同じ乱数のシードなら同じ区間を返す", () => {
    const options = () => ({ resamples: 200, confidence: 0.95, random: seededRandom(7) });
    expect(correctedEstimate([0.8, 0.9], rates, options())).toEqual(
      correctedEstimate([0.8, 0.9], rates, options()),
    );
  });

  it("TPRかTNRが求まっていなければ補正しない", () => {
    const options = { resamples: 10, confidence: 0.95, random: seededRandom(1) };
    expect(correctedEstimate([0.8], { ...rates, tpr: undefined }, options)).toBeUndefined();
  });
});

describe("検証結果のファイル", () => {
  it("採点器ごとのTPR，TNR，判定できた試行の数を保存し，読み戻せる", () => {
    const calibration = calibrate(result, { split: "dev" });
    const file = parseCalibrationFile(serializeCalibration(calibration));
    expect(file.split).toBe("dev");
    expect(file.graders[polite]).toEqual(
      calibration.graders.find((g) => g.grader === polite)?.rates,
    );
  });

  it("検証結果の形でなければエラーにする", () => {
    expect(() => parseCalibrationFile("{}")).toThrow("not a calibration file");
  });
});
