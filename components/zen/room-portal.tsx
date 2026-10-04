'use client'

import Image from 'next/image'
import { ArrowUpRight, Users } from 'lucide-react'
import { toast } from 'sonner'
import { mockRoom, mockUser } from '@/lib/zen-data'

export function RoomPortal() {
  return (
    <section aria-labelledby="room-heading" className="px-5">
      <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-b from-white to-zen-mint-soft shadow-[0_20px_40px_-24px_rgba(18,51,46,0.35)] ring-1 ring-zen-ink/5">
        <div className="flex items-start justify-between p-5 pb-0">
          <div>
            <p className="text-xs font-medium text-zen-mint-deep">おかえりなさい、{mockUser.name}さん</p>
            <h2 id="room-heading" className="font-display text-xl font-bold text-zen-ink">
              わたしのマイルーム
            </h2>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full bg-white/80 px-2.5 py-1 text-[11px] font-medium text-zen-ink ring-1 ring-zen-ink/10">
            <span className="size-1.5 rounded-full bg-zen-mint" aria-hidden="true" />
            <Users className="size-3" aria-hidden="true" />
            {mockRoom.visitors}人が訪問中
          </span>
        </div>

        <div className="relative mx-auto aspect-[4/3] w-full max-w-sm">
          <Image
            src={mockRoom.imageSrc}
            alt={mockRoom.imageAlt}
            fill
            priority
            sizes="(max-width: 448px) 100vw, 384px"
            className="object-contain"
          />
        </div>

        <div className="flex items-center justify-between gap-3 px-5 pb-5">
          <div className="min-w-0">
            <p className="text-[11px] text-zen-ink/60">称号</p>
            <p className="truncate text-sm font-bold text-zen-ink">{mockUser.title}</p>
          </div>
          <button
            type="button"
            onClick={() => toast('マイルームに入ります')}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-zen-ink px-4 py-2.5 text-sm font-bold text-white transition hover:bg-zen-mint-deep"
          >
            ルームに入る
            <ArrowUpRight className="size-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </section>
  )
}
