// Admin: the way in for Max to write posts and testimonials for the docs page. A quiet button in
// the footer opens a sign-in window; signing in is with GitHub, and only Max's account gets a
// session (checked on the server, api/admin). No credentials live in this code.

import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, LayoutDashboard, Lock, LogOut, X } from 'lucide-react'
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

export const DASHBOARD = `${import.meta.env.BASE_URL}docs.html#admin`
/** The admin's GitHub picture (a placeholder on the dev server's preview). */
export const avatarOf = (login) => (login && login !== 'preview' ? `https://github.com/${login}.png?size=64` : null)

function Avatar({ login, className = 'h-6 w-6' }) {
  const src = avatarOf(login)
  return src ? <img src={src} alt="" className={`${className} shrink-0 rounded-full bg-secondary`} /> : <GitHubIcon className={className} />
}

/**
 * In the top bar while signed in, in place of "Get started": who's signed in, with the dashboard
 * and a way to sign out (and see the site as a visitor does).
 */
export function AdminMenu({ login, signOut }) {
  const [open, setOpen] = useState(false)
  const box = useRef(null)
  useEffect(() => {
    if (!open) return
    const away = (e) => !box.current?.contains(e.target) && setOpen(false)
    const key = (e) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('pointerdown', away)
    document.addEventListener('keydown', key)
    return () => {
      document.removeEventListener('pointerdown', away)
      document.removeEventListener('keydown', key)
    }
  }, [open])
  return (
    <div ref={box} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-ink py-1 pr-3 pl-1 text-sm font-semibold whitespace-nowrap text-background shadow-md transition hover:-translate-y-px"
      >
        <Avatar login={login} />
        <span className="hidden sm:inline">{login === 'preview' ? 'Admin' : login}</span>
        <GitHubIcon className="hidden h-3.5 w-3.5 opacity-70 sm:inline" />
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 mt-2 w-60 animate-[tab-in_200ms_ease-out] rounded-2xl border border-border bg-surface p-2 text-ink shadow-xl shadow-shadow/15">
          <p className="px-3 pt-1.5 pb-2 text-xs text-ink-secondary">
            Signed in with GitHub as <strong className="text-ink">{login}</strong>
          </p>
          <a role="menuitem" href={DASHBOARD} onClick={() => setOpen(false)} className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold hover:bg-accent hover:text-on-accent">
            <LayoutDashboard className="h-4 w-4" aria-hidden="true" /> Dashboard
          </a>
          <button role="menuitem" type="button" onClick={signOut} className="flex w-full cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-semibold hover:bg-accent hover:text-on-accent">
            <LogOut className="h-4 w-4" aria-hidden="true" /> Sign out
          </button>
        </div>
      )}
    </div>
  )
}

export function AdminButton({ className = '' }) {
  const [open, setOpen] = useState(false)
  const { admin, login, signOut } = useAdmin()
  if (admin)
    return (
      <span className={`inline-flex items-center gap-3 ${className}`}>
        <a href={DASHBOARD} className="inline-flex items-center gap-1.5 font-semibold underline-offset-4 hover:underline">
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
