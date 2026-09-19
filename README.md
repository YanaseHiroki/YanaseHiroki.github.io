# yanasehiroki.github.io

アプリ開発者 柳瀬 大輝のポートフォリオ（https://yanasehiroki.github.io/）。名刺の QR コードの行き先。

素の HTML / CSS だけで、ビルドはない。`main` に push すると GitHub Pages がそのまま配信する。

## 製品を足すとき

`index.html` の `<article class="product">` をまるごと複製して、画像（`images/`）・名前・説明・技術タグ・リンクを書き換える。

## note の記事カード

「書いた記事」の横並びカードは `notes.json` から描く。`node scripts/fetch-notes.mjs` で note の最新記事を書き出し、差分が出たら `notes.json` をコミットする（日曜の定期ルーティン「note の既存記事を最新化する」が毎週流す）。
