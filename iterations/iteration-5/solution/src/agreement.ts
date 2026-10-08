import type { GradeOutcome, HumanLabel } from "./promptfooResult.ts";

// 人の判定(行)と採点の結果(列)の組の数．
export type ConfusionMatrix = Record<HumanLabel, Record<GradeOutcome, number>>;

export type LabeledOutcome = { human: HumanLabel; outcome: GradeOutcome };
export type LabeledProbability = { human: HumanLabel; probability: number };

// TPRとTNRは，判定できた(passかfailの)試行だけで求める．試行がなければundefined．
export type GraderRates = {
  tpr: number | undefined;
  tnr: number | undefined;
  positives: number;
  negatives: number;
};

export type ThresholdRates = { threshold: number; tpr: number; tnr: number };

const emptyRow = (): Record<GradeOutcome, number> => ({ pass: 0, fail: 0, unknown: 0, error: 0 });

export function confusionMatrix(pairs: LabeledOutcome[]): ConfusionMatrix {
  const matrix = { pass: emptyRow(), fail: emptyRow() };
  for (const { human, outcome } of pairs) {
    matrix[human][outcome] += 1;
  }
  return matrix;
}

export function rates(matrix: ConfusionMatrix): GraderRates {
  const positives = matrix.pass.pass + matrix.pass.fail;
  const negatives = matrix.fail.pass + matrix.fail.fail;
  return {
    tpr: positives === 0 ? undefined : matrix.pass.pass / positives,
    tnr: negatives === 0 ? undefined : matrix.fail.fail / negatives,
    positives,
    negatives,
  };
}

// 項目ごとの採点の結果の並びのうち，すべてがそろった項目の割合．
export function selfConsistency(items: GradeOutcome[][]): number {
  if (items.length === 0) {
    return 0;
  }
  const consistent = items.filter((outcomes) => outcomes.every((o) => o === outcomes[0]));
  return consistent.length / items.length;
}

// 確率がしきい値以上を合格としたときの，しきい値ごとのTPRとTNR．
export function thresholdSweep(
  pairs: LabeledProbability[],
  thresholds: number[],
): ThresholdRates[] {
  return thresholds.map((threshold) => {
    const outcomes = pairs.map(({ human, probability }) => ({
      human,
      outcome: probability >= threshold ? ("pass" as const) : ("fail" as const),
    }));
    const { tpr, tnr } = rates(confusionMatrix(outcomes));
    return { threshold, tpr: tpr ?? 0, tnr: tnr ?? 0 };
  });
}
