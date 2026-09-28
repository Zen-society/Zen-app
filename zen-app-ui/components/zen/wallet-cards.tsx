'use client'

import { Hourglass, RefreshCw, Sprout } from 'lucide-react'
import { toast } from 'sonner'
import { formatNumber, mockZen, mockZenPlus } from '@/lib/zen-data'

const RING_RADIUS = 30
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS

function CycleRing() {
  const remainingRatio = mockZen.expiring.daysLeft / mockZen.cycleDays
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

function ContributionBlocks() {
  const columns = [1, 2, 2, 3, 4, 5]
  const filledColumns = Math.round((mockZenPlus.amount / mockZenPlus.nextRankAt) * columns.length)
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
  const toNextRank = mockZenPlus.nextRankAt - mockZenPlus.amount

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
          <CycleRing />
          <div>
            <p className="font-display text-[1.7rem] leading-none font-bold tabular-nums text-zen-ink">
              {formatNumber(mockZen.amount)}
            </p>
            <p className="mt-1 text-xs font-medium text-zen-ink/60">Zen（禅）</p>
          </div>
        </article>

        <article className="flex flex-col gap-3 rounded-3xl bg-zen-ink p-4 text-white">
          <div className="flex items-center justify-between">
            <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-bold text-zen-mint">
              積み上がる
            </span>
            <span className="text-[11px] text-white/60">Rank {mockZenPlus.rank}</span>
          </div>
          <ContributionBlocks />
          <div>
            <p className="font-display text-[1.7rem] leading-none font-bold tabular-nums">
              {formatNumber(mockZenPlus.amount)}
            </p>
            <p className="mt-1 text-xs font-medium text-white/60">Zen+（善）</p>
          </div>
        </article>
      </div>

      <div className="mt-3 flex flex-col gap-2">
        <button
          type="button"
          onClick={() => toast('期限が近いZenを使えるお店を探します')}
          className="flex w-full items-center gap-3 rounded-2xl bg-zen-amber/12 px-4 py-3 text-left ring-1 ring-zen-amber/30 transition hover:bg-zen-amber/20"
        >
          <Hourglass className="size-5 shrink-0 text-zen-amber" aria-hidden="true" />
          <span className="min-w-0 flex-1 text-sm text-zen-ink">
            <strong className="font-bold tabular-nums">{formatNumber(mockZen.expiring.amount)} Zen</strong>
            {' が '}
            <strong className="font-bold">あと{mockZen.expiring.daysLeft}日</strong>
            {`（${mockZen.expiring.date}）で期限`}
          </span>
          <span className="shrink-0 text-xs font-bold text-zen-ink underline underline-offset-2">使い道</span>
        </button>
        <p className="flex items-center gap-2 px-1 text-xs text-zen-ink/70">
          <Sprout className="size-4 text-zen-mint-deep" aria-hidden="true" />
          今月 +{mockZenPlus.gainedThisMonth} の貢献。次のランクまであと {formatNumber(toNextRank)}
        </p>
      </div>
    </section>
  )
}
