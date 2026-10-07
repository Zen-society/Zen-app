export type AccountType = 'user' | 'store' | 'business' | 'common_reserve'

export type AssetType = 'zen' | 'zen_plus' | 'common_reserve'

export type LotStatus = 'active' | 'expired' | 'used' | 'locked' | 'transferred'

export type LockStatus = 'locked' | 'unlocked' | 'expired'

export type EventStatus = 'pending' | 'confirmed' | 'reversed'

export type TransactionStatus = 'pending' | 'confirmed' | 'cancelled'

export interface User {
  id: string
  name: string
  displayName: string
  isDemo: boolean
  accountType: AccountType
  createdAt: string
}

export interface AssetAccount {
  id: string
  userId: string
  assetType: AssetType
  createdAt: string
}

export interface ZenLot {
  id: string
  accountId: string
  amount: number
  remainingAmount: number
  issuedAt: string
  expiresAt: string
  sourceEventId: string
  status: LotStatus
  lockedAmount: number
  originalLotId?: string
  parentEventId?: string
}

export interface LedgerEvent {
  id: string
  eventType: string
  accountId?: string
  fromAccountId?: string
  toAccountId?: string
  assetType: AssetType
  amount: number
  lotId?: string
  newExpiresAt?: string
  parentEventId?: string
  transactionId?: string
  reason: string
  status: EventStatus
  createdAt: string
  metadata?: Record<string, unknown>
}

export interface LockRecord {
  id: string
  accountId: string
  lotId?: string
  assetType: 'zen' | 'zen_plus'
  amount: number
  lockedAt: string
  unlockAt: string
  status: LockStatus
  lockedByEventId: string
  unlockedByEventId?: string
}

export interface MissionDef {
  id: string
  title: string
  description: string
  rewardZen: number
  rewardZenPlus: number
  goal: number
  status: 'active' | 'inactive'
}

export interface ContributionRecord {
  id: string
  userId: string
  category: string
  reason: string
  zenPlusAmount: number
  relatedMissionId?: string
  eventId: string
  createdAt: string
}

export interface TransactionRecord {
  id: string
  buyerId: string
  sellerId: string
  itemName: string
  priceYen: number
  zenAppliedAmount: number
  zenApplicationRate: number
  circulationFeeYen: number
  circulationFeeZen: number
  status: TransactionStatus
  createdAt: string
}

export interface FeeRecord {
  id: string
  transactionId: string
  feeType: 'circulation' | 'digital_asset'
  assetType: 'yen' | 'zen'
  amount: number
  destination: 'system_ops' | 'common_reserve'
  eventId: string
  createdAt: string
}

export interface ReserveAccount {
  id: string
  balance: number
  burnEnabled: boolean
  burnRate: number | null
  burnPolicy: string | null
  burnSchedule: string | null
}

export interface BalanceSummary {
  available: number
  locked: number
  expired: number
  usedTotal: number
  zenPlusTotal: number
  reserveTotal: number
  lots: LotSummary[]
  nextExpiring?: LotSummary
}

export interface LotSummary {
  lotId: string
  remainingAmount: number
  issuedAt: string
  expiresAt: string
  status: LotStatus
  daysLeft: number
}

export interface EngineResult {
  events: LedgerEvent[]
  lots: ZenLot[]
  locks: LockRecord[]
  errors: string[]
}
