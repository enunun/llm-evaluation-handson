# Iteration 2 演習：標準誤差と信頼区間を付ける

Iteration 1の振り返りでは，同じ設定で110回ずつ試行した2回の評価で，pass@1が0.55と0.62になった．
このIterationでは，合格率がどこまで動きうるかを，タスクごとの信頼区間と，採点器ごとの標準誤差と信頼区間で示す．
目標の合格率を与えると，区間と比べて`met`，`not met`，`inconclusive`を判定する．
作業は，すべてこのパッケージ(`iterations/iteration-2/exercise`)のディレクトリで行う．

## 2-1 準備

リポジトリのルートで`pnpm install`を実行する．
このパッケージのコード，テスト，設計文書は，Iteration 1の解答と同じである．テストがすべて通ることを確かめる．

```console
$ cd iterations/iteration-2/exercise
$ pnpm test
...
      Tests  69 passed (69)
```

各タスクを10回ずつ評価し，今の`evalstats`で表示する．

```console
$ pnpm eval --repeat 10 -o results/fake.json
$ pnpm evalstats summary results/fake.json
suite: support (provider: support-fake, model: keyword, prompt: classify-v1, trials: 10, seed: 1)
task         grader             pass   rate  status
refund-01    category (QC01-1)  8/10   0.80  flaky
...

grader             pass@1  pass^3  stable  flaky  broken
category (QC01-1)  0.65    0.53    3       5      3
```

## 2-2 構文と概念

[Iteration 2のノート](../../../../docs/notes/iteration-2.md)を読む．
2-5の最初に依存を加えたら，このディレクトリで`node`を起動し，次を試す．

1. 合格率0.55，試行110回を独立とみなした標準誤差`√(p(1 - p) / n)`を計算する．
2. タスクごとの合格率`[1, 1, 0.5, 0, 0.5, 1, 1, 0.1, 0, 0, 1]`から，平均の標準誤差を`simple-statistics`で計算し，1と比べる．
3. `@stdlib/stats-binomial-test`で，10回中10回，10回中7回，100回中70回の合格の95%信頼区間を求める．
4. `@stdlib/stats-base-dists-normal-quantile`で，標準正規分布の97.5%点を求める．

## 2-3 テストリスト

次の要求と使用例から，`TESTLIST.md`を書く．期待値が変わる既存のテストも探す．

### 要求

- 統計のモジュール`stats`を作る．
  - `binomialInterval(passes, trials, confidence)`は，合格する確率の信頼区間をClopper-Pearson法で返す．試行が0回ならエラーにする．
  - `meanWithError(values, confidence)`は，値の平均，標準誤差(標本標準偏差を値の数の平方根で割ったもの)，平均±z×標準誤差の信頼区間を返す．区間は0から1の範囲に収める．値が2つより少なければエラーにする．
  - `judgeTarget(interval, target)`は，区間の下限が目標以上なら`"met"`，上限が目標未満なら`"not met"`，それ以外は`"inconclusive"`を返す．
- `summarize(result, { k, confidence, target })`は，次のものを加える．`confidence`の既定は0.95である．
  - タスクごとの合格率の信頼区間．
  - 採点器ごとの，タスクごとの合格率の平均の標準誤差と信頼区間．タスクが1つしかなければ求めない．
  - `target`を与えたときは，採点器ごとの区間と目標の比較．
- `evalstats summary`の表示を変える．
  - タスクの表に，信頼区間の列(`95% CI`)を加える．列の名前は信頼水準に合わせる(`90% CI`など)．
  - 採点器の表に，標準誤差(`SE`)と信頼区間の列を加える．求めていなければ`-`と表示する．
  - `--target <合格率>`を与えたときは，採点器の表の最後に`target 0.90`の列を加える．
  - `--confidence <水準>`で信頼水準を変える．`--confidence`と`--target`が0と1の間(両端を含まない)の数でなければ，使い方を表示して終了コード2を返す．

### 使用例

```console
$ pnpm evalstats summary results/fake.json --target 0.9
suite: support (provider: support-fake, model: keyword, prompt: classify-v1, trials: 10, seed: 1)
task         grader             pass   rate  95% CI        status
refund-01    category (QC01-1)  8/10   0.80  [0.44, 0.97]  flaky
refund-02    category (QC01-1)  0/10   0.00  [0.00, 0.31]  broken
...
shipping-01  category (QC01-1)  10/10  1.00  [0.69, 1.00]  stable
...

grader             pass@1  SE    95% CI        pass^3  stable  flaky  broken  target 0.90
category (QC01-1)  0.65    0.13  [0.40, 0.91]  0.53    3       5      3       inconclusive
```

### 作るもの

| モジュール | 公開するもの |
| --- | --- |
| `stats.ts`(新規) | `Interval`，`Estimate`，`TargetVerdict`，`binomialInterval`，`meanWithError`，`judgeTarget` |
| `summary.ts` | `TaskSummary.interval`，`GraderSummary.estimate`と`targetVerdict`，`Summary.confidence`と`target`，`SummaryOptions` |
| `report.ts` | 表示を変える |
| `cli.ts` | `--confidence`，`--target`を受け付ける |

### 考えること

- タスクごとの区間に正規近似ではなくClopper-Pearson法を使うのはなぜか．10回中10回の合格で考える．
- 採点器ごとの標準誤差を，試行の数ではなくタスクの数から求めるのはなぜか．
- `inconclusive`のとき，評価をどう変えれば決着に近づくか．

## 2-4 設計文書

- `design/modules.md`：`stats`と，それが使う外部のライブラリを加える．どのモジュールが`stats`をimportするかを考える．
- `design/types.md`：`Interval`，`Estimate`，`TargetVerdict`を加え，集計の型との関係を描く．
- `design/adr/0003-standard-errors.md`：タスクを単位にした標準誤差，タスクごとのClopper-Pearson区間，目標を区間で比べる判断を書く．

## 2-5 テスト駆動の実装

最初に依存を加える．

```console
pnpm add simple-statistics @stdlib/stats-binomial-test @stdlib/stats-base-dists-normal-quantile
```

### stats

- `binomialTest(passes, trials, { alpha: 1 - confidence }).ci`が`[下限, 上限]`の配列を返す．
- 期待値は，ノートのREPLで求めた値を`toBeCloseTo(値, 4)`で比べる．
- 正規分布の分位点は`quantile(1 - (1 - confidence) / 2, 0, 1)`で求める．
- 区間を0から1の範囲に収めるテストには，`[0, 1, 1, 1]`のように上限が1を超える値を使う．

### summary

- タスクごとの区間は`summarizeTask`で，採点器ごとの標準誤差は`summarizeGrader`で求める．
- `exactOptionalPropertyTypes`が有効なため，`target`がないときはプロパティそのものを持たせない(`target: undefined`を入れない)．

### report，cli

- 区間は`[0.44, 0.97]`の形で表示する．
- 目標の列は，`--target`を与えたときだけ加える．

### 統合テスト

期待する表示を書き換え，`--confidence`と`--target`の統合テストを加える．

### Ollamaで評価する

Iteration 1で保存したOllamaの結果JSONを`results/`にコピーし，このIterationの`evalstats`で表示し直す．
保存していなければ，`llm: ollama`で`--repeat 10`の評価を2回行う．

## 2-6 振り返り

1. 自分の`TESTLIST.md`と，解答の`TESTLIST.md`を見比べる．
2. Ollamaの2回の評価の採点器ごとの区間を比べる．2つの区間は重なっているか．Iteration 1で見たpass@1の違い(0.55と0.62)は，区間の幅と比べて大きいか．
3. Ollamaの評価で，`--target 0.9`の判定は何になったか．`inconclusive`だった場合，タスクと試行のどちらを増やすと区間が狭くなりやすいか．タスクごとの区間と採点器ごとの区間を見比べて考える．
4. 試行を独立とみなした標準誤差と，タスクを単位にした標準誤差を，Ollamaの評価で比べる．
5. 設計文書と実装を見比べ，食い違うところがあれば設計文書を直す．

## 2-7 発展

目標を満たすかを判定するのに必要なタスク数を見積もる`evalstats plan --sd <タスクごとの合格率の標準偏差> --margin <区間の半分の幅>`を加える．
必要なタスク数は`(z × sd / margin)^2`を切り上げた数である．
これまでと同じく，テストリスト，設計文書，実装の順に進める．
