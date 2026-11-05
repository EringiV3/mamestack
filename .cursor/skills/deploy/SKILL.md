---
name: deploy
description: Deploy a mamestack product to Cloudflare and check the live URL. Use when shipping a site or app, opening the production URL, or touching billing, domains, or production data. Astro sites use Wrangler. Void apps use cf and the Void CLI.
---

# deploy

正本は [docs/cloudflare-deploy.md](../../../docs/cloudflare-deploy.md)、[docs/framework-selection.md](../../../docs/framework-selection.md)、[docs/modes.md](../../../docs/modes.md)。未検証のフラグは作らない。

1. `.mamestack/state.json` が無ければ `node tools/gate/cli.mjs init --root <root> --name <名前>`。
2. 依存は [setup](../setup/SKILL.md) の `npm ci` 済みであること。公開の呼び出しは `npm run deploy`。サイトの script は `astro build && wrangler deploy`、アプリの script は `void deploy --platform cloudflare`。`void init --deploy none` のあと、プラットフォーム無しでは公開先が決まらない。使い分けは [AGENTS.md](../../../AGENTS.md)。
3. 空の公開のタイミングは [docs/cloudflare-deploy.md](../../../docs/cloudflare-deploy.md) の空の公開。サイトはヒアリング直後の `implement`。アプリは設計とチケットの確定のあと、T1 を実装している `implement`。どちらも `confirm-deploy --milestone empty`。`v1` は全チケットの検証動画が揃って phase が `deploy` になってからである。
4. 実行する一行を、先に次へ通す。`--root` を付ける。

```sh
node tools/gate/cli.mjs guard --root <root> --command "<実行する一行>"
```

exit 3 は利用者の確認待ち、exit 4 は実行しない。full-auto のデプロイは allow で、確認を待たない。approval とサイトは待つ。確認の範囲は [docs/modes.md](../../../docs/modes.md)。

5. アプリは、公開の前に `void db generate` を実行する。認証のテーブルも出る。`db/migrations` をコミットしてから `npm run deploy` する。`void.lock.json` は初回デプロイの直後にできるので、そのときコミットする。
6. Void が作った Worker、D1、KV、R2 を Void の外で消さない。消してしまったときは、`void.lock.json` の古い項目を除き、生成された `.void-wrangler.jsonc` と `dist` と `.cloudflare` を消してから出し直す。`--provision` では戻らない。エラーは 10041。
7. `npm run deploy` は Worker を上げる前に D1 のマイグレーションを適用する。失敗しても適用が残ることがある。`void db restore --platform cloudflare --bookmark=…` は、そのブックマークよりあとに書いたデータを消す。本番データなので、先に `guard` と利用者の確認を取る。
8. 非対話の Void は「About to apply N migration(s)」のような確認を自分で受ける。止まるのは mamestack のゲート確認だけである。
9. 出た本番 URL を開いて、表示を確認する。
10. full-auto で利用者に確認するのは、本番データの削除、ドメインの購入や DNS とカスタムドメインの変更、有料プランと有料枠だけである。無料枠の D1 / KV / R2 / Workers の作成、壊さないマイグレーション、本番シークレット、`--force` のデプロイは確認しない。請求情報の入力が要る操作は確認する。approval とサイトは従来どおり確認する。
