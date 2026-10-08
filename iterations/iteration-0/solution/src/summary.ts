import type { EvalResult, TaskOutcome } from "./promptfooResult.ts";

export type Summary = {
  suite: string;
  provider: string;
  outcomes: TaskOutcome[];
  passedTasks: number;
  totalTasks: number;
  passRate: number;
};

// すべての採点器に合格したタスクを合格として数える．
export function summarize(result: EvalResult): Summary {
  const passByTask = new Map<string, boolean>();
  for (const outcome of result.outcomes) {
    passByTask.set(outcome.taskId, (passByTask.get(outcome.taskId) ?? true) && outcome.pass);
  }
  const totalTasks = passByTask.size;
  const passedTasks = [...passByTask.values()].filter(Boolean).length;
  return {
    ...result,
    passedTasks,
    totalTasks,
    passRate: totalTasks === 0 ? 0 : passedTasks / totalTasks,
  };
}
