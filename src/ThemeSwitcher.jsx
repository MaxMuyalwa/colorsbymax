import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Palette } from 'lucide-react'
import ThemePanel from './ThemePanel.jsx'
import { useTheme } from './ThemeProvider.jsx'
import panelCss from './panel-css.generated.js'

// Placement: the sticky nav (max-w-5xl, 24px side gutter, top 16px, ~58px tall) spans the
// top-right corner below ~1200px. There the button sits just under the nav's right end;
// from 1200px up the gutter beside the nav is wide enough and it moves into the corner,
// vertically centred on the nav.
const BUTTON_POSITION = 'right-6 top-[84px] min-[1200px]:right-4 min-[1200px]:top-[27px]'
const PANEL_POSITION =
  'inset-x-3 top-[128px] max-h-[calc(100dvh-140px)] sm:inset-x-auto sm:right-6 sm:w-[420px] min-[1200px]:right-4 min-[1200px]:top-[72px] min-[1200px]:max-h-[calc(100dvh-88px)]'

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), summary, [tabindex]:not([tabindex="-1"])'

/** Tag of the element that hosts the switcher's shadow root. The site scan skips it. */
export const HOST_TAG = 'colorsbymax-root'

/**
 * Renders the switcher into a shadow root on <body> that carries its own stylesheet, so it
 * needs nothing from the host site's CSS and the host's CSS can't restyle it.
 */
export default function ThemeSwitcher() {
  const [mount, setMount] = useState(null)

  useEffect(() => {
    const host = document.createElement(HOST_TAG)
    const shadow = host.attachShadow({ mode: 'open' })
    const style = document.createElement('style')
    style.textContent = panelCss
    const container = document.createElement('div')
    shadow.append(style, container)
    document.body.append(host)
    setMount(container)
    return () => host.remove()
  }, [])

  return mount && createPortal(<Switcher />, mount)
}

function Switcher() {
  const { issues } = useTheme()
  const [open, setOpen] = useState(false)
  const buttonRef = useRef(null)
  const panelRef = useRef(null)

  const close = useCallback(() => {
    setOpen(false)
    buttonRef.current?.focus()
  }, [])

  useEffect(() => {
    if (!open) return
    const panel = panelRef.current
    const root = panel.getRootNode()
    // Inside the shadow root, the document only sees the host element as focused or clicked.
    const focused = () => root.activeElement ?? document.activeElement
    const inside = (e, el) => e.composedPath().includes(el)
    panel.querySelector(FOCUSABLE)?.focus()

    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        close()
        return
      }
      if (e.key !== 'Tab') return
      // Trap focus inside the dialog; only visible controls count (closed <details> hide theirs).
      const items = [...panel.querySelectorAll(FOCUSABLE)].filter((el) => el.offsetParent !== null)
      if (!items.length) return
      const first = items[0]
      const last = items[items.length - 1]
      if (e.shiftKey && (focused() === first || !panel.contains(focused()))) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && (focused() === last || !panel.contains(focused()))) {
        e.preventDefault()
        first.focus()
      }
    }
    const onPointerDown = (e) => {
      if (inside(e, panel) || inside(e, buttonRef.current)) return
      setOpen(false)
      // Return focus to the button, unless the click landed on another control that took it.
      setTimeout(() => {
        if (document.activeElement === document.body || !document.activeElement) buttonRef.current?.focus()
      })
    }
    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('pointerdown', onPointerDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('pointerdown', onPointerDown)
    }
  }, [open, close])

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-label={`colorsbymax theme settings${issues.length ? ` (${issues.length} contrast issues)` : ''}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls="theme-panel"
        onClick={() => (open ? close() : setOpen(true))}
        className={`theme-switcher fixed z-[60] ${BUTTON_POSITION} grid place-items-center w-9 h-9 rounded-full border border-zinc-200 bg-white/90 text-zinc-700 shadow-md backdrop-blur hover:bg-white hover:text-zinc-900 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2`}
      >
        <Palette className="w-4 h-4" aria-hidden="true" />
        {/* Live swatch of the active primary colour. */}
        <span
          aria-hidden="true"
          className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white shadow-sm"
          style={{ background: 'var(--color-primary)' }}
        />
      </button>

      {open && (
        <div
          ref={panelRef}
          id="theme-panel"
          role="dialog"
          aria-modal="true"
          aria-labelledby="theme-panel-title"
          className={`theme-switcher theme-panel fixed z-[60] ${PANEL_POSITION} overflow-y-auto overscroll-contain rounded-2xl border border-zinc-200 bg-white text-zinc-900 shadow-2xl`}
        >
          <ThemePanel onClose={close} />
        </div>
      )}
    </>
  )
}
