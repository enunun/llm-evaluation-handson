import { z } from "zod";
import {
  confusionMatrix,
  rates,
  selfConsistency,
  thresholdSweep,
  type ConfusionMatrix,
  type GraderRates,
  type ThresholdRates,
} from "./agreement.ts";
import type { EvalResult, TaskLabel, Trial } from "./promptfooResult.ts";
import type { Random } from "./random.ts";
import { bootstrapInterval, type Interval } from "./stats.ts";

// 採点器を使ってよいとする基準．
export const criteria = { tpr: 0.8, tnr: 0.8 };

const thresholds = Array.from({ length: 9 }, (_, i) => (i + 1) / 10);

export type GraderCalibration = {
  grader: string;
  items: number;
  matrix: ConfusionMatrix;
  rates: GraderRates;
  selfConsistency: number;
  usable: boolean;
  // 確率を残した採点器だけが持つ，しきい値ごとのTPRとTNR．
  sweep?: ThresholdRates[];
};

export type CalibrationResult = {
  split: string | undefined;
  graders: GraderCalibration[];
};

// 人手ラベルのスイートの評価結果から，人の判定を持つ採点器ごとに，人の判定と採点の結果を比べる．
export function calibrate(result: EvalResult, options: { split?: string }): CalibrationResult {
  const labels = result.labels.filter(
    (label) => options.split === undefined || label.split === options.split,
  );
  const graders = [...new Set(labels.flatMap((label) => Object.keys(label.human)))];
  return {
    split: options.split,
    graders: graders.map((grader) => calibrateGrader(grader, labels, result.trials)),
  };
}

function calibrateGrader(grader: string, labels: TaskLabel[], trials: Trial[]): GraderCalibration {
  // 人の判定を持つ項目ごとの，この採点器の試行．
  const items = labels.flatMap((label) => {
    const human = label.human[grader];
    const graded = trials.filter((t) => t.taskId === label.taskId && t.grader === grader);
    return human === undefined || graded.length === 0 ? [] : [{ human, graded }];
  });
  const pairs = items.flatMap(({ human, graded }) =>
    graded.map((t) => ({ human, outcome: t.outcome })),
  );
  const probabilities = items.flatMap(({ human, graded }) =>
    graded.flatMap((t) =>
      t.probability === undefined ? [] : [{ human, probability: t.probability }],
    ),
  );
  const matrix = confusionMatrix(pairs);
  const graderRates = rates(matrix);
  return {
    grader,
    items: items.length,
    matrix,
    rates: graderRates,
    selfConsistency: selfConsistency(items.map(({ graded }) => graded.map((t) => t.outcome))),
    usable: (graderRates.tpr ?? 0) >= criteria.tpr && (graderRates.tnr ?? 0) >= criteria.tnr,
    ...(probabilities.length === 0 ? {} : { sweep: thresholdSweep(probabilities, thresholds) }),
  };
}

// 採点器が観測した合格率を，採点器の誤りの率で補正する(Rogan-Gladen法)．
// (観測した合格率 + TNR - 1) / (TPR + TNR - 1)を0から1の範囲に収める．TPR + TNRが1以下なら補正できない．
export function correctPassRate(
  observed: number,
  graderRates: { tpr: number; tnr: number },
): number | undefined {
  const denominator = graderRates.tpr + graderRates.tnr - 1;
  if (denominator <= 0) {
    return undefined;
  }
  return Math.min(1, Math.max(0, (observed + graderRates.tnr - 1) / denominator));
}

export type CorrectedEstimate = { corrected: number; interval: Interval };

// タスクごとの合格率の平均を補正した値と，その区間．
// 区間は，タスクの再標本化と，TPRとTNRの二項分布からの再標本化によるブートストラップで求める．
export function correctedEstimate(
  taskRates: number[],
  graderRates: GraderRates,
  options: { resamples: number; confidence: number; random: Random },
): CorrectedEstimate | undefined {
  const { tpr, tnr, positives, negatives } = graderRates;
  if (tpr === undefined || tnr === undefined || taskRates.length === 0) {
    return undefined;
  }
  const corrected = correctPassRate(average(taskRates), { tpr, tnr });
  if (corrected === undefined) {
    return undefined;
  }
  const interval = bootstrapInterval((random) => {
    const resampled = taskRates.map(
      () => taskRates[Math.floor(random.next() * taskRates.length)] ?? 0,
    );
    return correctPassRate(average(resampled), {
      tpr: binomialDraw(positives, tpr, random) / positives,
      tnr: binomialDraw(negatives, tnr, random) / negatives,
    });
  }, options);
  return { corrected, interval };
}

const average = (values: number[]): number =>
  values.reduce((sum, value) => sum + value, 0) / values.length;

// 成功の確率pの試行をn回行ったときの成功数．
function binomialDraw(n: number, p: number, random: Random): number {
  let successes = 0;
  for (let i = 0; i < n; i++) {
    if (random.next() < p) {
      successes += 1;
    }
  }
  return successes;
}

const rateSchema = z.number().optional();

const fileSchema = z.object({
  split: z.string().optional(),
  graders: z.record(
    z.string(),
    z.object({
      tpr: rateSchema,
      tnr: rateSchema,
      positives: z.number(),
      negatives: z.number(),
    }),
  ),
});

// evalstats calibrate --outで保存し，evalstats summary --calibrationで読む検証結果．
export type CalibrationFile = { split: string | undefined; graders: Record<string, GraderRates> };

export function serializeCalibration(result: CalibrationResult): string {
  const graders = Object.fromEntries(result.graders.map((g) => [g.grader, g.rates]));
  return `${JSON.stringify({ split: result.split, graders }, null, 2)}\n`;
}

export function parseCalibrationFile(text: string): CalibrationFile {
  const parsed = fileSchema.safeParse(JSON.parse(text));
  if (!parsed.success) {
    throw new Error(`not a calibration file: ${parsed.error.issues[0]?.message}`);
  }
  const graders = Object.fromEntries(
    Object.entries(parsed.data.graders).map(([grader, r]) => [
      grader,
      { tpr: r.tpr, tnr: r.tnr, positives: r.positives, negatives: r.negatives },
    ]),
  );
  return { split: parsed.data.split, graders };
}
