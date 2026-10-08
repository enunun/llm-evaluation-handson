# Iteration 0 演習：1回だけ評価する

問い合わせを分類する製品の関数を作り，promptfooで1回評価し，その結果をCLI`evalstats`で表示する．
このIterationで，テストリスト，設計文書，テスト駆動の実装，設計の見直しという，全Iterationで繰り返す流れを初めて1周する．

## 進め方

[docs/iteration-0.md](docs/iteration-0.md)の手順に沿って進める．
完成形と模範解答は[../solution](../solution)にある．

## ディレクトリ構成

```text
README.md               このファイル
TESTLIST.md             テストリスト(見出しだけのひな形)
docs/iteration-0.md     演習の手順
design/                 設計文書(見出しと，何を描くかのコメントだけ)
promptfooconfig.yaml    評価のスイート(分類の11タスク)
src/                    製品，プロバイダ，evalstats(llm.tsとollamaLlm.ts以外はスタブ)
test/unit/              単体テスト
test/integration/       統合テスト
results/                promptfooの結果JSONの置き場所
```
