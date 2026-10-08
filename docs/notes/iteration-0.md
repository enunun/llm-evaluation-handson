# Iteration 0のノート

Iteration 0で初めて使う概念，ツール，構文をまとめる．
REPLの例は，演習パッケージのディレクトリで`node`を起動して試せる．

## 評価の用語

このコースは，Anthropicの"[Demystifying evals for AI agents](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents)"の用語を使う．

| 用語 | 意味 | promptfooでの呼び名 |
| --- | --- | --- |
| タスク | 入力と合格の基準を持つ1つのテストケース | test |
| 採点器 | 出力のある側面を採点する仕組み | assertion |
| スイート | 目的を共有するタスクの集まり | 設定ファイル`promptfooconfig.yaml` |
| 評価ハーネス | スイートを実行し，採点し，集計する仕組み | promptfooと，このコースで作る`evalstats` |

ソフトウェアの単体テストと評価は，入力と期待を並べて合否を見る点で似ている．
違いは，評価の対象が非決定的なLLMを含むことである．
単体テストは1回の実行で合否が決まる．評価では，1回の結果がたまたまのものである可能性を否定できない．
このコースは，その「たまたま」をIteration 1以降で数字にしていく．

## 品質特性：QA4AIとISO/IEC 25059

採点器が「何の品質」を測っているかを，名前に書いておく．
このコースは，[QA4AI AIプロダクト品質保証ガイドライン](https://www.qa4ai.jp/download)2025.04版の10章が定めるLLMの品質特性を使う．
この章は，品質特性を国際規格ISO/IEC 25059:2023(SQuaRE for AI)の品質特性と対応づけている．

| QA4AI | 内容 | ISO/IEC 25059の対応 |
| --- | --- | --- |
| QC01 回答性能 | 期待するタスクにおける「良さ」．QC01-1は自然言語処理における回答性能，QC01-4は指示に沿う制御可能性 | Functional correctness，User controllability |
| QC02 事実性・誠実性 | 事実や与えた知識に沿っていること．QC02-2は与えた知識に対する事実性 | Functional correctness |
| QC03 倫理性・アラインメント | 公平性，安全性，データガバナンス | Societal and ethical risk mitigation |
| QC04 頑健性 | 入力の揺らぎや干渉に対して品質を保つこと | Robustness |
| QC05 AIセキュリティ | プロンプトインジェクションなどの攻撃への耐性 | Security |

問い合わせを正しいカテゴリに分類できるかは，QC01-1にあたる．
採点器の`metric`は`category (QC01-1)`のように，名前と品質特性を並べて書く．

## promptfooの構成

promptfooは，設定ファイル`promptfooconfig.yaml`を読んで評価する．

```yaml
description: support          # スイートの名前
prompts:
  - "{{inquiry}}"             # プロバイダに渡すプロンプト．{{ }}にテストの変数が入る
providers:
  - id: file://src/supportProvider.ts   # 自作のプロバイダ
    config:
      llm: fake
defaultTest:
  assert:                     # すべてのテストに付ける採点器
    - type: equals
      value: "{{expected}}"
      metric: category (QC01-1)
tests:
  - description: refund-01    # タスクのID
    vars:
      inquiry: 返品して返金してほしいです．
      expected: refund
```

- プロバイダ：プロンプトを受け取って出力を返すもの．promptfooは多くのLLMのプロバイダを持つが，このコースでは製品の関数を呼ぶ自作のプロバイダを使う．
- アサーション：出力を採点する．`equals`は出力が`value`と一致すれば合格である．`metric`で採点器に名前を付ける．
- `pnpm eval -o results/fake.json`で評価し，結果をJSONに書き出す．`pnpm promptfoo view`で，結果をブラウザで見られる．

### カスタムプロバイダ

カスタムプロバイダは，`id()`と`callApi(prompt)`を持つクラスを`export default`するモジュールである．
promptfooは，設定の`config`を`options.config`としてコンストラクタに渡す．

```ts
import type { ApiProvider, ProviderOptions, ProviderResponse } from "promptfoo";

export default class EchoProvider implements ApiProvider {
  constructor(options: ProviderOptions) {}
  id(): string {
    return "echo";
  }
  async callApi(prompt: string): Promise<ProviderResponse> {
    return { output: prompt };          // 失敗したときは { error: "理由" } を返す
  }
}
```

### 結果JSON

`-o`で書き出した結果JSONのうち，`evalstats`が使う部分を示す．

```text
config.description                     スイートの名前
results.results[]                      テストを1回実行した結果の配列
  testCase.description                 タスクのID
  testCase.assert[]                    そのタスクのアサーション(type，metric)
  provider.id / provider.label         プロバイダのIDとラベル
  response.output                      プロバイダの出力
  gradingResult.componentResults[]     アサーションごとの採点結果(pass，assertion)
```

プロバイダがエラーを返すと，`gradingResult`は`null`になる．

## LLMをポートとして切り出す

製品のコードがOllamaのクライアントを直接呼ぶと，テストのたびに本物のLLMが動き，結果が揺れる．
そこで，LLMを1つのメソッドを持つインタフェース(ポート)にし，製品はこのインタフェースだけに依存する．

```ts
export interface Llm {
  complete(request: LlmRequest): Promise<string>;
}
```

本番ではOllamaを呼ぶ実装を，テストでは決めた応答を返す偽物を渡す．
このように，使う側が依存するものを外から渡すことを依存の注入という．
QA4AIのガイドラインのProcess Agilityの節は，LLMが数か月から数年おきに入れ替わることを踏まえ，LLMを交換できる設計を求めている．ポートはその設計の1つである．

## テストダブル

本物の代わりにテストで使う部品をテストダブルという．このIterationでは2つの偽LLMを作る．

- `scriptedLlm`：決めた応答を順に返し，受け取ったリクエストを記録する．製品の関数が，LLMの出力をどう扱うかを確かめる単体テストで使う．
- `keywordLlm`：キーワードで分類する．Ollamaを使わずにpromptfooで評価するために使う．

## LLMの出力の正規化

LLMは指示どおりの形で答えるとは限らない．
前後の空白や大文字小文字のような無害な違いは吸収し，それでも当たらない出力は`invalid`として扱う．
`invalid`を例外にせず値として返すと，評価で「形式を守らなかった」ことを数えられる．

```text
> " Refund\n".trim().toLowerCase()
'refund'
> ["refund", "shipping", "account", "other"].includes("返金")
false
```

## 正規表現で区切られた部分を取り出す

`keywordLlm`は，プロンプトから`<inquiry>`と`</inquiry>`の間だけを取り出して分類する．
`[\s\S]*?`は改行を含む任意の文字の最短一致である．

```text
> "カテゴリを答えよ\n<inquiry>\n本が届かない\n</inquiry>".match(/<inquiry>([\s\S]*?)<\/inquiry>/)?.[1]
'\n本が届かない\n'
```

## TypeScriptの構文

### 配列からユニオン型を作る

`as const`を付けた配列から，要素のユニオン型を作れる．値の一覧と型を1か所で定義できる．

```ts
export const categories = ["refund", "shipping", "account", "other"] as const;
export type Category = (typeof categories)[number]; // "refund" | "shipping" | "account" | "other"
```

### 型の除去で実行する

このコースは，TypeScriptをビルドせずNode.jsで直接実行する．Node.jsは型の注釈を取り除いて実行する．
そのため，次の約束を守る．

- importは拡張子`.ts`付きで書く(`import { summarize } from "./summary.ts"`)．
- 型だけをimportするときは`import type`を使う．
- 型の注釈を取り除くだけで消せない構文(`enum`など)を避ける．

### `import.meta.main`

モジュールが`node src/cli.ts`のように直接実行されたときだけ`true`になる．
テストから`main`をimportしたときは，CLIとしての処理が動かない．

## zodで外部のデータを検証する

promptfooの結果JSONは，このプログラムの外から来るデータである．
zodのスキーマで形を検証してから使うと，形が違うときに分かりやすいエラーで止まる．

```text
> await import("zod").then(({ z }) => z.object({ pass: z.boolean() }).safeParse({ pass: true }).success)
true
> await import("zod").then(({ z }) => z.object({ pass: z.boolean() }).safeParse({ pass: "yes" }).error.issues[0].message)
'Invalid input: expected boolean, received string'
```

`safeParse`は例外を投げずに`success`と`data`または`error`を返す．
`z.infer<typeof schema>`で，スキーマから型を作れる．

## Vitest

- `describe`でテストをまとめ，`it`で1つのテストを書き，`expect`で期待を書く．
- 非同期の関数は`await`で結果を待つ．例外を確かめるときは`await expect(promise).rejects.toThrow("...")`と書く．
- `vitest.config.ts`は`unit`と`integration`の2つのprojectを定義している．`--project unit`で単体テストだけを実行する．

## 表の列をそろえる

`padEnd`は，文字列の後ろを空白で埋めて指定の長さにする．

```text
> "refund-01".padEnd(12) + "|"
'refund-01   |'
```
