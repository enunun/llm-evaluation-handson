# Iteration 1 演習：複数回試行する

各タスクを何度も試行し，タスクごとの合格率と揺れの状態(`stable`/`flaky`/`broken`)，採点器ごとのpass@1とpass^kを集計する．
偽LLMにはシード付きの揺れを加え，Ollamaを使わずに揺れを再現する．

## 進め方

[docs/iteration-1.md](docs/iteration-1.md)の手順に沿って進める．
このパッケージのコード，テスト，設計文書は，[Iteration 0の解答](../../iteration-0/solution)と同じ状態から始まる．
完成形と模範解答は[../solution](../solution)にある．

## ディレクトリ構成

```text
README.md               このファイル
TESTLIST.md             テストリスト(見出しだけのひな形)
docs/iteration-1.md     演習の手順
design/                 設計文書(Iteration 0の解答)
promptfooconfig.yaml    評価のスイート(分類の11タスク)
src/                    製品，プロバイダ，evalstats(Iteration 0の解答)
test/unit/              単体テスト
test/integration/       統合テスト
results/                promptfooの結果JSONの置き場所
```
