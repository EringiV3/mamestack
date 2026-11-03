# 検証動画

PR に、受入条件が動いている画面録画が無いときは、そのチケットは終わっていない。口頭の「動きました」や、静止画だけでも終わっていない。

録画は Playwright の `recordVideo` で行う。正本は [Videos](https://playwright.dev/docs/videos)。コンテキストを閉じたあとでなければファイルは確定しない。サイズを指定しないと、ビューポートが 800×800 に収まるよう縮小される、と公式にある。mamestack のスクリプトはビューポートも動画も 1280×720 に固定する。

## 準備

工場リポジトリのルートで、Node.js 22 系。

```sh
npm install
npx playwright install chromium
```

`playwright` は依存関係にある。ブラウザのバイナリは `npx playwright install chromium` が入れる。

## 録る

シナリオは JSON である。`steps` の `type` は `goto` / `click` / `fill` / `press` / `wait` / `assertText` / `assertVisible` / `assertHidden`。アサーションが失敗すると終了コードは 1 で、その動画を PR に付けない。

ローカルの静的ディレクトリをスクリプト自身が配信する:

```sh
node tools/verify-record/record.mjs \
  --serve examples/kiosk-hours/site \
  --port 41773 \
  --scenario examples/kiosk-hours/scenarios/t1-hours.json \
  --out examples/kiosk-hours/recordings/t1-hours.webm
```

既に開発サーバーがあるとき（Astro の案内は `npm run dev`、Void の Quickstart は `http://localhost:5173`）:

```sh
node tools/verify-record/record.mjs \
  --base-url http://127.0.0.1:5173/ \
  --scenario scenarios/t1.json \
  --out recordings/t1.webm
```

成功すると一行出る。

```text
verified-video: /absolute/path/recordings/t1.webm bytes=12345
```

終了コード 0 のときだけ、PR に次の三行を入れる。パスはプロダクトルートからの相対パス。

```text
検証動画: recordings/t1.webm
録画コマンド: node tools/verify-record/record.mjs --serve <dir> --scenario <file> --out <file>
終了コード: 0
```

ゲートは、ファイルが存在し、1KB より大きく、WebM（先頭が `1A 45 DF A3`）か MP4（`ftyp`）であることを見る。中身が再生できることまでは見ない。再生の確認は、サンプルではこのリポジトリの録画実行で行う。

## 何を映すか

シナリオはチケットの受入条件をなぞる。表示の確認で終わるチケットは、開いて文言が見えること。操作があるチケットは、クリックや入力の前後を両方アサートする。`later` の画面は録らない。

動画はプロダクトの `recordings/` に置き、PR 本文から相対パスで指す。外部の URL だけを書いてファイルを置かない、は完了にならない。公開用に YouTube へ上げるのは、ファイルを付けたあとならよい。

## 失敗したとき

- `browserType.launch` が共有メモリで落ちる場合、スクリプトは `--disable-dev-shm-usage` を付けている。それでも落ちたら `npx playwright install-deps chromium` を検討する。このコマンドの成否は環境依存なので、失敗ログを PR に残し、成功するまで attach しない。
- ポート 41773 が使用中なら `--port` を変える。よくある 3000 / 5173 / 8080 は避ける。
- アサーション文と画面の文言が違うときは、シナリオを画面に合わせるか、実装を受入条件に合わせる。アサーションを消して緑にしない。
- 本番のサインインは Better Auth が IP あたり約 3 回 / 10 秒に制限する。デプロイ先への E2E は `AUTH_TRUSTED_KEY` を使う。手順は [verify-record](../.cursor/skills/verify-record/SKILL.md)。`void secret put` は利用者の確認が要る。
