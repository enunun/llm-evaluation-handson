import { z } from "zod";

// promptfooの結果JSON(promptfoo eval -o)のうち，evalstatsが使う部分だけを検証する．
const assertionSchema = z.object({ type: z.string(), metric: z.string().optional() });

const resultSchema = z.object({
  testCase: z.object({ description: z.string(), assert: z.array(assertionSchema) }),
  provider: z.object({ id: z.string(), label: z.string().optional() }),
  response: z.object({ output: z.unknown().optional() }).nullish(),
  gradingResult: z
    .object({
      componentResults: z.array(z.object({ pass: z.boolean(), assertion: assertionSchema })),
    })
    .nullish(),
});

const fileSchema = z.object({
  config: z.object({ description: z.string().optional() }),
  results: z.object({ results: z.array(resultSchema) }),
});

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

export function parseResultFile(text: string): EvalResult {
  const parsed = fileSchema.safeParse(JSON.parse(text));
  if (!parsed.success) {
    throw new Error(`not a promptfoo result file: ${parsed.error.issues[0]?.message}`);
  }
  const { config, results } = parsed.data;
  const first = results.results[0];
  return {
    suite: config.description ?? "",
    provider: first ? first.provider.label || first.provider.id : "",
    outcomes: results.results.flatMap(toOutcomes),
  };
}

type RawResult = z.infer<typeof resultSchema>;
type Assertion = z.infer<typeof assertionSchema>;

const graderName = (assertion: Assertion): string => assertion.metric ?? assertion.type;

// テストケースのアサーションごとに合否を取り出す．
// プロバイダがエラーを返すと採点結果がないため，そのアサーションは不合格とする．
function toOutcomes(result: RawResult): TaskOutcome[] {
  const output = typeof result.response?.output === "string" ? result.response.output : "";
  const components = result.gradingResult?.componentResults ?? [];
  return result.testCase.assert.map((assertion) => {
    const grader = graderName(assertion);
    const component = components.find((c) => graderName(c.assertion) === grader);
    return { taskId: result.testCase.description, grader, output, pass: component?.pass ?? false };
  });
}
