# Iteration 5 演習：比較して回帰を止める

これまでのIterationでは，1つの版の評価を読んできた．
このIterationでは，プロンプトやモデルを変えた版(対象)を，前の版(基準)と比べる．
同じタスクの合格率を対にした差の区間で，改善，悪化，判断できないのどれかを判定する．許せる悪化の幅(非劣性マージン)を超えた変更は，CIで止める．
作業は，すべてこのパッケージ(`iterations/iteration-5/exercise`)のディレクトリで行う．

## 5-1 準備

リポジトリのルートで`pnpm install`を実行する．
このパッケージのコード，テスト，設計文書は，Iteration 4の解答と同じである．テストがすべて通ることを確かめる．

```console
$ cd iterations/iteration-5/exercise
$ pnpm test
...
      Tests  186 passed (186)
```

## 5-2 構文と概念

[Iteration 5のノート](../../../../docs/notes/iteration-5.md)を読む．
読み終えたら，`node`で次を計算する．

1. 標準誤差が0.14と0.13の2つの評価を，独立とみなして比べたときの，差の標準誤差．
2. 標準正規分布の80%点(検出力80%の`z`)．
3. 対応のある差の標準誤差が0.03のときに，95%区間と検出力80%で求めた最小検出差．
4. `simple-statistics`の`sampleCorrelation`で，次の2つの並びの相関．Iteration 2のqwen2.5:0.5bの2回の評価の，タスクごとの合格率である．

   ```text
   [1, 1, 0.5, 0, 0.5, 1, 1, 0.1, 0, 0, 1]
   [1, 1, 0.7, 0.1, 0.6, 1, 1, 0.4, 0, 0, 1]
   ```

## 5-3 テストリスト

次の要求と使用例から，`TESTLIST.md`を書く．期待値が変わる既存のテストも探す．

### 要求

#### 対応のある差

- `pairedDifference(base, head, confidence)`は，対にした値の差(`head - base`)の平均，標準誤差(差の標本標準偏差を対の数の平方根で割ったもの)，平均±`z`×標準誤差の区間，基準と対象の相関を返す．区間は0から1の範囲に収めない(差は負にもなる)．
- どちらかの値がすべて同じなら，相関は`undefined`にする．
- 対の数が2より少ないか，`base`と`head`の数が違えばエラーにする．
- `minimumDetectableEffect(standardError, { confidence, power })`は，`(z(1 - α/2) + z(power)) × standardError`を返す．

#### 結果JSONの読み取り

- 採点器ごとの設定(アサーションの種類`type`，値`value`，設定`config`)を，比べられる文字列として`EvalResult.graderSettings`に残す．

#### 比較とゲート

- `compareRuns(base, head, { confidence })`は，両方の結果にある採点器について，タスクごとの合格率を対にして比べる．採点器ごとに，対にしたタスクの数，基準と対象の合格率(タスクごとの合格率の平均)，差の推定，検出力80%の最小検出差，判定を返す．
- 判定は，差の区間の下限が0より大きければ`improved`，上限が0より小さければ`regressed`，それ以外は`inconclusive`である．
- どちらかの結果で判定できた試行のないタスクは，対から除く．
- 採点器の設定が違えば`grader settings differ for <採点器>`，タスクの集合が違えば`task sets differ for <採点器>`のエラーにする．
- `gate(comparison, margin)`は，差の区間の下限が`-margin`より小さい採点器があれば不合格にし，その採点器と下限を返す．

#### CLI

- `evalstats compare <基準> <対象> [--margin <マージン>] [--confidence <水準>]`は，比較の表を表示する．
- `--margin`を与えると，最後の行にゲートの結果を表示し，不合格なら終了コード1を返す．`--margin`は0以上1未満の数である．
- 比べられない結果なら，理由を表示して終了コード1を返す．
- `package.json`に，`results/baseline.json`と`results/head.json`をマージン0.05で比べる`eval:gate`スクリプトを加える．

### 使用例

基準を評価してから，`promptfooconfig.yaml`のプロバイダの`noise`を0.3に変えて対象を評価する．

```console
$ pnpm eval --repeat 10 -o results/baseline.json
$ pnpm eval --repeat 10 -o results/head.json
$ pnpm eval:gate
grader                     tasks  base  head  diff   SE    95% CI          corr  MDE(80%)  verdict
category (QC01-1)          11     0.65  0.54  -0.12  0.05  [-0.21, -0.02]  0.95  0.14      regressed
no-promise (QC02-2)        4      1.00  0.95  -0.05  0.03  [-0.11, +0.01]  -     0.08      inconclusive
judge:polite (QC01-4)      4      0.89  0.79  -0.10  0.04  [-0.18, -0.02]  0.75  0.11      regressed
decision:answers (QC01-1)  4      0.95  0.88  -0.07  0.02  [-0.12, -0.03]  0.58  0.07      regressed
gate: FAIL (margin 0.05; category (QC01-1): lower bound -0.21 < -0.05; no-promise (QC02-2): lower bound -0.11 < -0.05; judge:polite (QC01-4): lower bound -0.18 < -0.05; decision:answers (QC01-1): lower bound -0.12 < -0.05)
$ echo $?
1
```

ゲートに合格したときは，最後の行が`gate: PASS (margin 0.05)`になる．

### 作るもの

| モジュール | 公開するもの |
| --- | --- |
| `stats.ts` | `PairedEstimate`，`pairedDifference`，`minimumDetectableEffect` |
| `promptfooResult.ts` | `EvalResult.graderSettings` |
| `compare.ts`(新規) | `Verdict`，`GraderComparison`，`Comparison`，`GateResult`，`compareRuns`，`gate` |
| `report.ts` | `formatComparison(comparison, confidence, gate?)` |
| `cli.ts` | `compare`サブコマンド，`--margin` |

### 考えること

- 2つの評価のpass@1の区間が重なっているかどうかで，差を判断してよいか．
- `inconclusive`は「差がない」という意味か．
- ゲートを「`regressed`なら落とす」にせず，マージンを使うのはなぜか．
- Judgeのモデルを変えた結果と，変える前の結果を比べたら，何が分かるか．

## 5-4 設計文書

- `design/modules.md`：`compare`を加える．`compare`がどのモジュールの関数で比較を組み立てるかが分かるように描く．
- `design/types.md`：比較の型(`Comparison`，`GraderComparison`，`PairedEstimate`，`Verdict`，`GateResult`)を，3つめの図として描く．`EvalResult`に`graderSettings`を加える．
- `design/adr/0006-regression-gate.md`：対応のある差で比べる判断，非劣性マージン，`inconclusive`をゲートでどう扱うか，比べられない結果を拒む判断を書く．

## 5-5 テスト駆動の実装

### 対応のある差

- `pairedDifference`のテストでは，差が`[0.1, 0.2, 0, 0.3]`のように手で計算できる値を使う．
- 相関は`simple-statistics`の`sampleCorrelation`で，`z`は`@stdlib/stats-base-dists-normal-quantile`で求める．

### 比較

- タスクごとの合格率は，`summarize`の`tasks`から取り出せる．判定できた試行のないタスクは`rate`が`undefined`である．
- テストでは，2つの`EvalResult`を，試行の結果だけが違うように作る．

### CLI

- 統合テストでは，`promptfooconfig.yaml`の一部を書き換えた設定ファイルで評価する．設定ファイルの`file://`のパスは設定ファイルからの相対パスで解決されるため，書き換えた設定ファイルはパッケージの中に一時的に置き，評価のあとで消す．
- 基準，揺れを増やした版，シードだけを変えた版の3つの評価は，`Promise.all`で並行に進める．`vitest.config.ts`の`hookTimeout`は120秒にしてあり，`beforeAll`でpromptfooを何回か動かしても間に合う．

### Ollamaで比べる

Iteration 2のOllamaの結果JSON(同じ設定の2回の評価と，モデルを変えた評価)があれば，それを比べる．
なければ，`llm: ollama`にして，同じ設定で2回と，`model`を変えて1回評価する．
時間がかかるときは，`qwen2.5:0.5b`と`qwen2.5:3b`を使い，分類のタスクだけを評価する．

## 5-6 振り返り

1. 自分の`TESTLIST.md`と，解答の`TESTLIST.md`を見比べる．
2. シードだけを変えた同じ設定どうし(A/A)を，マージン0.05で比べる．差の区間は0をまたぐか．ゲートは通るか．通らないなら，なぜか．
3. Ollamaの同じ設定の2回の評価を比べる．判定は何になったか．その判定をそのまま信じてよいか．
4. Ollamaのモデルを変えた評価と比べる．相関と差の標準誤差は，同じ設定どうしの比較と比べてどうか．
5. 設計文書と実装を見比べ，食い違うところがあれば設計文書を直す．

## 5-7 発展

GitHub ActionsなどのCIで，基準の結果JSONを成果物から取り出し，`pnpm eval`と`pnpm eval:gate`を動かすワークフローを書く．
偽LLMを使えばOllamaなしで動き，ゲートの判定も毎回同じになる．
