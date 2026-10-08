# 型

製品側の型(`Llm`，`Category`，`Random`)，採点器の型(`JudgeVerdict`，`DecisionModel`)と，`evalstats`が結果JSONから作る型を示す．
採点器の検証の型(`CalibrationResult`など)は，2つめの図に示す．
`evalstats`は，試行(`Trial`)をタスクと採点器ごとにまとめ(`TaskTrials`)，タスクごとの集計(`TaskSummary`)と採点器ごとの集計(`GraderSummary`)を作る．
集計は，区間(`Interval`)と，平均の標準誤差と区間(`Estimate`)を持つ．

```mermaid
classDiagram
  class Llm {
    <<interface>>
    +complete(request: LlmRequest) Promise~string~
  }
  class LlmRequest {
    +prompt: string
    +format?: "json"
  }
  class JudgeVerdict {
    +outcome: GradeOutcome
    +reason: string
    +probability?: number
  }
  class DecisionModel {
    <<interface>>
    +noul(state: string, instructions: string) Promise~number~
  }
  class GradeOutcome {
    <<enumeration>>
    pass
    fail
    unknown
    error
  }
  class Category {
    <<enumeration>>
    refund
    shipping
    account
    other
  }
  class Random {
    +next() number
  }
  class EvalResult {
    +suite: string
    +provider: string
    +metadata: RunMetadata
    +trials: Trial[]
    +labels: TaskLabel[]
    +graderSettings: Record~string, string~
  }
  class TaskLabel {
    +taskId: string
    +split: string
    +human: Record~string, HumanLabel~
  }
  class RunMetadata {
    +llm?: string
    +model?: string
    +promptVersion?: string
    +seed?: number
  }
  class Trial {
    +taskId: string
    +trial: number
    +grader: string
    +output: string
    +outcome: GradeOutcome
    +reason: string
  }
  class TaskTrials {
    +taskId: string
    +grader: string
    +trials: Trial[]
  }
  class Status {
    <<enumeration>>
    stable
    flaky
    broken
    unjudged
  }
  class TaskSummary {
    +taskId: string
    +grader: string
    +passes: number
    +trials: number
    +unknown: number
    +errors: number
    +rate: number | undefined
    +interval: Interval | undefined
    +status: Status
  }
  class Interval {
    +lower: number
    +upper: number
  }
  class Estimate {
    +mean: number
    +standardError: number
    +interval: Interval
  }
  class TargetVerdict {
    <<enumeration>>
    met
    not met
    inconclusive
  }
  class GraderSummary {
    +grader: string
    +passAt1: number
    +estimate: Estimate | undefined
    +passHatK: number | undefined
    +stable: number
    +flaky: number
    +broken: number
    +unknown: number
    +errors: number
    +targetVerdict?: TargetVerdict
  }
  class Summary {
    +suite: string
    +provider: string
    +metadata: RunMetadata
    +trialsPerTask: number
    +k: number
    +confidence: number
    +target?: number
    +tasks: TaskSummary[]
    +graders: GraderSummary[]
    +corrections?: Correction[]
    +calibrationSplit?: string
  }
  class Correction {
    +grader: string
    +observed: number
    +tpr: number
    +tnr: number
    +corrected: number
    +interval: Interval
  }
  Llm ..> LlmRequest
  JudgeVerdict ..> GradeOutcome
  Trial ..> GradeOutcome
  EvalResult *-- RunMetadata
  EvalResult "1" *-- "*" Trial
  EvalResult "1" *-- "*" TaskLabel
  TaskTrials "1" o-- "*" Trial
  TaskSummary ..> Status
  TaskSummary *-- Interval
  Estimate *-- Interval
  GraderSummary *-- Estimate
  GraderSummary ..> TargetVerdict
  Summary *-- RunMetadata
  Summary "1" *-- "*" TaskSummary
  Summary "1" *-- "*" GraderSummary
  Summary "1" *-- "*" Correction
```

- `classifyInquiry`は`Category`か`"invalid"`を返す．`"invalid"`は，LLMの出力がどのカテゴリにも当たらなかったことを表す．
- `Trial`は，1回の試行を1つの採点器で採点した結果である．`trial`は同じタスクの試行の中での1からの番号，`grader`はpromptfooのアサーションの`metric`(なければアサーションの種類)である．
- `GradeOutcome`の`unknown`は採点器が判断できないと答えたこと，`error`は採点できなかったこと(Judgeの応答が読めない，LLMの呼び出しの失敗など)を表す．自作のアサーションは採点の結果をメタデータの`outcome`に残し，ほかのアサーションは合否から`pass`か`fail`になる．
- `TaskSummary`の`trials`は判定できた(`pass`か`fail`の)試行の数であり，合格率と区間はその中で求める．判定できた試行がなければ，合格率と区間は`undefined`，状態は`unjudged`になる．
- `RunMetadata`は，プロバイダが出力のメタデータに残した記録である．結果ごとに違う値は，重複を除いてカンマでつなぐ．`seed`は偽LLMを使ったときだけ記録される．
- `TaskSummary`の`interval`は，そのタスクの合格する確率の信頼区間(Clopper-Pearson法)である．
- `GraderSummary`の`passAt1`はタスクごとの合格率の平均，`estimate`はその標準誤差と信頼区間，`passHatK`はタスクごとのpass^kの推定値の平均である．タスクが1つしかなければ`estimate`は`undefined`になる．目標を与えたときだけ`targetVerdict`を持つ．試行数が`k`より少ないタスクがあれば，`passHatK`は`undefined`になる．

採点器の検証では，人の判定を持つ採点器ごとに，混同行列と率を求める．

```mermaid
classDiagram
  class HumanLabel {
    <<enumeration>>
    pass
    fail
  }
  class ConfusionMatrix {
    +pass: Record~GradeOutcome, number~
    +fail: Record~GradeOutcome, number~
  }
  class GraderRates {
    +tpr: number | undefined
    +tnr: number | undefined
    +positives: number
    +negatives: number
  }
  class ThresholdRates {
    +threshold: number
    +tpr: number
    +tnr: number
  }
  class GraderCalibration {
    +grader: string
    +items: number
    +matrix: ConfusionMatrix
    +rates: GraderRates
    +selfConsistency: number
    +usable: boolean
    +sweep?: ThresholdRates[]
  }
  class CalibrationResult {
    +split: string | undefined
    +graders: GraderCalibration[]
  }
  class CalibrationFile {
    +split: string | undefined
    +graders: Record~string, GraderRates~
  }
  CalibrationResult "1" *-- "*" GraderCalibration
  GraderCalibration *-- ConfusionMatrix
  GraderCalibration *-- GraderRates
  GraderCalibration "1" *-- "*" ThresholdRates
  CalibrationFile "1" *-- "*" GraderRates
  ConfusionMatrix ..> HumanLabel
```

- `ConfusionMatrix`の行は人の判定，列は採点の結果(`GradeOutcome`)である．
- `GraderRates`の`tpr`と`tnr`は，判定できた(`pass`か`fail`の)試行だけで求める．`positives`と`negatives`は，人が合格，不合格とした試行のうち判定できた数であり，補正の区間のブートストラップに使う．
- `CalibrationFile`は，`evalstats calibrate --out`で保存し，`evalstats summary --calibration`で読む検証結果である．

2つの評価結果の比較では，採点器ごとに対応のある差を求める．

```mermaid
classDiagram
  class Estimate {
    +mean: number
    +standardError: number
    +interval: Interval
  }
  class PairedEstimate {
    +correlation: number | undefined
  }
  class Verdict {
    <<enumeration>>
    improved
    regressed
    inconclusive
  }
  class GraderComparison {
    +grader: string
    +tasks: number
    +base: number
    +head: number
    +difference: PairedEstimate
    +minimumDetectableEffect: number
    +verdict: Verdict
  }
  class Comparison {
    +graders: GraderComparison[]
  }
  class GateResult {
    +pass: boolean
    +failures: GateFailure[]
  }
  class GateFailure {
    +grader: string
    +lower: number
  }
  Estimate <|-- PairedEstimate
  Comparison "1" *-- "*" GraderComparison
  GraderComparison *-- PairedEstimate
  GraderComparison ..> Verdict
  GateResult "1" *-- "*" GateFailure
```

- `PairedEstimate`は，タスクごとの合格率の差(対象 - 基準)の平均，標準誤差，区間に，基準と対象の相関を加えたものである．どちらかの合格率がすべて同じなら，相関は`undefined`になる．
- `GraderComparison`の`minimumDetectableEffect`は，検出力80%で検出できる最小の差である．
- `GateFailure`は，`GateResult`の`failures`の要素の形(`{ grader, lower }`)を表す．コードでは名前を付けていない．
- `EvalResult`の`graderSettings`は，採点器ごとのアサーションの種類，値，設定をJSONにしたものであり，比べられる結果かを確かめるために使う．
