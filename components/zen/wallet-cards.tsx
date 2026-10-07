'use client'

import { useEffect, useState } from 'react'
import { Hourglass, Lock, RefreshCw, Sprout, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import type { BalanceSummary } from '@/lib/zen/types'
import {
  getOrCreateDemoUser,
  getOrCreateAssetAccount,
  getBalanceSummary,
  getReserveBalance,
  seedDemoData,
  DEMO_USER_ID,
} from '@/lib/zen/data-access'
import { formatNumber } from '@/lib/zen-data'

const RING_RADIUS = 30
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS

function CycleRing({ daysLeft, cycleDays }: { daysLeft: number; cycleDays: number }) {
  const remainingRatio = Math.max(0, Math.min(1, daysLeft / cycleDays))
  return (
    <div className="relative size-[76px]">
      <svg viewBox="0 0 76 76" className="size-full -rotate-90" aria-hidden="true">
        <circle cx="38" cy="38" r={RING_RADIUS} fill="none" strokeWidth="7" className="stroke-zen-mint-soft" />
        <circle
          cx="38"
          cy="38"
          r={RING_RADIUS}
          fill="none"
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={`${RING_CIRCUMFERENCE * remainingRatio} ${RING_CIRCUMFERENCE}`}
          className="stroke-zen-amber"
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">
        <RefreshCw className="size-6 text-zen-mint-deep motion-safe:animate-[spin_12s_linear_infinite]" aria-hidden="true" />
      </div>
    </div>
  )
}

function ContributionBlocks({ amount, nextRankAt }: { amount: number; nextRankAt: number }) {
  const columns = [1, 2, 2, 3, 4, 5]
  const filledColumns = Math.round((amount / nextRankAt) * columns.length)
  return (
    <div className="flex h-[76px] items-end gap-1" aria-hidden="true">
      {columns.map((height, i) => (
        <div key={i} className="flex flex-col-reverse gap-1">
          {Array.from({ length: height }).map((_, j) => (
            <span
              key={j}
              className={
                i < filledColumns ? 'size-2.5 rounded-[3px] bg-zen-mint' : 'size-2.5 rounded-[3px] bg-white/15'
              }
            />
          ))}
        </div>
      ))}
    </div>
  )
}

export function WalletCards() {
  const [balance, setBalance] = useState<BalanceSummary | null>(null)
  const [reserveTotal, setReserveTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [zenPlusAmount, setZenPlusAmount] = useState(1250)
  const [zenPlusRank, setZenPlusRank] = useState(7)
  const [zenPlusNextRankAt, setZenPlusNextRankAt] = useState(1500)
  const [zenPlusGainedThisMonth, setZenPlusGainedThisMonth] = useState(180)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        await seedDemoData()
        await getOrCreateDemoUser()
        const zenAccount = await getOrCreateAssetAccount(DEMO_USER_ID, 'zen')
        const reserve = await getReserveBalance()
        if (cancelled) return
        setReserveTotal(reserve)

        if (zenAccount) {
          const summary = await getBalanceSummary(zenAccount.id, reserve)
          if (cancelled) return
          setBalance(summary)
        }

        // Zen+取得（台帳から計算）
        const plusAccount = await getOrCreateAssetAccount(DEMO_USER_ID, 'zen_plus')
        if (plusAccount && !cancelled) {
          const plusSummary = await getBalanceSummary(plusAccount.id, reserve)
          if (!cancelled) {
            setZenPlusAmount(plusSummary.zenPlusTotal || 1250)
          }
        }
      } catch (err) {
        console.error('WalletCards: failed to load data', err)
        toast('データの読み込みに失敗しました。デモデータを表示します。')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  const availableZen = balance?.available ?? 15782
  const lockedZen = balance?.locked ?? 0
  const expiredZen = balance?.expired ?? 0
  const nextExpiring = balance?.nextExpiring
  const expiringAmount = nextExpiring?.remainingAmount ?? 3200
  const expiringDaysLeft = nextExpiring?.daysLeft ?? 12
  const toNextRank = zenPlusNextRankAt - zenPlusAmount

  if (loading) {
    return (
      <section className="px-5">
        <div className="flex items-center justify-center py-12 text-zen-ink/50">
          <Loader2 className="size-6 animate-spin" />
        </div>
      </section>
    )
  }

  return (
    <section aria-labelledby="wallet-heading" className="px-5">
      <h2 id="wallet-heading" className="sr-only">
        あなたの残高
      </h2>
      <div className="grid grid-cols-2 gap-3">
        <article className="flex flex-col gap-3 rounded-3xl bg-white p-4 ring-1 ring-zen-ink/5">
          <div className="flex items-center justify-between">
            <span className="rounded-full bg-zen-mint-soft px-2 py-0.5 text-[11px] font-bold text-zen-mint-deep">
              循環する
            </span>
          </div>
          <CycleRing daysLeft={expiringDaysLeft} cycleDays={90} />
          <div>
            <p className="font-display text-[1.7rem] leading-none font-bold tabular-nums text-zen-ink">
              {formatNumber(availableZen)}
            </p>
            <p className="mt-1 text-xs font-medium text-zen-ink/60">Zen（禅）</p>
          </div>
          {lockedZen > 0 && (
            <div className="flex items-center gap-1.5 text-[11px] text-zen-ink/60">
              <Lock className="size-3" aria-hidden="true" />
              ロック中: {formatNumber(lockedZen)}
            </div>
          )}
        </article>

        <article className="flex flex-col gap-3 rounded-3xl bg-zen-ink p-4 text-white">
          <div className="flex items-center justify-between">
            <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-bold text-zen-mint">
              積み上がる
            </span>
            <span className="text-[11px] text-white/60">Rank {zenPlusRank}</span>
          </div>
          <ContributionBlocks amount={zenPlusAmount} nextRankAt={zenPlusNextRankAt} />
          <div>
            <p className="font-display text-[1.7rem] leading-none font-bold tabular-nums">
              {formatNumber(zenPlusAmount)}
            </p>
            <p className="mt-1 text-xs font-medium text-white/60">Zen+（善）</p>
          </div>
        </article>
      </div>

      <div className="mt-3 flex flex-col gap-2">
        {expiringAmount > 0 && (
          <button
            type="button"
            onClick={() => toast('期限が近いZenを使えるお店を探します')}
            className="flex w-full items-center gap-3 rounded-2xl bg-zen-amber/12 px-4 py-3 text-left ring-1 ring-zen-amber/30 transition hover:bg-zen-amber/20"
          >
            <Hourglass className="size-5 shrink-0 text-zen-amber" aria-hidden="true" />
            <span className="min-w-0 flex-1 text-sm text-zen-ink">
              <strong className="font-bold tabular-nums">{formatNumber(expiringAmount)} Zen</strong>
              {' が '}
              <strong className="font-bold">あと{expiringDaysLeft}日</strong>
              {` で期限`}
            </span>
            <span className="shrink-0 text-xs font-bold text-zen-ink underline underline-offset-2">使い道</span>
          </button>
        )}
        {expiredZen > 0 && (
          <p className="flex items-center gap-2 px-4 py-2 text-xs text-zen-ink/50">
            <Hourglass className="size-4" aria-hidden="true" />
            期限切れ: {formatNumber(expiredZen)} Zen（みんなの蓄財へ還流済み）
          </p>
        )}
        <p className="flex items-center gap-2 px-1 text-xs text-zen-ink/70">
          <Sprout className="size-4 text-zen-mint-deep" aria-hidden="true" />
          今月 +{zenPlusGainedThisMonth} の貢献。次のランクまであと {formatNumber(toNextRank)}
        </p>
        {balance && balance.lots.length > 0 && (
          <details className="rounded-2xl bg-white/60 px-3 py-2 text-xs ring-1 ring-zen-ink/5">
            <summary className="cursor-pointer font-bold text-zen-ink/70">
              有効期限ごとのZen ({balance.lots.length}ロット)
            </summary>
            <ul className="mt-2 space-y-1">
              {balance.lots.map((lot) => (
                <li key={lot.lotId} className="flex items-center justify-between text-zen-ink/60">
                  <span className="tabular-nums">{formatNumber(lot.remainingAmount)} Zen</span>
                  <span className={lot.daysLeft <= 3 ? 'font-bold text-zen-amber' : ''}>
                    あと{lot.daysLeft}日
                  </span>
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>
    </section>
  )
}
