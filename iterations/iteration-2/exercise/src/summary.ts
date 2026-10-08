import type { EvalResult, RunMetadata, Trial } from "./promptfooResult.ts";

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
  status: Status;
};

export type GraderSummary = {
  grader: string;
  passAt1: number;
  passHatK: number | undefined;
  stable: number;
  flaky: number;
  broken: number;
};

export type Summary = {
  suite: string;
  provider: string;
  metadata: RunMetadata;
  trialsPerTask: number;
  k: number;
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

export function summarize(result: EvalResult, options: { k: number }): Summary {
  const groups = groupTrials(result);
  const tasks = groups.map(summarizeTask);
  const graderNames = [...new Set(tasks.map((task) => task.grader))];
  return {
    suite: result.suite,
    provider: result.provider,
    metadata: result.metadata,
    trialsPerTask: Math.max(0, ...tasks.map((task) => task.trials)),
    k: options.k,
    tasks,
    graders: graderNames.map((grader) =>
      summarizeGrader(
        grader,
        tasks.filter((task) => task.grader === grader),
        options.k,
      ),
    ),
  };
}

function summarizeTask(group: TaskTrials): TaskSummary {
  const passes = group.trials.filter((trial) => trial.pass).length;
  const trials = group.trials.length;
  const status: Status = passes === trials ? "stable" : passes === 0 ? "broken" : "flaky";
  return {
    taskId: group.taskId,
    grader: group.grader,
    passes,
    trials,
    rate: passes / trials,
    status,
  };
}

const mean = (values: number[]): number =>
  values.reduce((sum, value) => sum + value, 0) / values.length;

function summarizeGrader(grader: string, tasks: TaskSummary[], k: number): GraderSummary {
  const enoughTrials = tasks.every((task) => task.trials >= k);
  const count = (status: Status) => tasks.filter((task) => task.status === status).length;
  return {
    grader,
    passAt1: mean(tasks.map((task) => task.rate)),
    passHatK: enoughTrials ? mean(tasks.map((t) => passHatK(t.passes, t.trials, k))) : undefined,
    stable: count("stable"),
    flaky: count("flaky"),
    broken: count("broken"),
  };
}
