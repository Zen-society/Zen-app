'use client'

import Image from 'next/image'
import { Bell } from 'lucide-react'
import { toast } from 'sonner'
import { EnsoMark } from './enso-mark'
import { mockUser } from '@/lib/zen-data'

export function AppHeader() {
  return (
    <header className="flex items-center justify-between px-5 pt-5 pb-3">
      <div className="flex items-center gap-2 text-zen-mint-deep">
        <EnsoMark />
        <span className="font-display text-2xl font-bold tracking-wide text-zen-ink">Zen</span>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => toast('お知らせはまだありません')}
          className="grid size-10 place-items-center rounded-full bg-white text-zen-ink shadow-sm ring-1 ring-zen-ink/5 transition hover:bg-zen-mint-soft"
          aria-label="お知らせ"
        >
          <Bell className="size-5" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => toast('ユーザー設定を開きます')}
          className="relative size-10 overflow-hidden rounded-full bg-white ring-2 ring-zen-mint ring-offset-2 ring-offset-zen-cloud transition hover:ring-zen-mint-deep"
          aria-label={`ユーザー設定（${mockUser.name}）`}
        >
          <Image
            src={mockUser.avatarSrc}
            alt=""
            fill
            sizes="80px"
            className="scale-[2.2] object-cover saturate-[1.15]"
          />
        </button>
      </div>
    </header>
  )
}
