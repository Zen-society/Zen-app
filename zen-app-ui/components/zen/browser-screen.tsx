'use client'

import { Bookmark, ChevronRight, Leaf, MapPin, Newspaper, Search, Store } from 'lucide-react'
import { toast } from 'sonner'

const shortcuts = [
  { label: 'ニュース', icon: Newspaper },
  { label: '地域情報', icon: MapPin },
  { label: 'Zen加盟店', icon: Store },
  { label: 'ブックマーク', icon: Bookmark },
] as const

const feed = [
  { tag: '地域', title: '駅前商店街でZen決済が使えるお店が12店舗増えました', time: '2時間前' },
  { tag: 'コミュニティ', title: '今月のみんなの蓄財は子ども食堂の支援に循環されます', time: '5時間前' },
  { tag: '暮らし', title: '期限が近いZenを上手に使う3つのアイデア', time: '昨日' },
] as const

export function BrowserScreen() {
  return (
    <div className="flex flex-col gap-6 px-5 pt-5">
      <header>
        <p className="text-xs font-bold text-zen-mint-deep">情報空間</p>
        <h1 className="font-display text-2xl font-bold text-zen-ink">ブラウザ</h1>
      </header>

      <form
        role="search"
        onSubmit={(event) => {
          event.preventDefault()
          const query = new FormData(event.currentTarget).get('q')
          toast(query ? `「${query}」を検索します` : '検索ワードを入力してください')
        }}
      >
        <label htmlFor="zen-search" className="sr-only">
          検索またはURLを入力
        </label>
        <div className="flex items-center gap-2 rounded-2xl bg-white px-4 py-3 ring-1 ring-zen-ink/10 focus-within:ring-2 focus-within:ring-zen-mint">
          <Search className="size-5 text-zen-ink/50" aria-hidden="true" />
          <input
            id="zen-search"
            name="q"
            type="search"
            placeholder="検索またはURLを入力"
            className="min-w-0 flex-1 bg-transparent text-sm text-zen-ink outline-none placeholder:text-zen-ink/40"
          />
        </div>
      </form>

      <section aria-labelledby="shortcut-heading">
        <h2 id="shortcut-heading" className="sr-only">
          ショートカット
        </h2>
        <ul className="grid grid-cols-4 gap-3">
          {shortcuts.map(({ label, icon: Icon }) => (
            <li key={label}>
              <button
                type="button"
                onClick={() => toast(`${label}を開きます`)}
                className="flex w-full flex-col items-center gap-1.5"
              >
                <span className="grid size-14 place-items-center rounded-2xl bg-white text-zen-mint-deep ring-1 ring-zen-ink/5">
                  <Icon className="size-6" aria-hidden="true" />
                </span>
                <span className="text-[11px] font-medium text-zen-ink/80">{label}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="feed-heading">
        <h2 id="feed-heading" className="font-display text-lg font-bold text-zen-ink">
          あなたへのおすすめ
        </h2>
        <ul className="mt-3 flex flex-col gap-2">
          {feed.map((item) => (
            <li key={item.title}>
              <button
                type="button"
                onClick={() => toast('記事を開きます')}
                className="flex w-full items-center gap-3 rounded-2xl bg-white p-4 text-left ring-1 ring-zen-ink/5 transition hover:ring-zen-mint"
              >
                <span className="flex-1">
                  <span className="text-[10px] font-bold text-zen-mint-deep">
                    {item.tag}・{item.time}
                  </span>
                  <span className="mt-0.5 block text-sm font-bold text-zen-ink text-pretty">{item.title}</span>
                </span>
                <ChevronRight className="size-4 shrink-0 text-zen-ink/40" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      </section>

      <p className="flex items-center justify-center gap-1 text-[11px] text-zen-ink/50">
        <Leaf className="size-3" aria-hidden="true" />
        左へスワイプでホームに戻る
      </p>
    </div>
  )
}
