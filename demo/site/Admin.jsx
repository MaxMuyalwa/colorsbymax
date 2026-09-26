// Admin: the way in for Max to write posts and testimonials for the docs page. A quiet button in
// the footer opens a sign-in window; signing in is with GitHub, and only Max's account gets a
// session (checked on the server, api/admin). No credentials live in this code.

import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Lock, LogOut, X } from 'lucide-react'
import { Wordmark } from './Nav.jsx'
import { GitHubIcon } from './ui.jsx'

const API = `${import.meta.env.BASE_URL}api/admin`
const EVENT = 'colorsbymax:admin'

/**
 * Whether the visitor is the signed-in admin: { admin, login, signOut, refresh }. On the dev
 * server there's no API, so it's never signed in (add ?admin-preview there to see the tools).
 */
export function useAdmin() {
  const [state, setState] = useState({ admin: false, login: null })
  const refresh = useCallback(() => {
    if (import.meta.env.DEV) {
      if (new URLSearchParams(location.search).has('admin-preview')) setState({ admin: true, login: 'preview' })
      return
    }
    fetch(`${API}/session`, { credentials: 'same-origin', cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { admin: false }))
      .then((s) => setState({ admin: Boolean(s.admin), login: s.login ?? null }))
      .catch(() => {})
  }, [])
  useEffect(() => {
    refresh()
    window.addEventListener(EVENT, refresh)
    return () => window.removeEventListener(EVENT, refresh)
  }, [refresh])
  const signOut = useCallback(async () => {
    await fetch(`${API}/logout`, { method: 'POST', credentials: 'same-origin' }).catch(() => {})
    window.dispatchEvent(new Event(EVENT))
    setState({ admin: false, login: null })
  }, [])
  return { ...state, signOut, refresh }
}

export function AdminButton({ className = '' }) {
  const [open, setOpen] = useState(false)
  const { admin, login, signOut } = useAdmin()
  if (admin)
    return (
      <span className={`inline-flex items-center gap-3 ${className}`}>
        <a href={`${import.meta.env.BASE_URL}docs.html`} className="inline-flex items-center gap-1.5 font-semibold underline-offset-4 hover:underline">
          <Lock className="h-3.5 w-3.5" aria-hidden="true" /> Admin{login && login !== 'preview' ? ` · ${login}` : ''}
        </a>
        <button type="button" onClick={signOut} className="inline-flex cursor-pointer items-center gap-1 font-semibold underline-offset-4 hover:underline">
          <LogOut className="h-3.5 w-3.5" aria-hidden="true" /> Sign out
        </button>
      </span>
    )
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={`inline-flex cursor-pointer items-center gap-1.5 font-semibold underline-offset-4 hover:underline ${className}`}>
        <Lock className="h-3.5 w-3.5" aria-hidden="true" /> Admin
      </button>
      {open && <AdminSignIn onClose={() => setOpen(false)} />}
    </>
  )
}

/**
 * A centred window over the page, portalled to <body>, closed by Escape or a click outside.
 * `hideTitle` keeps the title for screen readers only.
 */
export function Modal({ title, onClose, children, wide = false, hideTitle = false }) {
  const ids = useId()
  const box = useRef(null)
  useEffect(() => {
    const opener = document.activeElement
    box.current?.querySelector('input, textarea, button:not([aria-label="Close"])')?.focus()
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      opener?.focus?.()
    }
  }, [onClose])
  return createPortal(
    <div className="fixed inset-0 z-[90] grid place-items-center overflow-y-auto bg-ink/50 p-4 backdrop-blur-sm animate-[fade-in_200ms_ease-out]" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        ref={box}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${ids}-title`}
        className={`my-8 w-full ${wide ? 'max-w-3xl' : 'max-w-sm'} animate-[tab-in_250ms_ease-out] rounded-3xl border border-border bg-surface p-6 text-ink shadow-2xl shadow-shadow/20`}
      >
        <div className={`flex items-start justify-between gap-4 ${hideTitle ? '-mb-9' : ''}`}>
          <h2 id={`${ids}-title`} className={hideTitle ? 'sr-only' : 'font-display text-2xl font-bold tracking-tight'}>
            {title}
          </h2>
          <button type="button" onClick={onClose} aria-label="Close" className="ml-auto grid h-9 w-9 shrink-0 cursor-pointer place-items-center rounded-full text-ink-secondary transition hover:bg-accent hover:text-on-accent">
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  )
}

/** Just the logo and a way in: nothing that says whose it is or what it's for. */
function AdminSignIn({ onClose }) {
  return (
    <Modal title="Sign in" onClose={onClose} hideTitle>
      <div className="flex flex-col items-center pt-10 pb-1 text-center">
        <span className="text-3xl text-primary-dark">
          <Wordmark />
        </span>
        <a
          href={`${API}/login`}
          className="shine mt-8 inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-ink font-semibold text-background shadow-lg transition hover:-translate-y-px"
        >
          <GitHubIcon className="h-5 w-5" /> Sign in with GitHub
        </a>
        <p className="mt-4 text-xs font-medium tracking-wide text-ink-muted">Authorised access only</p>
      </div>
    </Modal>
  )
}
