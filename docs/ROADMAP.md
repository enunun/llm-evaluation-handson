# ロードマップ

このハンズオンでは，カスタマーサポート向けの小さなLLM機能を作り，[promptfoo](https://github.com/promptfoo/promptfoo)で評価し，その結果を分析するCLI`evalstats`を6つのIterationで育てる．
生成AIの出力は，同じ入力でも毎回変わる．
この非決定性を「たまたま通った」「たまたま落ちた」で済ませず，複数回の試行，標準誤差と信頼区間，評価器の検証，対応のある比較によって，品質を根拠のある数字で語れるようにすることが，このコースの目標である．

promptfooは，タスクの実行，繰り返し，採点までを受け持つ．
一方で，promptfooの集計は合格と不合格の件数までであり，信頼区間，実行どうしの統計的な比較，評価器の検証は含まない．
このコースでは，この不足を`evalstats`として自分で作る．

## 拠り所にする指針

何を評価するかと，どう測るかを，次の公開された指針に沿って決める．

| 指針 | このコースで使う部分 |
| --- | --- |
| [QA4AI AIプロダクト品質保証ガイドライン 2025.04版](https://www.qa4ai.jp/download)の10章「大規模言語モデル・対話型生成AI」 | LLMの品質特性QC01〜QC05．各採点器がどの品質特性を測るかを明示する．5軸のうちCustomer Expectation(目標とする合格率)とProcess Agility(LLMを交換できる設計，再現のための記録) |
| ISO/IEC 25059:2023(SQuaRE for AI) | QA4AIの品質特性と対応する国際規格の用語(Functional correctness，User controllability，Robustnessなど) |
| Anthropic "[Demystifying evals for AI agents](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents)" | 用語(タスク，試行，採点器，トランスクリプト，評価ハーネス，スイート)，採点器の3分類，pass@kとpass^k，Judgeに「判断できない」を許すこと，トランスクリプトを読むこと，能力評価と回帰評価 |
| E. Miller "[Adding Error Bars to Evals](https://arxiv.org/abs/2411.00640)"([解説](https://www.anthropic.com/research/statistical-approach-to-model-evals)) | 平均±1.96×標準誤差，同じタスクの試行をまとめるクラスタ化，試行を平均して分散を減らすこと，対応のある差，検出力 |
| H. Husain "[evals-skills](https://github.com/hamelsmu/evals-skills)"のvalidate-evaluator | 人手ラベルをdevとtestに分けて評価器のTPRとTNRを測ること，Rogan-Gladen法による合格率の補正 |

## 使う評価器

採点器は，Anthropicの3分類に，文章を生成しない判定専用のモデルを加えた4種類を使う．

| 採点器 | 仕組み | 揺れ | このコースでの例 |
| --- | --- | --- | --- |
| コード | promptfooの決定的なアサーション(`equals`，`not-icontains`など)と，自作のアサーション | 揺れない | 分類の正しさ，方針にない約束をしていないか |
| LLM Judge | Judge用のLLMにルーブリックを渡し，理由と判定をJSONで返させる自作のアサーション | 揺れる | 丁寧な言葉遣いの指示に従っているか |
| 意思決定モデル | Ollamaの`/v1/systemone`で，状態と型付きの質問を渡し，答えを確率で受け取る(Jev形式のTev1) | 小さい | 返信が問い合わせに答えているか |
| 人 | 人手ラベル | — | 2つのモデル型の採点器を検証する基準 |

意思決定モデル(Tev1)は英語以外を十分に試験されていない．
日本語の問い合わせに使ってよいかどうかは，Iteration 4の検証で数字として確かめる．

## 完成したプログラムの使用例

```console
$ pnpm eval --repeat 10 -o results/head.json
...
$ pnpm evalstats summary results/head.json --target 0.9 --calibration results/calibration.json
suite: support (provider: support-ollama/qwen2.5:3b, trials: 10)
task          grader                     pass   rate  95% CI         status
refund-01     category (QC01-1)         10/10   1.00  [0.69, 1.00]   stable
shipping-03   category (QC01-1)          7/10   0.70  [0.35, 0.93]   flaky
reply-02      no-promise (QC02-2)       10/10   1.00  [0.69, 1.00]   stable
reply-02      judge:polite (QC01-4)      8/9    0.89  [0.52, 1.00]   flaky
reply-02      decision:answers (QC01-1) 10/10   1.00  [0.69, 1.00]   stable
...
grader                     mean   SE     95% CI          pass^3  unknown  target 0.90
category (QC01-1)          0.86   0.05   [0.76, 0.96]    0.62    0        inconclusive
no-promise (QC02-2)        0.98   0.02   [0.94, 1.00]    0.93    0        met
judge:polite (QC01-4)      0.84   0.06   [0.72, 0.96]    0.55    3        inconclusive
  corrected (TPR 0.90, TNR 0.85): 0.92  [0.80, 1.00]
decision:answers (QC01-1)  0.91   0.04   [0.83, 0.99]    0.80    0        inconclusive
  corrected (TPR 0.85, TNR 0.80): 0.98  [0.84, 1.00]

$ pnpm evalstats calibrate results/labels-test.json
grader             items  split  TPR    TNR    self-consistency  verdict
judge:polite       20     test   0.90   0.85   0.80              usable
decision:answers   20     test   0.85   0.80   1.00              usable

$ pnpm evalstats compare results/baseline.json results/head.json --margin 0.05
grader                  base   head   diff    SE     95% CI           corr   MDE(80%)  verdict
category (QC01-1)       0.79   0.86   +0.07   0.03   [+0.01, +0.13]   0.62   0.08      improved
judge:polite (QC01-4)   0.88   0.84   -0.04   0.04   [-0.12, +0.04]   0.48   0.11      inconclusive
gate: FAIL (judge:polite: lower bound -0.12 < -0.05)
```

上の数値は形式を示す例である．各Iterationの資料には，実際に実行した結果を載せる．

## 用語

このコースでは，Anthropicの用語に合わせて次の言葉を使う．promptfooでの呼び名を併記する．

| 用語 | 意味 | promptfooでの呼び名 |
| --- | --- | --- |
| タスク(task) | 入力と合格の基準を持つ1つのテストケース | test |
| 試行(trial) | タスクを1回実行すること | `--repeat`による繰り返しの1回 |
| 採点器(grader) | 出力のある側面を採点する仕組み．1つのタスクに複数付けられる | assertion(`metric`で名前を付ける) |
| トランスクリプト(transcript) | 1回の試行の記録．入力，出力，採点の理由を含む | 結果JSONの`results`の1要素 |
| スイート(suite) | 目的を共有するタスクの集まり | `promptfooconfig.yaml` |
| 評価ハーネス(evaluation harness) | スイートを実行し，採点し，集計する仕組み | promptfooと`evalstats` |

## 各Iterationの進め方

どのIterationも，同じ順に進める．

1. テストリスト：要求と使用例から，確かめるべき振る舞いを`TESTLIST.md`に書き出す．
2. 設計文書：テストリストの振る舞いを実現するモジュール，型，判断を`design/`に書く．
3. テスト駆動の実装：テストリストの項目を1つずつRed → Green → Refactorで実装する．
4. 設計の見直し：設計文書と実装を見比べ，食い違いを直す．

`iterations/iteration-N/exercise/`が受講者の作業場所であり，`iterations/iteration-N/solution/`が完成形と模範解答である．
Iteration N(N ≥ 1)の演習は，Iteration N-1の解答から始まる．

## テストの分け方

非決定的なLLMそのものは，テストの対象にしない．
テストでは，乱数のシードを固定した偽のLLMと偽の意思決定モデルを使い，製品，promptfooとの接続，`evalstats`の決定的なロジックを確かめる．

- **単体テスト**(`test/unit/`)：1つのモジュールの関数を単独で確かめる．LLMは，決めた応答を順に返す偽物を注入する．
- **統合テスト**(`test/integration/`)：promptfooのCLIでスイートを偽LLMで実際に評価し，その結果JSONを`evalstats`の入口`main`に渡して，表示までの組み合わせを確かめる．

実際のLLM(Ollama)での実行は，テストではなく評価そのものとして，受講者が手元で行う．
Ollamaを使えない環境でも，偽LLMでコースを最後まで進められる．

## Iterationの一覧

| Iteration | 作るもの | 学ぶこと |
| --- | --- | --- |
| 0 | 問い合わせの分類をpromptfooで1回評価し，`evalstats`でタスクごとの合否を表示する | promptfooの構成，LLMをポートとして切り出す設計，偽LLMによるテスト，品質特性QC01〜QC05 |
| 1 | 各タスクを複数回試行し，合格率，pass^k，揺れを集計する | 非決定性の源，シード付き乱数，pass@kとpass^k，flakyなタスク，再現のための記録 |
| 2 | 合格率に標準誤差と信頼区間を付け，目標と比べる | 中心極限定理，タスク単位のクラスタ化，二項分布の区間，目標合格率と「判定不能」 |
| 3 | 返信の下書きを，コードの採点器，LLM Judge，意思決定モデルで採点する | 採点器の分類，ルーブリック，構造化出力，「判断できない」，確率を返す採点器としきい値，トランスクリプトを読む |
| 4 | 2つのモデル型の採点器を人手ラベルで検証し，合格率を補正する | 評価器も測定器であること，dev/testの分割，TPRとTNR，自己一貫性，Rogan-Gladen補正 |
| 5 | 2つの実行結果を比較し，回帰をゲートで止める | 対応のある差，相関による分散の減少，検出力と最小検出差，非劣性マージン |

## Iteration 0：1回だけ評価する

### 要求

- 製品の機能`classifyInquiry`は，問い合わせ文をLLMで`refund`(返金)，`shipping`(配送)，`account`(アカウント)，`other`(その他)のどれかに分類する．LLMの出力は前後の空白と大文字小文字の違いを吸収してカテゴリに直し，どれにも当たらない出力は`invalid`とする．
- promptfooのカスタムプロバイダ`supportProvider`は，`classifyInquiry`をpromptfooから呼べるようにする．設定の`llm: fake | ollama`で，キーワードで分類する偽LLMとOllamaのモデルを切り替える．
- `promptfooconfig.yaml`は，分類のタスクを並べたスイートである．各タスクは`description`にタスクID，採点器`category`(`equals`アサーション)を持つ．採点器の`metric`は，名前と品質特性(QA4AIのQC番号)を`category (QC01-1)`の形で持つ．
- `evalstats summary <結果JSON>`は，promptfooの結果JSONを読み，タスクと採点器ごとの合否と，合格したタスクの数と割合を表示する．

### 使用例

```console
$ pnpm eval -o results/fake.json
$ pnpm evalstats summary results/fake.json
suite: support (provider: support-fake)
task         grader             result
refund-01    category (QC01-1)  pass
refund-02    category (QC01-1)  fail
refund-03    category (QC01-1)  fail
shipping-01  category (QC01-1)  pass
...
mixed-01     category (QC01-1)  fail
passed: 8/11 (0.73)
```

### モジュール

- `llm.ts`：`interface Llm { complete(request: LlmRequest): Promise<string> }`．LLMのポートである．
- `fakeLlm.ts`：`scriptedLlm(responses: string[]): Llm`，`keywordLlm(): Llm`．
- `ollamaLlm.ts`：`ollamaLlm(options: { client: OllamaClient; model: string }): Llm`．
- `support.ts`：`classifyInquiry(llm: Llm, inquiry: string): Promise<Category | "invalid">`．
- `supportProvider.ts`：promptfooのカスタムプロバイダ．
- `promptfooResult.ts`：`parseResultFile(text: string): EvalResult`．promptfooの結果JSONから，必要な部分だけをzodで検証して取り出す．
- `summary.ts`：`summarize(result: EvalResult): Summary`．
- `report.ts`：`formatSummary(summary: Summary): string`．
- `cli.ts`：`main(argv: string[], io: CliIo): Promise<number>`．

### 設計文書の更新

- `design/modules.md`：製品側(`support`，`llm`，プロバイダ)と分析側(`evalstats`)のモジュールと依存の矢印を初めて描く．promptfooと非決定的な`ollamaLlm`を外部として示す．
- `design/types.md`：`Category`，`EvalResult`，`TaskOutcome`，`Summary`を描く．
- `design/adr/0001-harness-and-quality-model.md`：実行と採点をpromptfooに任せ，集計を自作する判断と，各採点器に品質特性を1つ割り当てる判断を記録する．

### 学ぶこと

- 評価の用語と，promptfooでの呼び名との対応．
- QA4AIの品質特性QC01〜QC05と，ISO/IEC 25059の品質特性との対応．
- promptfooの構成(プロンプト，プロバイダ，テスト，アサーション，`metric`)と結果JSONの形．
- LLMをインタフェースの背後に置き，依存を注入する設計(QA4AIのProcess Agilityが求める，LLMを交換できる設計)．
- テストダブル，LLM出力の正規化，zodによる外部データの検証，Vitestの基本，型の除去でTypeScriptを実行するための約束．
- 振り返りで，Ollamaのモデルで2回評価し，結果が変わることを観察する．

### 既存テストへの影響

最初のIterationなので，既存のテストはない．

### 受講者のツール操作

- `pnpm install`で依存パッケージを入れ，演習パッケージをワークスペースに登録する．
- 単体テストだけ，統合テストだけを実行する．
- `pnpm eval`でpromptfooを実行し，`promptfoo view`で結果をブラウザで見る．
- `mise run ollama:pull`でモデルを取得し，プロバイダの設定を`ollama`に変えて実行する．

## Iteration 1：複数回試行する

### 要求

- `pnpm eval --repeat <n>`で，各タスクをn回試行する．
- 偽LLMは，プロバイダの設定`seed`と`noise`を受け取る．確率`noise`でキーワード分類と異なるカテゴリや，カテゴリでない文字列を返す．同じシードでは同じ結果になる．
- プロバイダは，出力のメタデータにLLMの種類，モデル名，プロンプトの版，シードを記録する．
- `evalstats summary`は，同じタスクの試行をまとめ，タスクと採点器ごとに合格数，試行数，合格率を表示する．
- タスクを3つに分類して表示する．全試行で合格なら`stable`，全試行で不合格なら`broken`，合否が揺れれば`flaky`である．
- 採点器ごとに，タスクごとの合格率の平均(pass@1)と，pass^kを表示する．`k`は`--k`で指定し，既定は3である．pass^kは，タスクごとの合格数と試行数から`C(合格数, k) / C(試行数, k)`で推定し，タスクについて平均する．

### 使用例

```console
$ pnpm eval --repeat 10 -o results/fake.json
$ pnpm evalstats summary results/fake.json
suite: support (provider: support-fake, trials: 10, seed: 1)
task          grader              pass   rate  status
refund-01     category (QC01-1)   9/10   0.90  flaky
shipping-01   category (QC01-1)  10/10   1.00  stable
mixed-01      category (QC01-1)   0/10   0.00  broken
...
grader              pass@1  pass^3  stable  flaky  broken
category (QC01-1)   0.79    0.55    3       4      1
```

### モジュール

- `random.ts`：`seededRandom(seed: number): Random`．`@stdlib/random-base-mt19937`を包む．
- `fakeLlm.ts`：`keywordLlm(options: { random: Random; noise: number }): Llm`に変える．
- `summary.ts`：次の関数を加え，`Summary`がタスクごとの集計と採点器ごとの集計を持つようにする．
  - `groupTrials(result: EvalResult): TaskTrials[]`
  - `passHatK(passes: number, trials: number, k: number): number`

### リファクタリング

`report.ts`にある合否の数え上げを`summary.ts`へ移し，`report.ts`は表示だけを受け持つようにする．

### 設計文書の更新

- `design/modules.md`：`random`を加える．
- `design/types.md`：`Trial`，`RunMetadata`，`TaskSummary`，`GraderSummary`，`Status`を加え，タスクが試行を複数持つ関係にする．
- `design/adr/0002-repeated-trials.md`：1回の採点をやめ，複数回の試行，pass@1とpass^k，`stable`/`flaky`/`broken`で報告する判断を記録する．温度を0にして揺れを消す案を採らない理由と，再現のために記録する項目も書く．

### 学ぶこと

- 非決定性の源(サンプリングと温度，推論基盤の非決定性，モデルの更新)と，温度0が解決にならない理由．
- pass@k(k回のうち1回でも成功する確率，能力を表す)とpass^k(k回すべて成功する確率，一貫性を表す)．顧客と直接やり取りする機能ではpass^kが重要になること．
- シード付き擬似乱数と，乱数を使うコードのテスト．並行に実行される試行で乱数の順序を保つ工夫．
- 再現のための記録(QA4AIのProcess Agilityが挙げる，乱数のシードや版の記録)．

### 既存テストへの影響

- 表示の列が変わるため，`report`の単体テストと統合テストの期待する出力が変わる．
- `keywordLlm`の引数が変わるため，偽LLMのテストを書き換える．

### 受講者のツール操作

- `pnpm --filter <パッケージ名> add <依存>`の形で，`@stdlib/random-base-mt19937`を依存に加える．

## Iteration 2：標準誤差と信頼区間を付ける

### 要求

- タスクごとの合格率に，二項分布に基づく95%信頼区間(Clopper-Pearson法)を表示する．
- 採点器ごとの全体の合格率は，タスクごとの合格率の平均とする．その標準誤差を，タスクごとの合格率の標本標準偏差を`√タスク数`で割って求め，平均±z×標準誤差を信頼区間とする．同じタスクの試行どうしは独立でないため，試行ではなくタスクを単位にする．
- `--target <合格率>`で目標を与えると，区間の下限が目標以上なら`met`，上限が目標未満なら`not met`，それ以外は`inconclusive`と表示する．
- `--confidence <水準>`で信頼水準を変えられる．既定は0.95である．

### 使用例

```console
$ pnpm evalstats summary results/fake.json --target 0.9
task          grader              pass   rate  95% CI         status
refund-01     category (QC01-1)   9/10   0.90  [0.55, 1.00]   flaky
shipping-01   category (QC01-1)  10/10   1.00  [0.69, 1.00]   stable
...
grader              mean   SE     95% CI          pass^3  target 0.90
category (QC01-1)   0.79   0.11   [0.57, 1.00]    0.55    inconclusive
```

### モジュール

- `stats.ts`
  - `binomialInterval(passes: number, trials: number, confidence: number): Interval`
  - `meanWithError(values: number[], confidence: number): Estimate`
  - `judgeTarget(interval: Interval, target: number): TargetVerdict`
- `summary.ts`：`TaskSummary`と`GraderSummary`に区間と推定値を持たせる．

### 設計文書の更新

- `design/modules.md`：`stats`と，それを使う`summary`への矢印を加える．
- `design/types.md`：`Interval`，`Estimate`，`TargetVerdict`を加える．
- `design/adr/0003-standard-errors.md`：タスクを単位にした標準誤差と，タスクごとのClopper-Pearson区間を選んだ判断を記録する．目標との比較で`inconclusive`を独立した結果として扱う理由も書く．

### 学ぶこと

- 中心極限定理と標準誤差．評価のスコアは，ありうるタスク全体からの標本の平均であること．
- 試行を平均してタスクごとの揺れを減らすことと，タスクを単位にしたクラスタ化．試行を独立に数えると標準誤差を過小に見積もること．
- 二項分布と信頼区間．10回中10回の合格が「100%」を意味しないこと．
- QA4AIのCustomer Expectation．目標とする合格率を先に決め，区間で判定すること．
- `simple-statistics`と`@stdlib/stats-binomial-test`の使い方．

### 既存テストへの影響

表示に区間の列と全体の推定値が加わるため，`report`の単体テストと統合テストの期待する出力が変わる．

### 受講者のツール操作

- `simple-statistics`と`@stdlib/stats-binomial-test`を依存に加える．
- 1つのテストファイルだけを実行する．

## Iteration 3：自由記述を3種類の採点器で評価する

### 要求

- 製品に`draftReply(llm, inquiry, policy)`を加える．返金と配送の方針をプロンプトに与えて，返信の下書きを書く．プロバイダは，テストの変数`task: classify | reply`で2つの機能を呼び分ける．
- 返信のタスクには，次の3種類の採点器を付ける．
  - `no-promise (QC02-2)`：promptfooの`not-icontains`で，方針にない約束(例：「全額返金します」)を含まなければ合格とする．
  - `judge:polite (QC01-4)`：自作のアサーション`judgeAssertion`が，1つの観点のルーブリックをJudge用のLLMに渡し，`{"reason": string, "verdict": "pass" | "fail" | "unknown"}`のJSONで判定させる．
  - `decision:answers (QC01-1)`：自作のアサーション`decisionAssertion`が，Ollamaの`/v1/systemone`に問い合わせ文と返信を状態として渡し，`noul`型の質問「返信は問い合わせに答えているか」の確率を受け取る．確率がしきい値(既定0.5)以上なら合格とし，確率をスコアとして記録する．
- Judgeが判断できないと答えたときは`unknown`，JSONが読めないときは`error`として，アサーションのメタデータに記録する．`evalstats summary`は，どちらも合格率の計算から除き，件数を表示する．
- `evalstats show <結果JSON> <タスクID>`は，そのタスクのトランスクリプト(出力，採点器ごとの判定，理由，確率)を表示する．

### 使用例

```console
$ pnpm evalstats summary results/fake.json
task          grader                     pass   rate  95% CI         status
refund-01     category (QC01-1)          9/10   0.90  [0.55, 1.00]   flaky
reply-01      no-promise (QC02-2)       10/10   1.00  [0.69, 1.00]   stable
reply-01      judge:polite (QC01-4)      8/9    0.89  [0.52, 1.00]   flaky
reply-01      decision:answers (QC01-1) 10/10   1.00  [0.69, 1.00]   stable
...
grader                     mean   SE     95% CI          pass^3  unknown  error
category (QC01-1)          0.79   0.11   [0.57, 1.00]    0.55    0        0
no-promise (QC02-2)        0.95   0.05   [0.85, 1.00]    0.85    0        0
judge:polite (QC01-4)      0.84   0.08   [0.68, 1.00]    0.60    1        0
decision:answers (QC01-1)  0.90   0.06   [0.78, 1.00]    0.75    0        0
```

### モジュール

- `support.ts`：`draftReply(llm: Llm, inquiry: string, policy: string): Promise<string>`を加える．
- `judge.ts`：`judge(llm: Llm, rubric: Rubric, output: string): Promise<JudgeVerdict>`．
- `judgeAssertion.ts`：promptfooのアサーションとして`judge`を呼ぶ．
- `decisionModel.ts`
  - `interface DecisionModel { noul(state: string, instructions: string): Promise<number> }`
  - `ollamaDecisionModel(options): DecisionModel`，`fakeDecisionModel(options): DecisionModel`
- `decisionAssertion.ts`：promptfooのアサーションとして意思決定モデルを呼ぶ．
- `fakeLlm.ts`：返信を書く偽LLMと，Judgeの偽LLMを加える．
- `promptfooResult.ts`，`summary.ts`：`unknown`と`error`を読み取り，集計から除く．
- `cli.ts`：`show`サブコマンドを加える．

### 設計文書の更新

- `design/modules.md`：Judgeと意思決定モデルの2つの外部と，それを呼ぶアサーションを加える．
- `design/types.md`：`Rubric`，`JudgeVerdict`，`GradeOutcome`(`pass`/`fail`/`unknown`/`error`)，`DecisionModel`を加える．
- `design/adr/0004-model-based-graders.md`：コードで判定できるものはコードで判定し，判定できない観点だけをモデルに任せる判断を記録する．LLM Judgeと意思決定モデルをどの観点に使い分けるか，ルーブリックを1観点にする理由，`unknown`を許す理由，しきい値の決め方も書く．

### 学ぶこと

- 採点器の分類(コード，LLM Judge，意思決定モデル，人)と，それぞれの長所と短所．
- ルーブリックの書き方(1観点ごとに独立したJudge，二値，判断できないときの逃げ道，理由を先に出力させる)．
- 構造化出力(OllamaのJSON出力とzodによる検証)と，TypeScriptの判別可能なユニオン型．
- 意思決定モデルの使い方(状態，型付きの質問，確率)と，確率をしきい値で合否に変えること．
- Judgeも非決定的であり，採点そのものが揺れること．
- トランスクリプトを読み，不合格がLLMの誤りか採点器の誤りかを見分けること．
- promptfooのカスタムアサーション．

### 既存テストへの影響

- 採点の結果が4値になるため，`promptfooResult`と`summary`のテストの期待値が変わる．
- 表示に`unknown`と`error`の列が加わるため，`report`の単体テストと統合テストの期待する出力が変わる．
- プロバイダが2つの機能を呼び分けるため，プロバイダのテストを書き換える．

### 受講者のツール操作

- Vitestをウォッチモードで動かし，保存のたびに単体テストを実行する．
- `mise run ollama:pull`で意思決定モデルを取得する．

## Iteration 4：モデル型の採点器を検証して補正する

### 要求

- 人手ラベルのスイート`labels.yaml`は，問い合わせ文，返信，人の判定(`human: pass | fail`)，分割(`split: dev | test`)を変数に持つタスクの集まりである．promptfooの`echo`プロバイダで返信をそのまま出力とし，`judge:polite`と`decision:answers`で採点する．
- `evalstats calibrate <結果JSON> [--split dev|test]`は，採点器ごとに人の判定と比べ，次のものを表示する．
  - 混同行列(`unknown`の列を含む)
  - TPR(人が合格としたものを採点器も合格とした割合)とTNR(人が不合格としたものを採点器も不合格とした割合)
  - 自己一貫性(全試行の判定がそろった項目の割合)
- 合格基準(TPR ≥ 0.80かつTNR ≥ 0.80)を満たすかを表示し，どれかの採点器が満たさなければ終了コード1を返す．`--out`で検証結果をJSONに保存する．
- 意思決定モデルについては，しきい値ごとのTPRとTNRを表示し，devでしきい値を選べるようにする．
- `evalstats summary --calibration <ファイル>`は，検証済みの採点器について，観測した合格率をRogan-Gladen法`(観測した合格率 + TNR − 1) / (TPR + TNR − 1)`で補正した値と，ブートストラップによる区間を併せて表示する．補正値は0から1の範囲に収める．

### 使用例

```console
$ pnpm eval -c labels.yaml --repeat 5 -o results/labels.json
$ pnpm evalstats calibrate results/labels.json --split dev
grader             items  split  TPR    TNR    self-consistency  verdict
judge:polite       20     dev    0.92   0.88   0.75              usable
decision:answers   20     dev    0.85   0.70   1.00              not usable (TNR < 0.80)

decision:answers thresholds
threshold  TPR    TNR
0.3        0.95   0.55
0.5        0.85   0.70
0.7        0.80   0.85
```

### モジュール

- `labels.ts`：結果JSONから人の判定と分割を取り出す．
- `agreement.ts`
  - `confusionMatrix(pairs: LabeledGrade[]): ConfusionMatrix`
  - `rates(matrix: ConfusionMatrix): GraderRates`
  - `selfConsistency(grades: GradeOutcome[][]): number`
  - `thresholdSweep(pairs: LabeledScore[], thresholds: number[]): ThresholdRates[]`
- `calibration.ts`：`calibrate(result: EvalResult, options): CalibrationResult`，`correctPassRate(observed: number, rates: GraderRates): number`．
- `stats.ts`：`bootstrapInterval(statistic: (random: Random) => number, options: { resamples: number; confidence: number; random: Random }): Interval`を加える．
- `cli.ts`：`calibrate`サブコマンドと`--calibration`を加える．

### 設計文書の更新

- `design/modules.md`：`labels`，`agreement`，`calibration`を加える．
- `design/types.md`：`ConfusionMatrix`，`GraderRates`，`CalibrationResult`を加える．
- `design/adr/0005-grader-validation.md`：モデル型の採点器を，使う前に人手ラベルで検証する判断を記録する．devで改善し，最後にtestを使って確かめる手順，合格基準の値，補正を表示に加える判断も書く．LLM Judgeと意思決定モデルの検証結果の比較も書く．

### 学ぶこと

- 評価器も測定器であり，測定誤差を持つこと．
- 人手ラベルの作り方と，dev/testに分けてルーブリックやしきい値の過学習を防ぐこと．
- 混同行列，TPRとTNR．一致率だけを見ると，合格が多いデータで誤る採点器を見逃すこと．
- 自己一貫性．LLM Judgeと意思決定モデルの揺れの違い．
- しきい値とTPR，TNRのトレードオフ．
- Rogan-Gladen補正と，その前提(TPR + TNR > 1)．

### 既存テストへの影響

`main`のサブコマンドの振り分けが変わるため，引数の誤りを確かめる統合テストの期待値が変わる．

### 受講者のツール操作

- promptfooで別のスイートファイルを指定して実行する．
- 人手ラベルに自分でラベルを数件加え，devで検証をやり直す．

## Iteration 5：比較して回帰を止める

### 要求

- `evalstats compare <基準> <対象>`は，2つの結果JSONを採点器ごとに比べる．
- タスクごとの合格率の差`対象 − 基準`を求め，その平均，標準誤差，信頼区間を表示する．あわせて，2つの実行のタスクごとの合格率の相関と，検出力80%で検出できる最小の差(MDE)を表示する．
- 差の区間の下限が0より大きければ`improved`，上限が0より小さければ`regressed`，それ以外は`inconclusive`と判定する．
- `--margin <m>`で非劣性マージンを指定する．どれかの採点器で差の区間の下限が`-m`より小さければ，ゲートを不合格とし終了コード1を返す．
- タスクの集合や採点器の設定(Judgeのモデル，ルーブリック，しきい値)が2つの結果で異なるときは，比較せずにエラーとする．

### 使用例

```console
$ pnpm evalstats compare results/baseline.json results/head.json --margin 0.05
grader                  base   head   diff    SE     95% CI           corr   MDE(80%)  verdict
category (QC01-1)       0.79   0.86   +0.07   0.03   [+0.01, +0.13]   0.62   0.08      improved
judge:polite (QC01-4)   0.88   0.84   -0.04   0.04   [-0.12, +0.04]   0.48   0.11      inconclusive
gate: FAIL (judge:polite: lower bound -0.12 < -0.05)
```

### モジュール

- `compare.ts`：`compareRuns(base: EvalResult, head: EvalResult, options): Comparison`，`gate(comparison: Comparison, margin: number): GateResult`．
- `stats.ts`：次の関数を加える．
  - `pairedDifference(base: number[], head: number[], confidence: number): PairedEstimate`
  - `minimumDetectableEffect(standardError: number, options: { confidence: number; power: number }): number`
- `cli.ts`：`compare`サブコマンドを加える．

### 設計文書の更新

- `design/modules.md`：`compare`を加える．
- `design/types.md`：`Comparison`，`PairedEstimate`，`Verdict`，`GateResult`を加える．
- `design/adr/0006-regression-gate.md`：対応のある差，非劣性マージン，`inconclusive`をゲートでどう扱うか，比較できない結果を拒む判断を記録する．

### 学ぶこと

- 同じタスクで2つの版を比べる対応のある差．相関が高いほど差の標準誤差が小さくなること．
- 検出力と最小検出差．小さな改善を主張するために必要なタスク数と試行回数．
- 非劣性マージンと，「差がない」と「差を検出できない」の違い．
- 能力評価と回帰評価．合格率が高くなった能力評価のタスクを回帰評価のスイートへ移すこと．
- 終了コードによるCIへの組み込みと，基準となる結果の管理．

### 既存テストへの影響

既存の出力は変わらない．`main`に`compare`サブコマンドが加わる．

### 受講者のツール操作

- パッケージの`package.json`に，基準と対象を比べる`eval:gate`スクリプトを加える．
- プロンプトの版を変えて評価し，基準と比べる．
