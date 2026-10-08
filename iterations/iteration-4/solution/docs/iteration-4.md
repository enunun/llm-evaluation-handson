# Iteration 4 解説：モデル型の採点器を検証して補正する

演習の各手順について，模範解答とその考え方を説明する．
見出しの番号は，演習の`docs/iteration-4.md`と対応する．

## 4-1 準備

Iteration 3の解答のテストがすべて通ることを確かめた．

## 4-2 構文と概念

```text
> (90 + 0) / 100
0.9
> (0.8 + 0.88 - 1) / (0.92 + 0.88 - 1)
0.8500000000000002
> await import("simple-statistics").then(({ quantile }) => [quantile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 0.025), quantile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 0.975)])
[ 1.225, 9.775 ]
```

何でも合格と答える採点器の一致率は0.9，TPRは1.0，TNRは0である．

## 4-3 テストリスト

模範解答は[TESTLIST.md](../TESTLIST.md)である．考え方を補足する．

- 一致率は，人の判定の合格と不合格の割合に左右される．TPRとTNRは人の判定の側ごとに測るため，「何でも合格」も「何でも不合格」も見抜ける．
- `dev`ではルーブリック，プロンプト，しきい値を調整し，`test`では調整の結果を最後に確かめる．`test`で調整すると，`test`の率も見かけだけ良くなる．
- 偽の意思決定モデルは，宣伝(「セール」)のない返信をすべて高い確率にする．人が「答えていない」とした丁寧な返信も合格にするため，TNRが低くなると予想できる．検証の結果もそのとおりになった．
- `rates`のテストには，`unknown`と`error`を含む行を使った．判定できなかった試行を分母に入れるかどうかで，率が変わるからである．

## 4-4 設計文書

- modules.md：`labelProvider`を製品側に，`agreement`と`calibration`を`evalstats`に加えた．`calibration`は`agreement`で率を求め，`stats`のブートストラップで補正の区間を求める．`cli`は検証結果JSONを書き，`summary`はそれを読んで補正する．
- types.md：`EvalResult`に`TaskLabel`を，`Trial`に`probability`を，`Summary`に`Correction`を加えた．検証の型は2つめの図に分けた．1つの図に描くと，主な流れ(試行，集計，表示)が読みにくくなるからである．
- adr/0005：人手ラベルで検証する判断，合格基準，dev/testの手順，補正を書いた．

## 4-5 テスト駆動の実装

### 人手ラベル

`labels.yaml`は，丁寧さと，問い合わせに答えているかが独立に変わる20件の返信で作った．
丁寧だが答えていない返信(「いつもご利用いただきありがとうございます．」)，答えているが丁寧でない返信(「注文履歴見て．3日以内に送るから．」)，方針を書き写しただけの返信，英語の返信も入れた．
英語の返信は，ルーブリックが「敬語」を求めるため，人の判定では丁寧さを`fail`とした．人の判定もルーブリックの書き方に従う．

### labelProvider，promptfooResult

`labelProvider`は，変数`reply`を返し，試行の番号を記録するだけである．
`promptfooResult`は，テストの`metadata`の`human`と`split`，採点器のメタデータの`probability`を読むようにスキーマを広げた．

### agreement

`confusionMatrix`は，4つの列を0で始める行を2つ作り，組を数え上げる．
`rates`を，最初に行の合計を分母にして書くと，次のように失敗する．

```text
 FAIL  |unit| test/unit/agreement.test.ts > rates > TPRは，人が合格とした試行のうち，採点器も合格とした割合である(unknownとerrorを除く)
AssertionError: expected 0.6 to be close to 0.75, received difference is 0.15000000000000002, but expected 0.005
 FAIL  |unit| test/unit/agreement.test.ts > rates > TNRは，人が不合格とした試行のうち，採点器も不合格とした割合である(unknownとerrorを除く)
AssertionError: expected 0.5 to be close to 0.6666666666666666, received difference is 0.16666666666666663, but expected 0.005
```

分母を`pass`と`fail`の列だけにした．
`thresholdSweep`は，確率をしきい値で`pass`か`fail`に変え，`confusionMatrix`と`rates`を使い回した．

### calibration

`calibrate`は，ラベルを分割で絞り，人の判定を持つ採点器ごとに`calibrateGrader`で検証する．
`calibrateGrader`は，項目ごとにその採点器の試行を集め，組，確率，項目ごとの結果の並びを作ってから，`agreement`の関数に渡す．
しきい値は`(i + 1) / 10`で作った．`0.1`を足し重ねると`0.30000000000000004`のような値になり，表示やテストで扱いにくい．

`correctPassRate`は式どおりに書き，分母が0以下なら`undefined`を返す．
`correctedEstimate`は，`bootstrapInterval`に，タスクの復元抽出とTPR，TNRの引き直しをする統計量を渡す．

### summary，report，cli

`summarize`の`calibration`は，検証結果のファイルと乱数の組にした．乱数を別の引数にすると，ファイルだけを渡して乱数を忘れる呼び出しを型で防げない．
`report`の`formatCalibration`は，採点器の表，混同行列，しきい値の表の順に表示する．使えない採点器には，満たさない基準を添えた．
`cli`には`calibrate`を加え，`summary`に`--calibration`と`--seed`を加えた．ファイルの書き出しは`CliIo`の`writeFile`を通す．

`pnpm eval -c labels.yaml`を最初に実行したとき，結果に分類のタスクも含まれていた．`eval`スクリプトの`-c promptfooconfig.yaml`と合わせて，2つのスイートが評価されたためである．`eval`スクリプトから`-c`を外した．

### 統合テスト

```console
$ pnpm eval -c labels.yaml --repeat 5 -o results/labels.json
$ pnpm evalstats calibrate results/labels.json --split dev --out results/calibration.json
$ node src/cli.ts calibrate results/labels.json --split dev --out results/calibration.json
calibration (split: dev, items: 10)
grader                     items  TPR   TNR   self-consistency  verdict
judge:polite (QC01-4)      10     0.88  1.00  0.50              usable
decision:answers (QC01-1)  10     1.00  0.33  1.00              not usable (TNR < 0.80)

judge:polite (QC01-4)
            pass  fail  unknown  error
human:pass  28    4     2        1
human:fail  0     13    1        1

decision:answers (QC01-1)
            pass  fail  unknown  error
human:pass  35    0     0        0
human:fail  10    5     0        0

decision:answers (QC01-1) thresholds
threshold  TPR   TNR
0.10       1.00  0.20
0.20       1.00  0.20
0.30       1.00  0.27
0.40       1.00  0.33
0.50       1.00  0.33
0.60       1.00  0.33
0.70       0.89  0.53
0.80       0.77  0.53
0.90       0.60  0.67
```

偽のJudgeは丁寧語の有無で判定するため，人の判定とよく合う．
偽の意思決定モデルはTNRが0.33で，しきい値をどこに置いてもTPRとTNRの両方を0.80以上にできない．

## 4-6 振り返り

1. 解答の`TESTLIST.md`には，二項分布からの引き直しや，しきい値の作り方のように，テストを書いてから気づいた細部もある．
2. 偽の意思決定モデルは，人が不合格とした返信の3分の2を合格にしている(誤った合格)．宣伝のない返信は，答えていなくても合格になる．
3. 作成時の環境(Ollama 0.35.1，Judgeはqwen2.5:0.5b，意思決定モデルはtev1:0.8b，CPU)で検証した結果を示す．

   ```text
   calibration (split: dev, items: 10)
   grader                     items  TPR   TNR   self-consistency  verdict
   judge:polite (QC01-4)      10     1.00  0.07  0.90              not usable (TNR < 0.80)
   decision:answers (QC01-1)  10     1.00  1.00  1.00              usable

   calibration (split: test, items: 10)
   grader                     items  TPR   TNR   self-consistency  verdict
   judge:polite (QC01-4)      10     1.00  0.07  0.80              not usable (TNR < 0.80)
   decision:answers (QC01-1)  10     0.67  1.00  1.00              not usable (TPR < 0.80)
   ```

   qwen2.5:0.5bのJudgeは，人が丁寧でないとした返信もほぼすべて合格にした(TNR 0.07)．Iteration 3で疑ったとおり，このJudgeは使えない．
   tev1:0.8bは，`dev`ではしきい値0.5でTPRとTNRが1.00だったが，`test`ではTPRが0.67に下がった．`test`のしきい値ごとの表では，しきい値0.3でTPRが0.83，TNRが1.00になる．`dev`だけを見てしきい値0.5で使えると判断すると，`test`の項目で答えている返信の3分の1を見逃す．ただし，`test`の表を見てしきい値を選び直すと，`test`は確かめの役目を失う．しきい値を変えるなら，人手ラベルを増やして`dev`で選び直し，新しい`test`で確かめる．
4. Iteration 3のOllamaの評価結果を，`test`の検証結果で補正した．

   ```text
   corrected with calibration (split: test)
   grader                     observed  TPR   TNR   corrected  95% CI
   judge:polite (QC01-4)      0.88      1.00  0.07  0.00       [0.00, 0.65]
   decision:answers (QC01-1)  0.40      0.67  1.00  0.60       [0.16, 1.00]
   ```

   Judgeの観測値0.88は，ほぼ何でも合格にする採点器の出力であり，補正すると0で区間も広い．この採点器の合格率からは何も言えない．
   意思決定モデルの観測値0.40は，答えている返信を見逃す分だけ低く出ており，補正すると0.60になる．ただし区間は`[0.16, 1.00]`と広い．人手ラベル20件では，補正値の確かさは低い．
5. 実装しながら`calibrateGrader`，`binomialDraw`，`verdict`，`rate`を加えた．どれもモジュールの中の関数であり，依存の矢印は`modules.md`のとおりである．

## 4-7 発展

多数決は，Judgeを3回呼んで最も多い判定を返すアサーションとして書ける．
3回の判定の乱数は，試行の番号と`0`，`1`，`2`を組み合わせた別々のシードから作る．
多数決は1回ごとの揺れを打ち消すため，自己一貫性は上がりやすい．TPRとTNRが上がるかは，Judgeの誤りが揺れによるものか，偏りによるものかで決まる．
