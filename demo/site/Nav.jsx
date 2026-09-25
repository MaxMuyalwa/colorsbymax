import { useEffect, useState } from 'react'
import { ArrowUpRight, Menu, X } from 'lucide-react'
import { MRMAX } from './ui.jsx'
import { StarButton } from './StarButton.jsx'

const LINKS = [
  ['Why', '#why'],
  ['Colour roles', '#roles'],
  ['Rules', '#rules'],
  ['Set up', '#setup'],
  ['AI agents', '#agents'],
]

export function Wordmark({ className = '' }) {
  return (
    <span className={`font-display font-bold tracking-tight ${className}`}>
      colors<span className="text-gradient">by</span>max<span className="align-super text-[0.55em] font-medium">™</span>
    </span>
  )
}

/**
 * The top bar, with a way back to mrmaxdesigns.com. It floats over the page, so the hero shows
 * behind it: a straight full-width bar at the very top, a floating glass pill once scrolled. From
 * 1200px wide the colour button sits at the top right, beside the bar, so both leave room for it.
 */
export function Nav() {
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])
  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <div className={`fixed inset-x-0 top-0 z-50 transition-[padding] duration-500 ease-out motion-reduce:transition-none ${scrolled ? 'px-4 pt-4 sm:px-6 min-[1200px]:px-20' : ''}`}>
      <nav
        aria-label="Main"
        className={`mx-auto flex items-center justify-between gap-4 border backdrop-blur-md transition-all duration-500 ease-out motion-reduce:transition-none ${
          scrolled
            ? 'max-w-6xl rounded-[2rem] border-border bg-surface/70 px-4 py-2.5 shadow-xl shadow-shadow/10 sm:px-6'
            : 'max-w-full rounded-none border-x-transparent border-t-transparent border-b-border/60 bg-surface/25 px-4 py-4 sm:px-8 min-[1200px]:py-6 min-[1200px]:pr-20'
        }`}
      >
        <a href="#top" className="text-lg text-primary-dark" data-colorsbymax-logo>
          <Wordmark />
        </a>
        <div className="hidden items-center gap-1 text-sm font-medium whitespace-nowrap text-ink-secondary xl:flex">
          {LINKS.map(([label, href]) => (
            <a key={href} href={href} className="rounded-full px-3 py-1.5 transition hover:bg-accent hover:text-on-accent">
              {label}
            </a>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <StarButton />
          <a
            href={MRMAX}
            className="group hidden items-center gap-1 rounded-full px-3 py-1.5 text-sm font-semibold whitespace-nowrap text-ink-secondary transition hover:bg-accent hover:text-on-accent sm:inline-flex"
          >
            mrmaxdesigns.com
            <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" aria-hidden="true" />
          </a>
          <a
            href="#setup"
            className="shine hidden rounded-full bg-primary px-4 py-1.5 whitespace-nowrap text-sm font-semibold text-on-primary shadow-md shadow-primary/25 transition hover:-translate-y-px hover:shadow-lg sm:inline-flex"
          >
            Get started
          </a>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-controls="mobile-menu"
            aria-label={open ? 'Close menu' : 'Open menu'}
            className="grid h-9 w-9 cursor-pointer place-items-center rounded-full text-ink transition hover:bg-accent xl:hidden"
          >
            {open ? <X className="h-5 w-5" aria-hidden="true" /> : <Menu className="h-5 w-5" aria-hidden="true" />}
          </button>
        </div>
      </nav>
      {open && (
        <div id="mobile-menu" className="mx-4 mt-2 max-w-6xl sm:mx-auto animate-[tab-in_250ms_ease-out] rounded-3xl border border-border bg-surface p-3 shadow-xl shadow-shadow/10 xl:hidden">
          {LINKS.map(([label, href]) => (
            <a key={href} href={href} onClick={() => setOpen(false)} className="block rounded-2xl px-4 py-3 font-medium text-ink hover:bg-accent hover:text-on-accent">
              {label}
            </a>
          ))}
          <a href="https://github.com/MaxMuyalwa" target="_blank" rel="noopener" className="block rounded-2xl px-4 py-3 font-medium text-ink hover:bg-accent hover:text-on-accent">
            Follow MaxMuyalwa on GitHub
          </a>
          <a href={MRMAX} className="mt-1 flex items-center justify-between rounded-2xl bg-secondary px-4 py-3 font-semibold text-on-secondary">
            Visit mrmaxdesigns.com <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
          </a>
        </div>
      )}
    </div>
  )
}
