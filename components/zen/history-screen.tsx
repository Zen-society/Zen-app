'use client'

import { useEffect, useState } from 'react'
import { Award, HeartHandshake, Leaf, Loader2, Sprout, Users } from 'lucide-react'
import { toast } from 'sonner'
import type { LedgerEvent } from '@/lib/zen/types'
import {
  getOrCreateDemoUser,
  getOrCreateAssetAccount,
  getLedgerEvents,
  getEventLabelJa,
  DEMO_USER_ID,
} from '@/lib/zen/data-access'
import { formatNumber } from '@/lib/zen-data'

const CATEGORY_ICONS: Record<string, typeof Sprout> = {
  'ISSUE_ZEN_PLUS': Sprout,
  'MISSION_REWARD': Award,
  'ISSUE_ZEN': Leaf,
  'TRANSFER_ZEN': Users,
  'ADJUSTMENT': HeartHandshake,
}

function EventIcon({ type }: { type: string }) {
  const Icon = CATEGORY_ICONS[type] || Leaf
  return <Icon className="size-4" aria-hidden="true" />
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return `${d.getMonth() + 1}月${d.getDate()}日 ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export function HistoryScreen() {
  const [events, setEvents] = useState<LedgerEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [zenPlusTotal, setZenPlusTotal] = useState(0)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        await getOrCreateDemoUser()
        const zenAccount = await getOrCreateAssetAccount(DEMO_USER_ID, 'zen')
        if (zenAccount && !cancelled) {
          const evts = await getLedgerEvents(zenAccount.id)
          if (!cancelled) setEvents(evts)
        }

        const plusAccount = await getOrCreateAssetAccount(DEMO_USER_ID, 'zen_plus')
        if (plusAccount && !cancelled) {
          const plusEvents = await getLedgerEvents(plusAccount.id)
          const total = plusEvents
            .filter((e) => e.eventType === 'ISSUE_ZEN_PLUS' && e.status === 'confirmed')
            .reduce((sum, e) => sum + e.amount, 0)
          if (!cancelled) setZenPlusTotal(total || 1250)
        }
      } catch {
        if (!cancelled) toast('履歴の読み込みに失敗しました')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  return (
    <div className="flex flex-col gap-6 px-5 pt-5">
      <header>
        <p className="text-xs font-bold text-zen-mint-deep">貢献と履歴</p>
        <h1 className="font-display text-2xl font-bold text-zen-ink">Zen+・台帳履歴</h1>
      </header>

      <div className="rounded-3xl bg-zen-ink p-5 text-white">
        <p className="text-xs text-white/60">現在のZen+残高</p>
        <p className="mt-1 font-display text-3xl font-bold tabular-nums">
          {loading ? <Loader2 className="inline size-7 animate-spin" /> : formatNumber(zenPlusTotal)}
        </p>
        <p className="mt-1 text-xs text-white/60">Zen+は支払いに使用できない非換金型スコアです</p>
      </div>

      <section aria-labelledby="history-heading">
        <h2 id="history-heading" className="font-display text-lg font-bold text-zen-ink">
          直近の台帳履歴
        </h2>
        {loading ? (
          <div className="flex items-center justify-center py-8 text-zen-ink/50">
            <Loader2 className="size-6 animate-spin" />
          </div>
        ) : events.length === 0 ? (
          <p className="py-8 text-center text-sm text-zen-ink/50">履歴がありません</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {events.map((event) => {
              const isPositive = !!event.toAccountId || event.eventType === 'ISSUE_ZEN' || event.eventType === 'ISSUE_ZEN_PLUS' || event.eventType === 'MISSION_REWARD'
              return (
                <li
                  key={event.id}
                  className="flex items-start gap-3 rounded-2xl bg-white p-4 ring-1 ring-zen-ink/5"
                >
                  <span className={`grid size-9 shrink-0 place-items-center rounded-xl ${isPositive ? 'bg-zen-mint-soft text-zen-mint-deep' : 'bg-zen-ink/5 text-zen-ink/60'}`}>
                    <EventIcon type={event.eventType} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-zen-ink">
                        {getEventLabelJa(event.eventType)}
                      </span>
                      <span className={`text-sm font-bold tabular-nums ${isPositive ? 'text-zen-mint-deep' : 'text-zen-ink/70'}`}>
                        {isPositive ? '+' : '-'}{formatNumber(event.amount)}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[11px] text-zen-ink/50">
                      {event.reason}
                    </p>
                    <p className="mt-0.5 text-[10px] text-zen-ink/40">
                      {formatDate(event.createdAt)}
                    </p>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <p className="text-center text-[11px] text-zen-ink/50">
        台帳イベントは削除されません。訂正は別イベントとして記録されます。
      </p>
    </div>
  )
}
