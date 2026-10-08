# 型

製品側の型(`Llm`，`Category`，`Random`)と，`evalstats`が結果JSONから作る型を示す．
`evalstats`は，試行(`Trial`)をタスクと採点器ごとにまとめ(`TaskTrials`)，タスクごとの集計(`TaskSummary`)と採点器ごとの集計(`GraderSummary`)を作る．

```mermaid
classDiagram
  class Llm {
    <<interface>>
    +complete(request: LlmRequest) Promise~string~
  }
  class LlmRequest {
    +prompt: string
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
    +grader: string
    +output: string
    +pass: boolean
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
  }
  class TaskSummary {
    +taskId: string
    +grader: string
    +passes: number
    +trials: number
    +rate: number
    +status: Status
  }
  class GraderSummary {
    +grader: string
    +passAt1: number
    +passHatK: number | undefined
    +stable: number
    +flaky: number
    +broken: number
  }
  class Summary {
    +suite: string
    +provider: string
    +metadata: RunMetadata
    +trialsPerTask: number
    +k: number
    +tasks: TaskSummary[]
    +graders: GraderSummary[]
  }
  Llm ..> LlmRequest
  EvalResult *-- RunMetadata
  EvalResult "1" *-- "*" Trial
  TaskTrials "1" o-- "*" Trial
  TaskSummary ..> Status
  Summary *-- RunMetadata
  Summary "1" *-- "*" TaskSummary
  Summary "1" *-- "*" GraderSummary
```

- `classifyInquiry`は`Category`か`"invalid"`を返す．`"invalid"`は，LLMの出力がどのカテゴリにも当たらなかったことを表す．
- `Trial`は，1回の試行を1つの採点器で採点した結果である．`grader`は，promptfooのアサーションの`metric`(なければアサーションの種類)である．
- `RunMetadata`は，プロバイダが出力のメタデータに残した記録である．`seed`は偽LLMを使ったときだけ記録される．
- `GraderSummary`の`passAt1`はタスクごとの合格率の平均，`passHatK`はタスクごとのpass^kの推定値の平均である．試行数が`k`より少ないタスクがあれば，`passHatK`は`undefined`になる．
