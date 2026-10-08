# 教材作成の進捗

教材を作る人向けに，作成の進み具合とこれからの作業を記録する．
コースの計画は[COURSE.md](COURSE.md)に，各Iterationの内容は[docs/ROADMAP.md](docs/ROADMAP.md)にある．

## 状況

| 項目 | 状態 |
| --- | --- |
| コース計画(`COURSE.md`，`docs/ROADMAP.md`) | 完了 |
| リポジトリの土台(Dev Container，mise，検査スクリプト，ガイド) | 完了(Dev Containerのビルドは未確認) |
| Iteration 0 | 完了 |
| Iteration 1 | 完了 |
| Iteration 2 | 完了 |
| Iteration 3 | 作成中 |
| Iteration 4 | 未着手 |
| Iteration 5 | 未着手 |

## 作業中：Iteration 3

- [x] Iteration 2の解答を演習と解答にコピーし，パッケージ名を変える
- [x] 製品に`draftReply`を加え，プロバイダが`task: classify | reply`で呼び分ける
- [x] 偽LLM(返信，Judge)と偽の意思決定モデル，Ollamaの意思決定モデルのアダプタ
- [x] カスタムアサーション`judgeAssertion`(pass/fail/unknown/error)と`decisionAssertion`(確率としきい値)．試行の番号はプロバイダがメタデータ`trial`に記録し，アサーションが読む
- [ ] スイートに返信のタスクと3種類の採点器を加える
- [ ] `promptfooResult`と`summary`で`unknown`と`error`を合格率から除いて数える．`show`サブコマンド
- [ ] 設計文書(ADR 0004)，教材の文章，ノート
- [ ] Ollama(qwen2.5:0.5b，tev1:0.8b)での実行結果を取る
- [ ] `mise run check`，演習と前の解答の差分の確認，コミット

## これからの作業

1. Iteration 4：人手ラベルのスイート，`calibrate`(TPR，TNR，自己一貫性，しきい値)，Rogan-Gladen補正．
2. Iteration 5：対応のある差，最小検出差，非劣性マージンによるゲート，`eval:gate`．
3. Dev Containerを実際にビルドし，コンテナの中で`mise run check`を通す．

## 作成の環境についての覚え書き

- Ollamaでの動作確認は，軽量なモデル(`qwen2.5:0.5b`，`tev1:0.8b`)で行う．教材に載せるOllamaの出力には，使ったモデルを書く．
