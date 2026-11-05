---
name: mamestack
description: Runs the mamestack factory for AI coding agents. Use when the user says mamestack, asks to start a hearing, write a PRD, choose full-auto or approval mode, write a design doc, break work into tickets, open one PR per ticket with a verification video, or deploy to Cloudflare. Astro sites may use Wrangler. Void apps use cf or the Void CLI, not Wrangler.
---

# mamestack

`AGENTS.md` が正本である。このスキルは着手時にそれと `docs/framework-selection.md`、`docs/cloudflare-deploy.md`、`docs/verification-video.md` を読むための入口である。依存、初期化、録画、公開、PR を閉じる作業は [setup](../setup/SKILL.md)、[scaffold](../scaffold/SKILL.md)、[verify-record](../verify-record/SKILL.md)、[deploy](../deploy/SKILL.md)、[pr-finish](../pr-finish/SKILL.md) を使う。

1. プロダクトのルートで `node tools/gate/cli.mjs next --root <root>` を実行する。
2. ヒアリングは表示された質問だけを一問ずつ聞き、答えを `answer` に渡す。サイト（static で保存なし）は要求まとめを書いて `accept-summary --by bot` し、空ページのデプロイから実装に入る。アプリは PRD の不足だけを1回3問まで聞く。機能の数に上限はなく、挙がった機能はすべて PRD に書き、明示して後回しにしたものだけを次の版のメモにする。自分だけが使うアプリは、収益モデル、プライシング、GTM、差別化、収益・グロース指標を聞かない。PRD の OK のあと、依存なしの HTML モックを `docs/mockup/` に置き、スマホ幅と PC 幅のスクショを見せて OK をもらう。モックはイメージと大まかな UI のすり合わせであり、見た目の正にはしない。実装 PR でモックとの差分は見ない。Design Doc は利用者にしか決められないことだけ聞く。答えが出ている項目は聞き直さない。アプリの T1 は空のアプリの本番公開で、その後の PR も本番に出せる状態を保つ。
3. アプリでは `templates/prd.md` と `templates/design-doc.md` を `docs/prd.md` と `docs/design-doc.md` に写す。見出しは削らず、アプリの工程を飛ばさない。
4. シェルで Cloudflare、Wrangler、Void の公開・作成・削除・購入を行う前に `guard --command` を実行する。サイトの Wrangler は `--root` を付ける。exit 3 は利用者の確認待ち、exit 4 は禁止（アプリの Wrangler を含む）。
5. 実装 PR の前に `tools/verify-record/record.mjs` で動画を録り、終了コード 0 のときだけ `attach-pr` する。
