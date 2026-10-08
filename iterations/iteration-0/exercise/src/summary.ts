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
  throw new Error("TODO: summarize");
}
