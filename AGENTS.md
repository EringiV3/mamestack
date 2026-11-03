# mamestack — エージェントへの指示

Canonical repository: https://github.com/EringiV3/mamestack (Cursor Origin `mametaro/mamestack` is a mirror only).

Normative rules, in English, so they survive a weak pass over the Japanese below:

- Hearing chooses the track. `static` with data starting `なし` is a website (Astro): after the hearing note, skip PRD, mockup, mode, design, and ticket splits. Write the seven answers briefly in `docs/00-hearing.md` and run `accept-summary --by bot` without asking for approval. Deploy an empty page to production first with `npm run deploy` (the script runs the pinned Wrangler; `guard --root` then a user yes), then build the content, then one pull request with a verification video, then check the production URL. Websites may build and deploy with Wrangler. Do not use `npx` to fetch a latest CLI, and do not install CLIs globally.
- Anything else is an app (Void): hearing → PRD → mockup → mode → design → tickets → implement → deploy. Do not skip or reorder those. The first ticket is T1 titled `空のアプリをCloudflare本番に出す` (repo, Void, needed D1 or other resources and bindings, deploy with `cf` or the Void CLI, confirm the production URL). Later pull requests stay deployable. Deploy and resource creation still need a user yes.
- Ask one hearing question at a time. The only wording is what `node tools/gate/cli.mjs next` prints.
- At PRD (apps only), copy `templates/prd.md` to `docs/prd.md` and fill it. Ask at most three questions per turn, only what is still missing for the pitch, target and problem, success metrics, features (P0/P1/P2/Won't), screen flow, monetization and cost, and GTM. Do not ask again when the answer is already known. Do not delete unused sections; write 該当なし. Keep the maximum of three features. If `who` starts with `自分だけ`, do not ask the revenue model, pricing, GTM, differentiation, or the revenue and growth success rows. Write `該当なし（自分用）` there. Fill infrastructure cost as the Cloudflare free tier. Do not edit the template.
- At design, copy `templates/design-doc.md` to `docs/design-doc.md` and fill every section. Ask only decisions only the user can make, such as auth, billing, and domain. Do not ask again when the answer is already known. Do not delete unused sections; write 該当なし.
- After the user accepts the PRD, build a dependency-free HTML mock of the PRD screen flow and P0 screens only, under `docs/mockup/` (`index.html` links to each screen). Show phone-width and desktop-width screenshots and wait for OK. The OK is required in both modes. Revise and show again when asked. Reflect spec changes in `docs/prd.md`. Do not add a feature; a fourth feature is a note for the next version, in the PRD Won't row. The mock aligns the overall image and rough UI only. It is not the visual source of truth. Design and implementation may glance at it. Do not compare implementation PRs against it.
- After the user accepts the mockup, ask once: `full-auto` or `approval`.
- In both modes, destructive data operations and anything that costs money stop for an explicit user yes. Run `node tools/gate/cli.mjs guard --command "<exact command>"` first. Exit 3 means wait. Exit 4 means the command is forbidden.
- Websites use Astro and may build and deploy with Wrangler. Applications use Void (Void SDK, deployed with the Void CLI). Host on Cloudflare. Apps deploy with `cf` or the Void CLI, not Wrangler.
- One pull request per ticket. A PR without a verification video is not done. Record it with `tools/verify-record/record.mjs`. The gate rejects a missing, tiny, or non-video file.
- Where `docs/cloudflare-deploy.md` says TODO, stop and say so. Do not invent CLI flags.

日本語の手順が上の規則と食い違って見えたら、上の規則を採る。

## 毎回最初にやること

プロダクトのルート（工場リポジトリでサンプルを触るなら `examples/kiosk-hours`）で次を実行する。

```sh
node tools/gate/cli.mjs next --root <プロダクトのルート>
```

ヒアリング中は、返った文章だけを利用者に見せる。質問をまとめない。PRD と Design Doc では `next` の手順に従い、不足分だけを聞く。先回りして実装を始めない。利用者が答えたら、対応するサブコマンドを実行し、もう一度 `next` を見る。

状態は `<ルート>/.mamestack/state.json` にある。手で phase を書き換えない。戻すサブコマンドは無い。やり直すときは、利用者がディレクトリの削除を明示したときだけ消す。

## 1. Hearing

`init --root <dir> --name <名前>` のあと、`next` の質問を一問ずつ聞く。サイトかどうかは、このあとでしか決まらない。

答えは短くても、ゲートが求める形を守る。

- `shape` は `static`（サイト、Astro）か `dynamic`（アプリ、Void）だけ。保存があるなら `dynamic`。
- `features` は JSON で 1〜3 個。各要素は `name` と `release`（`v1` か `later`）。v1 が一つは要る。
- 保存が無いとき、`data` は「なし」で始める。ドメインを使わないとき、`domain` も「なし」で始める。
- 使うのが自分だけのとき、`who` は「自分だけ」で始める。

七つ揃ったら `docs/00-hearing.md` に見出し `# 要求まとめ` で残す。七つの答えの文字列は、要約で消さない。

- サイト（`static` かつ `data` が「なし」）: 短く書いて、承認は待たない。`accept-summary --by bot`。PRD、モック、モード、設計書、チケット分割は飛ばして実装へ進む。
- アプリ（それ以外。保存がある静的の答えも含む）: 利用者の受理のあと `accept-summary --by user`。以降がフルコース。

`--by user` は、直前の利用者メッセージがその承認だと読めるときだけ付ける。サイトの `--by bot` は、承認を取らないためのもので、アプリには付けない。

## 2. PRD

`templates/prd.md` を `docs/prd.md` に写して埋める。`init` が既に置いていれば、それを埋める。見出し、表、チェックリストは残す。

埋めるのは次である。エレベーターピッチ、ターゲットと課題、成功指標、機能要件（P0 / P1 / P2 / Won't）、画面フロー、マネタイズ・コスト、GTM。

ヒアリングで答えが出ている項目は聞き直さない。足りないことだけを、1回につき3問まで聞く。機能はヒアリングと同じで最大3つ。行やセクションが余っても削らず、「該当なし」と書く。ヒアリングの機能名は機能要件に残す。

`who` が「自分だけ」で始まるときは、収益モデル、プライシング、リリース＆マーケティング計画（GTM）、既存サービスとの差別化、成功指標の収益・グロース行は質問しない。そこへ「該当なし（自分用）」と書く。インフラ許容コストは Cloudflare 無料枠を前提に埋める。テンプレート本文は変えない。

利用者に全文を見せ、OK まで待つ。修正依頼は同じフェーズで直す。OK なら `approve-prd --by user`。

## 3. モックアップ

PRD の OK のあと、モードを聞く前に作る。`init` は `docs/mockup/` を作らない。

PRD の画面フローと P0 の画面だけを、依存なしの HTML と CSS で置く。入口は `docs/mockup/index.html` で、各画面へリンクする。JS は画面切替など最小限、データはダミー。外部の script や stylesheet は置かない。

スマホ幅と PC 幅のスクショを撮り、利用者に見せる。修正が来たら直して、また見せる。仕様に関わる変更は `docs/prd.md` にも反映する。機能は足さない。4つ目は次の版のメモとして、PRD の Won't に一行残す。

これは全体のイメージと大まかな UI をすり合わせるためのものである。見た目の正にはしない。Design Doc と実装では参考程度に見る。実装 PR でモックとの差は確認しない。

OK はモードに関係なく利用者からもらう。OK なら `approve-mockup --by user`。

## 4. モード

モック承認の直後に、`next` が返すモードの質問を一度だけ聞く。

- `full-auto`: 設計書、チケットの粒度、実装 PR はボットが進める。
- `approval`: 設計書、チケットの粒度、各 PR を利用者が承認する。

選ばれた語を `docs/03-mode.md` に書き、`set-mode --mode <full-auto|approval> --by user`。この質問を実装の途中で繰り返さない。

どちらのモードでも、次は確認が要る。

- デプロイ（`cf deploy`, `void deploy`）
- データベースやオブジェクトの作成・削除・復元・ロールバック
- 書き込み SQL、`--force`
- 本番シークレット
- ドメインの購入や、DNS を変える操作

迷ったら確認する。`guard` が allow でも、データが消えるなら止まる。

## 5. Design Doc

`templates/design-doc.md` を `docs/design-doc.md` に写して埋める。`init` が既に置いていれば、それを埋める。見出し、表、チェックリストは残す。使わないセクションは削らず「該当なし」と書く。

利用者にしか決められないこと（認証、課金、ドメインなど）だけ聞く。ヒアリングと PRD で答えが出ている項目は聞き直さない。

アプリのテンプレートに wrangler とあっても、コマンドは cf / Void CLI に読み替える。サイト（Astro）のビルドとデプロイは Wrangler を使う。

フレームワークは次で、例外を黙って作らない。

| ヒアリング | 使うもの |
| --- | --- |
| `static` かつ data が「なし」 | Astro |
| `dynamic`、または保存するデータがある | Void |

ホスティングは Cloudflare。公開はどちらも `npm run deploy`。サイト（Astro）の script は固定バージョンの Wrangler、アプリ（Void）の script は Void CLI。アプリの資源操作は `cf`。詳細と、実行してはいけない未検証は `docs/framework-selection.md` と `docs/cloudflare-deploy.md`。

性能を先に書く。静的に出せる画面は静的のまま、UI フレームワークを足さない。クライアント JS は v1 の操作に要る分だけ。モックは参考程度に見る。見た目の正にはしない。

`approval` では利用者の OK のあと `approve-design --by user`。`full-auto` では書いた直後に `approve-design --by bot`。選定理由は設計書と同じ文を `--reason` に渡す。

## 6. チケット

最初の1枚は必ず T1「空のアプリをCloudflare本番に出す」。これは設計とチケットの確定のあと、`implement` で行う。中身は、リポジトリ作成、Void の導入（`void init` を含む）、必要な D1 等のリソース作成とバインディング、`cf` または Void CLI でのデプロイ、本番 URL での表示確認。資源の作成とデプロイは利用者の確認が要る。この1枚の `feature` はヒアリングの機能名でなくてよい。空の公開の記録は [docs/cloudflare-deploy.md](docs/cloudflare-deploy.md)。

その後、v1 の機能ごとに `templates/ticket.md` で `docs/tickets/T2.md` のように書き、`add-ticket` する。

- サイズは S か M。L は分割するまで登録できない。
- `feature` はヒアリングの機能名と一致させる。`later` はチケットにしない。
- 受入条件は、画面を操作して動画に映る文で書く。

`approval` では枚数と粒度の OK を待って `confirm-tickets --by user`。`full-auto` では `confirm-tickets --by bot`。

## 7. 実装

### サイト

`init` はヒアリングの前に済んでいる。`.mamestack` と `docs` を一時ディレクトリへ移してからプロダクトのルートで `npm create astro` を実行し、終わったら戻す。残したままだと create-astro は終了コード 0 で別フォルダを作り、もう一度 `init` すると「既に init 済みです」で失敗する。手順は [setup](.cursor/skills/setup/SKILL.md) のサイトの節。最初に空ページを出す。記録は [docs/cloudflare-deploy.md](docs/cloudflare-deploy.md) の空の公開（`confirm-deploy --milestone empty`）。`v1` は検証動画のあと。出た URL を見てから中身を作り、PR を1枚と検証動画を残して `attach-pr` する。

### アプリ

開いているチケットを一つだけ実装する。PR は一枚。T1 の空の公開は [docs/cloudflare-deploy.md](docs/cloudflare-deploy.md) の空の公開で、実装中に記録する。各 PR のあと、本番に出せる状態を保つ。デプロイそのものは利用者の確認が要る。

1. ローカルで受入条件を満たす。
2. `docs/verification-video.md` の手順で Playwright の動画を録る。終了コードが 0 のときだけ次へ進む。
3. `templates/pull-request.md` を `docs/prs/T1.md` に書く。`検証動画:`、`録画コマンド:`、`終了コード: 0` を入れる。
4. `attach-pr --ticket T1 --pr docs/prs/T1.md --video recordings/t1.webm`
5. `approval` では、attach の前に PR 本文を利用者へ見せて OK を取る。OK 前に `attach-pr` しない。

動画ファイルがディスクにあり、WebM か MP4 で、1KB より大きいことをゲートが見る。リンクだけの PR は完了にならない。モックとの差分確認はしない。

全チケットが付いたら phase は `deploy` になる。

## 8. デプロイ

マイルストーンは v1 の公開一つをゲートが持つ。コマンドはどちらも `npm run deploy`。サイトの script は Wrangler、アプリの script は Void CLI。サイトはヒアリングの直後に、アプリは設計の確定時に固定される。本番 URL で表示を確認する。

利用者に、何が公開され、何が未検証で、費用が出るかを伝えてから `confirm-deploy --by user --decision run|skip`。`run` のあとだけコマンドを実行し、成功したら `mark-deploy --exit 0`。失敗したら mark せず、直してからまた確認する。

`docs/cloudflare-deploy.md` が TODO としている操作は、run を提案しない。サイト（Astro）は `cf` ではビルドできないため、ビルドとデプロイに Wrangler を使う。アプリは Wrangler に切り替えない。

独自ドメインの購入コマンドは未検証である。購入は費用がかかるので、コマンド名が公式で分かるまで実行しない。

## スキル

手順の入口である。規則の本文はリンク先で、ここには写さない。

- [setup](.cursor/skills/setup/SKILL.md) — 依存の固定と `npm ci`
- [scaffold](.cursor/skills/scaffold/SKILL.md) — 初期化と、空のままの本番公開
- [verify-record](.cursor/skills/verify-record/SKILL.md) — 受入条件の録画
- [deploy](.cursor/skills/deploy/SKILL.md) — 公開と本番 URL の確認
- [pr-finish](.cursor/skills/pr-finish/SKILL.md) — PR を1枚閉じる

## コマンド早見

工場リポジトリのルートで、Node.js 22.18 以上。

```sh
node tools/gate/cli.mjs init --root <dir> --name <名前>
node tools/gate/cli.mjs next --root <dir>
node tools/gate/cli.mjs check --root <dir>
node tools/gate/cli.mjs guard --command "cf zones list"
```

`check` がエラーを返したら、phase を飛ばした状態である。エラーのファイルを直すか、利用者に欠落を伝える。ゲートを弱めて通さない。
