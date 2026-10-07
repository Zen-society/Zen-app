/**
 * Zen台帳エンジン テスト
 * 仕様書のテスト要件1〜20に対応する。
 * 実行方法: npx tsx lib/zen/__tests__/zen-engine.test.ts
 */
import {
  issueZen,
  transferZen,
  applyZen,
  expireZen,
  lockZen,
  unlockZen,
  issueZenPlus,
  extendZenExpiry,
  calculateExtendedExpiry,
  issueFromCommonReserve,
  issueMissionReward,
  accrueCirculationFee,
  validateNotZenPlusPayment,
  validateNotExpired,
  validateNotLocked,
} from '../zen-engine'
import { calculateBalance, hasDuplicateEvents, applyAdjustment } from '../balance-calculator'
import { ZEN_CONFIG } from '../config'
import { LEDGER_EVENT_TYPES } from '../event-types'
import type { ZenLot, LedgerEvent } from '../types'

const ACCT_A = 'acct-a'
const ACCT_B = 'acct-b'
const RESERVE = 'reserve-acct'

function makeLot(
  accountId: string,
  amount: number,
  daysAgo: number = 0,
  expiryDays: number = 7,
): ZenLot {
  const issuedAt = new Date()
  issuedAt.setDate(issuedAt.getDate() - daysAgo)
  const expiresAt = new Date(issuedAt)
  expiresAt.setDate(expiresAt.getDate() + expiryDays)
  return {
    id: `lot_${Math.random().toString(36).slice(2, 8)}`,
    accountId,
    amount,
    remainingAmount: amount,
    issuedAt: issuedAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
    sourceEventId: 'src',
    status: 'active',
    lockedAmount: 0,
  }
}

let passed = 0
let failed = 0

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    passed++
  } else {
    failed++
    console.error(`✗ ${testName}${detail ? ` — ${detail}` : ''}`)
  }
}

// Test 1: Zenを発行すると台帳に記録される
function test1() {
  const result = issueZen(ACCT_A, 1000, 'テスト発行')
  assert(result.errors.length === 0, 'Test 1: Zen発行でエラーなし')
  assert(result.events.length === 1, 'Test 1: 1イベント記録')
  assert(result.events[0].eventType === LEDGER_EVENT_TYPES.ISSUE_ZEN, 'Test 1: ISSUE_ZENイベント')
  assert(result.lots.length === 1, 'Test 1: 1ロット生成')
  assert(result.lots[0].remainingAmount === 1000, 'Test 1: ロット残高1000')
}

// Test 2: Zenを使用すると利用可能残高が減少する
function test2() {
  const issueResult = issueZen(ACCT_A, 1000, 'テスト発行')
  const lots = issueResult.lots
  const transferResult = transferZen(ACCT_A, ACCT_B, 300, 'テスト取引', lots, undefined, true)
  assert(transferResult.errors.length === 0, 'Test 2: 移転でエラーなし')
  const updatedLots = transferResult.lots
  const balance = calculateBalance(ACCT_A, [...issueResult.events, ...transferResult.events], updatedLots, [])
  assert(balance.available === 700, 'Test 2: 利用可能残高700', `actual: ${balance.available}`)
}

// Test 3: 残高を超える使用は拒否される
function test3() {
  const issueResult = issueZen(ACCT_A, 500, 'テスト発行')
  const transferResult = transferZen(ACCT_A, ACCT_B, 600, '過剰使用', issueResult.lots, undefined, true)
  assert(transferResult.errors.length > 0, 'Test 3: 残高不足で拒否')
}

// Test 4: 期限切れZenは使用できない
function test4() {
  const expiredLot: ZenLot = {
    ...makeLot(ACCT_A, 1000, 10, 5), // 5日前に期限切れ
    status: 'active',
  }
  // expiredLotのexpiresAtは過去
  const transferResult = transferZen(ACCT_A, ACCT_B, 100, '期限切れ使用', [expiredLot], undefined, true)
  assert(transferResult.errors.length > 0, 'Test 4: 期限切れZenで拒否')
}

// Test 5: ロック中Zenは使用できない
function test5() {
  const lot = makeLot(ACCT_A, 1000)
  lot.lockedAmount = 1000
  const transferResult = transferZen(ACCT_A, ACCT_B, 100, 'ロック中使用', [lot], undefined, true)
  assert(transferResult.errors.length > 0, 'Test 5: ロック中Zenで拒否')
}

// Test 6: Zen+は購入に使用できない
function test6() {
  const err = validateNotZenPlusPayment('zen_plus')
  assert(err !== null, 'Test 6: Zen+支払い拒否')
  const ok = validateNotZenPlusPayment('zen')
  assert(ok === null, 'Test 6: Zen支払いは許可')
}

// Test 7: Zenの期限延長は最大3か月の上限を超えない
function test7() {
  const issuedAt = new Date().toISOString()
  const currentExpiry = new Date()
  currentExpiry.setDate(currentExpiry.getDate() + 80)
  const extended = calculateExtendedExpiry(issuedAt, currentExpiry.toISOString(), 30)
  const maxExpiry = new Date(issuedAt)
  maxExpiry.setDate(maxExpiry.getDate() + ZEN_CONFIG.maxExpiryDays)
  assert(new Date(extended).getTime() <= maxExpiry.getTime(), 'Test 7: 延長が最大90日を超えない')
}

// Test 8: 同一イベントの重複計上が防止される
function test8() {
  const event: LedgerEvent = {
    id: 'dup-1',
    eventType: LEDGER_EVENT_TYPES.ISSUE_ZEN,
    toAccountId: ACCT_A,
    accountId: ACCT_A,
    assetType: 'zen',
    amount: 1000,
    reason: 'テスト',
    status: 'confirmed',
    createdAt: new Date().toISOString(),
  }
  assert(hasDuplicateEvents([event, event]) === true, 'Test 8: 重複検出')
  assert(hasDuplicateEvents([event]) === false, 'Test 8: 重複なし')
}

// Test 9: 訂正イベントによって履歴を維持したまま修正できる
function test9() {
  const event: LedgerEvent = {
    id: 'orig-1',
    eventType: LEDGER_EVENT_TYPES.ISSUE_ZEN,
    toAccountId: ACCT_A,
    accountId: ACCT_A,
    assetType: 'zen',
    amount: 1000,
    reason: 'テスト',
    status: 'confirmed',
    createdAt: new Date().toISOString(),
  }
  const adjusted = applyAdjustment([event], 'orig-1', -200, '過剰発行の修正')
  assert(adjusted.length === 2, 'Test 9: 元+訂正で2イベント')
  assert(adjusted[1].eventType === LEDGER_EVENT_TYPES.ADJUSTMENT, 'Test 9: ADJUSTMENTイベント')
  assert(adjusted[0].id === 'orig-1', 'Test 9: 元イベント保持')
}

// Test 10: 発行・使用・失効の履歴から残高を再計算できる
function test10() {
  const issueResult = issueZen(ACCT_A, 1000, '発行')
  const transferResult = transferZen(ACCT_A, ACCT_B, 300, '取引', issueResult.lots, undefined, true)
  const allEvents = [...issueResult.events, ...transferResult.events]
  const balance = calculateBalance(ACCT_A, allEvents, transferResult.lots, [])
  assert(balance.available === 700, 'Test 10: 再計算で残高700', `actual: ${balance.available}`)
}

// Test 11: 未確定の換算率が未設定の場合、推測した値で資産変動を行わない
function test11() {
  // expiryExtensionFormula が null の場合は延長しない
  const result = extendZenExpiry('lot-1', ZEN_CONFIG.expiryExtensionFormula as unknown as number | null, 'テスト')
  assert(result.errors.length > 0, 'Test 11: 未確定の延長日数でエラー')

  // expiredZenToZenPlusRate が null の場合はZen+付与しない
  assert(ZEN_CONFIG.expiredZenToZenPlusRate === null, 'Test 11: 換算率はnull')
}

// Test 13: TRANSFER_ZENで移転元の利用可能Zenが減少する
function test13() {
  const issueResult = issueZen(ACCT_A, 1000, '発行')
  const transferResult = transferZen(ACCT_A, ACCT_B, 400, '取引', issueResult.lots, undefined, true)
  const balanceA = calculateBalance(ACCT_A, [...issueResult.events, ...transferResult.events], transferResult.lots, [])
  assert(balanceA.available === 600, 'Test 13: 移転元残高600', `actual: ${balanceA.available}`)
}

// Test 14: TRANSFER_ZENで移転先のZen残高が増加する
function test14() {
  const issueResult = issueZen(ACCT_A, 1000, '発行')
  const transferResult = transferZen(ACCT_A, ACCT_B, 400, '取引', issueResult.lots, undefined, true)
  const balanceB = calculateBalance(ACCT_B, [...issueResult.events, ...transferResult.events], transferResult.lots, [])
  assert(balanceB.available === 400, 'Test 14: 移転先残高400', `actual: ${balanceB.available}`)
}

// Test 15: Zen移転時に移転先の有効期限が移転時点から1週間に設定される
function test15() {
  const issueResult = issueZen(ACCT_A, 1000, '発行')
  const transferResult = transferZen(ACCT_A, ACCT_B, 400, '取引', issueResult.lots, undefined, true)
  const newLots = transferResult.lots.filter((l) => l.accountId === ACCT_B)
  assert(newLots.length > 0, 'Test 15: 移転先ロット存在')
  if (newLots.length > 0) {
    const issuedAt = new Date(newLots[0].issuedAt)
    const expiresAt = new Date(newLots[0].expiresAt)
    const diffDays = Math.ceil((expiresAt.getTime() - issuedAt.getTime()) / (1000 * 60 * 60 * 24))
    assert(diffDays === 7, 'Test 15: 有効期限7日', `actual: ${diffDays}`)
  }
}

// Test 16: ユーザー間の無償送信は拒否される
function test16() {
  const issueResult = issueZen(ACCT_A, 1000, '発行')
  const transferResult = transferZen(ACCT_A, ACCT_B, 100, '無償送信', issueResult.lots, undefined, false)
  assert(transferResult.errors.length > 0, 'Test 16: 無償送信拒否')
}

// Test 17: 期限切れZenがCommon Reserve Poolへ正しく還流される
function test17() {
  const lot = makeLot(ACCT_A, 500, 10, 5) // 期限切れ
  const result = expireZen(lot, RESERVE)
  assert(result.errors.length === 0, 'Test 17: 失効処理エラーなし')
  assert(result.events.length === 2, 'Test 17: 2イベント（EXPIRE + TRANSFER）')
  assert(result.events[0].eventType === LEDGER_EVENT_TYPES.EXPIRE_ZEN, 'Test 17: EXPIRE_ZEN')
  assert(result.events[1].eventType === LEDGER_EVENT_TYPES.TRANSFER_TO_COMMON_RESERVE, 'Test 17: TRANSFER_TO_COMMON_RESERVE')
  assert(result.events[1].parentEventId === result.events[0].id, 'Test 17: parentEventIdで追跡可能')
  assert(result.lots[0].status === 'expired', 'Test 17: ロット状態expired')
  assert(result.lots[0].remainingAmount === 0, 'Test 17: 残高0')
}

// Test 18: Common Reserve PoolからZenを発行すると、プール残高が減少し、新しい通常Zenロットが生成される
function test18() {
  const result = issueFromCommonReserve(RESERVE, ACCT_A, 500, 'ミッション報酬', 10000)
  assert(result.errors.length === 0, 'Test 18: 発行エラーなし')
  assert(result.events.length === 1, 'Test 18: 1イベント')
  assert(result.events[0].eventType === LEDGER_EVENT_TYPES.ISSUE_ZEN_FROM_COMMON_RESERVE, 'Test 18: ISSUE_ZEN_FROM_COMMON_RESERVE')
  assert(result.lots.length === 1, 'Test 18: 新ロット生成')
  assert(result.lots[0].accountId === ACCT_A, 'Test 18: 移転先アカウント')
  assert(result.lots[0].remainingAmount === 500, 'Test 18: ロット残高500')
}

// Test 18b: 共通プール残高不足で拒否
function test18b() {
  const result = issueFromCommonReserve(RESERVE, ACCT_A, 500, '過剰発行', 100)
  assert(result.errors.length > 0, 'Test 18b: 残高不足で拒否')
}

// Test 19: Common Reserve Poolからの発行で生成されたZenに1週間の期限が設定される
function test19() {
  const result = issueFromCommonReserve(RESERVE, ACCT_A, 500, 'ミッション報酬', 10000)
  if (result.lots.length > 0) {
    const issuedAt = new Date(result.lots[0].issuedAt)
    const expiresAt = new Date(result.lots[0].expiresAt)
    const diffDays = Math.ceil((expiresAt.getTime() - issuedAt.getTime()) / (1000 * 60 * 60 * 24))
    assert(diffDays === 7, 'Test 19: 有効期限7日', `actual: ${diffDays}`)
  } else {
    assert(false, 'Test 19: ロット未生成')
  }
}

// Test 20: APPLY_ZENとTRANSFER_ZENによって同一Zenが二重に減算されない
function test20() {
  const issueResult = issueZen(ACCT_A, 1000, '発行')
  const applyResult = applyZen(ACCT_A, 300, 'tx-1', 'Zen使用')
  const transferResult = transferZen(ACCT_A, ACCT_B, 300, '取引', issueResult.lots, 'tx-1', true)

  const allEvents = [...issueResult.events, ...applyResult.events, ...transferResult.events]
  const balance = calculateBalance(ACCT_A, allEvents, transferResult.lots, [])

  // APPLY_ZENは残高を変更しない。TRANSFER_ZENのみが300を減算する。
  assert(balance.available === 700, 'Test 20: 二重減算なし（700）', `actual: ${balance.available}`)
}

// Test: ミッション報酬でZenとZen+が発行される
function testMission() {
  const result = issueMissionReward(ACCT_A, 100, 50, 'm1', '地域の清掃')
  assert(result.errors.length === 0, 'Test Mission: エラーなし')
  assert(result.events.length === 2, 'Test Mission: 2イベント')
  assert(result.lots.length === 1, 'Test Mission: 1ロット')
}

// Test: 縁環料計算
function testFee() {
  const result = accrueCirculationFee('tx-1', 1000, 200)
  assert(result.errors.length === 0, 'Test Fee: エラーなし')
  // 1000円 * 5% = 50, 200Zen * 5% = 10
  assert(result.events.length === 2, 'Test Fee: 2イベント（円分+Zen分）')
}

// Run all tests
function runAll() {
  console.log('=== Zen Engine Tests ===\n')
  test1()
  test2()
  test3()
  test4()
  test5()
  test6()
  test7()
  test8()
  test9()
  test10()
  test11()
  test13()
  test14()
  test15()
  test16()
  test17()
  test18()
  test18b()
  test19()
  test20()
  testMission()
  testFee()

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`)
  if (failed > 0) {
    process.exit(1)
  }
}

runAll()
