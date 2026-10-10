/*
# Zen台帳システムのデータモデル作成（初回適用版）

1. 概要
本プロトタイプは「循環型期限付きクーポンZen」と「貢献スコアZen+」の基盤を構築する。
すべての残高変動は台帳イベントとして記録し、残高を直接書き換えない。

2. 新規テーブル（10テーブル）
- `zen_users` — デモ/本番ユーザー、店舗、事業者（id は text）
- `zen_asset_accounts` — ユーザー別資産口座（Zen / Zen+ / 共通プール）
- `zen_lots` — Zen発行ロット（期限付き、id は text）
- `zen_ledger_events` — 台帳イベント履歴（id は text、append-only）
- `zen_lock_records` — ロック記録
- `zen_missions` — ミッション定義（id は text）
- `zen_contributions` — Zen+獲得理由・貢献分類
- `zen_transactions` — 購入・取引記録
- `zen_fee_records` — 縁環料・手数料記録
- `zen_reserve_account` — みんなの蓄財Zen（全）共通プール

3. ID型の設計方針
- コードから文字列ID（'demo-user-0001', 'm1', 'evt_seed_...', 'lot_seed_...' 等）を
  挿入する列は text 型とする。
- 自動生成されるUUIDをそのまま使う列（zen_asset_accounts.id, zen_transactions.id 等）は
  uuid 型を維持する。
- 外部キー制約は参照先の型に合わせる。

4. セキュリティ
- プロトタイプのため認証なし。RLSを有効化し、anon に SELECT / INSERT を許可。
- zen_ledger_events は append-only とし、UPDATE / DELETE を anon に許可しない。
- zen_reserve_account は SELECT のみ anon に許可。残高変更はサーバー側でのみ実行する設計。
- すべてのテーブルで DELETE を anon に許可しない。
- 本番では認証ベースのポリシーに切り替える必要がある。

5. 重要事項
- 金額は整数（bigint、最小単位1）で管理。浮動小数点誤差を回避。
- zen_lots は発行単位ごとに期限を追跡。単一残高数値に集約しない。
- 共通プールは通常ユーザー口座と分離。
- 台帳イベントは削除・上書きしない。訂正はADJUSTMENTイベントで記録。
- zen_reserve_account に created_at カラムを追加（data-access.ts が ORDER BY で参照）。
*/

-- === ユーザー ===
-- id は text: 'demo-user-0001', 'demo-store-0001', 'common-reserve-0001' 等の文字列IDを使用
CREATE TABLE IF NOT EXISTS zen_users (
  id text PRIMARY KEY,
  name text NOT NULL,
  display_name text NOT NULL,
  is_demo boolean NOT NULL DEFAULT true,
  account_type text NOT NULL DEFAULT 'user' CHECK (account_type IN ('user', 'store', 'business', 'common_reserve')),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- === 資産口座 ===
-- id は uuid（自動生成）: コードから手動ID挿入なし
-- user_id は text: zen_users.id を参照
CREATE TABLE IF NOT EXISTS zen_asset_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL REFERENCES zen_users(id) ON DELETE CASCADE,
  asset_type text NOT NULL CHECK (asset_type IN ('zen', 'zen_plus', 'common_reserve')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, asset_type)
);

-- === Zen発行ロット ===
-- id は text: 'lot_seed_...' 等の文字列IDを使用
-- account_id は uuid: zen_asset_accounts.id を参照
-- source_event_id, original_lot_id, parent_event_id は text: zen_ledger_events.id / zen_lots.id を参照
CREATE TABLE IF NOT EXISTS zen_lots (
  id text PRIMARY KEY,
  account_id uuid NOT NULL REFERENCES zen_asset_accounts(id) ON DELETE CASCADE,
  amount bigint NOT NULL CHECK (amount >= 0),
  remaining_amount bigint NOT NULL CHECK (remaining_amount >= 0),
  issued_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  source_event_id text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'used', 'locked', 'transferred')),
  locked_amount bigint NOT NULL DEFAULT 0 CHECK (locked_amount >= 0),
  original_lot_id text,
  parent_event_id text
);
CREATE INDEX IF NOT EXISTS idx_zen_lots_account ON zen_lots(account_id);
CREATE INDEX IF NOT EXISTS idx_zen_lots_status ON zen_lots(status);
CREATE INDEX IF NOT EXISTS idx_zen_lots_expires ON zen_lots(expires_at);

-- === 台帳イベント ===
-- id は text: 'evt_seed_...' 等の文字列IDを使用
-- account_id, from_account_id, to_account_id は uuid: zen_asset_accounts.id を参照（NULL許容）
-- lot_id は text: zen_lots.id を参照
-- parent_event_id は text: 自己参照
-- transaction_id は text: zen_transactions.id との参照（FK制約なし、将来追加）
CREATE TABLE IF NOT EXISTS zen_ledger_events (
  id text PRIMARY KEY,
  event_type text NOT NULL,
  account_id uuid,
  from_account_id uuid,
  to_account_id uuid,
  asset_type text NOT NULL CHECK (asset_type IN ('zen', 'zen_plus', 'common_reserve')),
  amount bigint NOT NULL DEFAULT 0,
  lot_id text,
  new_expires_at timestamptz,
  parent_event_id text,
  transaction_id text,
  reason text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'confirmed' CHECK (status IN ('pending', 'confirmed', 'reversed')),
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_zen_ledger_account ON zen_ledger_events(account_id);
CREATE INDEX IF NOT EXISTS idx_zen_ledger_from ON zen_ledger_events(from_account_id);
CREATE INDEX IF NOT EXISTS idx_zen_ledger_to ON zen_ledger_events(to_account_id);
CREATE INDEX IF NOT EXISTS idx_zen_ledger_type ON zen_ledger_events(event_type);
CREATE INDEX IF NOT EXISTS idx_zen_ledger_transaction ON zen_ledger_events(transaction_id);

-- === ロック記録 ===
-- id は uuid（自動生成）: コードから手動ID挿入なし
-- account_id は uuid: zen_asset_accounts.id を参照
-- lot_id は text: zen_lots.id を参照
-- locked_by_event_id, unlocked_by_event_id は text: zen_ledger_events.id を参照
CREATE TABLE IF NOT EXISTS zen_lock_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES zen_asset_accounts(id) ON DELETE CASCADE,
  lot_id text REFERENCES zen_lots(id) ON DELETE SET NULL,
  asset_type text NOT NULL CHECK (asset_type IN ('zen', 'zen_plus')),
  amount bigint NOT NULL CHECK (amount >= 0),
  locked_at timestamptz NOT NULL DEFAULT now(),
  unlock_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'locked' CHECK (status IN ('locked', 'unlocked', 'expired')),
  locked_by_event_id text REFERENCES zen_ledger_events(id),
  unlocked_by_event_id text REFERENCES zen_ledger_events(id)
);
CREATE INDEX IF NOT EXISTS idx_zen_locks_account ON zen_lock_records(account_id);
CREATE INDEX IF NOT EXISTS idx_zen_locks_status ON zen_lock_records(status);

-- === ミッション定義 ===
-- id は text: 'm1', 'm2', 'm3' 等の文字列IDを使用
CREATE TABLE IF NOT EXISTS zen_missions (
  id text PRIMARY KEY,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  reward_zen bigint NOT NULL DEFAULT 0 CHECK (reward_zen >= 0),
  reward_zen_plus bigint NOT NULL DEFAULT 0 CHECK (reward_zen_plus >= 0),
  goal integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- === 貢献記録（Zen+獲得理由）===
-- user_id は text: zen_users.id を参照
-- related_mission_id は text: zen_missions.id を参照
-- event_id は text: zen_ledger_events.id を参照
CREATE TABLE IF NOT EXISTS zen_contributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL REFERENCES zen_users(id) ON DELETE CASCADE,
  category text NOT NULL,
  reason text NOT NULL,
  zen_plus_amount bigint NOT NULL CHECK (zen_plus_amount >= 0),
  related_mission_id text REFERENCES zen_missions(id) ON DELETE SET NULL,
  event_id text REFERENCES zen_ledger_events(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_zen_contributions_user ON zen_contributions(user_id);

-- === 取引記録 ===
-- id は uuid（自動生成）: 現コードから手動ID挿入なし
-- buyer_id, seller_id は text: zen_users.id を参照
CREATE TABLE IF NOT EXISTS zen_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id text NOT NULL REFERENCES zen_users(id) ON DELETE CASCADE,
  seller_id text NOT NULL REFERENCES zen_users(id) ON DELETE CASCADE,
  item_name text NOT NULL,
  price_yen bigint NOT NULL DEFAULT 0 CHECK (price_yen >= 0),
  zen_applied_amount bigint NOT NULL DEFAULT 0 CHECK (zen_applied_amount >= 0),
  zen_application_rate numeric(5,4) NOT NULL DEFAULT 0.20 CHECK (zen_application_rate >= 0 AND zen_application_rate <= 1.0),
  circulation_fee_yen bigint NOT NULL DEFAULT 0,
  circulation_fee_zen bigint NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_zen_tx_buyer ON zen_transactions(buyer_id);
CREATE INDEX IF NOT EXISTS idx_zen_tx_seller ON zen_transactions(seller_id);

-- === 手数料記録 ===
-- transaction_id は uuid: zen_transactions.id を参照
-- event_id は text: zen_ledger_events.id を参照
CREATE TABLE IF NOT EXISTS zen_fee_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid NOT NULL REFERENCES zen_transactions(id) ON DELETE CASCADE,
  fee_type text NOT NULL CHECK (fee_type IN ('circulation', 'digital_asset')),
  asset_type text NOT NULL CHECK (asset_type IN ('yen', 'zen')),
  amount bigint NOT NULL CHECK (amount >= 0),
  destination text NOT NULL CHECK (destination IN ('system_ops', 'common_reserve')),
  event_id text REFERENCES zen_ledger_events(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_zen_fees_tx ON zen_fee_records(transaction_id);

-- === 共通プール（みんなの蓄財 Zen（全））===
-- id は uuid（自動生成）
-- created_at カラムを追加: data-access.ts の getReserveBalance() が ORDER BY created_at で参照
CREATE TABLE IF NOT EXISTS zen_reserve_account (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  balance bigint NOT NULL DEFAULT 0 CHECK (balance >= 0),
  burn_enabled boolean NOT NULL DEFAULT false,
  burn_rate numeric(10,6),
  burn_policy text,
  burn_schedule text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- =====================================================
-- === RLS 有効化 ===
-- =====================================================
ALTER TABLE zen_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE zen_asset_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE zen_lots ENABLE ROW LEVEL SECURITY;
ALTER TABLE zen_ledger_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE zen_lock_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE zen_missions ENABLE ROW LEVEL SECURITY;
ALTER TABLE zen_contributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE zen_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE zen_fee_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE zen_reserve_account ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- === RLS ポリシー ===
-- プロトタイプ（認証なし）のアクセス設計:
--
-- SELECT: 全テーブルで anon に読み取りを許可（UI表示に必要）
-- INSERT: データ作成に必要なテーブルのみ anon に許可
-- UPDATE: zen_lots のみ anon に許可（残高更新に必要、将来的にサーバー側へ移行すべき）
-- DELETE: 全テーブルで anon を拒否（台帳の整合性保護）
--
-- 特に制限の強いテーブル:
-- - zen_ledger_events: INSERT のみ許可、UPDATE/DELETE 拒否（append-only）
-- - zen_reserve_account: SELECT のみ許可、INSERT/UPDATE/DELETE 拒否（サーバー側でのみ操作）
-- =====================================================

-- --- zen_users ---
DROP POLICY IF EXISTS "zen_users_select" ON zen_users;
CREATE POLICY "zen_users_select" ON zen_users FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "zen_users_insert" ON zen_users;
CREATE POLICY "zen_users_insert" ON zen_users FOR INSERT TO anon, authenticated WITH CHECK (true);

-- UPDATE / DELETE は anon に許可しない

-- --- zen_asset_accounts ---
DROP POLICY IF EXISTS "zen_accounts_select" ON zen_asset_accounts;
CREATE POLICY "zen_accounts_select" ON zen_asset_accounts FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "zen_accounts_insert" ON zen_asset_accounts;
CREATE POLICY "zen_accounts_insert" ON zen_asset_accounts FOR INSERT TO anon, authenticated WITH CHECK (true);

-- UPDATE / DELETE は anon に許可しない

-- --- zen_lots ---
DROP POLICY IF EXISTS "zen_lots_select" ON zen_lots;
CREATE POLICY "zen_lots_select" ON zen_lots FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "zen_lots_insert" ON zen_lots;
CREATE POLICY "zen_lots_insert" ON zen_lots FOR INSERT TO anon, authenticated WITH CHECK (true);

-- UPDATE のみ許可（残高更新に必要、将来的にサーバー側APIへ移行すべき）
DROP POLICY IF EXISTS "zen_lots_update" ON zen_lots;
CREATE POLICY "zen_lots_update" ON zen_lots FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

-- DELETE は anon に許可しない

-- --- zen_ledger_events ---
-- append-only: INSERT のみ許可、UPDATE / DELETE 拒否
DROP POLICY IF EXISTS "zen_events_select" ON zen_ledger_events;
CREATE POLICY "zen_events_select" ON zen_ledger_events FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "zen_events_insert" ON zen_ledger_events;
CREATE POLICY "zen_events_insert" ON zen_ledger_events FOR INSERT TO anon, authenticated WITH CHECK (true);

-- UPDATE / DELETE はポリシーを定義しない = 拒否

-- --- zen_lock_records ---
DROP POLICY IF EXISTS "zen_locks_select" ON zen_lock_records;
CREATE POLICY "zen_locks_select" ON zen_lock_records FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "zen_locks_insert" ON zen_lock_records;
CREATE POLICY "zen_locks_insert" ON zen_lock_records FOR INSERT TO anon, authenticated WITH CHECK (true);

-- UPDATE / DELETE は anon に許可しない

-- --- zen_missions ---
DROP POLICY IF EXISTS "zen_missions_select" ON zen_missions;
CREATE POLICY "zen_missions_select" ON zen_missions FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "zen_missions_insert" ON zen_missions;
CREATE POLICY "zen_missions_insert" ON zen_missions FOR INSERT TO anon, authenticated WITH CHECK (true);

-- UPDATE / DELETE は anon に許可しない

-- --- zen_contributions ---
DROP POLICY IF EXISTS "zen_contrib_select" ON zen_contributions;
CREATE POLICY "zen_contrib_select" ON zen_contributions FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "zen_contrib_insert" ON zen_contributions;
CREATE POLICY "zen_contrib_insert" ON zen_contributions FOR INSERT TO anon, authenticated WITH CHECK (true);

-- UPDATE / DELETE は anon に許可しない

-- --- zen_transactions ---
DROP POLICY IF EXISTS "zen_tx_select" ON zen_transactions;
CREATE POLICY "zen_tx_select" ON zen_transactions FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "zen_tx_insert" ON zen_transactions;
CREATE POLICY "zen_tx_insert" ON zen_transactions FOR INSERT TO anon, authenticated WITH CHECK (true);

-- UPDATE / DELETE は anon に許可しない

-- --- zen_fee_records ---
DROP POLICY IF EXISTS "zen_fees_select" ON zen_fee_records;
CREATE POLICY "zen_fees_select" ON zen_fee_records FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "zen_fees_insert" ON zen_fee_records;
CREATE POLICY "zen_fees_insert" ON zen_fee_records FOR INSERT TO anon, authenticated WITH CHECK (true);

-- UPDATE / DELETE は anon に許可しない

-- --- zen_reserve_account ---
-- 共通プール残高はブラウザから変更不可。SELECT のみ許可。
-- INSERT / UPDATE / DELETE はサーバー側（Edge Function / サービスロールキー）でのみ実行する設計。
DROP POLICY IF EXISTS "zen_reserve_select" ON zen_reserve_account;
CREATE POLICY "zen_reserve_select" ON zen_reserve_account FOR SELECT TO anon, authenticated USING (true);

-- INSERT / UPDATE / DELETE はポリシーを定義しない = anon には拒否
