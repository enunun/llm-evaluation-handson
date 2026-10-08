# Iteration 2 演習：標準誤差と信頼区間を付ける

タスクごとの合格率に信頼区間を，採点器ごとの合格率に標準誤差と信頼区間を付け，目標の合格率と区間を比べる．

## 進め方

[docs/iteration-2.md](docs/iteration-2.md)の手順に沿って進める．
このパッケージのコード，テスト，設計文書は，[Iteration 1の解答](../../iteration-1/solution)と同じ状態から始まる．
完成形と模範解答は[../solution](../solution)にある．

## ディレクトリ構成

```text
README.md               このファイル
TESTLIST.md             テストリスト(見出しだけのひな形)
docs/iteration-2.md     演習の手順
design/                 設計文書(Iteration 1の解答)
promptfooconfig.yaml    評価のスイート(分類の11タスク，偽LLMのseedとnoise)
src/                    製品，プロバイダ，evalstats(Iteration 1の解答)
test/unit/              単体テスト
test/integration/       統合テスト
results/                promptfooの結果JSONの置き場所
```
