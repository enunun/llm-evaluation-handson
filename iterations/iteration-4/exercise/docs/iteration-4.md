# Iteration 4 演習：モデル型の採点器を検証して補正する

Iteration 3の振り返りでは，軽量なモデルのJudgeが，問い合わせに答えていない返信も合格にしていた．
このIterationでは，人が合否を付けた返信の集まり(人手ラベル)でLLM Judgeと意思決定モデルを検証し，使えるかを判定する．
検証で分かった採点器の誤りの率で，観測した合格率を補正する．
作業は，すべてこのパッケージ(`iterations/iteration-4/exercise`)のディレクトリで行う．

## 4-1 準備

リポジトリのルートで`pnpm install`を実行する．
このパッケージのコード，テスト，設計文書は，Iteration 3の解答と同じである．テストがすべて通ることを確かめる．

```console
$ cd iterations/iteration-4/exercise
$ pnpm test
...
      Tests  143 passed (143)
```

## 4-2 構文と概念

[Iteration 4のノート](../../../../docs/notes/iteration-4.md)を読む．
読み終えたら，`node`で次を計算する．

1. 100件のうち90件が人の判定で合格のとき，何でも合格と答える採点器の一致率，TPR，TNR．
2. TPRが0.92，TNRが0.88の採点器が0.80の合格率を観測したときの，Rogan-Gladen補正した合格率．
3. `simple-statistics`の`quantile`で，1から10の数の2.5%点と97.5%点．

## 4-3 テストリスト

次の要求と使用例から，`TESTLIST.md`を書く．期待値が変わる既存のテストも探す．

### 要求

#### 人手ラベルのスイート

- `labels.yaml`は，返信20件の人手ラベルのスイートである．各テストは，変数`inquiry`と`reply`，メタデータの`split`(`dev`か`test`)と`human`(採点器の`metric`ごとの`pass`か`fail`)を持つ．採点器は`promptfooconfig.yaml`の返信のタスクと同じにする．
- カスタムプロバイダ`labelProvider`は，変数`reply`をそのまま出力にし，試行の番号をメタデータ`trial`に記録する．`reply`がなければ`{ error: "no reply in vars" }`を返す．IDは`labels`である．

#### 結果JSONの読み取り

- 採点器のメタデータに`probability`があれば，試行に残す．
- テストのメタデータに`human`があるタスクのラベル(`taskId`，`split`，`human`)を，タスクごとに1つ取り出す．

#### 検証

- `confusionMatrix(pairs)`は，人の判定(`pass`，`fail`)と採点の結果(`pass`，`fail`，`unknown`，`error`)の組を数える．
- `rates(matrix)`は，TPRとTNRを，判定できた試行だけで求める．人の判定が合格(不合格)の判定できた試行がなければ，TPR(TNR)は`undefined`である．判定できた試行の数も返す．
- `selfConsistency(items)`は，項目ごとの採点の結果の並びのうち，すべてがそろった項目の割合を返す．項目がなければ0である．
- `thresholdSweep(pairs, thresholds)`は，確率がしきい値以上を合格としたときの，しきい値ごとのTPRとTNRを返す．
- `calibrate(result, { split })`は，人の判定がある採点器ごとに，項目の数，混同行列，率，自己一貫性，使えるか(TPRとTNRがどちらも0.80以上)を求める．確率を残した採点器には，しきい値0.1から0.9の0.1刻みのTPRとTNRを求める．`split`を与えると，その分割の項目だけを使う．

#### 補正

- `correctPassRate(observed, { tpr, tnr })`は，Rogan-Gladen法で補正し，0から1の範囲に収める．`TPR + TNR`が1以下なら`undefined`を返す．
- `bootstrapInterval(statistic, { resamples, confidence, random })`は，乱数を受け取る統計量を`resamples`回計算し，その分位点を区間にする．統計量が`undefined`を返した回は除き，一度も値がなければエラーにする．
- `correctedEstimate(taskRates, rates, options)`は，タスクごとの合格率の平均を補正した値と，ブートストラップの区間を返す．区間は，タスクの復元抽出と，TPRとTNRの二項分布からの引き直しで求める．
- 検証結果のファイル：`serializeCalibration(result)`は採点器ごとの率を保存し，`parseCalibrationFile(text)`で読み戻す．形が違えばエラーにする．
- `summarize`に`calibration: { file, random }`を与えると，検証結果にある採点器の合格率を補正する．

#### CLI

- `evalstats calibrate <結果JSON> [--split <分割>] [--out <ファイル>]`は，検証結果を表示し，`--out`で保存する．使えない採点器があれば終了コード1を返す．人の判定がなければ，理由を表示して終了コード1を返す．
- `evalstats summary`に`--calibration <ファイル>`と`--seed <シード>`(既定1)を加える．補正があれば，空行のあとに補正の表を表示する．
- `CliIo`に`writeFile(file, text)`を加える．
- `package.json`の`eval`スクリプトから`-c promptfooconfig.yaml`を外す．promptfooは，指定がなければ`promptfooconfig.yaml`を読む．

### 使用例

```console
$ pnpm eval -c labels.yaml --repeat 5 -o results/labels.json
$ pnpm evalstats calibrate results/labels.json --split dev --out results/calibration.json
calibration (split: dev, items: 10)
grader                     items  TPR   TNR   self-consistency  verdict
judge:polite (QC01-4)      10     0.88  1.00  0.50              usable
decision:answers (QC01-1)  10     1.00  0.33  1.00              not usable (TNR < 0.80)

judge:polite (QC01-4)
            pass  fail  unknown  error
human:pass  28    4     2        1
human:fail  0     13    1        1
...

decision:answers (QC01-1) thresholds
threshold  TPR   TNR
0.10       1.00  0.20
...
0.90       0.60  0.67
$ pnpm evalstats summary results/fake.json --calibration results/calibration.json
...

corrected with calibration (split: dev)
grader                     observed  TPR   TNR   corrected  95% CI
judge:polite (QC01-4)      0.89      0.88  1.00  1.00       [0.87, 1.00]
decision:answers (QC01-1)  0.95      1.00  0.33  0.85       [0.44, 1.00]
```

### 作るもの

| モジュール | 公開するもの |
| --- | --- |
| `labelProvider.ts`(新規) | 既定のエクスポート(プロバイダ) |
| `promptfooResult.ts` | `HumanLabel`，`TaskLabel`，`Trial.probability`，`EvalResult.labels` |
| `agreement.ts`(新規) | `ConfusionMatrix`，`GraderRates`，`ThresholdRates`，`confusionMatrix`，`rates`，`selfConsistency`，`thresholdSweep` |
| `calibration.ts`(新規) | `criteria`，`GraderCalibration`，`CalibrationResult`，`CalibrationFile`，`calibrate`，`correctPassRate`，`correctedEstimate`，`serializeCalibration`，`parseCalibrationFile` |
| `stats.ts` | `bootstrapInterval` |
| `summary.ts` | `Correction`，`Summary.corrections`と`calibrationSplit`，`SummaryOptions.calibration` |
| `report.ts` | 補正の表，`formatCalibration(result)` |
| `cli.ts` | `calibrate`サブコマンド，`--calibration`，`--seed`，`CliIo.writeFile` |

### 考えること

- 一致率ではなくTPRとTNRを使うのはなぜか．
- 人手ラベルを`dev`と`test`に分けるのはなぜか．どちらで何をするか．
- 偽の意思決定モデルは「セール」だけを見て判定する．人手ラベルで検証したら，どちらの率が低くなりそうか．

## 4-4 設計文書

- `design/modules.md`：`labelProvider`，`agreement`，`calibration`と，検証結果JSONを加える．検証の流れ(評価，検証，保存，補正)が追えるように描く．
- `design/types.md`：検証の型を，2つめの図として描く．
- `design/adr/0005-grader-validation.md`：人手ラベルで採点器を検証する判断，合格基準，dev/testの手順，補正を書く．

## 4-5 テスト駆動の実装

### 人手ラベル

`labels.yaml`の返信と人の判定は，自分で書いてもよい．
丁寧さと，問い合わせに答えているかが独立に変わる返信を混ぜる．たとえば，丁寧でも答えていない返信や，答えていても丁寧でない返信である．

### 検証と補正

- `confusionMatrix`は，`{ pass: { pass: 0, fail: 0, unknown: 0, error: 0 }, fail: { ... } }`を数え上げる形にすると，表示もそのまま書ける．
- 二項分布からの引き直しは，`random.next() < p`を`n`回数えれば書ける．
- `bootstrapInterval`のテストでは，呼ばれるたびに決まった値を返す統計量を使うと，分位点を確かめやすい．

### CLI

- 別のスイートを評価するには，`pnpm eval -c labels.yaml`のように指定する．その前に，`package.json`の`eval`スクリプトから`-c promptfooconfig.yaml`を外す．外さないと，2つのスイートが合わせて評価される．
- 統合テストでは，`labels.yaml`を`--repeat 5`で評価し，`calibrate`と`summary --calibration`を確かめる．

### Ollamaで検証する

`labels.yaml`のJudgeと意思決定モデルを`llm: ollama`にして評価し，`dev`と`test`の両方で検証する．
時間がかかるときは，Judgeを`qwen2.5:0.5b`に，意思決定モデルを`tev1:0.8b`にする．

## 4-6 振り返り

1. 自分の`TESTLIST.md`と，解答の`TESTLIST.md`を見比べる．
2. 偽のJudgeと偽の意思決定モデルの検証結果を読む．使えない採点器は，どの種類の誤り(誤った合格か，見逃した合格か)をしているか．
3. Ollamaのモデルで検証し，`dev`と`test`の率を比べる．`dev`だけで判断すると，何を見誤るか．
4. Iteration 3のOllamaの評価結果を，Ollamaのモデルの検証結果で補正する．補正前と補正後の合格率は，それぞれ何を意味するか．
5. 設計文書と実装を見比べ，食い違うところがあれば設計文書を直す．

## 4-7 発展

Judgeの判定を3回の多数決にするアサーションを作り，検証して，TPR，TNR，自己一貫性が変わるかを確かめる．
これまでと同じく，テストリスト，設計文書，実装の順に進める．
