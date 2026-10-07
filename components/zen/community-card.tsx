'use client'

import { useEffect, useState } from 'react'
import { ArrowRight, Globe2, Hourglass, Info, Loader2, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { formatNumber } from '@/lib/zen-data'
import { getReserveBalance } from '@/lib/zen/data-access'

const FALLBACK_TOTAL = 1258924432
const FALLBACK_MEMBERS = 48213
const FALLBACK_CIRCULATED = 3842160
const FALLBACK_MISSIONS = 126

export function CommunityCard() {
  const [total, setTotal] = useState(FALLBACK_TOTAL)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const balance = await getReserveBalance()
        if (!cancelled) setTotal(balance > 0 ? balance : FALLBACK_TOTAL)
      } catch {
        if (!cancelled) setTotal(FALLBACK_TOTAL)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  const stats = [
    { label: 'メンバー', value: `${formatNumber(FALLBACK_MEMBERS)}人` },
    { label: '今日の循環', value: `${formatNumber(FALLBACK_CIRCULATED)}` },
    { label: '進行中ミッション', value: `${FALLBACK_MISSIONS}件` },
  ]

  return (
    <section aria-labelledby="community-heading" className="px-5">
      <button
        type="button"
        onClick={() => toast('コミュニティを開きます')}
        className="w-full rounded-3xl border-2 border-dashed border-zen-mint/50 bg-zen-mint-soft/50 p-5 text-left transition hover:border-zen-mint"
      >
        <div className="flex items-center gap-2">
          <Globe2 className="size-5 text-zen-mint-deep" aria-hidden="true" />
          <h2 id="community-heading" className="font-display text-lg font-bold whitespace-nowrap text-zen-ink">
            みんなの蓄財 <span className="text-zen-mint-deep">Zen（全）</span>
          </h2>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-zen-ink/70 text-pretty">
          期限切れのZenなどがここへ還り、みんなのために循環します
        </p>
        <div
          className="mt-3 flex items-center gap-1.5 text-[10px] font-bold text-zen-ink/70"
          aria-hidden="true"
        >
          <span className="flex items-center gap-1 rounded-full bg-white px-2 py-1">
            <Hourglass className="size-3 text-zen-amber" />
            期限切れZen
          </span>
          <ArrowRight className="size-3 text-zen-mint" />
          <span className="rounded-full bg-zen-mint px-2 py-1 text-white">みんなの蓄財</span>
          <ArrowRight className="size-3 text-zen-mint" />
          <span className="flex items-center gap-1 rounded-full bg-white px-2 py-1">
            <RefreshCw className="size-3 text-zen-mint-deep" />
            再び循環
          </span>
        </div>

        <p className="mt-4 font-display text-3xl font-bold tabular-nums text-zen-mint-deep">
          {loading ? (
            <Loader2 className="inline size-7 animate-spin" />
          ) : (
            formatNumber(total)
          )}
          <span className="ml-1 text-base text-zen-ink/60">Zen</span>
        </p>
        <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-zen-ink/60">
          <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-zen-mint-deep">
            コミュニティ全体
          </span>
          <Info className="size-3" aria-hidden="true" />
          あなた個人の残高ではありません
        </p>

        <dl className="mt-4 grid grid-cols-3 divide-x divide-zen-mint/30 rounded-2xl bg-white/70 py-3">
          {stats.map((stat) => (
            <div key={stat.label} className="px-2 text-center">
              <dt className="text-[10px] text-zen-ink/60">{stat.label}</dt>
              <dd className="mt-0.5 text-sm font-bold tabular-nums text-zen-ink">{stat.value}</dd>
            </div>
          ))}
        </dl>
      </button>
    </section>
  )
}
