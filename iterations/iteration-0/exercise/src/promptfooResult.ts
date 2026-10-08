// 1つのタスクを1つの採点器で採点した結果．
export type TaskOutcome = {
  taskId: string;
  grader: string;
  output: string;
  pass: boolean;
};

export type EvalResult = {
  suite: string;
  provider: string;
  outcomes: TaskOutcome[];
};

// promptfooの結果JSON(promptfoo eval -o)を読み，評価結果を取り出す．
export function parseResultFile(text: string): EvalResult {
  throw new Error("TODO: parseResultFile");
}
