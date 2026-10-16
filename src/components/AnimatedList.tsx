'use client'

import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  CodeIcon,
  FigmaIcon,
  File01Icon,
  FileZipIcon,
  Folder01Icon,
  Image01Icon,
  MusicNote01Icon,
  Note01Icon,
  Pdf01Icon,
  Presentation01Icon,
  Table01Icon,
  Video01Icon,
} from '@hugeicons/core-free-icons'
import './AnimatedList.css'

export type AnimatedListItem =
  | string
  | {
      id?: string | number
      icon?: ReactNode
      image?: string
      title: string
      description?: string
      meta?: string
    }

export type AnimatedListProps = {
  items?: AnimatedListItem[]
  onItemSelect?: (item: AnimatedListItem, index: number) => void
  renderItem?: (item: AnimatedListItem, index: number, selected: boolean) => ReactNode
  initialSelectedIndex?: number
  selectOnHover?: boolean
  enableArrowNavigation?: boolean
  loop?: boolean
  animation?: 'pop' | 'slide' | 'fade' | 'none'
  animateOnce?: boolean
  stagger?: number
  showGradients?: boolean
  fadeSize?: number
  displayScrollbar?: boolean
  frame?: boolean
  theme?: 'dark' | 'light'
  accentColor?: string
  radius?: number
  gap?: number
  width?: number | string
  maxHeight?: number | string
  className?: string
  itemClassName?: string
  style?: CSSProperties
}

const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect
const glyph = (icon: unknown) => <HugeiconsIcon icon={icon as never} size={18} strokeWidth={1.8} />

const DEFAULT_ITEMS: AnimatedListItem[] = [
  { icon: glyph(Folder01Icon), title: 'Brand assets', description: '24 files', meta: '2m' },
  { icon: glyph(Image01Icon), title: 'Launch hero.png', description: '2.4 MB', meta: '18m' },
  { icon: glyph(Video01Icon), title: 'Product tour.mp4', description: '148 MB', meta: '1h' },
  { icon: glyph(Note01Icon), title: 'Pricing notes', description: '1,240 words', meta: '3h' },
  { icon: glyph(CodeIcon), title: 'landing-page.tsx', description: '12 KB', meta: '5h' },
  { icon: glyph(FigmaIcon), title: 'Onboarding flow', description: '38 frames', meta: '8h' },
  { icon: glyph(MusicNote01Icon), title: 'Ambient loop.wav', description: '9.1 MB', meta: '1d' },
  { icon: glyph(Table01Icon), title: 'Q3 forecast', description: '4 sheets', meta: '1d' },
  { icon: glyph(Pdf01Icon), title: 'Brand guidelines.pdf', description: '6.8 MB', meta: '2d' },
  { icon: glyph(Presentation01Icon), title: 'Investor update', description: '22 slides', meta: '3d' },
  { icon: glyph(FileZipIcon), title: 'Icon set.zip', description: '1.2 MB', meta: '4d' },
  { icon: glyph(File01Icon), title: 'Release notes', description: 'Version 2.4', meta: '1w' },
]

const THEMES = {
  dark: {
    '--al-frame': 'rgba(38, 35, 46, 0.66)',
    '--al-frame-edge': 'rgba(255, 255, 255, 0.08)',
    '--al-frame-highlight': 'rgba(255, 255, 255, 0.07)',
    '--al-frame-shadow': '0 22px 44px -20px rgba(0, 0, 0, 0.8), 0 6px 16px -8px rgba(0, 0, 0, 0.5)',
    '--al-tile': 'linear-gradient(180deg, #3a3644 0%, #27242f 100%)',
    '--al-tile-edge': 'rgba(255, 255, 255, 0.07)',
    '--al-tile-highlight': 'rgba(255, 255, 255, 0.12)',
    '--al-tile-shadow': '0 4px 10px -4px rgba(0, 0, 0, 0.7)',
    '--al-well': 'rgba(255, 255, 255, 0.08)',
    '--al-ink': '#f4f4f5',
    '--al-muted': 'rgba(244, 244, 245, 0.55)',
    '--al-thumb': 'rgba(255, 255, 255, 0.16)',
    '--al-ring': 'rgba(244, 244, 245, 0.3)',
    '--al-ring-fill': 'rgba(244, 244, 245, 0.05)',
    '--al-hover': 'brightness(1.12)',
    '--al-press': 'brightness(0.85)',
    '--al-active': 'brightness(1.16)',
  },
  light: {
    '--al-frame': 'rgba(240, 240, 243, 0.8)',
    '--al-frame-edge': 'rgba(24, 24, 27, 0.07)',
    '--al-frame-highlight': 'rgba(255, 255, 255, 0.95)',
    '--al-frame-shadow': '0 22px 44px -22px rgba(24, 24, 27, 0.3), 0 6px 16px -10px rgba(24, 24, 27, 0.16)',
    '--al-tile': 'linear-gradient(180deg, #ffffff 0%, #f6f6f8 100%)',
    '--al-tile-edge': 'rgba(24, 24, 27, 0.08)',
    '--al-tile-highlight': 'rgba(255, 255, 255, 1)',
    '--al-tile-shadow': '0 4px 10px -5px rgba(24, 24, 27, 0.25)',
    '--al-well': 'rgba(24, 24, 27, 0.05)',
    '--al-ink': '#27272a',
    '--al-muted': 'rgba(39, 39, 42, 0.55)',
    '--al-thumb': 'rgba(24, 24, 27, 0.16)',
    '--al-ring': 'rgba(24, 24, 27, 0.28)',
    '--al-ring-fill': 'transparent',
    '--al-hover': 'brightness(0.97)',
    '--al-press': 'brightness(0.92)',
    '--al-active': 'none',
  },
} as const

const HIDDEN: Record<'pop' | 'slide' | 'fade', { above: string; below: string }> = {
  pop: { above: 'translate3d(0, -12px, 0) scale(0.8)', below: 'translate3d(0, 12px, 0) scale(0.8)' },
  slide: { above: 'translate3d(0, -28px, 0) scale(0.98)', below: 'translate3d(0, 28px, 0) scale(0.98)' },
  fade: { above: 'translate3d(0, -4px, 0)', below: 'translate3d(0, 4px, 0)' },
}

const SPRING = 'linear(0, 0.0603, 0.2033, 0.3821, 0.5633, 0.7258, 0.8584, 0.9574, 1.0242, 1.0634, 1.0809, 1.0828, 1.0747, 1.0613, 1.046, 1.0313, 1.0186, 1.0085, 1.0012, 0.9965, 0.994, 0.9931, 0.9933, 0.9941, 0.9953, 0.9966, 0.9978, 0.9988, 1)'
const size = (value: number | string) => (typeof value === 'number' ? value + 'px' : value)

const smootherstep = (t: number) => t * t * t * (t * (t * 6 - 15) + 10)
const FADE_MASK = (() => {
  const steps = [0, 0.15, 0.3, 0.45, 0.6, 0.75, 0.9, 1]
  const top = steps.map((t) => 'rgba(0, 0, 0, ' + smootherstep(t).toFixed(3) + ') calc(var(--al-fade-top) * ' + t + ')')
  const bottom = [...steps].reverse().map((t) => 'rgba(0, 0, 0, ' + smootherstep(t).toFixed(3) + ') calc(100% - var(--al-fade-bottom) * ' + t + ')')
  return 'linear-gradient(to bottom, ' + [...top, ...bottom].join(', ') + ')'
})()

const entry = (item: AnimatedListItem) => (typeof item === 'string' ? { title: item } : item)

export default function AnimatedList({
  items = DEFAULT_ITEMS,
  onItemSelect,
  renderItem,
  initialSelectedIndex = -1,
  selectOnHover = true,
  enableArrowNavigation = true,
  loop = false,
  animation = 'pop',
  animateOnce = false,
  stagger = 0.05,
  showGradients = true,
  fadeSize = 56,
  displayScrollbar = true,
  frame = true,
  theme = 'dark',
  accentColor,
  radius = 14,
  gap = 8,
  width = 420,
  maxHeight = 440,
  className = '',
  itemClassName = '',
  style,
}: AnimatedListProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const viewportRef = useRef<HTMLDivElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const indicatorRef = useRef<HTMLSpanElement>(null)
  const ringRef = useRef<HTMLSpanElement>(null)
  const itemRefs = useRef<Array<HTMLDivElement | null>>([])
  const selectedRef = useRef(initialSelectedIndex)
  const settingsRef = useRef({ items, onItemSelect, selectOnHover, enableArrowNavigation, loop, animation, animateOnce, stagger, showGradients, fadeSize, selected: initialSelectedIndex })
  const [selected, setSelected] = useState(initialSelectedIndex)
  const baseId = useId()
  const keyboardRef = useRef(false)
  const navigatingRef = useRef(false)
  selectedRef.current = selected
  settingsRef.current = { items, onItemSelect, selectOnHover, enableArrowNavigation, loop, animation, animateOnce, stagger, showGradients, fadeSize, selected }

  const placeIndicator = (snap = false) => {
    const item = itemRefs.current[selectedRef.current]
    const indicator = indicatorRef.current
    if (!indicator) return
    if (!item || selectedRef.current < 0) {
      indicator.style.opacity = '0'
      return
    }
    indicator.style.opacity = '1'
    indicator.style.height = item.offsetHeight + 'px'
    indicator.style.transform = 'translate3d(0, ' + item.offsetTop + 'px, 0)'
    if (snap) indicator.style.transition = 'none'
    else indicator.style.transition = ''
  }

  const updateFades = () => {
    const viewport = viewportRef.current
    if (!viewport) return
    const span = Math.max(1, settingsRef.current.fadeSize)
    const s = settingsRef.current
    const top = s.showGradients ? Math.min(span, Math.max(0, viewport.scrollTop)) : 0
    const bottom = s.showGradients ? Math.min(span, Math.max(0, viewport.scrollHeight - viewport.clientHeight - viewport.scrollTop)) : 0
    viewport.style.setProperty('--al-fade-top', top.toFixed(1) + 'px')
    viewport.style.setProperty('--al-fade-bottom', bottom.toFixed(1) + 'px')
  }

  useEffect(() => {
    setSelected(initialSelectedIndex)
  }, [initialSelectedIndex])

  useIsoLayoutEffect(() => {
    const root = rootRef.current
    const viewport = viewportRef.current
    const track = trackRef.current
    const indicator = indicatorRef.current
    const ring = ringRef.current
    if (!root || !viewport || !track || !indicator || !ring) return

    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
    const springEase = CSS.supports?.('transition-timing-function', 'linear(0, 1)') ? SPRING : 'cubic-bezier(0.34, 1.4, 0.64, 1)'
    const transition = 'transform 620ms ' + springEase + ', opacity 300ms cubic-bezier(0.22, 1, 0.36, 1), filter 200ms ease'
    const mode = () => {
      const chosen = settingsRef.current.animation
      if (chosen === 'none' || !HIDDEN[chosen]) return 'none'
      return reduced ? 'fade' : chosen
    }
    const apply = (item: HTMLDivElement, state: string) => {
      item.dataset.state = state
      const chosen = mode()
      const pose = chosen !== 'none' && state !== 'in' ? HIDDEN[chosen][state as 'above' | 'below'] : ''
      item.style.transform = pose
      item.style.opacity = pose ? '0' : ''
    }
    const reveal = () => {
      const s = settingsRef.current
      const bounds = viewport.getBoundingClientRect()
      const visible: Array<{ item: HTMLDivElement; index: number }> = []
      itemRefs.current.forEach((item, index) => {
        if (!item) return
        const rect = item.getBoundingClientRect()
        const overlaps = Math.min(bounds.bottom, rect.bottom) - Math.max(bounds.top, rect.top)
        const inView = overlaps >= Math.min(rect.height, bounds.height) * 0.5
        if (inView) visible.push({ item, index })
        else if (!(s.animateOnce && item.dataset.seen === 'true')) {
          const state = rect.top + rect.height / 2 < bounds.top + bounds.height / 2 ? 'above' : 'below'
          if (item.dataset.state !== state) apply(item, state)
        }
      })
      visible.sort((a, b) => a.index - b.index)
      visible.forEach(({ item }, order) => {
        if (item.dataset.state === 'in') {
          item.dataset.seen = 'true'
          return
        }
        item.style.transitionDelay = (order * Math.max(0, s.stagger)).toFixed(3) + 's, ' + (order * Math.max(0, s.stagger)).toFixed(3) + 's, 0s'
        apply(item, 'in')
        item.dataset.seen = 'true'
      })
      ring.dataset.state = selectedRef.current >= 0 ? 'in' : 'below'
    }

    const sync = () => {
      itemRefs.current.length = settingsRef.current.items.length
      const chosen = mode()
      for (const item of itemRefs.current) {
        if (!item) continue
        item.style.transition = transition
        if (chosen === 'none') apply(item, 'in')
        else if (!item.dataset.state) apply(item, 'below')
      }
      if (chosen === 'none') root.removeAttribute('data-animated')
      else root.setAttribute('data-animated', '')
      reveal()
      placeIndicator(true)
      updateFades()
    }

    const onScroll = () => {
      updateFades()
      reveal()
    }
    const resizeObserver = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => {
      placeIndicator(true)
      updateFades()
      reveal()
    }) : null
    resizeObserver?.observe(viewport)
    resizeObserver?.observe(track)

    sync()
    const scrollObserver = typeof IntersectionObserver !== 'undefined' ? new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) reveal()
    }, { root: viewport, threshold: [0, 0.5, 1] }) : null
    itemRefs.current.forEach((item) => { if (item) scrollObserver?.observe(item) })

    viewport.addEventListener('scroll', onScroll, { passive: true })
    const onWindowResize = () => { placeIndicator(true); updateFades(); reveal() }
    window.addEventListener('resize', onWindowResize)

    const onKey = (event: KeyboardEvent) => {
      const s = settingsRef.current
      if (!s.enableArrowNavigation || event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return
      const active = document.activeElement
      const focused = active === viewport
      const idle = !active || active === document.body || active === document.documentElement
      if (!focused && !(engaged && idle)) return
      const count = s.items.length
      if (!count) return
      const index = s.selected
      let next: number | null = null
      if (event.key === 'ArrowDown') next = index < 0 ? 0 : index + 1
      else if (event.key === 'ArrowUp') next = index < 0 ? count - 1 : index - 1
      else if (event.key === 'Home') next = 0
      else if (event.key === 'End') next = count - 1
      else if ((event.key === 'Enter' || (focused && event.key === ' ')) && index >= 0 && index < count) {
        event.preventDefault()
        s.onItemSelect?.(s.items[index], index)
        return
      }
      if (next === null) return
      event.preventDefault()
      next = s.loop ? (next + count) % count : Math.min(count - 1, Math.max(0, next))
      keyboardRef.current = true
      navigatingRef.current = true
      setSelected(next)
    }
    let engaged = false
    let pointer = [0, 0]
    const onEnter = () => { engaged = true }
    const onLeave = () => { engaged = false }
    const onPointerMove = (event: PointerEvent) => {
      const moved = event.clientX !== pointer[0] || event.clientY !== pointer[1]
      pointer = [event.clientX, event.clientY]
      if (!navigatingRef.current || !moved) return
      navigatingRef.current = false
      const target = event.target instanceof Element ? event.target.closest('[data-index]') : null
      if (target && root.contains(target) && settingsRef.current.selectOnHover) {
        setSelected(Number((target as HTMLElement).dataset.index))
      }
    }
    root.addEventListener('pointerenter', onEnter)
    root.addEventListener('pointerleave', onLeave)
    root.addEventListener('pointermove', onPointerMove)
    window.addEventListener('keydown', onKey)
    engineRef.current = sync

    return () => {
      scrollObserver?.disconnect()
      resizeObserver?.disconnect()
      viewport.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onWindowResize)
      root.removeEventListener('pointerenter', onEnter)
      root.removeEventListener('pointerleave', onLeave)
      root.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('keydown', onKey)
    }
  }, [])

  const engineRef = useRef<(() => void) | null>(null)
  useIsoLayoutEffect(() => {
    engineRef.current?.()
    placeIndicator()
  }, [items, animation, animateOnce, stagger, showGradients, fadeSize])

  useIsoLayoutEffect(() => {
    placeIndicator()
    const viewport = viewportRef.current
    const track = trackRef.current
    const item = itemRefs.current[selected]
    if (!viewport || !track || !item) return
    const top = track.offsetTop + item.offsetTop
    const bottom = top + item.offsetHeight
    const margin = Math.min(showGradients ? Math.max(12, fadeSize) : 12, Math.max(0, (viewport.clientHeight - item.offsetHeight) / 2))
    if (top < viewport.scrollTop + margin) viewport.scrollTo({ top: Math.max(0, top - margin), behavior: 'smooth' })
    else if (bottom > viewport.scrollTop + viewport.clientHeight - margin) viewport.scrollTo({ top: bottom - viewport.clientHeight + margin, behavior: 'smooth' })
  }, [selected, items, fadeSize, showGradients])

  const hover = (index: number) => {
    if (!navigatingRef.current && selectOnHover) setSelected(index)
  }
  const choose = (item: AnimatedListItem, index: number) => {
    setSelected(index)
    onItemSelect?.(item, index)
  }

  return (
    <div
      ref={rootRef}
      className={'animated-list' + (frame ? ' animated-list--framed' : '') + ' ' + className}
      style={{
        ...(THEMES[theme] ?? THEMES.dark),
        '--al-radius': Math.max(0, radius) + 'px',
        '--al-gap': Math.max(0, gap) + 'px',
        '--al-width': size(width),
        '--al-accent': accentColor || 'var(--al-ink)',
        ...(accentColor ? { '--al-ring': accentColor, '--al-ring-fill': 'color-mix(in srgb, ' + accentColor + ' 8%, transparent)' } : {}),
        ...style,
      } as CSSProperties}
    >
      <div
        ref={viewportRef}
        className={'animated-list__viewport' + (displayScrollbar ? '' : ' animated-list__viewport--bare')}
        role="listbox"
        tabIndex={0}
        aria-activedescendant={selected >= 0 && selected < items.length ? baseId + '-' + selected : undefined}
        style={{
          maxHeight: size(maxHeight),
          maskImage: showGradients ? FADE_MASK : undefined,
          WebkitMaskImage: showGradients ? FADE_MASK : undefined,
        }}
      >
        <div ref={trackRef} className="animated-list__track">
          {items.map((item, index) => {
            const current = entry(item)
            const isSelected = index === selected
            return (
              <div
                key={current.id ?? index}
                ref={(element) => { itemRefs.current[index] = element }}
                id={baseId + '-' + index}
                className={'animated-list__item ' + itemClassName}
                role="option"
                aria-selected={isSelected}
                data-index={index}
                data-selected={isSelected ? '' : undefined}
                onPointerEnter={selectOnHover ? () => hover(index) : undefined}
                onClick={() => choose(item, index)}
              >
                {renderItem ? renderItem(item, index, isSelected) : (
                  <>
                    {(current.image || current.icon) && (
                      <span className="animated-list__lead">
                        {current.image ? <img src={current.image} alt="" draggable={false} /> : current.icon}
                      </span>
                    )}
                    <span className="animated-list__text">
                      <span className="animated-list__title">{current.title}</span>
                      {current.description && <span className="animated-list__description">{current.description}</span>}
                    </span>
                    {current.meta && <span className="animated-list__meta">{current.meta}</span>}
                  </>
                )}
                <span className="animated-list__rim" aria-hidden="true" />
              </div>
            )
          })}
          <span ref={indicatorRef} className="animated-list__indicator" aria-hidden="true">
            <span ref={ringRef} className="animated-list__ring" />
          </span>
        </div>
      </div>
      {frame && <span className="animated-list__frame-rim" aria-hidden="true" />}
    </div>
  )
}
