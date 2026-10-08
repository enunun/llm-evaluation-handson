import binomialTest from "@stdlib/stats-binomial-test";
import normalQuantile from "@stdlib/stats-base-dists-normal-quantile";
import { mean, quantile, sampleStandardDeviation } from "simple-statistics";
import type { Random } from "./random.ts";

export type Interval = {
  lower: number;
  upper: number;
};

// 平均と，その標準誤差と信頼区間．
export type Estimate = {
  mean: number;
  standardError: number;
  interval: Interval;
};

// 目標の合格率と信頼区間を比べた結果．
export type TargetVerdict = "met" | "not met" | "inconclusive";

// trials回中passes回合格したときの，合格する確率の信頼区間(Clopper-Pearson法)．
export function binomialInterval(passes: number, trials: number, confidence: number): Interval {
  if (trials < 1) {
    throw new RangeError("trials must be at least 1");
  }
  const [lower = 0, upper = 1] = binomialTest(passes, trials, { alpha: 1 - confidence }).ci;
  return { lower, upper };
}

// 値の平均と，標準誤差(標本標準偏差 / √値の数)，平均±z×標準誤差の信頼区間．
// 値は0以上1以下の合格率なので，区間もその範囲に収める．
export function meanWithError(values: number[], confidence: number): Estimate {
  if (values.length < 2) {
    throw new RangeError("at least two values are needed to estimate the standard error");
  }
  const average = mean(values);
  const standardError = sampleStandardDeviation(values) / Math.sqrt(values.length);
  const z = normalQuantile(1 - (1 - confidence) / 2, 0, 1);
  return {
    mean: average,
    standardError,
    interval: {
      lower: Math.max(0, average - z * standardError),
      upper: Math.min(1, average + z * standardError),
    },
  };
}

export function judgeTarget(interval: Interval, target: number): TargetVerdict {
  if (interval.lower >= target) {
    return "met";
  }
  return interval.upper < target ? "not met" : "inconclusive";
}

// 乱数を使って計算する統計量をresamples回計算し，その分布の分位点を区間にする(ブートストラップ)．
// 統計量がundefinedを返した回は除く．
export function bootstrapInterval(
  statistic: (random: Random) => number | undefined,
  options: { resamples: number; confidence: number; random: Random },
): Interval {
  const samples: number[] = [];
  for (let i = 0; i < options.resamples; i++) {
    const value = statistic(options.random);
    if (value !== undefined) {
      samples.push(value);
    }
  }
  if (samples.length === 0) {
    throw new RangeError("no bootstrap samples");
  }
  const tail = (1 - options.confidence) / 2;
  return { lower: quantile(samples, tail), upper: quantile(samples, 1 - tail) };
}
