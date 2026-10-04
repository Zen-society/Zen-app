import { AppHeader } from '@/components/zen/app-header'
import { AppsScreen } from '@/components/zen/apps-screen'
import { BrowserScreen } from '@/components/zen/browser-screen'
import { CommunityCard } from '@/components/zen/community-card'
import { MissionStrip } from '@/components/zen/mission-strip'
import { QuickActions } from '@/components/zen/quick-actions'
import { RoomPortal } from '@/components/zen/room-portal'
import { WalletCards } from '@/components/zen/wallet-cards'
import { ZenPager } from '@/components/zen/zen-pager'

export default function HomePage() {
  return (
    <ZenPager
      browser={<BrowserScreen />}
      apps={<AppsScreen />}
      home={
        <>
          <AppHeader />
          <main className="flex flex-col gap-6">
            <RoomPortal />
            <WalletCards />
            <QuickActions />
            <MissionStrip />
            <CommunityCard />
          </main>
        </>
      }
    />
  )
}
