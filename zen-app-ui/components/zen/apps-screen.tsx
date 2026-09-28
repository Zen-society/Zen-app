'use client'

import {
  BookOpen,
  CalendarDays,
  HandHeart,
  HandHelping,
  History,
  Orbit,
  ShoppingBag,
  Target,
  UserRound,
  UsersRound,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

type AppItem = {
  label: string
  icon: typeof Target
  tone: 'mint' | 'ink' | 'amber' | 'soft'
  soon?: boolean
}

const groups: { title: string; items: AppItem[] }[] = [
  {
    title: 'よく使う',
    items: [
      { label: 'ミッション', icon: Target, tone: 'mint' },
      { label: 'フリマ', icon: ShoppingBag, tone: 'amber' },
      { label: 'メタバース', icon: Orbit, tone: 'ink' },
      { label: 'コミュニティ', icon: UsersRound, tone: 'mint' },
    ],
  },
  {
    title: 'Zenの循環',
    items: [
      { label: '支援依頼', icon: HandHelping, tone: 'soft' },
      { label: '募金', icon: HandHeart, tone: 'soft' },
      { label: '取引履歴', icon: History, tone: 'soft' },
      { label: 'ユーザー', icon: UserRound, tone: 'soft' },
    ],
  },
  {
    title: 'まもなく登場',
    items: [
      { label: 'まなび', icon: BookOpen, tone: 'soft', soon: true },
      { label: 'イベント', icon: CalendarDays, tone: 'soft', soon: true },
    ],
  },
]

const toneClass: Record<AppItem['tone'], string> = {
  mint: 'bg-zen-mint text-white',
  ink: 'bg-zen-ink text-zen-mint',
  amber: 'bg-zen-amber text-white',
  soft: 'bg-white text-zen-mint-deep ring-1 ring-zen-ink/5',
}

export function AppsScreen() {
  return (
    <div className="flex flex-col gap-6 px-5 pt-5">
      <header>
        <p className="text-xs font-bold text-zen-mint-deep">サービス空間</p>
        <h1 className="font-display text-2xl font-bold text-zen-ink">アプリ</h1>
      </header>

      {groups.map((group) => (
        <section key={group.title} aria-label={group.title}>
          <h2 className="text-xs font-bold text-zen-ink/60">{group.title}</h2>
          <ul className="mt-3 grid grid-cols-4 gap-x-3 gap-y-4">
            {group.items.map(({ label, icon: Icon, tone, soon }) => (
              <li key={label}>
                <button
                  type="button"
                  disabled={soon}
                  onClick={() => toast(`${label}を開きます`)}
                  className="flex w-full flex-col items-center gap-1.5 disabled:opacity-50"
                >
                  <span
                    className={cn(
                      'grid aspect-square w-full max-w-16 place-items-center rounded-[1.25rem] shadow-sm transition',
                      toneClass[tone],
                    )}
                  >
                    <Icon className="size-7" aria-hidden="true" />
                  </span>
                  <span className="text-[11px] font-medium text-zen-ink/80">{label}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}

      <p className="text-center text-[11px] text-zen-ink/50">右へスワイプでホームに戻る</p>
    </div>
  )
}
