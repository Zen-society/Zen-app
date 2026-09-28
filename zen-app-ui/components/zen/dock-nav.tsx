'use client'

import { Compass, LayoutGrid } from 'lucide-react'
import { cn } from '@/lib/utils'
import { EnsoMark } from './enso-mark'

export const SCREENS = ['browser', 'home', 'apps'] as const
export type Screen = (typeof SCREENS)[number]

type DockNavProps = {
  active: Screen
  onNavigate: (screen: Screen) => void
}

function SideButton({
  label,
  icon: Icon,
  isActive,
  onClick,
  controls,
}: {
  label: string
  icon: typeof Compass
  isActive: boolean
  onClick: () => void
  controls: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={isActive ? 'page' : undefined}
      aria-controls={controls}
      className={cn(
        'flex h-14 flex-1 items-center justify-center gap-2 rounded-2xl text-sm font-bold transition',
        isActive ? 'bg-zen-ink text-zen-mint' : 'text-zen-ink/70 hover:bg-zen-mint-soft hover:text-zen-ink',
      )}
    >
      <Icon className="size-5" aria-hidden="true" />
      {label}
    </button>
  )
}

export function DockNav({ active, onNavigate }: DockNavProps) {
  const isHome = active === 'home'

  return (
    <nav
      aria-label="メインナビゲーション"
      className="fixed inset-x-0 bottom-0 z-30 mx-auto w-full max-w-md px-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
    >
      <div className="mb-2 flex justify-center gap-1.5" aria-hidden="true">
        {SCREENS.map((screen) => (
          <span
            key={screen}
            className={cn(
              'h-1.5 rounded-full transition-all duration-300',
              screen === active ? 'w-5 bg-zen-mint' : 'w-1.5 bg-zen-ink/20',
            )}
          />
        ))}
      </div>
      <div className="flex items-center gap-2 rounded-[1.75rem] bg-white/90 p-2 shadow-[0_12px_32px_-12px_rgba(18,51,46,0.35)] ring-1 ring-zen-ink/5 backdrop-blur">
        <SideButton
          label="ブラウザ"
          icon={Compass}
          isActive={active === 'browser'}
          onClick={() => onNavigate('browser')}
          controls="screen-browser"
        />
        <button
          type="button"
          onClick={() => onNavigate('home')}
          aria-current={isHome ? 'page' : undefined}
          aria-controls="screen-home"
          className={cn(
            '-my-6 flex size-[4.5rem] shrink-0 flex-col items-center justify-center rounded-full shadow-lg ring-4 ring-zen-cloud transition',
            isHome ? 'bg-zen-mint text-white' : 'bg-white text-zen-mint-deep hover:bg-zen-mint-soft',
          )}
        >
          <EnsoMark className="size-7" />
          <span className="text-[11px] font-bold">ホーム</span>
        </button>
        <SideButton
          label="アプリ"
          icon={LayoutGrid}
          isActive={active === 'apps'}
          onClick={() => onNavigate('apps')}
          controls="screen-apps"
        />
      </div>
    </nav>
  )
}
