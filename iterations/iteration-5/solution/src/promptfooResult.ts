import { z } from "zod";

// promptfooの結果JSON(promptfoo eval -o)のうち，evalstatsが使う部分だけを検証する．
const assertionSchema = z.object({
  type: z.string(),
  metric: z.string().optional(),
  value: z.unknown().optional(),
  config: z.record(z.string(), z.unknown()).optional(),
});

const metadataSchema = z.object({
  llm: z.string().optional(),
  model: z.string().optional(),
  promptVersion: z.string().optional(),
  seed: z.number().optional(),
});

const resultSchema = z.object({
  testCase: z.object({
    description: z.string(),
    assert: z.array(assertionSchema),
    metadata: z
      .object({
        split: z.string().optional(),
        human: z.record(z.string(), z.enum(["pass", "fail"])).optional(),
      })
      .loose()
      .optional(),
  }),
  provider: z.object({ id: z.string(), label: z.string().optional() }),
  response: z.object({ output: z.unknown().optional() }).nullish(),
  gradingResult: z
    .object({
      componentResults: z.array(
        z.object({
          pass: z.boolean(),
          reason: z.string().optional(),
          assertion: assertionSchema,
          metadata: z
            .object({ outcome: z.string().optional(), probability: z.number().optional() })
            .loose()
            .optional(),
        }),
      ),
    })
    .nullish(),
  error: z.string().nullish(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const fileSchema = z.object({
  config: z.object({ description: z.string().optional() }),
  results: z.object({ results: z.array(resultSchema) }),
});

// 採点の結果．unknownは採点器が判断できなかったこと，errorは採点できなかったことを表す．
export type GradeOutcome = "pass" | "fail" | "unknown" | "error";

// 1回の試行を，1つの採点器で採点した結果．trialは，同じタスクの試行の中での1からの番号．
export type Trial = {
  taskId: string;
  trial: number;
  grader: string;
  output: string;
  outcome: GradeOutcome;
  reason: string;
  // 確率を返す採点器(意思決定モデル)が残した確率．
  probability?: number;
};

// 人の判定．
export type HumanLabel = "pass" | "fail";

// 人手ラベルのスイートのタスクに付けた，採点器ごとの人の判定と，dev/testの分割．
export type TaskLabel = {
  taskId: string;
  split: string;
  human: Record<string, HumanLabel>;
};

// プロバイダが出力のメタデータに残した，再現のための記録．
export type RunMetadata = z.infer<typeof metadataSchema>;

export type EvalResult = {
  suite: string;
  provider: string;
  metadata: RunMetadata;
  trials: Trial[];
  labels: TaskLabel[];
  // 採点器ごとの設定(アサーションの種類，値，設定)をJSONにしたもの．比べられる結果かを確かめるために使う．
  graderSettings: Record<string, string>;
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
    metadata: mergeMetadata(results.results.map((result) => pickMetadata(result.metadata ?? {}))),
    trials: withTrialNumbers(results.results).flatMap(([result, trial]) => toTrials(result, trial)),
    labels: toLabels(results.results),
    graderSettings: toGraderSettings(results.results),
  };
}

// promptfooが加える項目を除き，記録の項目だけを残す．形の違う記録は空にする．
function pickMetadata(raw: Record<string, unknown>): RunMetadata {
  return metadataSchema.safeParse(raw).data ?? {};
}

// 結果ごとの記録をまとめる．文字列の項目は，現れた順に重複を除いてカンマでつなぐ．
// シードはプロバイダの設定なので，最初の記録の値を使う．
function mergeMetadata(records: RunMetadata[]): RunMetadata {
  const join = (key: "llm" | "model" | "promptVersion") => {
    const values = [...new Set(records.flatMap((record) => record[key] ?? []))];
    return values.length === 0 ? {} : { [key]: values.join(", ") };
  };
  const seed = records.find((record) => record.seed !== undefined)?.seed;
  return {
    ...join("llm"),
    ...join("model"),
    ...join("promptVersion"),
    ...(seed === undefined ? {} : { seed }),
  };
}

type RawResult = z.infer<typeof resultSchema>;
type Assertion = z.infer<typeof assertionSchema>;

const graderName = (assertion: Assertion): string => assertion.metric ?? assertion.type;

// 同じタスクの結果に，現れた順に1からの番号を付ける．
function withTrialNumbers(results: RawResult[]): [RawResult, number][] {
  const counts = new Map<string, number>();
  return results.map((result) => {
    const trial = (counts.get(result.testCase.description) ?? 0) + 1;
    counts.set(result.testCase.description, trial);
    return [result, trial];
  });
}

const isOutcome = (value: string | undefined): value is GradeOutcome =>
  value === "pass" || value === "fail" || value === "unknown" || value === "error";

// テストケースのアサーションごとに，採点の結果と理由を取り出す．
// 自作のアサーションは結果をメタデータのoutcomeに残す．ほかのアサーションは合否から決める．
// プロバイダがエラーを返すと採点結果がないため，そのアサーションはerrorとする．
function toTrials(result: RawResult, trial: number): Trial[] {
  const output = typeof result.response?.output === "string" ? result.response.output : "";
  const components = result.gradingResult?.componentResults ?? [];
  return result.testCase.assert.map((assertion) => {
    const grader = graderName(assertion);
    const component = components.find((c) => graderName(c.assertion) === grader);
    const base = { taskId: result.testCase.description, trial, grader, output };
    if (component === undefined) {
      return { ...base, outcome: "error" as const, reason: result.error ?? "not graded" };
    }
    const recorded = component.metadata?.outcome;
    const probability = component.metadata?.probability;
    return {
      ...base,
      outcome: isOutcome(recorded) ? recorded : component.pass ? "pass" : "fail",
      reason: component.reason ?? "",
      ...(probability === undefined ? {} : { probability }),
    };
  });
}

// 人の判定を持つタスクのラベルを，タスクごとに1つ取り出す．
function toLabels(results: RawResult[]): TaskLabel[] {
  const labels = new Map<string, TaskLabel>();
  for (const { testCase } of results) {
    const human = testCase.metadata?.human;
    if (human !== undefined && !labels.has(testCase.description)) {
      labels.set(testCase.description, {
        taskId: testCase.description,
        split: testCase.metadata?.split ?? "",
        human,
      });
    }
  }
  return [...labels.values()];
}

function toGraderSettings(results: RawResult[]): Record<string, string> {
  const settings: Record<string, string> = {};
  for (const assertion of results.flatMap((result) => result.testCase.assert)) {
    const { type, value, config } = assertion;
    settings[graderName(assertion)] ??= JSON.stringify({ type, value, config });
  }
  return settings;
}
