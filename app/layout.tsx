import type { Metadata, Viewport } from 'next'
import { Toaster } from '@/components/ui/sonner'
import './globals.css'

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
    <html lang="ja" className="light">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700&family=Zen+Maru+Gothic:wght@500;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-sans antialiased" style={{ '--font-noto-sans-jp': "'Noto Sans JP', sans-serif", '--font-zen-maru': "'Zen Maru Gothic', sans-serif" } as React.CSSProperties}>
        {children}
        <Toaster position="top-center" />
      </body>
    </html>
  )
}
