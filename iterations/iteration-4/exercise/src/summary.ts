import type { EvalResult, GradeOutcome, RunMetadata, Trial } from "./promptfooResult.ts";
import { binomialInterval, judgeTarget, meanWithError } from "./stats.ts";
import type { Estimate, Interval, TargetVerdict } from "./stats.ts";

// 判定できた試行がすべて合格ならstable，すべて不合格ならbroken，合否が揺れればflaky．
// 判定できた試行がなければunjudged．
export type Status = "stable" | "flaky" | "broken" | "unjudged";

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
  // 判定できた(passかfailの)試行の数．
  trials: number;
  unknown: number;
  errors: number;
  // 判定できた試行がなければundefined．
  rate: number | undefined;
  interval: Interval | undefined;
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
  unknown: number;
  errors: number;
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
    trialsPerTask: Math.max(0, ...tasks.map((task) => task.trials + task.unknown + task.errors)),
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
  const count = (outcome: GradeOutcome) => group.trials.filter((t) => t.outcome === outcome).length;
  const passes = count("pass");
  const trials = passes + count("fail");
  const base = {
    taskId: group.taskId,
    grader: group.grader,
    passes,
    trials,
    unknown: count("unknown"),
    errors: count("error"),
  };
  if (trials === 0) {
    return { ...base, rate: undefined, interval: undefined, status: "unjudged" };
  }
  return {
    ...base,
    rate: passes / trials,
    interval: binomialInterval(passes, trials, confidence),
    status: passes === trials ? "stable" : passes === 0 ? "broken" : "flaky",
  };
}

const sum = (values: number[]): number => values.reduce((total, value) => total + value, 0);

const mean = (values: number[]): number => sum(values) / values.length;

// 同じタスクの試行どうしは独立でないため，標準誤差はタスクごとの合格率から求める．
function summarizeGrader(
  grader: string,
  tasks: TaskSummary[],
  options: SummaryOptions & { confidence: number },
): GraderSummary {
  const { k, confidence, target } = options;
  const judged = tasks.filter((task) => task.rate !== undefined);
  const rates = judged.flatMap((task) => (task.rate === undefined ? [] : [task.rate]));
  const estimate = rates.length >= 2 ? meanWithError(rates, confidence) : undefined;
  const enoughTrials = judged.length > 0 && judged.every((task) => task.trials >= k);
  const count = (status: Status) => tasks.filter((task) => task.status === status).length;
  return {
    grader,
    passAt1: rates.length === 0 ? 0 : mean(rates),
    estimate,
    passHatK: enoughTrials ? mean(judged.map((t) => passHatK(t.passes, t.trials, k))) : undefined,
    stable: count("stable"),
    flaky: count("flaky"),
    broken: count("broken"),
    unknown: sum(tasks.map((task) => task.unknown)),
    errors: sum(tasks.map((task) => task.errors)),
    ...(target === undefined || estimate === undefined
      ? {}
      : { targetVerdict: judgeTarget(estimate.interval, target) }),
  };
}
