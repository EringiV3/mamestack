---
name: mamestack
description: Runs the mamestack factory for AI coding agents. Use when the user says mamestack, asks to start a hearing, write a PRD, choose full-auto or approval mode, write a design doc, break work into tickets, open one PR per ticket with a verification video, or deploy to Cloudflare with cf or Void. Do not use Wrangler.
---

# mamestack

`AGENTS.md` が正本である。このスキルは着手時にそれと `docs/framework-selection.md`、`docs/cloudflare-deploy.md`、`docs/verification-video.md` を読むための入口である。

1. プロダクトのルートで `node tools/gate/cli.mjs next --root <root>` を実行する。
2. ヒアリングは表示された質問だけを一問ずつ聞き、答えを `answer` に渡す。PRD はテンプレートの不足だけを1回3問まで聞く。Design Doc は利用者にしか決められないことだけ聞く。答えが出ている項目は聞き直さない。
3. `templates/prd.md` と `templates/design-doc.md` を `docs/prd.md` と `docs/design-doc.md` に写す。見出しは削らず、工程を飛ばさない。
4. シェルで Cloudflare か Void の公開・作成・削除・購入を行う前に `guard --command` を実行する。exit 3 は利用者の確認待ち、exit 4 は禁止（Wrangler を含む）。
5. 実装 PR の前に `tools/verify-record/record.mjs` で動画を録り、終了コード 0 のときだけ `attach-pr` する。
