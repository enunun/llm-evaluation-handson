# モジュール依存図

<!--
src/のモジュールと，その依存の矢印をMermaidのflowchartで描く．

- ノードのIDは，src/の下のファイル名から.tsを除いたもの(例：supportProvider)にする．
- promptfoo，Ollama，結果JSONなどの外部のノードには:::externalを付ける．
- 実線の矢印は，矢印の元のモジュールが先のモジュールをimportすることを表す．1行に1本書く．
- 製品側(promptfooから呼ばれるもの)と，evalstats側をsubgraphで分ける．
- 図の上に，何を示す図かを1〜2文で書き，図で表せない約束は図の下に箇条書きで書く．
-->
