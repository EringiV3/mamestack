# サンプル: 麦畑ベーカリー

静的な一枚看板が、ヒアリングからデプロイ判断まで通った写しである。サイトではなく、工程の実例。

`site/index.html` は、Astro で出す予定のページと同じ文言を持つスタンドインである。`npm create astro` は対話が要るため、この工場の中では生成していない。設計書にその旨を書いた。

デプロイは実行していない。`cf` ベータは Astro 6 以降をビルドできないと公式にあり、この環境に Cloudflare の資格情報も無い。状態ファイルの v1 は、その理由で `skip` になっている。

再生:

```sh
npm install
npx playwright install chromium
npm run example:record
npm run example:check
```

`example:record` は二つの WebM を作り直す。`example:check` は `.mamestack/state.json` が文書と動画に対して整合しているかを見る。
