---
name: verify-record
description: Record a Playwright verification video for a mamestack acceptance check. Use when writing a scenario JSON, running tools/verify-record, or putting the video lines into a pull request.
---

# verify-record

手順と合格条件は [docs/verification-video.md](../../../docs/verification-video.md)。シナリオの形は [examples/kiosk-hours/scenarios/t1-hours.json](../../../examples/kiosk-hours/scenarios/t1-hours.json)。認証つきアプリの例は [examples/scenarios/auth.json](../../../examples/scenarios/auth.json)。

工場リポジトリのルートで、先に `npm install` と `npx playwright install chromium`。無いと `record.mjs` が `ERR_MODULE_NOT_FOUND` になる。

1. 受入条件をなぞる JSON を `scenarios/` に書く。`later` の画面は録らない。
2. 次で録画する。終了コードが 0 のときだけ先へ進む。

```sh
node tools/verify-record/record.mjs --serve <dir> --port <port> --scenario <file> --out recordings/<name>.webm
```

開発サーバーがあるときは `--serve` の代わりに `--base-url` を使う。フラグの意味は検証動画の文書に従う。

3. 本番のサインインは Better Auth が IP あたり約 3 回 / 10 秒に制限する（`node_modules/void/docs/guide/auth.md`）。デプロイ先への E2E は `AUTH_TRUSTED_KEY` を使う。`env.ts` に optional で宣言し、`auth.ts` の `rateLimit.customRules` でヘッダ `x-auth-trusted-key` が一致するときだけ制限を外す。値は `void secret put AUTH_TRUSTED_KEY`。ブラウザに載るコードへは入れない。`void secret put` は利用者の確認が要る。
4. 文書が定める三行（`検証動画:`、`録画コマンド:`、`終了コード: 0`）を PR に書く。動画ファイルを同じ変更に含める。
5. `node tools/gate/cli.mjs attach-pr --root <root> --ticket <id> --pr <path> --video <path>`。サイトでチケットが無いときの付け方は [AGENTS.md](../../../AGENTS.md) の実装の節。
