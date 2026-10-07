'use client'

import { useState, useCallback, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { AppHeader } from '@/components/zen/app-header'
import { AppsScreen } from '@/components/zen/apps-screen'
import { BrowserScreen } from '@/components/zen/browser-screen'
import { CommunityCard } from '@/components/zen/community-card'
import { HistoryScreen } from '@/components/zen/history-screen'
import { MissionStrip } from '@/components/zen/mission-strip'
import { QuickActions } from '@/components/zen/quick-actions'
import { RoomPortal } from '@/components/zen/room-portal'
import { TransactionScreen } from '@/components/zen/transaction-screen'
import { WalletCards } from '@/components/zen/wallet-cards'
import { ZenPager } from '@/components/zen/zen-pager'

type OverlayType = 'transaction' | 'history' | null

function Overlay({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div
      className="fixed inset-0 z-50 mx-auto flex max-w-md flex-col bg-zen-cloud"
      role="dialog"
      aria-label={title}
      aria-modal="true"
    >
      <div className="flex items-center justify-between border-b border-zen-ink/10 bg-white px-5 py-3">
        <h2 className="font-display text-lg font-bold text-zen-ink">{title}</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="閉じる"
          className="grid size-9 place-items-center rounded-full bg-zen-mint-soft text-zen-mint-deep transition hover:bg-zen-mint/20"
        >
          <X className="size-5" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto pb-20">{children}</div>
    </div>
  )
}

export default function HomePage() {
  const [overlay, setOverlay] = useState<OverlayType>(null)

  const openOverlay = useCallback((type: OverlayType) => setOverlay(type), [])
  const closeOverlay = useCallback(() => setOverlay(null), [])

  return (
    <>
      <ZenPager
        browser={<BrowserScreen />}
        apps={<AppsScreen />}
        home={
          <>
            <AppHeader />
            <main className="flex flex-col gap-6">
              <RoomPortal />
              <WalletCards />
              <QuickActions onAction={openOverlay} />
              <MissionStrip />
              <CommunityCard />
            </main>
          </>
        }
      />
      {overlay === 'transaction' && (
        <Overlay title="お買い物" onClose={closeOverlay}>
          <TransactionScreen />
        </Overlay>
      )}
      {overlay === 'history' && (
        <Overlay title="Zen+・台帳履歴" onClose={closeOverlay}>
          <HistoryScreen />
        </Overlay>
      )}
    </>
  )
}
