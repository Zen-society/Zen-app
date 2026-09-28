'use client'

import { useRef, useState, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { DockNav, SCREENS, type Screen } from './dock-nav'

const SWIPE_RATIO = 0.18
const DIRECTION_LOCK_PX = 10

type Gesture = {
  pointerId: number
  startX: number
  startY: number
  axis: 'x' | 'y' | null
  startTime: number
}

type ZenPagerProps = {
  browser: ReactNode
  home: ReactNode
  apps: ReactNode
}

export function ZenPager({ browser, home, apps }: ZenPagerProps) {
  const [index, setIndex] = useState(1)
  const [dragX, setDragX] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const gesture = useRef<Gesture | null>(null)
  const suppressClick = useRef(false)
  const viewportRef = useRef<HTMLDivElement>(null)
  const panelRefs = useRef<(HTMLDivElement | null)[]>([])

  const navigate = (screen: Screen) => {
    const next = SCREENS.indexOf(screen)
    if (next === index) {
      panelRefs.current[next]?.scrollTo({ top: 0, behavior: 'smooth' })
    }
    setIndex(next)
  }

  const endGesture = (commit: boolean) => {
    const g = gesture.current
    gesture.current = null
    setIsDragging(false)
    if (!g || g.axis !== 'x') {
      setDragX(0)
      return
    }
    const width = viewportRef.current?.clientWidth ?? 1
    const velocity = Math.abs(dragX) / Math.max(1, performance.now() - g.startTime)
    if (commit && (Math.abs(dragX) > width * SWIPE_RATIO || velocity > 0.5)) {
      setIndex((current) => Math.min(SCREENS.length - 1, Math.max(0, current + (dragX < 0 ? 1 : -1))))
    }
    setDragX(0)
  }

  const panels = [
    { id: 'screen-browser', label: 'ブラウザ', content: browser },
    { id: 'screen-home', label: 'ホーム', content: home },
    { id: 'screen-apps', label: 'アプリ', content: apps },
  ]

  return (
    <div className="min-h-dvh bg-zen-mint-soft">
      <div
        ref={viewportRef}
        className={cn(
          'relative mx-auto h-dvh w-full max-w-md touch-pan-y overflow-hidden bg-zen-cloud shadow-sm',
          isDragging && 'select-none',
        )}
        onPointerDown={(event) => {
          if (event.pointerType === 'mouse' && event.button !== 0) return
          const target = event.target as HTMLElement
          if (target.closest('[data-no-swipe], input, textarea')) return
          suppressClick.current = false
          gesture.current = {
            pointerId: event.pointerId,
            startX: event.clientX,
            startY: event.clientY,
            axis: null,
            startTime: performance.now(),
          }
        }}
        onPointerMove={(event) => {
          const g = gesture.current
          if (!g || g.pointerId !== event.pointerId) return
          const dx = event.clientX - g.startX
          const dy = event.clientY - g.startY
          if (!g.axis) {
            if (Math.abs(dx) < DIRECTION_LOCK_PX && Math.abs(dy) < DIRECTION_LOCK_PX) return
            g.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y'
            if (g.axis === 'y') return
            setIsDragging(true)
            event.currentTarget.setPointerCapture(event.pointerId)
          }
          if (g.axis !== 'x') return
          suppressClick.current = true
          const atEdge = (index === 0 && dx > 0) || (index === SCREENS.length - 1 && dx < 0)
          setDragX(atEdge ? dx * 0.25 : dx)
        }}
        onPointerUp={() => endGesture(true)}
        onPointerCancel={() => endGesture(false)}
        onClickCapture={(event) => {
          if (suppressClick.current) {
            event.preventDefault()
            event.stopPropagation()
            suppressClick.current = false
          }
        }}
      >
        <div
          className={cn(
            'flex h-full will-change-transform',
            !isDragging && 'transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none',
          )}
          style={{ transform: `translateX(calc(${-index * 100}% + ${dragX}px))` }}
        >
          {panels.map((panel, i) => (
            <section
              key={panel.id}
              id={panel.id}
              ref={(node) => {
                panelRefs.current[i] = node as HTMLDivElement | null
              }}
              aria-label={panel.label}
              aria-hidden={i !== index}
              inert={i !== index && !isDragging}
              className="h-full w-full shrink-0 overflow-y-auto overscroll-contain pb-36 [scrollbar-width:none]"
            >
              {panel.content}
            </section>
          ))}
        </div>

        <DockNav active={SCREENS[index]} onNavigate={navigate} />
      </div>
    </div>
  )
}
