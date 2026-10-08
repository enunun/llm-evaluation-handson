# 型

製品側の型(`Llm`，`Category`，`Random`)，採点器の型(`JudgeVerdict`，`DecisionModel`)と，`evalstats`が結果JSONから作る型を示す．
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
  }
  Llm ..> LlmRequest
  JudgeVerdict ..> GradeOutcome
  Trial ..> GradeOutcome
  EvalResult *-- RunMetadata
  EvalResult "1" *-- "*" Trial
  TaskTrials "1" o-- "*" Trial
  TaskSummary ..> Status
  TaskSummary *-- Interval
  Estimate *-- Interval
  GraderSummary *-- Estimate
  GraderSummary ..> TargetVerdict
  Summary *-- RunMetadata
  Summary "1" *-- "*" TaskSummary
  Summary "1" *-- "*" GraderSummary
```

- `classifyInquiry`は`Category`か`"invalid"`を返す．`"invalid"`は，LLMの出力がどのカテゴリにも当たらなかったことを表す．
- `Trial`は，1回の試行を1つの採点器で採点した結果である．`trial`は同じタスクの試行の中での1からの番号，`grader`はpromptfooのアサーションの`metric`(なければアサーションの種類)である．
- `GradeOutcome`の`unknown`は採点器が判断できないと答えたこと，`error`は採点できなかったこと(Judgeの応答が読めない，LLMの呼び出しの失敗など)を表す．自作のアサーションは採点の結果をメタデータの`outcome`に残し，ほかのアサーションは合否から`pass`か`fail`になる．
- `TaskSummary`の`trials`は判定できた(`pass`か`fail`の)試行の数であり，合格率と区間はその中で求める．判定できた試行がなければ，合格率と区間は`undefined`，状態は`unjudged`になる．
- `RunMetadata`は，プロバイダが出力のメタデータに残した記録である．結果ごとに違う値は，重複を除いてカンマでつなぐ．`seed`は偽LLMを使ったときだけ記録される．
- `TaskSummary`の`interval`は，そのタスクの合格する確率の信頼区間(Clopper-Pearson法)である．
- `GraderSummary`の`passAt1`はタスクごとの合格率の平均，`estimate`はその標準誤差と信頼区間，`passHatK`はタスクごとのpass^kの推定値の平均である．タスクが1つしかなければ`estimate`は`undefined`になる．目標を与えたときだけ`targetVerdict`を持つ．試行数が`k`より少ないタスクがあれば，`passHatK`は`undefined`になる．
