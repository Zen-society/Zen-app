import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { Noto_Sans_JP, Zen_Maru_Gothic } from 'next/font/google'
import { Toaster } from '@/components/ui/sonner'
import './globals.css'

const notoSansJP = Noto_Sans_JP({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  variable: '--font-noto-sans-jp',
})

const zenMaru = Zen_Maru_Gothic({
  subsets: ['latin'],
  weight: ['500', '700'],
  variable: '--font-zen-maru',
})

export const metadata: Metadata = {
  title: 'Zen — わたしのZen空間',
  description:
    '循環する「Zen」と、積み上がる貢献ポイント「Zen+」。買い物・ミッション・コミュニティ・メタバースがつながる新しい生活プラットフォーム。',
  generator: 'v0.app',
}

export const viewport: Viewport = {
  colorScheme: 'light',
  themeColor: '#e3f6ef',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ja" className={`light ${notoSansJP.variable} ${zenMaru.variable}`}>
      <body className="font-sans antialiased">
        {children}
        <Toaster position="top-center" />
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
