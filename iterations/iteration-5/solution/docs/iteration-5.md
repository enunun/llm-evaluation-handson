# Iteration 5 解説：比較して回帰を止める

演習の各手順について，模範解答とその考え方を説明する．
見出しの番号は，演習の`docs/iteration-5.md`と対応する．

## 5-1 準備

Iteration 4の解答のテストがすべて通ることを確かめた．

## 5-2 構文と概念

```text
> Math.sqrt(0.14 ** 2 + 0.13 ** 2)
0.19104973174542803
> await import("@stdlib/stats-base-dists-normal-quantile").then(({ default: q }) => q(0.8, 0, 1))
0.8416212335729144
> (1.96 + 0.84) * 0.03
0.08399999999999999
> await import("simple-statistics").then(({ sampleCorrelation }) => sampleCorrelation([1, 1, 0.5, 0, 0.5, 1, 1, 0.1, 0, 0, 1], [1, 1, 0.7, 0.1, 0.6, 1, 1, 0.4, 0, 0, 1]))
0.9762983664744722
```

独立とみなした差の標準誤差は0.19，対応のある差の標準誤差0.03での最小検出差は約0.08である．
2回の評価のタスクごとの合格率の相関は0.98と高い．同じタスクが2回とも易しく，同じタスクが2回とも難しいからである．

## 5-3 テストリスト

模範解答は[TESTLIST.md](../TESTLIST.md)である．考え方を補足する．

- 2つの評価のpass@1の区間が重なっていても，差の区間は0を含まないことがある．別々の区間を比べる方法は，同じタスクを使っていることを活かせない．差は差として区間を求める．
- `inconclusive`は「この評価では差を検出できない」であり，「差がない」ではない．差の区間と最小検出差を一緒に表示し，評価の大きさが足りているかを読めるようにした．
- 「`regressed`なら落とす」ゲートは，区間が広いほど通りやすい．評価を小さくするほどゲートが甘くなるのは逆である．マージンを使い，「下限が`-m`以上」を確かめる．
- Judgeのモデルを変えた結果どうしを比べると，製品の差と採点器の差が混ざる．そこで`graderSettings`を比べ，違えばエラーにした．
- `pairedDifference`の区間は，`meanWithError`と違い0から1の範囲に収めない．差は-1から1の値をとるからである．

## 5-4 設計文書

- modules.md：`compare`を加えた．`compare`は，`summary`でタスクごとの合格率を求め，`stats`の`pairedDifference`と`minimumDetectableEffect`で比べる．`report`は`compare`の型を表示する．
- types.md：比較の型を3つめの図に分けた．`EvalResult`に`graderSettings`を加えた．
- adr/0006：対応のある差，判定の3つの値，非劣性のゲート，比べられない結果を拒む判断を書いた．`inconclusive`でも下限が`-m`以上ならゲートを通すこと，A/A比較でも約20回に1回は`improved`か`regressed`が出ることも影響に書いた．

## 5-5 テスト駆動の実装

### 対応のある差

`pairedDifference`は，最初に`meanWithError`と同じように区間を0から1に収めて書くと，次のように失敗する．

```text
 FAIL  |unit| test/unit/stats.test.ts > pairedDifference > 区間は平均±z×標準誤差であり，負の値もとる
AssertionError: expected 0 to be less than 0
```

区間を収める処理を外した．
相関は，どちらかの値がすべて同じだと`sampleCorrelation`が`NaN`を返すため，その場合は`undefined`にした．
`minimumDetectableEffect`は式どおりに書いた．

### promptfooResult

採点器の設定は，アサーションの`type`，`value`，`config`を`JSON.stringify`した文字列にした．
文字列にしておくと，2つの結果の設定が同じかを`!==`で比べられる．
promptfooの結果JSONでは，`value`の`{{expected}}`のような変数はテストごとに展開されないまま残るため，同じ採点器なら同じ文字列になる．

### compare

`compareRuns`は，`summarize`の`tasks`から，採点器ごと，タスクごとの合格率の表を作り，両方にあるタスクを対にする．
タスクの集合は，判定できた試行の有無に関係なく，試行のあるタスクで比べる．`unknown`や`error`だけになったタスクがあるだけでは，比べられない結果にはしない．
`gate`は，下限が`-margin`より小さい採点器を集めるだけである．

### report，cli

`formatComparison`は，差に符号を付けて表示する．`+0.06`と`-0.12`のように符号があると，増えたか減ったかを読み違えない．
相関が求まらない採点器は`-`と表示した．
`cli`の`compare`は，`--margin`がなければ表だけを表示して終了コード0を返し，あればゲートの行を加え，不合格なら終了コード1を返す．

### 統合テスト

統合テストでは，基準，偽LLMの`noise`を0.3にした版，シードを2にした版の3つを`Promise.all`で並行に評価した．
書き換えた設定ファイルを一時ディレクトリに置くと，`file://src/supportProvider.ts`がそのディレクトリからの相対パスになり，promptfooがプロバイダを見つけられない．そこで，パッケージの中に`.noisier.tmp.yaml`のような名前で書き，評価が終われば`rm`で消した．
`noise: 0.1`はプロバイダとJudgeの両方にあるため，正規表現にインデントの数まで書いて書き換える行を選んだ．Judgeの`noise`を変えた設定は，採点器の設定が違う結果として，比べられないことを確かめるのに使った．

3つの評価を並行にしても，`beforeAll`はVitestの既定の制限時間(10秒)を超える．`vitest.config.ts`では`hookTimeout`を120秒にしてある．

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
```

`head.json`は，`promptfooconfig.yaml`のプロバイダの`noise`を0.3にして評価した．
`no-promise`は，基準の合格率が1.00で値がすべて同じため，相関は`-`になった．

## 5-6 振り返り

1. 解答の`TESTLIST.md`には，相関が求まらない場合や，判定できた試行のないタスクを対から除く場合のように，実装しながら気づいた細部もある．
2. シードだけを変えた同じ設定どうし(A/A)を，マージン0.05で比べた．

   ```text
   grader                     tasks  base  head  diff   SE    95% CI          corr  MDE(80%)  verdict
   category (QC01-1)          11     0.65  0.63  -0.03  0.02  [-0.07, +0.02]  0.99  0.07      inconclusive
   no-promise (QC02-2)        4      1.00  0.97  -0.02  0.02  [-0.07, +0.02]  -     0.07      inconclusive
   judge:polite (QC01-4)      4      0.89  0.84  -0.05  0.05  [-0.15, +0.05]  0.62  0.14      inconclusive
   decision:answers (QC01-1)  4      0.95  0.88  -0.07  0.05  [-0.17, +0.02]  0.30  0.13      inconclusive
   gate: FAIL (margin 0.05; category (QC01-1): lower bound -0.07 < -0.05; no-promise (QC02-2): lower bound -0.07 < -0.05; judge:polite (QC01-4): lower bound -0.15 < -0.05; decision:answers (QC01-1): lower bound -0.17 < -0.05)
   ```

   どの採点器も差の区間は0をまたぎ，`inconclusive`である．
   それでもゲートは落ちた．どの採点器も最小検出差(0.07から0.14)がマージン0.05より大きく，差がなくても区間の下限が`-0.05`を下回るからである．
   このスイート(返信は4タスク)では，マージン0.05のゲートは同じ設定でも落ち続ける．タスクと試行を増やすか，最小検出差に見合うマージンを選ぶ必要がある．
3. 作成時の環境(Ollama 0.35.1，CPU)で，Iteration 2のqwen2.5:0.5bの2回の評価(同じ設定，11タスク×10回)を比べた．

   ```text
   grader             tasks  base  head  diff   SE    95% CI          corr  MDE(80%)  verdict
   category (QC01-1)  11     0.55  0.62  +0.06  0.03  [+0.00, +0.12]  0.98  0.09      improved
   gate: PASS (margin 0.05)
   ```

   同じ設定なのに`improved`になった．区間の下限は0.003で，かろうじて0を上回った．
   合格率が変わったのは`refund-03`，`shipping-01`，`shipping-02`，`other-01`の4タスクで，4つともたまたま上がった．
   これは偽陽性である．A/A比較でも約20回に1回はこうなる．`improved`を1回見ただけで改善を主張せず，評価をやり直すか，タスクを増やして確かめる．
4. Iteration 2のqwen2.5:3bの評価と比べた．

   ```text
   grader             tasks  base  head  diff   SE    95% CI          corr  MDE(80%)  verdict
   category (QC01-1)  11     0.55  0.87  +0.32  0.15  [+0.02, +0.62]  0.19  0.43      improved
   gate: PASS (margin 0.05)
   ```

   相関は0.19と低い．qwen2.5:0.5bが1回も解けなかった`shipping-01`，`other-02`，`other-03`を，qwen2.5:3bは解いた．逆に，qwen2.5:0.5bが半分解いた`refund-03`を，qwen2.5:3bは1回も解けなかった．2つのモデルでは，難しいタスクが違う．
   相関が低いため，差の標準誤差は0.15で，独立とみなした`√(0.14² + 0.09²) ≈ 0.17`とあまり変わらない．
   差の推定は+0.32と大きいが，区間は`[+0.02, +0.62]`と広い．「改善した」とは言えるが，どれだけ改善したかは11タスクでは分からない．
5. 実装しながら`constant`(値がすべて同じか)，`taskIds`，`taskRates`，`judge`，`signed`を加えた．どれもモジュールの中の関数であり，依存の矢印は`modules.md`のとおりである．

## 5-7 発展

GitHub Actionsでは，基準の結果JSONを前回の`main`の実行の成果物として保存し，プルリクエストの実行で取り出して比べる．
`pnpm eval:gate`の終了コード1がジョブの失敗になる．
偽LLMを使うスイートなら，同じシードで同じ結果になるため，ゲートの判定も毎回同じになる．
Ollamaを使うスイートでは，A/A比較で偽陽性やゲートの落ち方を確かめてから，マージンを決める．
