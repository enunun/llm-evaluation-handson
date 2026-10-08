# Iteration 2 解説：標準誤差と信頼区間を付ける

演習の各手順について，模範解答とその考え方を説明する．
見出しの番号は，演習の`docs/iteration-2.md`と対応する．

## 2-1 準備

Iteration 1の`evalstats`は，合格率を1つの数で示す．
`refund-01`の0.80と`account-02`の0.90は，10回の試行では区別できるのか．採点器の0.65は，評価し直すとどこまで動くのか．
この表示からは，それが分からない．

## 2-2 構文と概念

```text
> Math.sqrt(0.55 * 0.45 / 110)
0.047434164902525694
> await import("simple-statistics").then(({ sampleStandardDeviation }) => sampleStandardDeviation([1, 1, 0.5, 0, 0.5, 1, 1, 0.1, 0, 0, 1]) / Math.sqrt(11))
0.1390641685525305
> await import("@stdlib/stats-binomial-test").then(({ default: test }) => test(10, 10).ci)
[ 0.6915028921812392, 1 ]
> await import("@stdlib/stats-binomial-test").then(({ default: test }) => test(7, 10).ci)
[ 0.3475471499400027, 0.9332604888222655 ]
> await import("@stdlib/stats-binomial-test").then(({ default: test }) => test(70, 100).ci)
[ 0.6001853238201958, 0.7875935795104633 ]
> await import("@stdlib/stats-base-dists-normal-quantile").then(({ default: q }) => q(0.975, 0, 1))
1.9599639845400538
```

タスクを単位にした標準誤差(0.14)は，試行を独立とみなした標準誤差(0.047)の約3倍である．

## 2-3 テストリスト

模範解答は[TESTLIST.md](../TESTLIST.md)である．考え方を補足する．

- `stats`のテストの期待値は，REPLで求めた値をそのまま使った．ライブラリを使う関数のテストでも，自分が渡す引数(`alpha`は`1 - confidence`)と，戻り値の受け取り方を確かめる価値がある．
- 区間の性質(信頼水準を下げると狭い，試行を増やすと狭い)のテストは，具体的な値に頼らず区間の意味を確かめる．
- 正規近似ではなくClopper-Pearson法を使うのは，10回中10回の合格で正規近似の区間が`[1, 1]`になり，「100%で確実」と言ってしまうからである．
- 標準誤差をタスクの数から求めるのは，同じタスクの試行が独立でないからである．`meanWithError`は，`summary`がタスクごとの合格率を渡す前提で作る．
- `inconclusive`のときは，区間を狭くすれば決着に近づく．採点器の区間の幅は主にタスクどうしの違いから来るため，タスクを増やすほうが効く．

## 2-4 設計文書

- modules.md：`stats`と外部の3つのライブラリを加えた．`summary`は区間と標準誤差を求めるため，`report`は`Interval`の型を使うため，`stats`をimportする．
- types.md：`Interval`，`Estimate`，`TargetVerdict`を加え，`TaskSummary`が`Interval`を，`GraderSummary`が`Estimate`を持つ関係を描いた．
- adr/0003：タスクを単位にした標準誤差，タスクごとのClopper-Pearson区間，目標を区間で比べる判断と，`inconclusive`を独立した結果にする理由を書いた．

## 2-5 テスト駆動の実装

### stats

**`binomialInterval`**は，`binomialTest(passes, trials, { alpha: 1 - confidence }).ci`を分割代入するだけで，最初の5つのテストが通る．
試行0回のテストで，`RangeError`を投げる行を加えた．

**`meanWithError`**は，平均と標準誤差の2つのテストを`simple-statistics`の`mean`と`sampleStandardDeviation`で通した．
区間のテストでは，最初に`simple-statistics`の`probit`で`z`を求めたところ，次のように失敗した．

```text
 FAIL  |unit| test/unit/stats.test.ts > meanWithError > 区間は，平均±z×標準誤差である
AssertionError: expected 0.42009919872404544 to be close to 0.41998480476292854, received difference is 0.0001143939611168987, but expected 5e-7
```

`probit(0.975)`は1.9572で，正しい値1.9600から外れている．近似式による誤差である．
`@stdlib/stats-base-dists-normal-quantile`に替えて通した．
区間を0から1に収めるテストで`Math.max`と`Math.min`を加え，値が2つ未満のテストでエラーを加えた．

**`judgeTarget`**は，下限，上限の順に比べる2つの`if`で書いた．

### summary

**タスクの区間**のテストで，`summarizeTask`に信頼水準を渡し，`binomialInterval`を呼ぶようにした．
**採点器の標準誤差**のテストを通すため，`summarizeGrader`はタスクごとの合格率を`meanWithError`に渡す．
**タスクが1つ**のテストで，`rates.length >= 2`のときだけ求めるようにした．
**目標**の2つのテストで，`target`を受け取り，区間があるときだけ`targetVerdict`を持たせた．
`exactOptionalPropertyTypes`が有効なため，`target`がないときはスプレッド構文`...(target === undefined ? {} : { target })`でプロパティごと省いた．

### report

区間は`formatInterval`で`[0.44, 0.97]`の形にした．
列の名前`95% CI`は，`Math.round(confidence * 100)`から作る．
目標の列は，`summary.target`があるときだけヘッダと各行に加える．

### cli

`--confidence`と`--target`を`parseArgs`に加え，どちらも0と1の間(両端を含まない)の数かを`isProbability`で確かめた．

### 統合テスト

```console
$ pnpm evalstats summary results/fake.json --target 0.9
$ node src/cli.ts summary results/fake.json --target 0.9
suite: support (provider: support-fake, model: keyword, prompt: classify-v1, trials: 10, seed: 1)
task         grader             pass   rate  95% CI        status
refund-01    category (QC01-1)  8/10   0.80  [0.44, 0.97]  flaky
refund-02    category (QC01-1)  0/10   0.00  [0.00, 0.31]  broken
refund-03    category (QC01-1)  0/10   0.00  [0.00, 0.31]  broken
shipping-01  category (QC01-1)  10/10  1.00  [0.69, 1.00]  stable
shipping-02  category (QC01-1)  8/10   0.80  [0.44, 0.97]  flaky
account-01   category (QC01-1)  10/10  1.00  [0.69, 1.00]  stable
account-02   category (QC01-1)  9/10   0.90  [0.55, 1.00]  flaky
other-01     category (QC01-1)  8/10   0.80  [0.44, 0.97]  flaky
other-02     category (QC01-1)  10/10  1.00  [0.69, 1.00]  stable
other-03     category (QC01-1)  9/10   0.90  [0.55, 1.00]  flaky
mixed-01     category (QC01-1)  0/10   0.00  [0.00, 0.31]  broken

grader             pass@1  SE    95% CI        pass^3  stable  flaky  broken  target 0.90
category (QC01-1)  0.65    0.13  [0.40, 0.91]  0.53    3       5      3       inconclusive
```

`refund-01`(8/10)と`account-02`(9/10)の区間は大きく重なり，10回の試行では2つのタスクの合格率の違いを言えない．
採点器の区間は目標0.90をまたぐため`inconclusive`である．

## 2-6 振り返り

1. 解答の`TESTLIST.md`には，区間の性質(狭くなる条件)を確かめる項目を入れた．具体的な値のテストと組み合わせると，計算の誤りと意味の誤りの両方を捕まえられる．
2. 作成時の環境(Ollama 0.35.1，qwen2.5:0.5b，CPU)で，Iteration 1の2回の評価を表示し直した．1回目の全体は次のとおりである．

   ```text
   suite: support (provider: support-ollama, model: qwen2.5:0.5b, prompt: classify-v1, trials: 10)
   task         grader             pass   rate  95% CI        status
   refund-01    category (QC01-1)  10/10  1.00  [0.69, 1.00]  stable
   refund-02    category (QC01-1)  10/10  1.00  [0.69, 1.00]  stable
   refund-03    category (QC01-1)  5/10   0.50  [0.19, 0.81]  flaky
   shipping-01  category (QC01-1)  0/10   0.00  [0.00, 0.31]  broken
   shipping-02  category (QC01-1)  5/10   0.50  [0.19, 0.81]  flaky
   account-01   category (QC01-1)  10/10  1.00  [0.69, 1.00]  stable
   account-02   category (QC01-1)  10/10  1.00  [0.69, 1.00]  stable
   other-01     category (QC01-1)  1/10   0.10  [0.00, 0.45]  flaky
   other-02     category (QC01-1)  0/10   0.00  [0.00, 0.31]  broken
   other-03     category (QC01-1)  0/10   0.00  [0.00, 0.31]  broken
   mixed-01     category (QC01-1)  10/10  1.00  [0.69, 1.00]  stable

   grader             pass@1  SE    95% CI        pass^3  stable  flaky  broken  target 0.90
   category (QC01-1)  0.55    0.14  [0.28, 0.83]  0.47    5       3      3       not met
   ```

   2回目の採点器の行は`0.62    0.13  [0.37, 0.87]  0.50    5       4      2       not met`だった．
   2つの区間は大きく重なり，pass@1の違い(0.07)は区間の幅(約0.5)よりずっと小さい．Iteration 1で見た違いは，評価の揺れの範囲に収まる．
3. どちらの評価も，区間の上限が0.90に届かず`not met`だった．小さなモデルでは目標を満たさないと言える．区間の幅の大部分は，`stable`のタスクと`broken`のタスクが混ざっていることから来ている．試行を増やしてもタスクごとの合格率はほぼ変わらないため，区間を狭くするにはタスクを増やす必要がある．
4. 試行を独立とみなした標準誤差は0.047，タスクを単位にした標準誤差は0.14である．独立とみなすと，区間を3分の1の幅に見誤る．
5. 実装しながら`formatInterval`と`isProbability`を加えた．どちらもモジュールの中の関数で，依存の矢印は変わらない．

## 2-7 発展

`plan`は統計の計算と表示だけなので，`stats`に`requiredTasks(sd, margin, confidence)`を加え，`cli`にサブコマンドを加える．
テストリストには，`requiredTasks`の単体テスト(例：`sd = 0.4`，`margin = 0.1`，95%なら62)と，`plan`の統合テストを加える．
