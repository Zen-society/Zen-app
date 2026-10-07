/**
 * Zenデータアクセス層
 * Supabaseへのアクセスを抽象化する。
 * 将来ブロックチェーンに移行してもUI全体を書き換えずに済むよう、
 * すべてのデータアクセスをここに集約する。
 */
import { supabase } from '@/lib/supabase-client'
import type {
  User,
  AssetAccount,
  ZenLot,
  LedgerEvent,
  LockRecord,
  BalanceSummary,
} from './types'
import { calculateBalance } from './balance-calculator'
import { EVENT_LABELS_JA } from './event-types'

// === デモユーザーID ===
export const DEMO_USER_ID = 'demo-user-0001'
export const DEMO_STORE_ID = 'demo-store-0001'
export const COMMON_RESERVE_USER_ID = 'common-reserve-0001'

// === ユーザー ===

export async function getOrCreateDemoUser(): Promise<User | null> {
  const { data: existing } = await supabase
    .from('zen_users')
    .select('*')
    .eq('id', DEMO_USER_ID)
    .maybeSingle()

  if (existing) return existing as unknown as User

  const { data, error } = await supabase
    .from('zen_users')
    .insert({
      id: DEMO_USER_ID,
      name: 'Zen',
      display_name: 'Zen',
      is_demo: true,
      account_type: 'user',
    })
    .select()
    .maybeSingle()

  if (error) {
    console.error('Failed to create demo user:', error)
    return null
  }
  return data as unknown as User
}

// === 資産口座 ===

export async function getAssetAccount(
  userId: string,
  assetType: 'zen' | 'zen_plus' | 'common_reserve',
): Promise<AssetAccount | null> {
  const { data, error } = await supabase
    .from('zen_asset_accounts')
    .select('*')
    .eq('user_id', userId)
    .eq('asset_type', assetType)
    .maybeSingle()

  if (error) {
    console.error('Failed to get asset account:', error)
    return null
  }
  return data as unknown as AssetAccount | null
}

export async function getOrCreateAssetAccount(
  userId: string,
  assetType: 'zen' | 'zen_plus' | 'common_reserve',
): Promise<AssetAccount | null> {
  const existing = await getAssetAccount(userId, assetType)
  if (existing) return existing

  const { data, error } = await supabase
    .from('zen_asset_accounts')
    .insert({ user_id: userId, asset_type: assetType })
    .select()
    .maybeSingle()

  if (error) {
    console.error('Failed to create asset account:', error)
    return null
  }
  return data as unknown as AssetAccount
}

// === ロット ===

export async function getLots(accountId: string): Promise<ZenLot[]> {
  const { data, error } = await supabase
    .from('zen_lots')
    .select('*')
    .eq('account_id', accountId)
    .order('expires_at', { ascending: true })

  if (error) {
    console.error('Failed to get lots:', error)
    return []
  }
  return (data || []) as unknown as ZenLot[]
}

export async function insertLot(lot: Omit<ZenLot, 'id'>): Promise<ZenLot | null> {
  const { data, error } = await supabase
    .from('zen_lots')
    .insert(lot)
    .select()
    .maybeSingle()

  if (error) {
    console.error('Failed to insert lot:', error)
    return null
  }
  return data as unknown as ZenLot
}

export async function updateLotRemaining(
  lotId: string,
  remainingAmount: number,
  status?: string,
  lockedAmount?: number,
): Promise<void> {
  const update: Record<string, unknown> = { remaining_amount: remainingAmount }
  if (status) update.status = status
  if (lockedAmount !== undefined) update.locked_amount = lockedAmount

  const { error } = await supabase.from('zen_lots').update(update).eq('id', lotId)
  if (error) console.error('Failed to update lot:', error)
}

// === 台帳イベント ===

export async function getLedgerEvents(accountId?: string): Promise<LedgerEvent[]> {
  let query = supabase.from('zen_ledger_events').select('*')
  if (accountId) {
    query = query.or(`account_id.eq.${accountId},from_account_id.eq.${accountId},to_account_id.eq.${accountId}`)
  }
  query = query.order('created_at', { ascending: false }).limit(50)

  const { data, error } = await query
  if (error) {
    console.error('Failed to get ledger events:', error)
    return []
  }
  return (data || []) as unknown as LedgerEvent[]
}

export async function insertLedgerEvent(
  event: Omit<LedgerEvent, 'id'>,
): Promise<LedgerEvent | null> {
  const { data, error } = await supabase
    .from('zen_ledger_events')
    .insert({
      event_type: event.eventType,
      account_id: event.accountId,
      from_account_id: event.fromAccountId,
      to_account_id: event.toAccountId,
      asset_type: event.assetType,
      amount: event.amount,
      lot_id: event.lotId,
      new_expires_at: event.newExpiresAt,
      parent_event_id: event.parentEventId,
      transaction_id: event.transactionId,
      reason: event.reason,
      status: event.status,
      metadata: event.metadata,
    })
    .select()
    .maybeSingle()

  if (error) {
    console.error('Failed to insert ledger event:', error)
    return null
  }
  return data as unknown as LedgerEvent
}

// === ロック記録 ===

export async function getLockRecords(accountId: string): Promise<LockRecord[]> {
  const { data, error } = await supabase
    .from('zen_lock_records')
    .select('*')
    .eq('account_id', accountId)
    .eq('status', 'locked')
    .order('locked_at', { ascending: false })

  if (error) {
    console.error('Failed to get lock records:', error)
    return []
  }
  return (data || []) as unknown as LockRecord[]
}

// === 残高サマリー ===

export async function getBalanceSummary(
  accountId: string,
  reserveBalance: number = 0,
): Promise<BalanceSummary> {
  const [lots, events, locks] = await Promise.all([
    getLots(accountId),
    getLedgerEvents(accountId),
    getLockRecords(accountId),
  ])

  return calculateBalance(accountId, events, lots, locks, reserveBalance)
}

// === 共通プール ===

export async function getReserveBalance(): Promise<number> {
  const { data, error } = await supabase
    .from('zen_reserve_account')
    .select('balance')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error || !data) return 0
  return (data as { balance: number }).balance
}

export async function updateReserveBalance(newBalance: number): Promise<void> {
  const { error } = await supabase
    .from('zen_reserve_account')
    .insert({ balance: newBalance })
  if (error) console.error('Failed to update reserve balance:', error)
}

// === イベントラベル ===

export function getEventLabelJa(eventType: string): string {
  return EVENT_LABELS_JA[eventType] || eventType
}
