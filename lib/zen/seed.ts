/**
 * デモ用シードデータ初期化
 * プロトタイプ用のデモデータをSupabaseに投入する。
 * 本番の資産記録として扱わないこと。
 */
import { supabase } from '@/lib/supabase-client'
import { issueZen, issueZenPlus } from './zen-engine'
import { insertLedgerEvent, insertLot } from './data-access'
import { ZEN_CONFIG } from './config'

export const DEMO_USER_ID = 'demo-user-0001'
export const DEMO_STORE_ID = 'demo-store-0001'
export const COMMON_RESERVE_USER_ID = 'common-reserve-0001'

export async function seedDemoData(): Promise<boolean> {
  // 既存データがあるか確認
  const { data: existingLots } = await supabase
    .from('zen_lots')
    .select('id')
    .limit(1)
  if (existingLots && existingLots.length > 0) return true

  // デモユーザー作成
  const { data: userData, error: userErr } = await supabase
    .from('zen_users')
    .upsert({
      id: DEMO_USER_ID,
      name: 'Zen',
      display_name: 'Zen',
      is_demo: true,
      account_type: 'user',
    })
    .select()
    .maybeSingle()
  if (userErr || !userData) {
    console.error('Seed: failed to create demo user', userErr)
    return false
  }

  // デモストア作成
  await supabase.from('zen_users').upsert({
    id: DEMO_STORE_ID,
    name: 'Zen Mart',
    display_name: 'Zen Mart',
    is_demo: true,
    account_type: 'store',
  })

  // 共通プールユーザー作成
  await supabase.from('zen_users').upsert({
    id: COMMON_RESERVE_USER_ID,
    name: 'Common Reserve',
    display_name: 'みんなの蓄財 Zen（全）',
    is_demo: true,
    account_type: 'common_reserve',
  })

  // 資産口座作成
  const { data: zenAccount } = await supabase
    .from('zen_asset_accounts')
    .upsert({ user_id: DEMO_USER_ID, asset_type: 'zen' }, { onConflict: 'user_id,asset_type' })
    .select()
    .maybeSingle()

  const { data: plusAccount } = await supabase
    .from('zen_asset_accounts')
    .upsert({ user_id: DEMO_USER_ID, asset_type: 'zen_plus' }, { onConflict: 'user_id,asset_type' })
    .select()
    .maybeSingle()

  await supabase
    .from('zen_asset_accounts')
    .upsert({ user_id: COMMON_RESERVE_USER_ID, asset_type: 'common_reserve' }, { onConflict: 'user_id,asset_type' })

  // 共通プール残高レコード
  await supabase.from('zen_reserve_account').insert({
    balance: 1258924432,
    burn_enabled: ZEN_CONFIG.commonReserve.burnEnabled,
    burn_rate: ZEN_CONFIG.commonReserve.burnRate,
    burn_policy: ZEN_CONFIG.commonReserve.burnPolicy,
    burn_schedule: ZEN_CONFIG.commonReserve.burnSchedule,
  })

  if (!zenAccount) {
    console.error('Seed: failed to create zen account')
    return false
  }

  // Zenロットを複数発行（異なる期限）
  const now = new Date()
  const lots = [
    { amount: 5000, daysAgo: 0, expiryDays: 7 },
    { amount: 6000, daysAgo: 5, expiryDays: 7 },
    { amount: 4000, daysAgo: 80, expiryDays: 90 },
    { amount: 782, daysAgo: 0, expiryDays: 5 },
  ]

  for (const lotDef of lots) {
    const issuedAt = new Date(now)
    issuedAt.setDate(issuedAt.getDate() - lotDef.daysAgo)
    const expiresAt = new Date(issuedAt)
    expiresAt.setDate(expiresAt.getDate() + lotDef.expiryDays)

    const eventId = `evt_seed_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    const lotId = `lot_seed_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

    await supabase.from('zen_ledger_events').insert({
      id: eventId,
      event_type: 'ISSUE_ZEN',
      account_id: zenAccount.id,
      to_account_id: zenAccount.id,
      asset_type: 'zen',
      amount: lotDef.amount,
      lot_id: lotId,
      reason: 'デモ用Zen発行',
      status: 'confirmed',
      created_at: issuedAt.toISOString(),
    })

    await supabase.from('zen_lots').insert({
      id: lotId,
      account_id: zenAccount.id,
      amount: lotDef.amount,
      remaining_amount: lotDef.amount,
      issued_at: issuedAt.toISOString(),
      expires_at: expiresAt.toISOString(),
      source_event_id: eventId,
      status: 'active',
      locked_amount: 0,
    })
  }

  // Zen+発行
  if (plusAccount) {
    await supabase.from('zen_ledger_events').insert({
      id: `evt_seed_plus_${Date.now()}`,
      event_type: 'ISSUE_ZEN_PLUS',
      account_id: plusAccount.id,
      asset_type: 'zen_plus',
      amount: 1250,
      reason: 'デモ用Zen+獲得: コミュニティ活動',
      status: 'confirmed',
      created_at: now.toISOString(),
    })
  }

  // ミッション定義
  await supabase.from('zen_missions').insert([
    {
      id: 'm1',
      title: '地域の清掃に参加する',
      description: '地域の清掃イベントに参加する',
      reward_zen: 120,
      reward_zen_plus: 40,
      goal: 1,
      status: 'active',
    },
    {
      id: 'm2',
      title: 'フリマに1品出品する',
      description: 'フリマアプリに商品を1品出品する',
      reward_zen: 50,
      reward_zen_plus: 15,
      goal: 1,
      status: 'active',
    },
    {
      id: 'm3',
      title: '近所のお店でZenを使う',
      description: 'Zen加盟店でZen決済を利用する',
      reward_zen: 30,
      reward_zen_plus: 10,
      goal: 3,
      status: 'active',
    },
  ])

  return true
}
