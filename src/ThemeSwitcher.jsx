import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Palette } from 'lucide-react'
import ThemePanel from './ThemePanel.jsx'
import { useTheme } from './ThemeProvider.jsx'
import { loadLibrary } from './library.js'
import { DARK_SUFFIX, isDarkTheme, toDark } from './modes.js'
import { DEFAULT_SETTINGS, SettingsContext, loadSettings, saveSettings, usePrefersDark } from './settings.js'
import { loadButtonPosition, saveButtonPosition } from './storage.js'
import panelCss from './panel-css.generated.js'

// Placement: the sticky nav (max-w-5xl, 24px side gutter, top 16px, ~58px tall) spans the
// top-right corner below ~1200px. There the button sits just under the nav's right end;
// from 1200px up the gutter beside the nav is wide enough and it moves into the corner,
// vertically centred on the nav.
const BUTTON_POSITION = 'right-6 top-[84px] min-[1200px]:right-4 min-[1200px]:top-[27px]'

// Once dragged, the colour button is placed in pixels and the panel opens beside it.
const BUTTON_SIZE = 36
const EDGE = 12 // closest the button or panel gets to the viewport edge
const PANEL_GAP = 8
const PANEL_WIDTH = 420
const MIN_PANEL_WIDTH = 320
const MIN_PANEL_HEIGHT = 260
const DRAG_THRESHOLD = 5 // pixels of movement before a press becomes a drag
const HINT_DELAY = 100 // ms of hovering before the drag tooltip shows; just enough to skip passing sweeps
const DOT_INTERVAL = 1500 // ms between the colour button dot's colour changes

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
  const { issues, storageKey, tokens, active, themes, selectTheme } = useTheme()
  const [open, setOpen] = useState(false)
  const [settings, setSettings] = useState(() => loadSettings(storageKey))
  const prefersDark = usePrefersDark()
  const mode = settings.mode === 'system' ? (prefersDark ? 'dark' : 'light') : settings.mode
  const buttonRef = useRef(null)
  const panelRef = useRef(null)
  const layerRef = useRef(null)
  const viewport = useViewport()
  const [saved, setSaved] = useState(() => loadButtonPosition(storageKey))
  const [dragPoint, setDragPoint] = useState(null)
  const drag = useRef(null)
  const justDragged = useRef(false)
  const [hint, setHint] = useState(false)
  const hintTimer = useRef(null)

  // Pixel position of the colour button, or null while it sits in its default corner.
  const placed = dragPoint ?? (saved && fromRatios(saved, viewport))

  // Panel size: the saved one, or the one being dragged out right now.
  const [liveSize, setLiveSize] = useState(null)
  const resize = useRef(null)
  const size = liveSize ?? { width: settings.panelWidth, height: settings.panelHeight }
  const layout = panelLayout(placed, viewport, size)

  const onResizeStart = (edges) => (e) => {
    if (e.button !== 0) return
    e.preventDefault()
    const r = panelRef.current.getBoundingClientRect()
    resize.current = { id: e.pointerId, x: e.clientX, y: e.clientY, width: r.width, height: r.height, edges }
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const onResizeMove = (e) => {
    const d = resize.current
    if (!d || d.id !== e.pointerId) return
    const dx = e.clientX - d.x
    const dy = e.clientY - d.y
    setLiveSize({
      width: d.edges.left ? d.width - dx : d.edges.right ? d.width + dx : settings.panelWidth,
      height: d.edges.top ? d.height - dy : d.edges.bottom ? d.height + dy : settings.panelHeight,
    })
  }
  const onResizeEnd = (e) => {
    const d = resize.current
    if (!d || d.id !== e.pointerId) return
    resize.current = null
    // Save what's on screen, which is already kept within the room available.
    const r = panelRef.current.getBoundingClientRect()
    const horizontal = d.edges.left || d.edges.right
    const vertical = d.edges.top || d.edges.bottom
    if (horizontal || vertical) {
      settingsApi.update({
        ...(horizontal && { panelWidth: Math.round(r.width) }),
        ...(vertical && { panelHeight: Math.round(r.height) }),
      })
    }
    setLiveSize(null)
  }
  /** Double-clicking an edge goes back to the standard size in that direction. */
  const onResizeReset = (edges) => () =>
    settingsApi.update({
      ...((edges.left || edges.right) && { panelWidth: null }),
      ...((edges.top || edges.bottom) && { panelHeight: null }),
    })
  // The tooltip sits on the button's inward side; the default corner is on the right.
  const hintOnLeft = placed ? placed.left + BUTTON_SIZE / 2 > viewport.width / 2 : true

  const hideHint = () => {
    clearTimeout(hintTimer.current)
    setHint(false)
  }
  // Native listeners: React builds enter/leave from over/out events, which lose track when the
  // pointer arrives from another React tree across the shadow root boundary.
  useEffect(() => {
    const button = buttonRef.current
    const onEnter = (e) => {
      // Mouse and pen only: touch has no hover, and a long press there already drags.
      if (e.pointerType === 'touch' || e.buttons || open || !settings.draggable) return
      clearTimeout(hintTimer.current)
      hintTimer.current = setTimeout(() => setHint(true), HINT_DELAY)
    }
    const onLeave = () => {
      clearTimeout(hintTimer.current)
      setHint(false)
    }
    button.addEventListener('pointerenter', onEnter)
    button.addEventListener('pointerleave', onLeave)
    return () => {
      clearTimeout(hintTimer.current)
      button.removeEventListener('pointerenter', onEnter)
      button.removeEventListener('pointerleave', onLeave)
    }
  }, [open, settings.draggable])

  const close = useCallback(() => {
    setOpen(false)
    buttonRef.current?.focus()
  }, [])

  const onDragStart = (e) => {
    justDragged.current = false
    hideHint()
    if (e.button !== 0 || !settings.draggable) return
    const r = e.currentTarget.getBoundingClientRect()
    drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, dx: e.clientX - r.left, dy: e.clientY - r.top, moved: false }
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const onDragMove = (e) => {
    const d = drag.current
    if (!d || d.id !== e.pointerId) return
    // Released without a pointerup reaching us: finish instead of dragging on hover.
    if (!(e.buttons & 1)) return onDragEnd(e)
    if (!d.moved && Math.hypot(e.clientX - d.x, e.clientY - d.y) < DRAG_THRESHOLD) return
    // The panel gets out of the way as soon as a press turns into a drag.
    if (!d.moved) setOpen(false)
    d.moved = true
    d.point = clampToViewport({ left: e.clientX - d.dx, top: e.clientY - d.dy }, viewport)
    setDragPoint(d.point)
  }
  const onDragEnd = (e) => {
    const d = drag.current
    if (!d || d.id !== e.pointerId) return
    drag.current = null
    if (!d.moved) return
    // The release still fires a click; swallow it so a drag doesn't also toggle the panel.
    justDragged.current = true
    const ratios = toRatios(d.point, viewport)
    setSaved(ratios)
    saveButtonPosition(storageKey, ratios)
    setDragPoint(null)
  }
  const resetPosition = () => {
    setSaved(null)
    saveButtonPosition(storageKey, null)
  }

  const storeSettings = (next) => {
    saveSettings(storageKey, next)
    return next
  }
  const settingsApi = {
    settings,
    mode,
    update: (patch) => setSettings((s) => storeSettings({ ...s, ...patch })),
    reset: () => setSettings(storeSettings(DEFAULT_SETTINGS)),
    resetButton: saved ? resetPosition : null,
  }

  // When the mode changes (in settings, or the device's if it's followed), swap the current
  // theme for its twin in the new mode. Custom palettes stay as they are.
  const lastMode = useRef(mode)
  useEffect(() => {
    if (lastMode.current === mode) return
    lastMode.current = mode
    if (active.custom) return
    if (mode === 'dark' && !isDarkTheme(active.tokens)) {
      const twin = toDark(active)
      selectTheme(twin.id, twin)
    } else if (mode === 'light' && active.id.endsWith(DARK_SUFFIX)) {
      const lightId = active.id.slice(0, -DARK_SUFFIX.length)
      const local = themes.find((t) => t.id === lightId)
      if (local) selectTheme(local.id, local)
      else
        loadLibrary().then(
          (lib) => {
            const t = lib.themes.find((x) => x.id === lightId)
            if (t) selectTheme(t.id, t)
          },
          () => {},
        )
    }
  }, [mode, active, themes, selectTheme])

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
    <SettingsContext.Provider value={settingsApi}>
      <div ref={layerRef} className={mode === 'dark' ? 'cbm-dark' : undefined}>
        <button
          ref={buttonRef}
          type="button"
          aria-label={`colorsbymax theme settings${issues.length ? ` (${issues.length} contrast issues)` : ''}`}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-controls="theme-panel"
          onClick={() => {
            if (justDragged.current) {
              justDragged.current = false
              return
            }
            hideHint()
            if (open) close()
            else setOpen(true)
          }}
          onPointerDown={onDragStart}
          onPointerMove={onDragMove}
          onPointerUp={onDragEnd}
          onPointerCancel={onDragEnd}
          onLostPointerCapture={onDragEnd}
          style={placed ?? undefined}
          className={`theme-switcher fixed z-[60] ${placed ? '' : BUTTON_POSITION} grid place-items-center w-9 h-9 rounded-full border border-zinc-200 bg-white/90 text-zinc-700 backdrop-blur hover:bg-white hover:text-zinc-900 transition-[color,background-color,box-shadow,scale] select-none ${settings.draggable ? 'touch-none' : ''} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2 ${
            dragPoint ? 'scale-110 shadow-xl cursor-grabbing' : 'shadow-md cursor-pointer'
          }`}
        >
          <Palette className="w-4 h-4" aria-hidden="true" />
          <CyclingDot tokens={tokens} animate={settings.animateDot} />
          {/* Hover tooltip. Visual only: screen reader and keyboard users open the panel as usual. */}
          {hint && !open && !dragPoint && (
            <span
              aria-hidden="true"
              className={`theme-hint pointer-events-none absolute top-1/2 -translate-y-1/2 whitespace-nowrap rounded-md bg-zinc-900 px-2 py-1 text-[11px] font-medium text-white shadow-lg ${
                hintOnLeft ? 'right-full mr-2' : 'left-full ml-2'
              }`}
            >
              Hold and drag to move
            </span>
          )}
        </button>

        {open && (
          <div
            ref={panelRef}
            id="theme-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="theme-panel-title"
            style={layout.style}
            className="theme-switcher theme-panel fixed z-[60] flex flex-col rounded-2xl border border-zinc-200 bg-white text-zinc-900 shadow-2xl"
          >
            <ThemePanel />
            <ResizeHandles
              free={layout.free}
              onStart={onResizeStart}
              onMove={onResizeMove}
              onEnd={onResizeEnd}
              onReset={onResizeReset}
              active={Boolean(liveSize)}
            />
          </div>
        )}
        <TooltipLayer rootRef={layerRef} />
      </div>
    </SettingsContext.Provider>
  )
}

// Theme colours the colour button's dot cycles through: brand, gradient and data colours.
const DOT_KEYS = ['primary', 'primary-alt', 'primary-dark', 'data-1', 'data-2', 'data-3', 'data-4', 'data-5', 'data-6', 'data-7', 'data-8']

/**
 * The dot on the colour button: drifts through the current theme's colours, overrides
 * included, in random order. Held on the primary colour when animation is off or reduced.
 */
function CyclingDot({ tokens, animate }) {
  const reduceMotion = usePrefersReducedMotion()
  const colours = useMemo(() => [...new Set(DOT_KEYS.map((k) => tokens[k]).filter(Boolean))], [tokens])
  const [index, setIndex] = useState(0)
  const still = reduceMotion || !animate || colours.length < 2

  useEffect(() => {
    if (still) return
    const id = setInterval(() => {
      // Any colour but the one showing.
      setIndex((i) => (i + 1 + Math.floor(Math.random() * (colours.length - 1))) % colours.length)
    }, DOT_INTERVAL)
    return () => clearInterval(id)
  }, [still, colours.length])

  return (
    <span
      aria-hidden="true"
      className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white shadow-sm transition-colors duration-700 ease-in-out"
      style={{ backgroundColor: still ? tokens.primary : colours[index % colours.length] }}
    />
  )
}

function usePrefersReducedMotion() {
  const query = '(prefers-reduced-motion: reduce)'
  const [reduce, setReduce] = useState(() => window.matchMedia(query).matches)
  useEffect(() => {
    const mq = window.matchMedia(query)
    const update = () => setReduce(mq.matches)
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])
  return reduce
}

/**
 * Themed tooltips for the panel: anything with `data-tip` gets one on hover, or on keyboard
 * focus, drawn in the panel's own colours instead of the browser's plain tooltip. It sits
 * above its element (below when there's no room) and stays on screen.
 */
function TooltipLayer({ rootRef }) {
  const [tip, setTip] = useState(null)
  const [pos, setPos] = useState(null)
  const tipRef = useRef(null)
  const timer = useRef(null)

  useEffect(() => {
    const root = rootRef.current
    const target = (e) => e.target.closest?.('[data-tip]')
    const show = (el) => {
      clearTimeout(timer.current)
      timer.current = setTimeout(() => setTip({ text: el.dataset.tip, rect: el.getBoundingClientRect() }), HINT_DELAY)
    }
    const hide = () => {
      clearTimeout(timer.current)
      setTip(null)
    }
    const onOver = (e) => {
      const el = target(e)
      if (el && e.pointerType !== 'touch') show(el)
    }
    const onOut = (e) => {
      const el = target(e)
      if (el && !el.contains(e.relatedTarget)) hide()
    }
    const onFocus = (e) => {
      const el = target(e)
      if (el?.matches(':focus-visible')) show(el)
    }
    root.addEventListener('pointerover', onOver)
    root.addEventListener('pointerout', onOut)
    root.addEventListener('focusin', onFocus)
    root.addEventListener('focusout', hide)
    root.addEventListener('pointerdown', hide)
    // The tooltip is placed once, so any scroll would leave it behind.
    root.addEventListener('scroll', hide, true)
    window.addEventListener('scroll', hide, true)
    return () => {
      clearTimeout(timer.current)
      root.removeEventListener('pointerover', onOver)
      root.removeEventListener('pointerout', onOut)
      root.removeEventListener('focusin', onFocus)
      root.removeEventListener('focusout', hide)
      root.removeEventListener('pointerdown', hide)
      root.removeEventListener('scroll', hide, true)
      window.removeEventListener('scroll', hide, true)
    }
  }, [rootRef])

  useLayoutEffect(() => {
    if (!tip || !tipRef.current) return setPos(null)
    const { width, height } = tipRef.current.getBoundingClientRect()
    const r = tip.rect
    const vw = document.documentElement.clientWidth
    const above = r.top - height - PANEL_GAP
    setPos({
      top: Math.round(above >= EDGE ? above : r.bottom + PANEL_GAP),
      left: Math.round(clamp(r.left + r.width / 2 - width / 2, EDGE, vw - width - EDGE)),
    })
  }, [tip])

  if (!tip) return null
  return (
    <span
      ref={tipRef}
      aria-hidden="true"
      className="theme-switcher theme-hint pointer-events-none fixed z-[70] max-w-[240px] rounded-md bg-zinc-900 px-2 py-1 text-[11px] font-medium leading-snug text-white shadow-lg"
      // Measured off-screen first, then placed.
      style={pos ?? { top: -9999, left: -9999 }}
    >
      {tip.text}
    </span>
  )
}

/** Viewport size without scrollbars: the area fixed elements are placed in. */
function useViewport() {
  const read = () => ({ width: document.documentElement.clientWidth, height: document.documentElement.clientHeight })
  const [size, setSize] = useState(read)
  useLayoutEffect(() => {
    const update = () =>
      setSize((s) => {
        const n = read()
        return n.width === s.width && n.height === s.height ? s : n
      })
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])
  return size
}

const clamp = (n, min, max) => Math.min(Math.max(n, min), Math.max(min, max))

function clampToViewport({ left, top }, { width, height }) {
  return {
    left: Math.round(clamp(left, EDGE, width - BUTTON_SIZE - EDGE)),
    top: Math.round(clamp(top, EDGE, height - BUTTON_SIZE - EDGE)),
  }
}

/** Saved as fractions of the space the button can move in, so resizing keeps its relative spot. */
function toRatios({ left, top }, { width, height }) {
  const ratio = (n, span) => (span > 0 ? clamp((n - EDGE) / span, 0, 1) : 0)
  return { rx: ratio(left, width - BUTTON_SIZE - 2 * EDGE), ry: ratio(top, height - BUTTON_SIZE - 2 * EDGE) }
}

function fromRatios({ rx, ry }, viewport) {
  const { width, height } = viewport
  return clampToViewport({ left: EDGE + rx * (width - BUTTON_SIZE - 2 * EDGE), top: EDGE + ry * (height - BUTTON_SIZE - 2 * EDGE) }, viewport)
}

/**
 * Where the panel goes and how big it is. In its default corner it sits under the site's nav
 * (matching BUTTON_POSITION). Next to a moved button it opens below the button in the top half
 * of the screen and above it otherwise, lined up with the button's inward side. Its edges away
 * from the button (`free`) can be dragged to resize it; the edge at the button stays put.
 * @param {{ left: number, top: number } | null} button
 * @param {{ width: number | null, height: number | 'full' | null }} size
 */
function panelLayout(button, { width: vw, height: vh }, size) {
  const narrow = vw < 640
  const style = {}
  const free = { left: false, right: false, top: false, bottom: false }
  let maxWidth
  let maxHeight

  if (!button) {
    const wide = vw >= 1200
    style.top = wide ? 72 : 128
    style.right = narrow ? EDGE : wide ? 16 : 24
    maxHeight = vh - style.top - EDGE
    free.bottom = true
    style.transformOrigin = 'top right'
  } else {
    const onRight = button.left + BUTTON_SIZE / 2 > vw / 2
    const below = button.top + BUTTON_SIZE / 2 < vh / 2
    if (onRight) style.right = clamp(vw - button.left - BUTTON_SIZE, EDGE, vw - EDGE - MIN_PANEL_WIDTH)
    else style.left = clamp(button.left, EDGE, vw - EDGE - MIN_PANEL_WIDTH)
    free[onRight ? 'left' : 'right'] = !narrow
    if (below) {
      style.top = button.top + BUTTON_SIZE + PANEL_GAP
      maxHeight = vh - style.top - EDGE
      free.bottom = true
    } else {
      style.bottom = vh - button.top + PANEL_GAP
      maxHeight = button.top - PANEL_GAP - EDGE
      free.top = true
    }
    style.transformOrigin = `${below ? 'top' : 'bottom'} ${onRight ? 'right' : 'left'}`
  }

  if (narrow) {
    // Phones: full width between the gutters; only the height can change.
    style.left = EDGE
    style.right = EDGE
  } else {
    free.left ||= !button // the default corner is right-anchored
    maxWidth = vw - EDGE - (style.right ?? style.left)
    style.width = Math.round(clamp(size.width ?? PANEL_WIDTH, MIN_PANEL_WIDTH, maxWidth))
  }
  style.maxHeight = maxHeight
  if (size.height === 'full') style.height = maxHeight
  else if (size.height) style.height = Math.round(clamp(size.height, MIN_PANEL_HEIGHT, maxHeight))
  return { style, free }
}

/**
 * Invisible grab strips along the panel's free edges, plus the corner where two meet. They sit
 * mostly outside the panel, so they're easy to catch and never cover its scrollbar.
 */
function ResizeHandles({ free, onStart, onMove, onEnd, onReset, active }) {
  const strips = [
    free.left && { edges: { left: true }, className: 'inset-y-5 -left-2 w-3 cursor-ew-resize' },
    free.right && { edges: { right: true }, className: 'inset-y-5 -right-2 w-3 cursor-ew-resize' },
    free.top && { edges: { top: true }, className: 'inset-x-5 -top-2 h-3 cursor-ns-resize' },
    free.bottom && { edges: { bottom: true }, className: 'inset-x-5 -bottom-2 h-3 cursor-ns-resize' },
  ]
  for (const v of ['top', 'bottom']) {
    for (const h of ['left', 'right']) {
      if (free[v] && free[h]) {
        const diagonal = (v === 'top') === (h === 'left') ? 'cursor-nwse-resize' : 'cursor-nesw-resize'
        strips.push({ edges: { [v]: true, [h]: true }, className: `-${v}-2 -${h}-2 h-5 w-5 ${diagonal}`, corner: true })
      }
    }
  }
  return strips.filter(Boolean).map(({ edges, className, corner }) => (
    <div
      key={Object.keys(edges).join('-')}
      aria-hidden="true"
      data-tip={active ? undefined : 'Drag to resize, double-click to reset'}
      onPointerDown={onStart(edges)}
      onPointerMove={onMove}
      onPointerUp={onEnd}
      onPointerCancel={onEnd}
      onLostPointerCapture={onEnd}
      onDoubleClick={onReset(edges)}
      className={`theme-resize absolute z-30 touch-none select-none ${corner ? '' : 'rounded-full hover:bg-zinc-400/30'} ${className}`}
    />
  ))
}
