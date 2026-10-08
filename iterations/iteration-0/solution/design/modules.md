# モジュール依存図

製品側のモジュールはpromptfooから呼ばれ，分析側の`evalstats`はpromptfooが書いた結果JSONを読む．
実線の矢印`A --> B`は，`A`が`B`をimportすることを表す．点線の枠は外部である．

```mermaid
flowchart LR
  promptfoo[promptfoo]:::external
  ollamaClient["ollama(npm)"]:::external
  ollamaServer[(Ollamaのモデル)]:::external
  resultFile[(結果JSON)]:::external

  subgraph product[製品とプロバイダ]
    supportProvider
    support
    llm
    fakeLlm
    ollamaLlm
  end

  subgraph evalstats[evalstats]
    cli
    promptfooResult
    summary
    report
  end

  promptfoo --> supportProvider
  promptfoo --> resultFile
  supportProvider --> support
  supportProvider --> fakeLlm
  supportProvider --> ollamaLlm
  supportProvider --> llm
  supportProvider --> ollamaClient
  support --> llm
  fakeLlm --> llm
  ollamaLlm --> llm
  ollamaClient --> ollamaServer
  cli --> promptfooResult
  cli --> summary
  cli --> report
  cli --> resultFile
  summary --> promptfooResult
  report --> summary

  classDef external stroke-dasharray: 5 5
```

- 非決定的なのは，外部の`Ollamaのモデル`だけである．`support`は`llm`のインタフェースだけに依存するため，テストでは`fakeLlm`を渡して決定的に確かめられる．
- `supportProvider`は，設定の`llm`に応じて`fakeLlm`の`keywordLlm`か，`ollamaLlm`と`ollama(npm)`のクライアントを組み立てる．
- `evalstats`は製品のモジュールをimportしない．promptfooの結果JSONだけを通して製品の評価結果を受け取る．
