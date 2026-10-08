# 型

製品側の型(`Llm`，`Category`)と，`evalstats`が結果JSONから作る型(`EvalResult`，`TaskOutcome`，`Summary`)を示す．

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
  class EvalResult {
    +suite: string
    +provider: string
    +outcomes: TaskOutcome[]
  }
  class TaskOutcome {
    +taskId: string
    +grader: string
    +output: string
    +pass: boolean
  }
  class Summary {
    +suite: string
    +provider: string
    +outcomes: TaskOutcome[]
    +passedTasks: number
    +totalTasks: number
    +passRate: number
  }
  Llm ..> LlmRequest
  EvalResult "1" *-- "*" TaskOutcome
  Summary "1" *-- "*" TaskOutcome
```

- `classifyInquiry`は`Category`か`"invalid"`を返す．`"invalid"`は，LLMの出力がどのカテゴリにも当たらなかったことを表す．
- `TaskOutcome`は，1つのタスクを1つの採点器で採点した結果である．`grader`は，promptfooのアサーションの`metric`(なければアサーションの種類)である．
- `Summary`の`passedTasks`は，すべての採点器に合格したタスクの数である．
