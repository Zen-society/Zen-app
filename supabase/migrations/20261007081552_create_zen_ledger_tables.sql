/*
# Zen台帳システムのデータモデル作成

1. 概要
本プロトタイプは「循環型期限付きクーポンZen」と「貢献スコアZen+」の基盤を構築する。
すべての残高変動は台帳イベントとして記録し、残高を直接書き換えない。

2. 新規テーブル
- `zen_users` — デモ/本番ユーザー、店舗、事業者
- `zen_asset_accounts` — ユーザー別資産口座（Zen / Zen+ / 共通プール）
- `zen_lots` — Zen発行ロット（期限付き）
- `zen_ledger_events` — 台帳イベント履歴
- `zen_lock_records` — ロック記録
- `zen_missions` — ミッション定義
- `zen_contributions` — Zen+獲得理由・貢献分類
- `zen_transactions` — 購入・取引記録
- `zen_fee_records` — 縁環料・手数料記録
- `zen_reserve_account` — みんなの蓄財Zen（全）共通プール

3. セキュリティ
- プロトタイプのため認証なし。RLSを有効化し anon, authenticated にCRUDを許可。
- 本番では認証ベースのポリシーに切り替える必要がある。

4. 重要事項
- 金額は整数（最小単位1）で管理。浮動小数点誤差を回避。
- zen_lots は発行単位ごとに期限を追跡。単一残高数値に集約しない。
- 共通プールは通常ユーザー口座と分離。
- 台帳イベントは削除・上書きしない。訂正はADJUSTMENTイベントで記録。
*/

-- ユーザー
CREATE TABLE IF NOT EXISTS zen_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  display_name text NOT NULL,
  is_demo boolean NOT NULL DEFAULT true,
  account_type text NOT NULL DEFAULT 'user' CHECK (account_type IN ('user', 'store', 'business', 'common_reserve')),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 資産口座
CREATE TABLE IF NOT EXISTS zen_asset_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES zen_users(id) ON DELETE CASCADE,
  asset_type text NOT NULL CHECK (asset_type IN ('zen', 'zen_plus', 'common_reserve')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, asset_type)
);

-- Zen発行ロット
CREATE TABLE IF NOT EXISTS zen_lots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES zen_asset_accounts(id) ON DELETE CASCADE,
  amount bigint NOT NULL CHECK (amount >= 0),
  remaining_amount bigint NOT NULL CHECK (remaining_amount >= 0),
  issued_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  source_event_id uuid,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'used', 'locked', 'transferred')),
  locked_amount bigint NOT NULL DEFAULT 0 CHECK (locked_amount >= 0),
  original_lot_id uuid,
  parent_event_id uuid
);
CREATE INDEX IF NOT EXISTS idx_zen_lots_account ON zen_lots(account_id);
CREATE INDEX IF NOT EXISTS idx_zen_lots_status ON zen_lots(status);
CREATE INDEX IF NOT EXISTS idx_zen_lots_expires ON zen_lots(expires_at);

-- 台帳イベント
CREATE TABLE IF NOT EXISTS zen_ledger_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  account_id uuid,
  from_account_id uuid,
  to_account_id uuid,
  asset_type text NOT NULL CHECK (asset_type IN ('zen', 'zen_plus', 'common_reserve')),
  amount bigint NOT NULL DEFAULT 0,
  lot_id uuid,
  new_expires_at timestamptz,
  parent_event_id uuid,
  transaction_id uuid,
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

-- ロック記録
CREATE TABLE IF NOT EXISTS zen_lock_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES zen_asset_accounts(id) ON DELETE CASCADE,
  lot_id uuid REFERENCES zen_lots(id) ON DELETE SET NULL,
  asset_type text NOT NULL CHECK (asset_type IN ('zen', 'zen_plus')),
  amount bigint NOT NULL CHECK (amount >= 0),
  locked_at timestamptz NOT NULL DEFAULT now(),
  unlock_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'locked' CHECK (status IN ('locked', 'unlocked', 'expired')),
  locked_by_event_id uuid REFERENCES zen_ledger_events(id),
  unlocked_by_event_id uuid REFERENCES zen_ledger_events(id)
);
CREATE INDEX IF NOT EXISTS idx_zen_locks_account ON zen_lock_records(account_id);
CREATE INDEX IF NOT EXISTS idx_zen_locks_status ON zen_lock_records(status);

-- ミッション定義
CREATE TABLE IF NOT EXISTS zen_missions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  reward_zen bigint NOT NULL DEFAULT 0 CHECK (reward_zen >= 0),
  reward_zen_plus bigint NOT NULL DEFAULT 0 CHECK (reward_zen_plus >= 0),
  goal integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 貢献記録（Zen+獲得理由）
CREATE TABLE IF NOT EXISTS zen_contributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES zen_users(id) ON DELETE CASCADE,
  category text NOT NULL,
  reason text NOT NULL,
  zen_plus_amount bigint NOT NULL CHECK (zen_plus_amount >= 0),
  related_mission_id uuid REFERENCES zen_missions(id) ON DELETE SET NULL,
  event_id uuid REFERENCES zen_ledger_events(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_zen_contributions_user ON zen_contributions(user_id);

-- 取引記録
CREATE TABLE IF NOT EXISTS zen_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id uuid NOT NULL REFERENCES zen_users(id) ON DELETE CASCADE,
  seller_id uuid NOT NULL REFERENCES zen_users(id) ON DELETE CASCADE,
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

-- 手数料記録
CREATE TABLE IF NOT EXISTS zen_fee_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid NOT NULL REFERENCES zen_transactions(id) ON DELETE CASCADE,
  fee_type text NOT NULL CHECK (fee_type IN ('circulation', 'digital_asset')),
  asset_type text NOT NULL CHECK (asset_type IN ('yen', 'zen')),
  amount bigint NOT NULL CHECK (amount >= 0),
  destination text NOT NULL CHECK (destination IN ('system_ops', 'common_reserve')),
  event_id uuid REFERENCES zen_ledger_events(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_zen_fees_tx ON zen_fee_records(transaction_id);

-- 共通プール（みんなの蓄財 Zen（全））
CREATE TABLE IF NOT EXISTS zen_reserve_account (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  balance bigint NOT NULL DEFAULT 0 CHECK (balance >= 0),
  burn_enabled boolean NOT NULL DEFAULT false,
  burn_rate numeric(10,6),
  burn_policy text,
  burn_schedule text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- === RLS 有効化 ===
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

-- === RLS ポリシー（プロトタイプ：認証なし、anon+authenticated 許可）===

-- zen_users
DROP POLICY IF EXISTS "zen_users_select" ON zen_users;
CREATE POLICY "zen_users_select" ON zen_users FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "zen_users_insert" ON zen_users;
CREATE POLICY "zen_users_insert" ON zen_users FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "zen_users_update" ON zen_users;
CREATE POLICY "zen_users_update" ON zen_users FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "zen_users_delete" ON zen_users;
CREATE POLICY "zen_users_delete" ON zen_users FOR DELETE TO anon, authenticated USING (true);

-- zen_asset_accounts
DROP POLICY IF EXISTS "zen_accounts_select" ON zen_asset_accounts;
CREATE POLICY "zen_accounts_select" ON zen_asset_accounts FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "zen_accounts_insert" ON zen_asset_accounts;
CREATE POLICY "zen_accounts_insert" ON zen_asset_accounts FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "zen_accounts_update" ON zen_asset_accounts;
CREATE POLICY "zen_accounts_update" ON zen_asset_accounts FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "zen_accounts_delete" ON zen_asset_accounts;
CREATE POLICY "zen_accounts_delete" ON zen_asset_accounts FOR DELETE TO anon, authenticated USING (true);

-- zen_lots
DROP POLICY IF EXISTS "zen_lots_select" ON zen_lots;
CREATE POLICY "zen_lots_select" ON zen_lots FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "zen_lots_insert" ON zen_lots;
CREATE POLICY "zen_lots_insert" ON zen_lots FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "zen_lots_update" ON zen_lots;
CREATE POLICY "zen_lots_update" ON zen_lots FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "zen_lots_delete" ON zen_lots;
CREATE POLICY "zen_lots_delete" ON zen_lots FOR DELETE TO anon, authenticated USING (true);

-- zen_ledger_events
DROP POLICY IF EXISTS "zen_events_select" ON zen_ledger_events;
CREATE POLICY "zen_events_select" ON zen_ledger_events FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "zen_events_insert" ON zen_ledger_events;
CREATE POLICY "zen_events_insert" ON zen_ledger_events FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "zen_events_update" ON zen_ledger_events;
CREATE POLICY "zen_events_update" ON zen_ledger_events FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "zen_events_delete" ON zen_ledger_events;
CREATE POLICY "zen_events_delete" ON zen_ledger_events FOR DELETE TO anon, authenticated USING (true);

-- zen_lock_records
DROP POLICY IF EXISTS "zen_locks_select" ON zen_lock_records;
CREATE POLICY "zen_locks_select" ON zen_lock_records FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "zen_locks_insert" ON zen_lock_records;
CREATE POLICY "zen_locks_insert" ON zen_lock_records FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "zen_locks_update" ON zen_lock_records;
CREATE POLICY "zen_locks_update" ON zen_lock_records FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "zen_locks_delete" ON zen_lock_records;
CREATE POLICY "zen_locks_delete" ON zen_lock_records FOR DELETE TO anon, authenticated USING (true);

-- zen_missions
DROP POLICY IF EXISTS "zen_missions_select" ON zen_missions;
CREATE POLICY "zen_missions_select" ON zen_missions FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "zen_missions_insert" ON zen_missions;
CREATE POLICY "zen_missions_insert" ON zen_missions FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "zen_missions_update" ON zen_missions;
CREATE POLICY "zen_missions_update" ON zen_missions FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "zen_missions_delete" ON zen_missions;
CREATE POLICY "zen_missions_delete" ON zen_missions FOR DELETE TO anon, authenticated USING (true);

-- zen_contributions
DROP POLICY IF EXISTS "zen_contrib_select" ON zen_contributions;
CREATE POLICY "zen_contrib_select" ON zen_contributions FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "zen_contrib_insert" ON zen_contributions;
CREATE POLICY "zen_contrib_insert" ON zen_contributions FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "zen_contrib_update" ON zen_contributions;
CREATE POLICY "zen_contrib_update" ON zen_contributions FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "zen_contrib_delete" ON zen_contributions;
CREATE POLICY "zen_contrib_delete" ON zen_contributions FOR DELETE TO anon, authenticated USING (true);

-- zen_transactions
DROP POLICY IF EXISTS "zen_tx_select" ON zen_transactions;
CREATE POLICY "zen_tx_select" ON zen_transactions FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "zen_tx_insert" ON zen_transactions;
CREATE POLICY "zen_tx_insert" ON zen_transactions FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "zen_tx_update" ON zen_transactions;
CREATE POLICY "zen_tx_update" ON zen_transactions FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "zen_tx_delete" ON zen_transactions;
CREATE POLICY "zen_tx_delete" ON zen_transactions FOR DELETE TO anon, authenticated USING (true);

-- zen_fee_records
DROP POLICY IF EXISTS "zen_fees_select" ON zen_fee_records;
CREATE POLICY "zen_fees_select" ON zen_fee_records FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "zen_fees_insert" ON zen_fee_records;
CREATE POLICY "zen_fees_insert" ON zen_fee_records FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "zen_fees_update" ON zen_fee_records;
CREATE POLICY "zen_fees_update" ON zen_fee_records FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "zen_fees_delete" ON zen_fee_records;
CREATE POLICY "zen_fees_delete" ON zen_fee_records FOR DELETE TO anon, authenticated USING (true);

-- zen_reserve_account
DROP POLICY IF EXISTS "zen_reserve_select" ON zen_reserve_account;
CREATE POLICY "zen_reserve_select" ON zen_reserve_account FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "zen_reserve_insert" ON zen_reserve_account;
CREATE POLICY "zen_reserve_insert" ON zen_reserve_account FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "zen_reserve_update" ON zen_reserve_account;
CREATE POLICY "zen_reserve_update" ON zen_reserve_account FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "zen_reserve_delete" ON zen_reserve_account;
CREATE POLICY "zen_reserve_delete" ON zen_reserve_account FOR DELETE TO anon, authenticated USING (true);
