import type { EvalResult } from "./promptfooResult.ts";
import { minimumDetectableEffect, pairedDifference, type PairedEstimate } from "./stats.ts";
import { summarize } from "./summary.ts";

// 差の区間が0より上ならimproved，0より下ならregressed，0をまたげばinconclusive．
export type Verdict = "improved" | "regressed" | "inconclusive";

export type GraderComparison = {
  grader: string;
  tasks: number;
  base: number;
  head: number;
  difference: PairedEstimate;
  minimumDetectableEffect: number;
  verdict: Verdict;
};

export type Comparison = { graders: GraderComparison[] };

export type GateResult = { pass: boolean; failures: { grader: string; lower: number }[] };

// 2つの評価結果を，両方にある採点器ごとに，同じタスクの合格率を対にして比べる．
// タスクの集合や採点器の設定が違う結果は比べられないため，エラーにする．
export function compareRuns(
  base: EvalResult,
  head: EvalResult,
  options: { confidence: number },
): Comparison {
  const baseRates = taskRates(base);
  const headRates = taskRates(head);
  const graders = Object.keys(base.graderSettings).filter(
    (grader) => grader in head.graderSettings,
  );
  return {
    graders: graders.map((grader) => {
      if (base.graderSettings[grader] !== head.graderSettings[grader]) {
        throw new Error(`grader settings differ for ${grader}`);
      }
      const baseTasks = taskIds(base, grader);
      const headTasks = taskIds(head, grader);
      if (
        baseTasks.size !== headTasks.size ||
        [...baseTasks].some((task) => !headTasks.has(task))
      ) {
        throw new Error(`task sets differ for ${grader}`);
      }
      // 両方の結果で判定できた試行のあるタスクだけを対にする．
      const baseOf = baseRates.get(grader) ?? new Map<string, number>();
      const headOf = headRates.get(grader) ?? new Map<string, number>();
      const tasks = [...baseTasks].filter((task) => baseOf.has(task) && headOf.has(task));
      const baseValues = tasks.map((task) => baseOf.get(task) ?? 0);
      const headValues = tasks.map((task) => headOf.get(task) ?? 0);
      const difference = pairedDifference(baseValues, headValues, options.confidence);
      return {
        grader,
        tasks: tasks.length,
        base: average(baseValues),
        head: average(headValues),
        difference,
        minimumDetectableEffect: minimumDetectableEffect(difference.standardError, {
          confidence: options.confidence,
          power: 0.8,
        }),
        verdict: judge(difference),
      };
    }),
  };
}

// 非劣性のゲート．差の区間の下限が-marginより小さい採点器があれば不合格にする．
export function gate(comparison: Comparison, margin: number): GateResult {
  const failures = comparison.graders
    .filter((g) => g.difference.interval.lower < -margin)
    .map((g) => ({ grader: g.grader, lower: g.difference.interval.lower }));
  return { pass: failures.length === 0, failures };
}

function judge(difference: PairedEstimate): Verdict {
  if (difference.interval.lower > 0) {
    return "improved";
  }
  return difference.interval.upper < 0 ? "regressed" : "inconclusive";
}

const taskIds = (result: EvalResult, grader: string): Set<string> =>
  new Set(result.trials.filter((t) => t.grader === grader).map((t) => t.taskId));

// 採点器ごと，タスクごとの合格率．判定できた試行のないタスクは除く．
function taskRates(result: EvalResult): Map<string, Map<string, number>> {
  const rates = new Map<string, Map<string, number>>();
  for (const task of summarize(result, { k: 1 }).tasks) {
    if (task.rate !== undefined) {
      const ofGrader = rates.get(task.grader) ?? new Map<string, number>();
      ofGrader.set(task.taskId, task.rate);
      rates.set(task.grader, ofGrader);
    }
  }
  return rates;
}

const average = (values: number[]): number =>
  values.reduce((sum, value) => sum + value, 0) / values.length;
