/**
 * Zen 台帳エンジン
 * 発行・移転・使用・失効・期限延長・ロックの各処理を独立した関数として実装する。
 * すべての残高変動は台帳イベントとして記録し、残高を直接書き換えない。
 *
 * 重要:
 * - APPLY_ZEN は表示用イベント。残高変更は TRANSFER_ZEN で行う。
 * - TRANSFER_ZEN が実際の残高移動を行う。
 * - ユーザー間の無償送信は拒否する。
 * - Zen+は支払いに使用できない。
 * - 未確定のルールは推測しない。
 */
import type {
  LedgerEvent,
  ZenLot,
  LockRecord,
  EngineResult,
  AssetType,
} from './types'
import { LEDGER_EVENT_TYPES } from './event-types'
import { ZEN_CONFIG } from './config'

function genId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

function nowISO(): string {
  return new Date().toISOString()
}

function addDays(date: string, days: number): string {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d.toISOString()
}

function ok(events: LedgerEvent[], lots: ZenLot[] = [], locks: LockRecord[] = []): EngineResult {
  return { events, lots, locks, errors: [] }
}

function fail(errors: string[]): EngineResult {
  return { events: [], lots: [], locks: [], errors }
}

/**
 * Zen発行
 * 発行時点から baseExpiryDays 日後に期限を設定する。
 */
export function issueZen(
  accountId: string,
  amount: number,
  reason: string,
  sourceEventId?: string,
): EngineResult {
  if (amount <= 0) return fail(['発行量は正の数である必要があります'])
  if (amount % ZEN_CONFIG.minimalUnit !== 0)
    return fail([`発行量は最小単位(${ZEN_CONFIG.minimalUnit})の倍数である必要があります`])

  const issuedAt = nowISO()
  const expiresAt = addDays(issuedAt, ZEN_CONFIG.baseExpiryDays)

  const eventId = genId('evt')
  const lotId = genId('lot')

  const event: LedgerEvent = {
    id: eventId,
    eventType: LEDGER_EVENT_TYPES.ISSUE_ZEN,
    toAccountId: accountId,
    accountId,
    assetType: 'zen',
    amount,
    lotId,
    sourceEventId,
    reason,
    status: 'confirmed',
    createdAt: issuedAt,
  }

  const lot: ZenLot = {
    id: lotId,
    accountId,
    amount,
    remainingAmount: amount,
    issuedAt,
    expiresAt,
    sourceEventId: eventId,
    status: 'active',
    lockedAmount: 0,
  }

  return ok([event], [lot])
}

/**
 * Zen移転（TRANSFER_ZEN）
 * 購入取引に伴うZenの移転。移転時に有効期限をリセットする。
 * ユーザー間の無償送信は拒否する（isCommercialTransfer = true が必要）。
 */
export function transferZen(
  fromAccountId: string,
  toAccountId: string,
  amount: number,
  reason: string,
  availableLots: ZenLot[],
  transactionId?: string,
  isCommercialTransfer: boolean = true,
): EngineResult {
  if (amount <= 0) return fail(['移転量は正の数である必要があります'])
  if (fromAccountId === toAccountId) return fail(['同一口座間の移転はできません'])
  if (!isCommercialTransfer)
    return fail(['ユーザー間の無償送信は禁止されています'])

  // 利用可能なロットから十分な残高があるか確認
  const now = new Date()
  const usableLots = availableLots.filter(
    (l) =>
      l.accountId === fromAccountId &&
      l.status === 'active' &&
      l.remainingAmount - l.lockedAmount > 0 &&
      new Date(l.expiresAt).getTime() > now.getTime(),
  )

  const totalAvailable = usableLots.reduce(
    (sum, l) => sum + (l.remainingAmount - l.lockedAmount),
    0,
  )
  if (totalAvailable < amount) return fail(['利用可能残高が不足しています'])

  const transferredAt = nowISO()
  const newExpiresAt = addDays(transferredAt, ZEN_CONFIG.baseExpiryDays)
  const eventId = genId('evt')

  const event: LedgerEvent = {
    id: eventId,
    eventType: LEDGER_EVENT_TYPES.TRANSFER_ZEN,
    fromAccountId,
    toAccountId,
    assetType: 'zen',
    amount,
    transactionId,
    reason,
    status: 'confirmed',
    createdAt: transferredAt,
  }

  // 移転元ロットから FIFO で消費
  const updatedLots: ZenLot[] = []
  let remaining = amount
  const newLots: ZenLot[] = []

  for (const lot of availableLots) {
    if (lot.accountId !== fromAccountId || lot.status !== 'active' || remaining <= 0) {
      updatedLots.push(lot)
      continue
    }
    const usable = lot.remainingAmount - lot.lockedAmount
    if (usable <= 0) {
      updatedLots.push(lot)
      continue
    }
    if (new Date(lot.expiresAt).getTime() <= now.getTime()) {
      updatedLots.push(lot)
      continue
    }

    if (usable >= remaining) {
      updatedLots.push({
        ...lot,
        remainingAmount: lot.remainingAmount - remaining,
      })
      // 移転先に新しいロットを発行
      newLots.push({
        id: genId('lot'),
        accountId: toAccountId,
        amount: remaining,
        remainingAmount: remaining,
        issuedAt: transferredAt,
        expiresAt: newExpiresAt,
        sourceEventId: eventId,
        status: 'active',
        lockedAmount: 0,
        originalLotId: lot.id,
        parentEventId: eventId,
      })
      remaining = 0
    } else {
      updatedLots.push({
        ...lot,
        remainingAmount: lot.lockedAmount,
      })
      newLots.push({
        id: genId('lot'),
        accountId: toAccountId,
        amount: usable,
        remainingAmount: usable,
        issuedAt: transferredAt,
        expiresAt: newExpiresAt,
        sourceEventId: eventId,
        status: 'active',
        lockedAmount: 0,
        originalLotId: lot.id,
        parentEventId: eventId,
      })
      remaining -= usable
    }
  }

  if (remaining > 0) return fail(['利用可能残高が不足しています'])

  return ok([event], [...updatedLots, ...newLots])
}

/**
 * Zen使用記録（APPLY_ZEN）
 * このイベントは表示用であり、単独では残高を変更しない。
 * 実際の残高移動は TRANSFER_ZEN で行う。
 */
export function applyZen(
  accountId: string,
  amount: number,
  transactionId: string,
  reason: string,
): EngineResult {
  if (amount <= 0) return fail(['使用量は正の数である必要があります'])

  const event: LedgerEvent = {
    id: genId('evt'),
    eventType: LEDGER_EVENT_TYPES.APPLY_ZEN,
    accountId,
    assetType: 'zen',
    amount,
    transactionId,
    reason,
    status: 'confirmed',
    createdAt: nowISO(),
  }

  return ok([event])
}

/**
 * Zen期限延長
 * 設定値から延長日数を受け取る。設定値が未設定の場合は延長しない。
 */
export function extendZenExpiry(
  lotId: string,
  extensionDays: number | null,
  reason: string,
): EngineResult {
  if (extensionDays === null || extensionDays === undefined)
    return fail(['延長日数が未確定です。設定値を確認してください。'])

  const eventId = genId('evt')
  const now = nowISO()

  const event: LedgerEvent = {
    id: eventId,
    eventType: LEDGER_EVENT_TYPES.EXTEND_ZEN_EXPIRY,
    assetType: 'zen',
    amount: 0,
    lotId,
    reason: `期限延長: ${reason} (${extensionDays}日)`,
    status: 'confirmed',
    createdAt: now,
  }

  // 延長後の期限を計算するが、ここではイベントのみ記録。
  // 実際の期限更新はロットの更新として呼び出し元が行う。
  return ok([event])
}

/**
 * 延長後の有効期限を計算する（最大 maxExpiryDays を超えない）
 */
export function calculateExtendedExpiry(
  issuedAt: string,
  currentExpiry: string,
  extensionDays: number,
): string {
  const newExpiry = addDays(currentExpiry, extensionDays)
  const maxExpiry = addDays(issuedAt, ZEN_CONFIG.maxExpiryDays)
  return newExpiry > maxExpiry ? maxExpiry : newExpiry
}

/**
 * Zen失効
 * 期限切れZenを失効させ、共通プールへの還流イベントも記録する。
 */
export function expireZen(
  lot: ZenLot,
  commonReserveAccountId: string,
): EngineResult {
  if (lot.status === 'expired' || lot.remainingAmount <= 0)
    return fail(['既に失効済みまたは残高ゼロのロットです'])

  const now = nowISO()
  const expireEventId = genId('evt')
  const transferEventId = genId('evt')

  const expireEvent: LedgerEvent = {
    id: expireEventId,
    eventType: LEDGER_EVENT_TYPES.EXPIRE_ZEN,
    accountId: lot.accountId,
    assetType: 'zen',
    amount: lot.remainingAmount,
    lotId: lot.id,
    reason: '有効期限切れによる失効',
    status: 'confirmed',
    createdAt: now,
  }

  const transferEvent: LedgerEvent = {
    id: transferEventId,
    eventType: LEDGER_EVENT_TYPES.TRANSFER_TO_COMMON_RESERVE,
    fromAccountId: lot.accountId,
    toAccountId: commonReserveAccountId,
    assetType: 'zen',
    amount: lot.remainingAmount,
    lotId: lot.id,
    parentEventId: expireEventId,
    reason: '期限切れZenの共通プールへの還流',
    status: 'confirmed',
    createdAt: now,
    metadata: { originalLotId: lot.id },
  }

  const expiredLot: ZenLot = {
    ...lot,
    status: 'expired',
    remainingAmount: 0,
  }

  return ok([expireEvent, transferEvent], [expiredLot])
}

/**
 * Zenロック
 */
export function lockZen(
  accountId: string,
  amount: number,
  lockDays: number,
  lotId: string | null,
  availableLots: ZenLot[],
): EngineResult {
  if (amount <= 0) return fail(['ロック量は正の数である必要があります'])
  if (lockDays <= 0 || lockDays > ZEN_CONFIG.maxLockDays)
    return fail([`ロック期間は1日〜${ZEN_CONFIG.maxLockDays}日の範囲です`])

  const now = nowISO()
  const unlockAt = addDays(now, lockDays)
  const eventId = genId('evt')
  const lockId = genId('lock')

  let targetLot: ZenLot | null = null
  if (lotId) {
    targetLot = availableLots.find(
      (l) => l.id === lotId && l.accountId === accountId && l.status === 'active',
    ) || null
    if (!targetLot) return fail(['指定されたロットが見つかりません'])
    const usable = targetLot.remainingAmount - targetLot.lockedAmount
    if (usable < amount) return fail(['ロック対象の残高が不足しています'])
  } else {
    const totalAvailable = availableLots
      .filter(
        (l) =>
          l.accountId === accountId &&
          l.status === 'active' &&
          new Date(l.expiresAt).getTime() > new Date(now).getTime(),
      )
      .reduce((sum, l) => sum + (l.remainingAmount - l.lockedAmount), 0)
    if (totalAvailable < amount) return fail(['利用可能残高が不足しています'])
  }

  const event: LedgerEvent = {
    id: eventId,
    eventType: LEDGER_EVENT_TYPES.LOCK_ZEN,
    accountId,
    assetType: 'zen',
    amount,
    lotId: lotId || undefined,
    reason: `${lockDays}日間のロック`,
    status: 'confirmed',
    createdAt: now,
  }

  const lockRecord: LockRecord = {
    id: lockId,
    accountId,
    lotId: lotId || undefined,
    assetType: 'zen',
    amount,
    lockedAt: now,
    unlockAt,
    status: 'locked',
    lockedByEventId: eventId,
  }

  const updatedLots = availableLots.map((l) => {
    if (lotId && l.id !== lotId) return l
    if (l.accountId !== accountId || l.status !== 'active') return l
    if (!lotId && l.remainingAmount - l.lockedAmount <= 0) return l

    if (lotId) {
      return { ...l, lockedAmount: l.lockedAmount + amount }
    }
    return l
  })

  if (lotId) {
    const idx = updatedLots.findIndex((l) => l.id === lotId)
    if (idx >= 0) {
      updatedLots[idx] = {
        ...updatedLots[idx],
        lockedAmount: updatedLots[idx].lockedAmount + amount,
      }
    }
  }

  return ok([event], updatedLots, [lockRecord])
}

/**
 * Zenロック解除
 */
export function unlockZen(
  lockRecord: LockRecord,
): EngineResult {
  if (lockRecord.status !== 'locked') return fail(['ロックされていません'])

  const now = nowISO()
  const eventId = genId('evt')

  const event: LedgerEvent = {
    id: eventId,
    eventType: LEDGER_EVENT_TYPES.UNLOCK_ZEN,
    accountId: lockRecord.accountId,
    assetType: 'zen',
    amount: lockRecord.amount,
    lotId: lockRecord.lotId,
    reason: 'ロック解除',
    status: 'confirmed',
    createdAt: now,
  }

  const updatedLock: LockRecord = {
    ...lockRecord,
    status: 'unlocked',
    unlockedByEventId: eventId,
  }

  return ok([event], [], [updatedLock])
}

/**
 * Zen+獲得
 */
export function issueZenPlus(
  accountId: string,
  amount: number,
  category: string,
  reason: string,
): EngineResult {
  if (amount <= 0) return fail(['獲得量は正の数である必要があります'])

  const eventId = genId('evt')
  const now = nowISO()

  const event: LedgerEvent = {
    id: eventId,
    eventType: LEDGER_EVENT_TYPES.ISSUE_ZEN_PLUS,
    accountId,
    assetType: 'zen_plus',
    amount,
    reason: `${category}: ${reason}`,
    status: 'confirmed',
    createdAt: now,
  }

  return ok([event])
}

/**
 * ミッション報酬
 * 共通プールから通常Zenを新規発行する。
 * 発行時点から baseExpiryDays 日の期限を設定する。
 */
export function issueMissionReward(
  toAccountId: string,
  zenAmount: number,
  zenPlusAmount: number,
  missionId: string,
  missionTitle: string,
): EngineResult {
  const now = nowISO()
  const events: LedgerEvent[] = []
  const lots: ZenLot[] = []

  if (zenAmount > 0) {
    const eventId = genId('evt')
    const lotId = genId('lot')
    const expiresAt = addDays(now, ZEN_CONFIG.baseExpiryDays)

    events.push({
      id: eventId,
      eventType: LEDGER_EVENT_TYPES.MISSION_REWARD,
      toAccountId,
      assetType: 'zen',
      amount: zenAmount,
      lotId,
      reason: `ミッション報酬: ${missionTitle}`,
      status: 'confirmed',
      createdAt: now,
      metadata: { missionId },
    })

    lots.push({
      id: lotId,
      accountId: toAccountId,
      amount: zenAmount,
      remainingAmount: zenAmount,
      issuedAt: now,
      expiresAt,
      sourceEventId: eventId,
      status: 'active',
      lockedAmount: 0,
    })
  }

  if (zenPlusAmount > 0) {
    const plusEventId = genId('evt')
    events.push({
      id: plusEventId,
      eventType: LEDGER_EVENT_TYPES.ISSUE_ZEN_PLUS,
      accountId: toAccountId,
      assetType: 'zen_plus',
      amount: zenPlusAmount,
      reason: `ミッション貢献報酬: ${missionTitle}`,
      status: 'confirmed',
      createdAt: now,
      metadata: { missionId },
    })
  }

  return ok(events, lots)
}

/**
 * 共通プールからのZen発行
 * 共通プール残高を減少させ、新しい通常Zenロットを発行する。
 * 発行時点から baseExpiryDays 日の期限を設定する。
 */
export function issueFromCommonReserve(
  commonReserveAccountId: string,
  toAccountId: string,
  amount: number,
  reason: string,
  currentReserveBalance: number,
): EngineResult {
  if (amount <= 0) return fail(['発行量は正の数である必要があります'])
  if (currentReserveBalance < amount)
    return fail(['共通プール残高が不足しています'])

  const now = nowISO()
  const eventId = genId('evt')
  const lotId = genId('lot')
  const expiresAt = addDays(now, ZEN_CONFIG.baseExpiryDays)

  const event: LedgerEvent = {
    id: eventId,
    eventType: LEDGER_EVENT_TYPES.ISSUE_ZEN_FROM_COMMON_RESERVE,
    fromAccountId: commonReserveAccountId,
    toAccountId,
    assetType: 'zen',
    amount,
    lotId,
    reason: `共通プールから発行: ${reason}`,
    status: 'confirmed',
    createdAt: now,
  }

  const lot: ZenLot = {
    id: lotId,
    accountId: toAccountId,
    amount,
    remainingAmount: amount,
    issuedAt: now,
    expiresAt,
    sourceEventId: eventId,
    status: 'active',
    lockedAmount: 0,
  }

  return ok([event], [lot])
}

/**
 * 縁環料の記録
 * 円支払額に対する縁環料は system_ops、Zen使用額に対する縁環料は common_reserve へ。
 * 計算式が未確定の場合は基本率のみ使用する。
 */
export function accrueCirculationFee(
  transactionId: string,
  yenPaymentAmount: number,
  zenUsedAmount: number,
): EngineResult {
  const now = nowISO()
  const events: LedgerEvent[] = []

  const feeRate = ZEN_CONFIG.baseCirculationFeeRate

  if (yenPaymentAmount > 0) {
    const feeYen = Math.floor(yenPaymentAmount * feeRate)
    if (feeYen > 0) {
      events.push({
        id: genId('evt'),
        eventType: LEDGER_EVENT_TYPES.ACCRUE_CIRCULATION_FEE,
        assetType: 'zen',
        amount: feeYen,
        transactionId,
        reason: `円支払分の縁環料 (${feeRate * 100}%) → システム運営費`,
        status: 'confirmed',
        createdAt: now,
        metadata: { destination: 'system_ops', originalAmount: yenPaymentAmount },
      })
    }
  }

  if (zenUsedAmount > 0) {
    const feeZen = Math.floor(zenUsedAmount * feeRate)
    if (feeZen > 0) {
      events.push({
        id: genId('evt'),
        eventType: LEDGER_EVENT_TYPES.ACCRUE_CIRCULATION_FEE,
        assetType: 'zen',
        amount: feeZen,
        transactionId,
        reason: `Zen使用分の縁環料 (${feeRate * 100}%) → みんなの蓄財`,
        status: 'confirmed',
        createdAt: now,
        metadata: { destination: 'common_reserve', originalAmount: zenUsedAmount },
      })
    }
  }

  return ok(events)
}

/**
 * Zen+の支払い使用を拒否する（バリデーション）
 */
export function validateNotZenPlusPayment(assetType: AssetType): string | null {
  if (assetType === 'zen_plus')
    return 'Zen+は支払いに使用できません'
  return null
}

/**
 * 期限切れZenの使用を拒否する（バリデーション）
 */
export function validateNotExpired(expiresAt: string): string | null {
  if (new Date(expiresAt).getTime() <= new Date().getTime())
    return '期限切れのZenは使用できません'
  return null
}

/**
 * ロック中Zenの使用を拒否する（バリデーション）
 */
export function validateNotLocked(lot: ZenLot): string | null {
  if (lot.lockedAmount >= lot.remainingAmount)
    return 'ロック中のZenは使用できません'
  return null
}
