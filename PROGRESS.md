# 教材作成の進捗

教材を作る人向けに，作成の進み具合とこれからの作業を記録する．
コースの計画は[COURSE.md](COURSE.md)に，各Iterationの内容は[docs/ROADMAP.md](docs/ROADMAP.md)にある．

## 状況

| 項目 | 状態 |
| --- | --- |
| コース計画(`COURSE.md`，`docs/ROADMAP.md`) | 完了 |
| リポジトリの土台(Dev Container，mise，検査スクリプト，ガイド) | 完了(Dev Containerのビルドは未確認) |
| Iteration 0 | 完了 |
| Iteration 1 | 作成中：設計文書と教材の文章 |
| Iteration 2 | 未着手 |
| Iteration 3 | 未着手 |
| Iteration 4 | 未着手 |
| Iteration 5 | 未着手 |

## 作業中：Iteration 1

- [x] Iteration 0の解答を演習と解答にコピーし，パッケージ名を変える
- [x] 解答に`@stdlib/random-base-mt19937`を加える
- [x] 単体テストを先に書き，失敗を確かめる
- [x] 解答の実装(`random`，`keywordLlm`の揺れ，プロバイダの記録，`summary`のpass^kと状態，`report`，`cli`の`--k`)
- [x] 統合テストを`--repeat 10`の出力に合わせる(偽LLMの`noise`は0.1)
- [ ] 設計文書(モジュール依存図，型，ADR 0002)
- [ ] 解答の`TESTLIST.md`，`README.md`，`docs/iteration-1.md`
- [ ] 演習の`TESTLIST.md`，`README.md`，`docs/iteration-1.md`
- [ ] ノート`docs/notes/iteration-1.md`
- [ ] Ollama(qwen2.5:0.5b)での実行結果を取る
- [ ] `mise run check`，演習と前の解答の差分の確認，コミット

## これからの作業

1. Iteration 2：Clopper-Pearson区間，タスク単位の標準誤差，目標との判定．
2. Iteration 3：返信の下書き，`not-icontains`，LLM Judge，意思決定モデル(Tev1)，4値の採点結果，`show`．
3. Iteration 4：人手ラベルのスイート，`calibrate`(TPR，TNR，自己一貫性，しきい値)，Rogan-Gladen補正．
4. Iteration 5：対応のある差，最小検出差，非劣性マージンによるゲート，`eval:gate`．
5. Dev Containerを実際にビルドし，コンテナの中で`mise run check`を通す．

## 作成の環境についての覚え書き

- Ollamaでの動作確認は，軽量なモデル(`qwen2.5:0.5b`，`tev1:0.8b`)で行う．教材に載せるOllamaの出力には，使ったモデルを書く．
