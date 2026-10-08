# Iteration 3 演習：自由記述を3種類の採点器で評価する

返信の下書きを書く機能を加え，コードの採点器，LLM Judge，意思決定モデルで採点する．採点器が判断できなかった試行と採点できなかった試行を，不合格と区別して数える．

## 進め方

[docs/iteration-3.md](docs/iteration-3.md)の手順に沿って進める．
このパッケージのコード，テスト，設計文書は，[Iteration 2の解答](../../iteration-2/solution)と同じ状態から始まる．
完成形と模範解答は[../solution](../solution)にある．

## ディレクトリ構成

```text
README.md               このファイル
TESTLIST.md             テストリスト(見出しだけのひな形)
docs/iteration-3.md     演習の手順
design/                 設計文書(Iteration 2の解答)
promptfooconfig.yaml    評価のスイート(分類の11タスク，偽LLMのseedとnoise)
src/                    製品，プロバイダ，evalstats(Iteration 2の解答)
test/unit/              単体テスト
test/integration/       統合テスト
results/                promptfooの結果JSONの置き場所
```
