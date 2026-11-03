---
name: mamestack
description: Runs the mamestack factory for AI coding agents. Use when the user says mamestack, asks to start a hearing, write a PRD, choose full-auto or approval mode, write a design doc, break work into tickets, open one PR per ticket with a verification video, or deploy to Cloudflare with cf or Void. Do not use Wrangler.
---

# mamestack

`AGENTS.md` が正本である。このスキルは着手時にそれと `docs/framework-selection.md`、`docs/cloudflare-deploy.md`、`docs/verification-video.md` を読むための入口である。

1. プロダクトのルートで `node tools/gate/cli.mjs next --root <root>` を実行する。
2. 表示された質問だけを聞き、答えを `answer` に渡す。質問をまとめない。
3. テンプレートは `templates/` からの写しで、見出しを増やして工程を飛ばさない。
4. シェルで Cloudflare か Void の公開・作成・削除・購入を行う前に `guard --command` を実行する。exit 3 は利用者の確認待ち、exit 4 は禁止（Wrangler を含む）。
5. 実装 PR の前に `tools/verify-record/record.mjs` で動画を録り、終了コード 0 のときだけ `attach-pr` する。
