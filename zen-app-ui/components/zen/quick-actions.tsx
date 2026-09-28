'use client'

import { HandHeart, HeartHandshake, ReceiptText } from 'lucide-react'
import { toast } from 'sonner'

const actions = [
  { label: '支援依頼', description: '助けを求める', icon: HandHeart },
  { label: '募金', description: '想いを届ける', icon: HeartHandshake },
  { label: '取引履歴', description: '流れを見る', icon: ReceiptText },
] as const

export function QuickActions() {
  return (
    <nav aria-label="クイックアクション" className="px-5">
      <ul className="grid grid-cols-3 gap-3">
        {actions.map(({ label, description, icon: Icon }) => (
          <li key={label}>
            <button
              type="button"
              onClick={() => toast(`${label}画面を開きます`)}
              className="flex w-full flex-col items-center gap-2 rounded-2xl bg-white px-2 py-4 ring-1 ring-zen-ink/5 transition hover:-translate-y-0.5 hover:ring-zen-mint"
            >
              <span className="grid size-11 place-items-center rounded-2xl bg-zen-mint-soft text-zen-mint-deep">
                <Icon className="size-5" aria-hidden="true" />
              </span>
              <span className="text-sm font-bold text-zen-ink">{label}</span>
              <span className="text-[10px] text-zen-ink/55">{description}</span>
            </button>
          </li>
        ))}
      </ul>
    </nav>
  )
}
