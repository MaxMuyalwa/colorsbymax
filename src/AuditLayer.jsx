import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { MAX_PINNED } from './audit.js'
import { AlertTriangle, CheckCircle2, Contrast, RotateCcw, ScanSearch, X } from './icons.jsx'

const CARD_WIDTH = 264
const GAP = 10
const EDGE = 12
/** Space kept between two notes. */
const APART = 8
/** A note's height before it has been measured. */
const GUESS_HEIGHT = 150
/** Below this width, only one note is open at a time; the numbered badges pick which. */
const COMPACT_WIDTH = 640

/**
 * The audit on the page: each finding outlined where it is, with a numbered card pointing at it,
 * kept in place as the page scrolls; and a bar by the colour button to re-check or close.
 */
export default function AuditLayer({ findings, anchor, themeIssues, onRecheck, onClose, onAction }) {
  const [rects, setRects] = useState([])
  const [dismissed, setDismissed] = useState(() => new Set())
  const [inverted, setInverted] = useState(() => new Set())
  const [selected, setSelected] = useState(null)
  const [anchorRect, setAnchorRect] = useState(null)
  const pinned = findings.filter((f) => !dismissed.has(f.id)).slice(0, MAX_PINNED)
  const hiddenCount = findings.filter((f) => !dismissed.has(f.id)).length - pinned.length

  useEffect(() => setDismissed(new Set()), [findings])

  // Follow the elements as the page scrolls, resizes or shifts.
  useLayoutEffect(() => {
    let frame = 0
    const measure = () => {
      frame = 0
      setRects(pinned.map((f) => (f.el.isConnected ? f.el.getBoundingClientRect() : null)))
      setAnchorRect(anchor.current?.getBoundingClientRect() ?? null)
    }
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure)
    }
    measure()
    window.addEventListener('scroll', schedule, true)
    window.addEventListener('resize', schedule)
    const timer = setInterval(schedule, 500) // late layout shifts (images loading, fonts)
    return () => {
      cancelAnimationFrame(frame)
      clearInterval(timer)
      window.removeEventListener('scroll', schedule, true)
      window.removeEventListener('resize', schedule)
    }
  }, [findings, dismissed]) // `pinned` and `anchor` follow from these

  // "Preview inverted" for pictures: a temporary filter on the element, removed with the audit.
  useEffect(() => {
    for (const f of findings) f.el.toggleAttribute('data-colorsbymax-invert', inverted.has(f.id))
    return () => {
      for (const f of findings) f.el.removeAttribute('data-colorsbymax-invert')
    }
  }, [inverted, findings])
  useEffect(() => {
    const style = document.createElement('style')
    style.dataset.colorsbymax = 'audit'
    style.textContent = '[data-colorsbymax-invert]{filter:invert(1) hue-rotate(180deg)!important}'
    document.head.append(style)
    return () => style.remove()
  }, [])

  const vw = document.documentElement.clientWidth
  const vh = document.documentElement.clientHeight
  const open = findings.filter((f) => !dismissed.has(f.id)).length

  // Measured note heights, so notes can be kept from overlapping.
  const heights = useRef({})
  const layerRef = useRef(null)
  useLayoutEffect(() => {
    for (const note of layerRef.current?.querySelectorAll('[data-note]') ?? []) heights.current[note.dataset.note] = note.offsetHeight
  })

  // Each note goes below its element (above if there's no room), kept on screen. A note that
  // would overlap an earlier one moves beside it, or below it when there's no room beside.
  const placed = []
  const compact = vw < COMPACT_WIDTH
  const openId = pinned.some((f) => f.id === selected) ? selected : pinned[0]?.id
  const showsNote = (f) => !compact || f.id === openId
  const placements = pinned.map((f, i) => {
    const r = rects[i]
    if (!r || r.bottom < 0 || r.top > vh || !showsNote(f)) return null
    const h = heights.current[f.id] ?? GUESS_HEIGHT
    const below = r.bottom + GAP + h < vh || r.top < h + GAP
    let top = below ? r.bottom + GAP : r.top - GAP - h
    let left = Math.min(Math.max(r.left + r.width / 2 - CARD_WIDTH / 2, EDGE), vw - CARD_WIDTH - EDGE)
    for (let tries = 0; tries < placed.length + 1; tries++) {
      const hit = placed.find((p) => left < p.left + CARD_WIDTH + APART && left + CARD_WIDTH + APART > p.left && top < p.top + p.h + APART && top + h + APART > p.top)
      if (!hit) break
      if (hit.left + 2 * CARD_WIDTH + APART + EDGE <= vw) left = hit.left + CARD_WIDTH + APART
      else top = hit.top + hit.h + APART
    }
    placed.push({ left, top, h })
    const arrow = Math.min(Math.max(r.left + r.width / 2 - left, 16), CARD_WIDTH - 16)
    // Only point at the element while the note is still next to it.
    const pointing = below ? Math.abs(top - (r.bottom + GAP)) < 2 : Math.abs(top + h - (r.top - GAP)) < 2
    return { left: Math.round(left), top: Math.round(top), below, arrow: Math.round(arrow), pointing }
  })

  return (
    <div ref={layerRef}>
      {pinned.map((f, i) => {
        const r = rects[i]
        if (!r || r.bottom < 0 || r.top > vh) return null
        const place = placements[i]
        return (
          <div key={f.id}>
            <div
              aria-hidden="true"
              className="pointer-events-none fixed z-[55] rounded-md border-2 border-dashed border-amber-400"
              style={{ left: r.left - 4, top: r.top - 4, width: r.width + 8, height: r.height + 8 }}
            />
            {compact ? (
              // On small screens the badges choose which note is open.
              <button
                type="button"
                aria-label={`Show audit finding ${i + 1}: ${f.title}`}
                aria-pressed={f.id === openId}
                onClick={() => setSelected(f.id)}
                className={`fixed z-[57] grid h-6 w-6 place-items-center rounded-full bg-amber-400 text-[11px] font-bold text-zinc-900 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 ${f.id === openId ? 'ring-2 ring-white' : ''}`}
                style={{ left: r.left - 14, top: r.top - 14 }}
              >
                {i + 1}
              </button>
            ) : (
              <span
                aria-hidden="true"
                className="pointer-events-none fixed z-[56] grid h-5 w-5 place-items-center rounded-full bg-amber-400 text-[11px] font-bold text-zinc-900"
                style={{ left: r.left - 12, top: r.top - 12 }}
              >
                {i + 1}
              </span>
            )}
            {place && (
            <div
              role="note"
              data-note={f.id}
              aria-label={`Audit finding ${i + 1}: ${f.title}`}
              className="theme-switcher theme-hint fixed z-[62] rounded-xl border border-zinc-200 bg-white p-3 text-zinc-900 shadow-xl"
              style={{ left: place.left, top: place.top, width: CARD_WIDTH }}
            >
              {place.pointing && (
                <span
                  aria-hidden="true"
                  className={`absolute h-2.5 w-2.5 rotate-45 border-zinc-200 bg-white ${place.below ? '-top-[6px] border-l border-t' : '-bottom-[6px] border-b border-r'}`}
                  style={{ left: place.arrow - 5 }}
                />
              )}
              <p className="flex items-start gap-1.5 text-xs font-semibold">
                <span className="grid h-4 w-4 shrink-0 place-items-center rounded-full bg-amber-400 text-[10px] font-bold text-zinc-900">{i + 1}</span>
                {f.title}
              </p>
              <p className="mt-1 text-[11px] leading-snug text-zinc-600">{f.message}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {f.action === 'colour-logo' && (
                  <button type="button" className="rounded-lg bg-zinc-900 px-2 py-1 text-[11px] font-medium text-white hover:bg-zinc-700 cursor-pointer" onClick={() => onAction('colour-logo')}>
                    Colour the logo
                  </button>
                )}
                {f.action === 'invert' && (
                  <button
                    type="button"
                    aria-pressed={inverted.has(f.id)}
                    className="inline-flex items-center gap-1 rounded-lg border border-zinc-300 bg-white px-2 py-1 text-[11px] font-medium text-zinc-800 hover:bg-zinc-50 cursor-pointer"
                    onClick={() =>
                      setInverted((s) => {
                        const next = new Set(s)
                        if (next.has(f.id)) next.delete(f.id)
                        else next.add(f.id)
                        return next
                      })
                    }
                  >
                    <Contrast className="w-3 h-3" aria-hidden="true" />
                    {inverted.has(f.id) ? 'Undo preview' : 'Preview inverted'}
                  </button>
                )}
                <button
                  type="button"
                  className="rounded-lg px-2 py-1 text-[11px] font-medium text-zinc-600 hover:bg-zinc-100 cursor-pointer"
                  onClick={() => setDismissed((s) => new Set(s).add(f.id))}
                >
                  Got it
                </button>
              </div>
            </div>
            )}
          </div>
        )
      })}

      <AuditBar anchorRect={anchorRect} open={open} hiddenCount={hiddenCount} themeIssues={themeIssues} onRecheck={onRecheck} onClose={onClose} />
    </div>
  )
}

/** The audit's summary, next to the colour button: what it found, Re-check and Close. */
function AuditBar({ anchorRect, open, hiddenCount, themeIssues, onRecheck, onClose }) {
  const ref = useRef(null)
  const [size, setSize] = useState({ width: 0, height: 0 })
  useLayoutEffect(() => {
    const r = ref.current?.getBoundingClientRect()
    if (r && (r.width !== size.width || r.height !== size.height)) setSize({ width: r.width, height: r.height })
  })
  const vw = document.documentElement.clientWidth
  // Just below the colour button (above it when it's in the lower half of the screen), lined up
  // with its inward edge, so it stays clear of the page's top bar and of the notes.
  const vh = document.documentElement.clientHeight
  let style = { right: EDGE, bottom: EDGE }
  if (anchorRect) {
    const onRight = anchorRect.left + anchorRect.width / 2 > vw / 2
    const below = anchorRect.top + anchorRect.height / 2 < vh / 2
    const top = below ? Math.round(anchorRect.bottom + GAP) : Math.round(anchorRect.top - GAP - size.height)
    const left = onRight ? Math.round(anchorRect.right - size.width) : Math.round(anchorRect.left)
    style = { top, left: Math.min(Math.max(EDGE, left), vw - size.width - EDGE) }
  }

  return (
    <div
      ref={ref}
      role="status"
      aria-live="polite"
      className="theme-switcher fixed z-[61] flex max-w-[calc(100vw-80px)] items-center gap-2 rounded-full border border-zinc-200 bg-white py-1.5 pl-3 pr-1.5 text-xs text-zinc-900 shadow-xl"
      style={style}
    >
      <ScanSearch className="w-4 h-4 shrink-0" aria-hidden="true" />
      <span className="font-semibold">Audit</span>
      {open ? (
        <span className="flex items-center gap-1 text-zinc-700">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-700" aria-hidden="true" />
          {open} to check{hiddenCount > 0 ? ` (${hiddenCount} more after these)` : ''}
        </span>
      ) : (
        <span className="flex items-center gap-1 text-zinc-700">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-800" aria-hidden="true" />
          Nothing to fix on the page
        </span>
      )}
      {themeIssues > 0 && (
        <span className="hidden text-zinc-600 sm:inline">· theme has {themeIssues} contrast {themeIssues === 1 ? 'issue' : 'issues'} (see the panel)</span>
      )}
      <button
        type="button"
        onClick={onRecheck}
        className="inline-flex items-center gap-1 rounded-full border border-zinc-300 px-2 py-1 text-[11px] font-medium hover:bg-zinc-50 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900"
      >
        <RotateCcw className="w-3 h-3" aria-hidden="true" /> Re-check
      </button>
      <button
        type="button"
        onClick={onClose}
        aria-label="Close the audit"
        className="grid h-6 w-6 place-items-center rounded-full hover:bg-zinc-100 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900"
      >
        <X className="w-3.5 h-3.5" aria-hidden="true" />
      </button>
    </div>
  )
}
