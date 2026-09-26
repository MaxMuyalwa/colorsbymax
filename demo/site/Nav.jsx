import { useEffect, useState } from 'react'
import { ArrowRight, ArrowUpRight, Menu, X } from 'lucide-react'
import { MRMAX, REPO } from './ui.jsx'
import { StarButton } from './StarButton.jsx'
import { FeedbackButton, openFeedback } from './Feedback.jsx'
import { LogoMark } from './Favicon.jsx'

const MENU_CLOSE_MS = 200

const LINKS = [
  ['Why', '#why'],
  ['Colour roles', '#roles'],
  ['Rules', '#rules'],
  ['Set up', '#setup'],
  ['AI agents', '#agents'],
]

/**
 * The colorsbymax logo: mrmaxdesigns' three-bar mark, then the wordmark. As in the mrmaxdesigns logo,
 * the bars stand on the text's baseline, about two and a half times its lowercase height, and the
 * text tucks in under the last bar's slant.
 */
export function Wordmark({ className = '' }) {
  return (
    <span className={`inline-flex items-baseline font-display font-bold tracking-tight ${className}`}>
      <LogoMark className="mr-[-0.28em] h-[1.3em] w-auto shrink-0 self-baseline" />
      <span>
        colors<span className="text-gradient">by</span>max<span className="align-super text-[0.55em] font-medium">™</span>
      </span>
    </span>
  )
}

/**
 * The top bar, with a way back to mrmaxdesigns.com. It floats over the page, so the hero shows
 * behind it: a straight full-width bar at the very top, a floating glass pill once scrolled. From
 * 1200px wide the colour button sits at the top right, beside the bar, so both leave room for it.
 */
/** @param {{ home?: string }} props  prefix for in-page links, for pages other than the home page */
export function Nav({ home = '' }) {
  const [open, setOpen] = useState(false)
  // The menu stays on screen while it animates closed, then goes.
  const [menuShown, setMenuShown] = useState(false)
  useEffect(() => {
    if (open) return setMenuShown(true)
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const id = setTimeout(() => setMenuShown(false), reduce ? 0 : MENU_CLOSE_MS)
    return () => clearTimeout(id)
  }, [open])
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])
  useEffect(() => {
    // The colour button floats where the menu opens, so it steps aside while the menu is up.
    document.documentElement.toggleAttribute('data-menu-open', open)
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <div className={`fixed inset-x-0 top-0 z-50 transition-[padding] duration-500 ease-out motion-reduce:transition-none ${scrolled ? 'px-4 pt-4 sm:px-6 min-[1200px]:!px-20' : ''}`}>
      <nav
        aria-label="Main"
        className={`mx-auto flex items-center justify-between gap-2 border sm:gap-4 backdrop-blur-md transition-all duration-500 ease-out motion-reduce:transition-none ${
          scrolled
            ? 'max-w-6xl rounded-[2rem] border-border bg-surface/70 px-4 py-2.5 shadow-xl shadow-shadow/10 sm:px-6'
            : 'max-w-full rounded-none border-x-transparent border-t-transparent border-b-border/60 bg-surface/25 px-4 py-4 sm:px-8 min-[1200px]:py-6 min-[1200px]:!pr-20'
        }`}
      >
        <a href={`${home}#top`} className="shrink-0 text-base text-primary-dark sm:text-lg" data-colorsbymax-logo>
          <Wordmark />
        </a>
        <div className="hidden items-center gap-1 text-sm font-medium whitespace-nowrap text-ink-secondary xl:flex">
          {LINKS.map(([label, href]) => (
            <a key={href} href={home + href} className="rounded-full px-3 py-1.5 transition hover:bg-accent hover:text-on-accent">
              {label}
            </a>
          ))}
        </div>
        {/* On a phone: feedback and GitHub as small icon buttons, everything else in the menu. */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          <FeedbackButton className="max-sm:h-8 max-sm:px-2.5 max-sm:py-0" />
          <StarButton compactOnPhone />
          <a
            href={MRMAX}
            className="group hidden items-center gap-1 rounded-full px-3 py-1.5 text-sm font-semibold whitespace-nowrap text-ink-secondary transition hover:bg-accent hover:text-on-accent sm:inline-flex"
          >
            mrmaxdesigns.com
            <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" aria-hidden="true" />
          </a>
          <a
            href={`${home}#setup`}
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
            className="grid h-8 w-8 cursor-pointer place-items-center rounded-full text-ink transition hover:bg-accent sm:h-9 sm:w-9 xl:hidden"
          >
            {open ? <X className="h-5 w-5" aria-hidden="true" /> : <Menu className="h-5 w-5" aria-hidden="true" />}
          </button>
        </div>
      </nav>
      {menuShown && (
        <div
          id="mobile-menu"
          className={`mx-4 mt-2 max-w-6xl sm:mx-auto rounded-3xl border border-border bg-surface p-3 shadow-xl shadow-shadow/10 xl:hidden motion-reduce:animate-none ${
            open ? 'animate-[tab-in_250ms_ease-out]' : 'pointer-events-none animate-[menu-out_200ms_ease-in_forwards]'
          }`}
        >
          {LINKS.map(([label, href]) => (
            <a key={href} href={home + href} onClick={() => setOpen(false)} className="block rounded-2xl px-4 py-3 font-medium text-ink hover:bg-accent hover:text-on-accent">
              {label}
            </a>
          ))}
          <button
            type="button"
            onClick={() => {
              setOpen(false)
              openFeedback()
            }}
            className="block w-full cursor-pointer rounded-2xl px-4 py-3 text-left font-medium text-ink hover:bg-accent hover:text-on-accent"
          >
            Send feedback
          </button>
          <a href={REPO} target="_blank" rel="noopener" className="block rounded-2xl px-4 py-3 font-medium text-ink hover:bg-accent hover:text-on-accent">
            Star colorsbymax on GitHub
          </a>
          <a href="https://github.com/MaxMuyalwa" target="_blank" rel="noopener" className="block rounded-2xl px-4 py-3 font-medium text-ink hover:bg-accent hover:text-on-accent">
            Follow MaxMuyalwa on GitHub
          </a>
          {/* The two main ways on, set apart below the links with room between them. */}
          <div className="mt-3 grid gap-2.5 border-t border-border px-1 pt-4 pb-1">
            <a
              href={`${home}#setup`}
              onClick={() => setOpen(false)}
              className="shine group inline-flex h-12 items-center justify-center gap-2 rounded-full bg-primary px-5 font-semibold text-on-primary shadow-lg shadow-primary/25 transition hover:-translate-y-px sm:hidden"
            >
              Get started
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
            </a>
            <a
              href={MRMAX}
              className="group inline-flex h-12 items-center justify-center gap-2 rounded-full border border-border bg-background px-5 font-semibold text-ink transition hover:border-primary"
            >
              Visit mrmaxdesigns.com
              <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" aria-hidden="true" />
            </a>
          </div>
        </div>
      )}
    </div>
  )
}
