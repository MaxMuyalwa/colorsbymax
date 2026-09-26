// The announcement banner: a slim bar floating at the bottom of every page, written and switched
// on in the admin space (Announcement). Visitors can close it; it stays closed for them until the
// message changes.

import { useEffect, useState } from 'react'
import { ArrowRight, Megaphone, X } from 'lucide-react'
import { useSiteSettings } from './siteSettings.jsx'

const DISMISSED = 'colorsbymax-site:announcement-closed'
const idOf = (a) => [...`${a.text}|${a.link}`].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) | 0, 0).toString(36)

/** The bar itself, for the page and for the admin's preview. */
export function AnnouncementBar({ announcement: a, onClose, preview = false }) {
  const soft = a.tone === 'soft'
  const external = /^https?:/.test(a.link)
  return (
    <div className={`flex items-center justify-center gap-3 px-10 py-2 text-center text-sm font-medium ${soft ? 'bg-secondary text-on-secondary' : 'bg-primary text-on-primary'} relative ${preview ? 'rounded-2xl' : ''}`}>
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

/**
 * The banner for the page: floating at the bottom of the screen, centred, sliding up a moment
 * after the page loads, so it never covers the top bar or the colour button.
 */
export function Announcement() {
  const { announcement: a } = useSiteSettings()
  const id = a?.on && a.text ? idOf(a) : null
  const [closed, setClosed] = useState(() => {
    try {
      return localStorage.getItem(DISMISSED)
    } catch {
      return null
    }
  })
  const [arrived, setArrived] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setArrived(true), 800)
    return () => clearTimeout(t)
  }, [])
  if (!id || closed === id || !arrived) return null
  const close = () => {
    setClosed(id)
    try {
      localStorage.setItem(DISMISSED, id)
    } catch {}
  }
  return (
    <div role="region" aria-label="Announcement" className="pointer-events-none fixed inset-x-0 bottom-4 z-[55] flex justify-center px-4">
      <div className="pointer-events-auto w-full max-w-2xl animate-[tab-in_400ms_ease-out] overflow-hidden rounded-2xl shadow-2xl shadow-shadow/25 motion-reduce:animate-none">
        <AnnouncementBar announcement={a} onClose={close} />
      </div>
    </div>
  )
}
