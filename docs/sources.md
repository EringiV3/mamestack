# 出典と確認日

確認日は 2026-11-03。ページは変わり得る。デプロイの前に取り直す。Context7 はこの日、月間枠を超えていて使えなかった。公式サイトと npm レジストリを直接見た。

## Astro

- https://docs.astro.build/en/install-and-setup/
- Node.js は v22.23.4 以上。奇数版は非対応。`npm create astro@latest`。グローバルインストールはしない。スクリプトは `astro dev` / `astro build` / `astro preview`。
- npm `astro` の version は `7.4.5`。`@astrojs/cloudflare` は `14.4.4`。

## Void

- https://void.cloud/guide/quickstart
- https://void.cloud/guide/deployment
- https://void.cloud/guide/app-types
- https://void.cloud/integrations/frameworks/overview
- https://void.cloud/integrations/frameworks/astro
- npm `void@1.5.0`。description は Cloudflare Workers 向けのフルスタックフレームワークとデプロイ CLI。homepage は https://void.cloud 。repository は `https://github.com/voidzero-dev/void.git`。
- Quickstart のコマンド: `npm install -D void`、`npx void init`、`npm run dev`（`http://localhost:5173`）、`npx void deploy`、`npx void deploy --platform cloudflare`。
- Deployment のコマンド: `void connect --platform cloudflare`、`void deploy --platform cloudflare`、`void db generate`、`void secret put`、`void project status`、`void project logs`、`void project rollback`。D1 では `void db restore` が表示される、とある。
- Astro 統合ページ（同日取得）は Astro 7 以上と `nodejs_als`、`void auth login`、`void deploy` を書いていた。検索結果の要約は Astro 6 以上と書いており、ページ本文と違った。本文を採る。mamestack の既定は、アプリを Astro 統合にしない。

## Cloudflare `cf`

- https://developers.cloudflare.com/cf/
- https://developers.cloudflare.com/cf/get-started/
- https://developers.cloudflare.com/cf/get-started/first-worker/
- https://developers.cloudflare.com/cf/agents/
- https://developers.cloudflare.com/cf/projects/
- https://developers.cloudflare.com/cf/projects/cloudflare-config/
- https://developers.cloudflare.com/cf/projects/config-explorer/
- https://developers.cloudflare.com/cf/wrangler/reference/
- https://developers.cloudflare.com/changelog/post/2026-09-28-cloudflare-cli-beta/
- npm `cf@1.0.0-beta.27`。description は "The Cloudflare CLI"。repository は `https://github.com/cloudflare/cf.git`。
- ベータ。Node.js 22.18 以上。Bun は `cloudflare.config.ts` を読むコマンドで非対応。
- インストール `npm install --global cf`。別名 `cloudflare`。`cf auth login`、`cf auth whoami`、`cf zones list`、`cf cli search`、`cf schema`、`cf docs search`、`cf init`、`cf dev`、`cf build`、`cf deploy`、`cf migrate`。
- D1 の例: `cf d1 create`、`cf d1 create --name my-database --dry-run`、`cf d1 query <DATABASE_ID> --sql "SELECT 1"`。
- `worker.domains` がカスタムドメインの配列。
- Deploy your first Worker のページ: Astro を検出してもビルドできるとは限らず、Astro 6 以降はベータ中 `cf` でビルドできない、という趣旨。原文は英語のページ。
- 非対話の破壊的コマンドは `--force` が無いと `Aborted.` かつ終了コード 0 があり得る。
- Wrangler 向けの Astro 案内（`npm create cloudflare@latest -- my-astro-app --framework=astro` や `npx wrangler deploy`）は https://developers.cloudflare.com/workers/framework-guides/web-apps/astro/ に残っている。サイト（Astro）のビルドとデプロイはこれを使う。アプリは使わない。

## Playwright

- https://playwright.dev/docs/videos
- `recordVideo: { dir, size }`。コンテキストを閉じてから保存。`page.video().saveAs`。
- npm `playwright` は 2026-11-03 に `1.64.1`。

## この環境で実行したこと、しなかったこと

- 実行した: ゲートの単体テスト、サンプルに対する Playwright の録画（README の再生手順）。
- 実行していない: `cf auth login`、`cf deploy`、`npx void init`、`void deploy`、Astro プロジェクトの生成。資格情報と、Astro × `cf` の未解決があるため。
