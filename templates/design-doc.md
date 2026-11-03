# 【プロダクト名】Design Doc（技術設計書・Cloudflare構成テンプレート）

作成日: Date
最終更新日: Date
関連リンク: [PRD URL] / [GitHub URL] / [Cloudflare Dashboard URL]

## 1. 技術スタック選定（Cloudflareフルスタック構成）

インフラ・バックエンドリソースをCloudflareエコシステムに統一し、エグレス（転送量）課金ゼロ・爆速エッジ実行・低コスト運用を実現します。

**採用フレームワークの選択（いずれかを選択）:**

- [ ] **Astro**（コンテンツ重視・Island Architecture・SSG/SSRハイブリッド）
- [ ] **Void**（軽量・高速エッジネイティブ構成）

| レイヤー | 採用技術 / Cloudflareサービス | 役割・構成詳細 | コスト目安（Free / Paid） |
| --- | --- | --- | --- |
| Frontend / Fullstack | **Cloudflare Pages / Workers**（**Astro** または **Void** から選択） | プロジェクト特性に合わせて **Astro** または **Void** を選択し、Cloudflareアダプターでエッジホスティング | Free ($0) |
| API / Serverless | **Cloudflare Workers**（**Astro / Void** のAPI機能 または Hono） | 軽量API・Webhook受信・Cron Triggers（定期実行） | Free または Workers Paid ($5/月) |
| Database (RDB) | Cloudflare D1 + Drizzle ORM | SQLiteベースのエッジRDB。スキーマ管理はDrizzle Kitを使用 | Free枠（5GBまで無料） |
| Storage (Object) | Cloudflare R2 | 画像・動画・静的アセット保存（S3互換・エグレス通信料無料） | Free枠（10GB/月まで無料） |
| Cache / Session | Cloudflare KV | セッション管理、レートリミット用カウンタ、高速キャッシュ | Free枠あり |
| Queue / Async | Cloudflare Queues / Workflows | 重い非同期処理・外部APIリトライ制御（Workers Paid時） | Paid ($5/月〜) |
| AI / LLM | Workers AI / AI Gateway | 外部LLM（OpenAI / Claude / Gemini）のキャッシュ・ログ・レート制限管理 | AI Gatewayは無料 |
| DNS / Security | Cloudflare DNS / Turnstile / WAF | ドメイン管理、Bot対策（reCAPTCHA代替のTurnstile）、DDoS防御 | Free ($0) |
| Auth / Payment | （例：Better Auth / Auth.js / Clerk） + Stripe | 認証と決済基盤 | 従量課金 |

## 2. システムアーキテクチャ＆バインディング設計

Cloudflareのリソース間連携（Bindings）と `wrangler.jsonc`（または `wrangler.toml`）の定義方針です。

### 全体データフロー

- `[Browser / Client]` ⇄ `[Cloudflare CDN / WAF / Turnstile]` ⇄ `[Pages / Workers (Astro or Void)]`
  - ⇄ `env.DB` (Cloudflare D1: メインデータ永続化)
  - ⇄ `env.BUCKET` (Cloudflare R2: ファイル・画像アップロード用Presigned URLまたはWorker経由保存)
  - ⇄ `env.KV` (Cloudflare KV: キャッシュ・レートリミット)
  - ⇄ `[AI Gateway]` ⇄ [外部LLM API / Stripe API]

### Cloudflare Bindings一覧（`wrangler.jsonc` 定義）

| バインディング変数名 | リソース種別 | 本番リソース名 | 用途・備考 |
| --- | --- | --- | --- |
| `DB` | D1 Database | `prod-[app-name]-db` | メインデータベース |
| `BUCKET` | R2 Bucket | `prod-[app-name]-assets` | ユーザーアップロード画像等 |
| `KV_CACHE` | KV Namespace | `prod-[app-name]-kv` | セッション・一時キャッシュ |
| `AI` | Workers AI / Gateway | `[gateway-name]` | LLM呼び出しプロキシ |

## 3. データモデル（Cloudflare D1 / SQLite スキーマ設計）

D1（SQLite）の特性に合わせ、UUIDや日時（INTEGER Unix Timestamp または TEXT ISO8601）、JSONカラムを設計します。マイグレーションは `wrangler d1 migrations` + `drizzle-kit` で管理します。

### `users`（ユーザー）

- `id` (TEXT, PK) — UUID v4 / NanoID
- `email` (TEXT, UNIQUE, NOT NULL)
- `name` (TEXT)
- `plan` (TEXT, DEFAULT 'free') — `'free' | 'pro'`
- `stripe_customer_id` (TEXT)
- `created_at` (INTEGER, NOT NULL) — Unix timestamp (ms)

### `[main_entities]`（メインリソース）

- `id` (TEXT, PK)
- `user_id` (TEXT, NOT NULL, FK -> users.id)
- `title` (TEXT, NOT NULL)
- `r2_object_key` (TEXT) — R2上のファイルパス（画像等がある場合）
- `metadata_json` (TEXT) — SQLite JSON文字列
- `created_at` (INTEGER, NOT NULL)

### インデックス設計

- `idx_main_entities_user_id` ON `[main_entities](user_id, created_at DESC)` （D1のRead Row数を節約するため必須）

## 4. 主要API / エッジ処理フロー設計

Cloudflare WorkersのCPU時間制限（Free: 10ms / Paid: 30s〜）やサブリクエスト制限を考慮した設計にします。

### エンドポイント / Action名: `POST /api/xxx`

- **認証・Bot対策:** Cloudflare Turnstileトークン検証 ＋ セッション確認
- **入力（Request）:** `{ ... }`（Zodでバリデーション）
- **処理ステップ:**
  - KVでユーザーのレートリミット確認
  - D1から必要データを取得（バッチクエリ `db.batch()` を活用）
  - 外部API（AI Gateway経由）またはR2への書き込み
  - D1へ結果保存
- **出力（Response）:** `{ ... }`
- **エラーハンドリング:** タイムアウト時、レートリミット超過時（429 Too Many Requests）のフォールバック

## 5. セキュリティ・高額課金防止チェックリスト（Cloudflare特化）

個人開発で事故（炎上・DDoS・無限ループ課金）を防ぐためのガードレールです。

- [ ] **シークレット管理:** APIキー等は `.env` に直書きせず、`wrangler secret put` またはダッシュボードの暗号化変数で管理しているか
- [ ] **D1クエリ最適化:** フルテーブルスキャンによる「Rows Read」爆発を防ぐため、`WHERE` 句のカラムに必ずインデックスを貼っているか
- [ ] **R2の公開制御:** プライベートなファイルバケットがパブリックアクセス不可になっているか（カスタムドメイン公開時はキャッシュ制御を設定）
- [ ] **Bot・スパム対策:** ログイン画面や重いAPIの前に Cloudflare Turnstile と WAF Rate Limiting Rules を設定しているか
- [ ] **AI Gatewayのガードレール:** LLMを使う場合、Cloudflare AI GatewayでRate Limitとキャッシュを有効化しているか
- [ ] **認可（Authorization）:** API・Server Actions内で必ずログイン中ユーザーの `user_id` 一致チェックを行っているか

## 6. 技術的トレードオフ・割り切りメモ（ADR）

「あえて今はやらないこと」「技術的負債として許容すること」をメモしておきます。

- **決定事項1（ローカル開発環境）:** Miniflare（`wrangler dev`）のローカルD1/R2エミュレータを使用し、ステージング環境はPagesのPreview Deploymentで代替する。
- **決定事項2（管理画面・テスト）:** 管理画面は作らず `wrangler d1 execute` や Drizzle Studio で直接データを参照・操作する。テストはコアロジックの単体テスト（Vitest）のみに絞る。

## 7. 開発マイルストーン＆タスク分解

1タスク＝1〜2時間で終わる粒度に分解します。

### Phase 1: Cloudflare環境構築・プロトタイプ

- [ ] リポジトリ作成・フレームワーク選択（Astro または Void）＋ Cloudflare Pages/Workers テンプレート導入
- [ ] `wrangler` で D1 Database / R2 Bucket 作成＆バインディング設定
- [ ] Drizzle ORM導入・初期マイグレーション適用（ローカル＆本番）
- [ ] 認証（Google OAuth等）の導線確認

### Phase 2: MVPコア機能実装

- [ ] [コア機能A] の実装（D1読み書き / R2連携）
- [ ] [コア機能B] の実装
- [ ] エラーハンドリング・Turnstile導入・ローディングUI実装

### Phase 3: リリース準備・公開

- [ ] Cloudflare DNSでカスタムドメイン接続・OGP設定
- [ ] WAFレートリミット設定・Stripe本番Webhook接続（必要な場合）
- [ ] ローンチ告知（X / Zenn記事執筆 / YouTube等）
