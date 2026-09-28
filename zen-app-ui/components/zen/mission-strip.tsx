'use client'

import { ChevronRight, RefreshCw, Sprout } from 'lucide-react'
import { toast } from 'sonner'
import { mockMissions } from '@/lib/zen-data'

function RewardRow({ zen, zenPlus }: { zen: number; zenPlus: number }) {
  return (
    <span className="grid grid-cols-2 gap-1.5" aria-label={`報酬 ${zen} Zen と ${zenPlus} Zen+`}>
      <span className="flex flex-col rounded-xl bg-zen-mint-soft px-2.5 py-1.5">
        <span className="flex items-center gap-1 text-[9px] font-bold text-zen-mint-deep">
          <RefreshCw className="size-2.5" aria-hidden="true" />
          使えるZen
        </span>
        <span className="font-display text-sm font-bold tabular-nums text-zen-mint-deep">+{zen} Zen</span>
      </span>
      <span className="flex flex-col rounded-xl bg-zen-ink px-2.5 py-1.5">
        <span className="flex items-center gap-1 text-[9px] font-bold text-zen-mint">
          <Sprout className="size-2.5" aria-hidden="true" />
          貢献の証
        </span>
        <span className="font-display text-sm font-bold tabular-nums text-white">+{zenPlus} Zen+</span>
      </span>
    </span>
  )
}

export function MissionStrip() {
  return (
    <section aria-labelledby="mission-heading">
      <div className="flex items-end justify-between px-5">
        <div>
          <h2 id="mission-heading" className="font-display text-lg font-bold text-zen-ink">
            今日のミッション
          </h2>
          <p className="text-xs text-zen-ink/60">達成すると Zen と Zen+ の両方がもらえます</p>
        </div>
        <button
          type="button"
          onClick={() => toast('ミッション一覧を開きます')}
          className="inline-flex items-center text-xs font-bold text-zen-mint-deep"
        >
          すべて
          <ChevronRight className="size-4" aria-hidden="true" />
        </button>
      </div>
      <ul data-no-swipe className="mt-3 flex snap-x gap-3 overflow-x-auto px-5 pb-1 [scrollbar-width:none]">
        {mockMissions.map((mission) => {
          const ratio = mission.progress / mission.goal
          return (
            <li key={mission.id} className="w-60 shrink-0 snap-start">
              <button
                type="button"
                onClick={() => toast(`「${mission.title}」に参加します`)}
                className="flex h-full w-full flex-col gap-3 rounded-2xl bg-white p-4 text-left ring-1 ring-zen-ink/5 transition hover:ring-zen-mint"
              >
                <span className="text-sm font-bold text-zen-ink text-pretty">{mission.title}</span>
                <RewardRow zen={mission.reward.zen} zenPlus={mission.reward.zenPlus} />
                <span className="mt-auto flex items-center gap-2">
                  <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-zen-mint-soft">
                    <span className="block h-full rounded-full bg-zen-mint" style={{ width: `${ratio * 100}%` }} />
                  </span>
                  <span className="text-[11px] tabular-nums text-zen-ink/60">
                    {mission.progress}/{mission.goal}
                  </span>
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
