import type { EvalResult, RunMetadata, Trial } from "./promptfooResult.ts";
import { binomialInterval, judgeTarget, meanWithError } from "./stats.ts";
import type { Estimate, Interval, TargetVerdict } from "./stats.ts";

// 全試行で合格ならstable，全試行で不合格ならbroken，合否が揺れればflaky．
export type Status = "stable" | "flaky" | "broken";

// 1つのタスクを1つの採点器で採点した，すべての試行．
export type TaskTrials = {
  taskId: string;
  grader: string;
  trials: Trial[];
};

export type TaskSummary = {
  taskId: string;
  grader: string;
  passes: number;
  trials: number;
  rate: number;
  interval: Interval;
  status: Status;
};

export type GraderSummary = {
  grader: string;
  passAt1: number;
  // タスクが2つ以上あるときの，タスクごとの合格率の平均の標準誤差と信頼区間．
  estimate: Estimate | undefined;
  passHatK: number | undefined;
  stable: number;
  flaky: number;
  broken: number;
  targetVerdict?: TargetVerdict;
};

export type Summary = {
  suite: string;
  provider: string;
  metadata: RunMetadata;
  trialsPerTask: number;
  k: number;
  confidence: number;
  target?: number;
  tasks: TaskSummary[];
  graders: GraderSummary[];
};

// 同じタスクと採点器の試行をまとめる．最初に現れた順に並べる．
export function groupTrials(result: EvalResult): TaskTrials[] {
  const groups = new Map<string, TaskTrials>();
  for (const trial of result.trials) {
    const key = JSON.stringify([trial.taskId, trial.grader]);
    const group = groups.get(key) ?? { taskId: trial.taskId, grader: trial.grader, trials: [] };
    group.trials.push(trial);
    groups.set(key, group);
  }
  return [...groups.values()];
}

// trials回中passes回合格したタスクが，k回続けて合格する確率の推定値．C(passes, k) / C(trials, k)．
export function passHatK(passes: number, trials: number, k: number): number {
  if (k > trials) {
    throw new RangeError(`k (${k}) must not exceed the number of trials (${trials})`);
  }
  let estimate = 1;
  for (let i = 0; i < k; i++) {
    estimate *= Math.max(passes - i, 0) / (trials - i);
  }
  return estimate;
}

export type SummaryOptions = {
  k: number;
  confidence?: number;
  target?: number;
};

export function summarize(result: EvalResult, options: SummaryOptions): Summary {
  const confidence = options.confidence ?? 0.95;
  const groups = groupTrials(result);
  const tasks = groups.map((group) => summarizeTask(group, confidence));
  const graderNames = [...new Set(tasks.map((task) => task.grader))];
  return {
    suite: result.suite,
    provider: result.provider,
    metadata: result.metadata,
    trialsPerTask: Math.max(0, ...tasks.map((task) => task.trials)),
    k: options.k,
    confidence,
    ...(options.target === undefined ? {} : { target: options.target }),
    tasks,
    graders: graderNames.map((grader) =>
      summarizeGrader(
        grader,
        tasks.filter((task) => task.grader === grader),
        { ...options, confidence },
      ),
    ),
  };
}

function summarizeTask(group: TaskTrials, confidence: number): TaskSummary {
  const passes = group.trials.filter((trial) => trial.pass).length;
  const trials = group.trials.length;
  const status: Status = passes === trials ? "stable" : passes === 0 ? "broken" : "flaky";
  return {
    taskId: group.taskId,
    grader: group.grader,
    passes,
    trials,
    rate: passes / trials,
    interval: binomialInterval(passes, trials, confidence),
    status,
  };
}

const mean = (values: number[]): number =>
  values.reduce((sum, value) => sum + value, 0) / values.length;

// 同じタスクの試行どうしは独立でないため，標準誤差はタスクごとの合格率から求める．
function summarizeGrader(
  grader: string,
  tasks: TaskSummary[],
  options: SummaryOptions & { confidence: number },
): GraderSummary {
  const { k, confidence, target } = options;
  const rates = tasks.map((task) => task.rate);
  const estimate = rates.length >= 2 ? meanWithError(rates, confidence) : undefined;
  const enoughTrials = tasks.every((task) => task.trials >= k);
  const count = (status: Status) => tasks.filter((task) => task.status === status).length;
  return {
    grader,
    passAt1: mean(rates),
    estimate,
    passHatK: enoughTrials ? mean(tasks.map((t) => passHatK(t.passes, t.trials, k))) : undefined,
    stable: count("stable"),
    flaky: count("flaky"),
    broken: count("broken"),
    ...(target === undefined || estimate === undefined
      ? {}
      : { targetVerdict: judgeTarget(estimate.interval, target) }),
  };
}
