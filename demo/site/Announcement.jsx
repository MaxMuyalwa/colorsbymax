// The announcement banner: a slim bar pinned above the top bar on every page, written and
// switched on in the admin space (Announcement). While the admin has it on, it's always there:
// a visitor can close it, and it stays closed as they move between pages, but a refresh brings
// it back. The page (and the colour button) move down by its height, so it never covers anything.

import { useLayoutEffect, useRef, useState } from 'react'
import { ArrowRight, Megaphone, X } from 'lucide-react'
import { useSiteSettings } from './siteSettings.jsx'

const CLOSED = 'colorsbymax-site:announcement-closed'
const idOf = (a) => [...`${a.text}|${a.link}`].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) | 0, 0).toString(36)

// Closing lasts for this visit's page-to-page browsing; a refresh shows it again.
try {
  if (performance.getEntriesByType?.('navigation')?.[0]?.type === 'reload') sessionStorage.removeItem(CLOSED)
} catch {}

/** The bar itself, for the page and for the admin's preview. */
export function AnnouncementBar({ announcement: a, onClose, preview = false }) {
  const soft = a.tone === 'soft'
  const external = /^https?:/.test(a.link)
  return (
    <div className={`relative flex items-center justify-center gap-3 px-11 py-2 text-center text-sm font-medium ${soft ? 'bg-secondary text-on-secondary' : 'bg-primary text-on-primary'} ${preview ? 'rounded-2xl' : ''}`}>
      <Megaphone className="hidden h-4 w-4 shrink-0 sm:block" aria-hidden="true" />
      <p className="min-w-0">
        {a.text}
        {a.link && (
          <a
            href={a.link}
            {...(external ? { target: '_blank', rel: 'noopener' } : {})}
            className="ml-2 inline-flex items-center gap-1 font-semibold whitespace-nowrap underline underline-offset-4 hover:no-underline"
          >
            {a.label || 'Read more'} <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </a>
        )}
      </p>
      {onClose && (
        <button type="button" onClick={onClose} aria-label="Close the announcement" className="absolute right-2 grid h-7 w-7 cursor-pointer place-items-center rounded-full opacity-80 transition hover:bg-black/10 hover:opacity-100">
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      )}
    </div>
  )
}

/** The banner for the page, at the very top of the top bar's pinned area. */
export function Announcement() {
  const { announcement: a } = useSiteSettings()
  const id = a?.on && a.text?.trim() ? idOf(a) : null
  const [closed, setClosed] = useState(() => {
    try {
      return sessionStorage.getItem(CLOSED)
    } catch {
      return null
    }
  })
  const box = useRef(null)
  const shown = Boolean(id) && closed !== id
  // Push the page and the colour button down by the banner's height while it shows.
  useLayoutEffect(() => {
    const root = document.documentElement
    const clear = () => {
      root.style.removeProperty('--announcement')
      root.style.removeProperty('--colorsbymax-offset-top')
    }
    if (!shown || !box.current) return clear()
    const set = () => {
      const h = `${box.current?.offsetHeight ?? 0}px`
      root.style.setProperty('--announcement', h)
      root.style.setProperty('--colorsbymax-offset-top', h)
    }
    set()
    const ro = new ResizeObserver(set)
    ro.observe(box.current)
    return () => {
      ro.disconnect()
      clear()
    }
  }, [shown])
  if (!shown) return null
  const close = () => {
    setClosed(id)
    try {
      sessionStorage.setItem(CLOSED, id)
    } catch {}
  }
  return (
    <div ref={box} role="region" aria-label="Announcement">
      <AnnouncementBar announcement={a} onClose={close} />
    </div>
  )
}
