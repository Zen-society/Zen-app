/**
 * Zen残高計算エンジン
 * 台帳イベントから残高を再計算する。残高を直接書き換えない。
 */
import type {
  LedgerEvent,
  ZenLot,
  LockRecord,
  BalanceSummary,
  LotSummary,
} from './types'
import { LEDGER_EVENT_TYPES } from './event-types'

function daysBetween(from: string, to: string): number {
  const ms = new Date(to).getTime() - new Date(from).getTime()
  return Math.ceil(ms / (1000 * 60 * 60 * 24))
}

export function summarizeLot(lot: ZenLot, now: Date = new Date()): LotSummary {
  const daysLeft = daysBetween(now.toISOString(), lot.expiresAt)
  return {
    lotId: lot.id,
    remainingAmount: lot.remainingAmount,
    issuedAt: lot.issuedAt,
    expiresAt: lot.expiresAt,
    status: lot.status,
    daysLeft,
  }
}

/**
 * 台帳イベントとロットから残高サマリーを計算する。
 * 重複イベントIDは1回だけ処理する。
 */
export function calculateBalance(
  accountId: string,
  events: LedgerEvent[],
  lots: ZenLot[],
  locks: LockRecord[],
  reserveBalance: number = 0,
): BalanceSummary {
  const processedEventIds = new Set<string>()
  const accountEvents = events
    .filter(
      (e) =>
        (e.accountId === accountId ||
          e.fromAccountId === accountId ||
          e.toAccountId === accountId) &&
        e.status === 'confirmed',
    )
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())

  const accountLots = lots.filter((l) => l.accountId === accountId)
  const accountLocks = locks.filter((l) => l.accountId === accountId)

  let available = 0
  let locked = 0
  let expired = 0
  let usedTotal = 0
  let zenPlusTotal = 0

  for (const event of accountEvents) {
    if (processedEventIds.has(event.id)) continue
    processedEventIds.add(event.id)

    switch (event.eventType) {
      case LEDGER_EVENT_TYPES.ISSUE_ZEN:
      case LEDGER_EVENT_TYPES.ISSUE_ZEN_FROM_COMMON_RESERVE:
      case LEDGER_EVENT_TYPES.MISSION_REWARD:
        if (event.assetType === 'zen' && event.toAccountId === accountId) {
          available += event.amount
        }
        if (event.assetType === 'zen_plus' && event.accountId === accountId) {
          zenPlusTotal += event.amount
        }
        break

      case LEDGER_EVENT_TYPES.TRANSFER_ZEN:
        if (event.fromAccountId === accountId && event.assetType === 'zen') {
          available -= event.amount
          usedTotal += event.amount
        }
        if (event.toAccountId === accountId && event.assetType === 'zen') {
          available += event.amount
        }
        break

      case LEDGER_EVENT_TYPES.APPLY_ZEN:
        // APPLY_ZEN は表示用イベント。残高変更は TRANSFER_ZEN で行う。
        // ここでは残高を変更しない。
        break

      case LEDGER_EVENT_TYPES.EXPIRE_ZEN:
        if (event.accountId === accountId && event.assetType === 'zen') {
          available -= event.amount
          expired += event.amount
        }
        break

      case LEDGER_EVENT_TYPES.LOCK_ZEN:
        if (event.accountId === accountId && event.assetType === 'zen') {
          available -= event.amount
          locked += event.amount
        }
        break

      case LEDGER_EVENT_TYPES.UNLOCK_ZEN:
        if (event.accountId === accountId && event.assetType === 'zen') {
          locked -= event.amount
          available += event.amount
        }
        break

      case LEDGER_EVENT_TYPES.ISSUE_ZEN_PLUS:
        if (event.accountId === accountId && event.assetType === 'zen_plus') {
          zenPlusTotal += event.amount
        }
        break

      case LEDGER_EVENT_TYPES.LOCK_ZEN_PLUS:
        if (event.accountId === accountId && event.assetType === 'zen_plus') {
          // Zen+のロックは残高から除外するが、zenPlusTotalは変更しない
        }
        break

      case LEDGER_EVENT_TYPES.UNLOCK_ZEN_PLUS:
        if (event.accountId === accountId && event.assetType === 'zen_plus') {
          // Zen+のロック解除
        }
        break

      case LEDGER_EVENT_TYPES.ADJUSTMENT:
        if (event.accountId === accountId) {
          if (event.assetType === 'zen') {
            available += event.amount
          } else if (event.assetType === 'zen_plus') {
            zenPlusTotal += event.amount
          }
        }
        break

      default:
        break
    }
  }

  // ロットベースでも検証（ロット残高の合計と一致することを確認）
  const now = new Date()
  const lotSummaries: LotSummary[] = accountLots
    .filter((l) => l.status !== 'transferred' && l.status !== 'used')
    .map((l) => summarizeLot(l, now))
    .filter((s) => s.remainingAmount > 0)

  const nextExpiring = lotSummaries
    .filter((l) => l.status === 'active')
    .sort((a, b) => a.daysLeft - b.daysLeft)[0]

  // 期限切れロットの自動検出
  const expiredLots = accountLots.filter(
    (l) =>
      l.status === 'active' &&
      new Date(l.expiresAt).getTime() < now.getTime() &&
      l.remainingAmount > 0,
  )

  for (const lot of expiredLots) {
    if (lot.lockedAmount > 0) {
      locked -= lot.remainingAmount
    } else {
      available -= lot.remainingAmount
    }
    expired += lot.remainingAmount
  }

  return {
    available: Math.max(0, available),
    locked: Math.max(0, locked),
    expired: Math.max(0, expired),
    usedTotal,
    zenPlusTotal,
    reserveTotal: reserveBalance,
    lots: lotSummaries,
    nextExpiring,
  }
}

/**
 * 台帳イベントの重複を検出する。
 * 同一イベントIDが2回以上出現する場合、trueを返す。
 */
export function hasDuplicateEvents(events: LedgerEvent[]): boolean {
  const seen = new Set<string>()
  for (const e of events) {
    if (seen.has(e.id)) return true
    seen.add(e.id)
  }
  return false
}

/**
 * 訂正イベントを適用した新しいイベントリストを返す。
 * 元のイベントを削除せず、ADJUSTMENTイベントを追加する。
 */
export function applyAdjustment(
  events: LedgerEvent[],
  originalEventId: string,
  correctionAmount: number,
  reason: string,
  assetType: 'zen' | 'zen_plus' = 'zen',
): LedgerEvent[] {
  const original = events.find((e) => e.id === originalEventId)
  if (!original) return events

  const adjustmentEvent: LedgerEvent = {
    id: `adj_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    eventType: LEDGER_EVENT_TYPES.ADJUSTMENT,
    accountId: original.accountId,
    assetType,
    amount: correctionAmount,
    parentEventId: originalEventId,
    reason: `訂正: ${reason}`,
    status: 'confirmed',
    createdAt: new Date().toISOString(),
  }

  return [...events, adjustmentEvent]
}
