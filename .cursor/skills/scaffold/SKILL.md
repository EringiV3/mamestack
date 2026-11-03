---
name: scaffold
description: Initialize a mamestack product and ship an empty production deploy. Use when creating a repo, scaffolding Astro or Void, placing docs/prd.md and docs/design-doc.md, or deploying the empty site or app before building features.
---

# scaffold

正本は [AGENTS.md](../../../AGENTS.md)、[docs/framework-selection.md](../../../docs/framework-selection.md)、[docs/cloudflare-deploy.md](../../../docs/cloudflare-deploy.md)。規則をここに写さない。

1. [setup](../setup/SKILL.md) に従い、プロジェクト作成から `npm ci` まで終える。
2. プロダクトのルートで `node tools/gate/cli.mjs next --root <root>` に従う。サイトかアプリかはヒアリングの結果で決まる。
3. `docs/prd.md` と `docs/design-doc.md` が無ければ、`templates/prd.md` と `templates/design-doc.md` をそのパスへ置く。`init` が既に置いていれば上書きしない。中身の埋め方は [AGENTS.md](../../../AGENTS.md) の工程に従う。
4. 中身を書く前に、空のまま本番へ出す。公開は `npm run deploy`。確認は [deploy](../deploy/SKILL.md) と [docs/cloudflare-deploy.md](../../../docs/cloudflare-deploy.md)。出た URL を開いて、空であることが見えるまで次の実装に進まない。
