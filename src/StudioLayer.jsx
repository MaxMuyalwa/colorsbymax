// Studio's point and click, drawn over the page: while it's on, the part under the pointer is
// outlined and named; a click picks it (instead of following a link or pressing a button) and
// opens a card beside it to give it a background, text and border colour, from the theme or any
// colour. Changes show at once and are kept; Done goes back to Studio in the panel.

import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { contrastRatio } from './color.js'
import { formatRatio } from './contrast.js'
import { ArrowDownRight, ArrowUpLeft, Check, Trash2, X } from './icons.jsx'
import { usePathname } from './scope.js'
import { PROPS, SWATCH_TOKENS, bestText, checkText, childOf, describe, kindOf, parentOf, pickTarget, selectorOf } from './studio.js'
import { useTheme } from './ThemeProvider.jsx'
import { TOKEN_LABELS } from './tokens.js'

const CARD_WIDTH = 300
const EDGE = 12
const GAP = 10
const OUTLINE = '#6366f1'

const stepButton =
  'inline-flex items-center gap-1 rounded-lg border border-zinc-300 px-2 py-1 text-[11px] font-medium text-zinc-800 cursor-pointer hover:bg-zinc-50 disabled:cursor-default disabled:opacity-45 disabled:hover:bg-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900'

const newId = () => `paint-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`

/** Follows an element's box on screen as the page scrolls, resizes or shifts. */
function useRect(el) {
  const [rect, setRect] = useState(null)
  useLayoutEffect(() => {
    if (!el) return setRect(null)
    let frame = 0
    const measure = () => {
      frame = 0
      setRect(el.isConnected ? el.getBoundingClientRect() : null)
    }
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure)
    }
    measure()
    window.addEventListener('scroll', schedule, true)
    window.addEventListener('resize', schedule)
    const timer = setInterval(schedule, 400)
    return () => {
      cancelAnimationFrame(frame)
      clearInterval(timer)
      window.removeEventListener('scroll', schedule, true)
      window.removeEventListener('resize', schedule)
    }
  }, [el])
  return rect
}

function Outline({ rect, label, solid }) {
  if (!rect) return null
  const above = rect.top > 26
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed z-[65] rounded-md"
      style={{ left: rect.left - 3, top: rect.top - 3, width: rect.width + 6, height: rect.height + 6, outline: `2px ${solid ? 'solid' : 'dashed'} ${OUTLINE}`, background: solid ? 'transparent' : 'rgb(99 102 241 / 0.08)' }}
    >
      <span
        className="absolute left-0 whitespace-nowrap rounded px-1.5 py-0.5 text-[11px] font-semibold text-white"
        style={{ background: OUTLINE, ...(above ? { bottom: '100%', marginBottom: 4 } : { top: '100%', marginTop: 4 }) }}
      >
        {label}
      </span>
    </div>
  )
}

export default function StudioLayer({ onDone }) {
  const theme = useTheme()
  const pathname = usePathname()
  const [hover, setHover] = useState(null)
  const [picked, setPicked] = useState(null)
  const hoverRect = useRect(hover?.el ?? null)
  const pickedRect = useRect(picked?.el ?? null)
  // Page listeners are added once, so they reach the latest of these through refs.
  const latest = useRef({})
  const coarse = typeof matchMedia === 'function' && matchMedia('(hover: none)').matches

  // While on: the part under the pointer is outlined, and a click picks it instead of using it.
  useEffect(() => {
    const onMove = (e) => {
      if (e.pointerType === 'touch') return
      const el = pickTarget(e)
      setHover((h) => (h?.el === el ? h : el ? { el, kind: kindOf(el) } : null))
    }
    const block = (e) => {
      if (!pickTarget(e)) return
      e.preventDefault()
      e.stopPropagation()
      e.stopImmediatePropagation()
    }
    const onClick = (e) => {
      const el = pickTarget(e)
      if (!el) return
      block(e)
      setHover(null)
      latest.current.pick(el)
    }
    const onKey = (e) => {
      if (e.key !== 'Escape') return
      e.preventDefault()
      if (latest.current.picked) setPicked(null)
      else latest.current.onDone()
    }
    document.addEventListener('pointermove', onMove, true)
    for (const type of ['pointerdown', 'mousedown', 'mouseup', 'pointerup', 'submit', 'dblclick']) document.addEventListener(type, block, true)
    document.addEventListener('click', onClick, true)
    document.addEventListener('keydown', onKey, true)
    document.documentElement.style.setProperty('cursor', 'crosshair')
    return () => {
      document.removeEventListener('pointermove', onMove, true)
      for (const type of ['pointerdown', 'mousedown', 'mouseup', 'pointerup', 'submit', 'dblclick']) document.removeEventListener(type, block, true)
      document.removeEventListener('click', onClick, true)
      document.removeEventListener('keydown', onKey, true)
      document.documentElement.style.removeProperty('cursor')
    }
  }, [])

  // A new page (in a single-page app) has none of the old page's parts.
  useEffect(() => {
    setPicked(null)
    setHover(null)
  }, [pathname])

  // The parts stepped out of with "The part around it", so "The part inside it" goes back the same way.
  const trail = useRef([])
  const pick = (el, { stepping = false } = {}) => {
    if (!stepping) trail.current = []
    const info = describe(el)
    // Picked before: carry on with its colours.
    const existing = theme.paints.find((p) => (p.everywhere && info.similar && p.similar === info.similar) || (p.page === pathname && (p.one === info.one || (p.all && p.similar === info.similar))))
    setPicked({ ...info, paint: existing ?? { id: newId(), page: pathname, one: info.one, similar: info.similar, likeIt: info.likeIt, all: false, kind: info.kind, text: info.text, where: info.where, hasBorder: info.hasBorder, props: {} } })
  }
  latest.current = { pick, picked, onDone }

  return (
    <div className="theme-switcher">
      <Outline rect={hoverRect} label={hover?.kind} />
      <Outline rect={pickedRect} label={picked?.kind} solid />

      {/* The bar: what to do, and how to finish. */}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[70] flex justify-center px-3">
        <div className="pointer-events-auto flex max-w-full items-center gap-3 rounded-full border border-zinc-200 bg-white py-1.5 pr-1.5 pl-4 text-xs text-zinc-800 shadow-xl" role="status">
          <span className="min-w-0">
            <strong className="font-semibold text-zinc-900">Studio:</strong> {coarse ? 'tap' : 'click'} any part of the page to colour it
          </span>
          <button type="button" onClick={onDone} className="shrink-0 rounded-full bg-zinc-900 px-3 py-1 text-xs font-semibold text-white cursor-pointer hover:bg-zinc-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2">
            Done
          </button>
        </div>
      </div>

      {picked && pickedRect && (
        <Editor
          key={picked.paint.id}
          picked={picked}
          rect={pickedRect}
          canPickParent={Boolean(parentOf(picked.el))}
          onPickParent={() => {
            const parent = parentOf(picked.el)
            if (!parent) return
            trail.current.push(picked.el)
            pick(parent, { stepping: true })
          }}
          canPickChild={Boolean(childOf(picked.el))}
          onPickChild={() => {
            const back = trail.current.pop()
            const inner = back && back.isConnected && picked.el.contains(back) ? back : childOf(picked.el)
            if (inner) pick(inner, { stepping: true })
          }}
          onClose={() => setPicked(null)}
        />
      )}
    </div>
  )
}

/** Where the card goes: beside the part if there's room, else below or above it, on screen. */
function place(rect, height) {
  const vw = window.innerWidth
  const vh = window.innerHeight
  const width = Math.min(CARD_WIDTH, vw - EDGE * 2)
  if (vw >= 700) {
    const right = rect.right + GAP
    const left = rect.left - GAP - width
    const x = right + width <= vw - EDGE ? right : left >= EDGE ? left : null
    if (x !== null) return { left: x, top: Math.min(Math.max(EDGE, rect.top), vh - height - EDGE), width }
  }
  const x = Math.min(Math.max(EDGE, rect.left), vw - width - EDGE)
  const below = rect.bottom + GAP
  const top = below + height <= vh - EDGE ? below : rect.top - GAP - height >= EDGE ? rect.top - GAP - height : vh - height - EDGE
  return { left: x, top: Math.max(EDGE, top), width }
}

function Editor({ picked, rect, onPickParent, canPickParent, onPickChild, canPickChild, onClose }) {
  const { tokens, savePaint, removePaint, paints, inScope } = useTheme()
  const [paint, setPaint] = useState(picked.paint)
  const [height, setHeight] = useState(320)
  // How readable the text in it is: every piece of text in the part (or in all the parts like it).
  const [check, setCheck] = useState(null)
  // Set by Fix, so text it couldn't help (on a background of its own) can be pointed out.
  const [fixTried, setFixTried] = useState(false)
  const cardRef = useRef(null)
  const headingId = useId()
  const saved = paints.some((p) => p.id === paint.id)

  useLayoutEffect(() => {
    if (cardRef.current) setHeight(cardRef.current.offsetHeight)
  })
  useEffect(() => cardRef.current?.querySelector('button')?.focus({ preventScroll: true }), [])

  // Checked as soon as it's picked, and again once new colours are on the page: at once, and after
  // the site's own colour transitions (which report the colour mid-way) have finished.
  const roots = () => {
    if (!paint.all || !paint.similar) return [picked.el]
    try {
      return [...document.querySelectorAll(selectorOf(paint))]
    } catch {
      return [picked.el]
    }
  }
  useEffect(() => {
    const measure = () => {
      if (!picked.el.isConnected) return setCheck(null)
      const result = checkText(roots())
      setCheck(result.checked ? result : null)
    }
    const frame = requestAnimationFrame(measure)
    const settled = setTimeout(measure, 450)
    picked.el.addEventListener('transitionend', measure)
    return () => {
      cancelAnimationFrame(frame)
      clearTimeout(settled)
      picked.el.removeEventListener('transitionend', measure)
    }
  }, [paint, tokens, picked.el])

  const update = (next) => {
    setPaint(next)
    savePaint(next)
  }
  const setColour = (key, value, fromFix = false) => {
    setFixTried(fromFix)
    const props = { ...paint.props }
    if (value) props[key] = value
    else delete props[key]
    update({ ...paint, props })
  }
  // Fix: the text colour that reads on every background the hard-to-read text sits on, checked
  // against each of them; the theme's colour where one is good enough, else black or white.
  const fixText = () => {
    const failing = check?.failing ?? []
    if (!failing.length) return
    const need = Math.max(...failing.map((f) => f.need))
    const backgrounds = [...new Set(failing.map((f) => f.background))]
    const score = (hex) => Math.min(...backgrounds.map((bg) => contrastRatio(hex, bg)))
    const themeBest = backgrounds
      .map((bg) => bestText(bg, tokens, need))
      .filter((c) => c.token)
      .sort((a, b) => score(b.hex) - score(a.hex))[0]
    const fallback = score('#000000') >= score('#ffffff') ? { hex: '#000000' } : { hex: '#ffffff' }
    const choice = themeBest && score(themeBest.hex) >= need ? { token: themeBest.token, hex: themeBest.hex } : fallback
    setColour('text', choice, true)
  }
  // What the part's text and background are now, for marking swatches that wouldn't read.
  const main = check?.worst ?? null
  const pos = place(rect, height)
  const swatches = [...new Map(SWATCH_TOKENS.map((t) => [tokens[t], t])).entries()].map(([hex, token]) => ({ hex, token }))

  return (
    <div
      ref={cardRef}
      role="dialog"
      aria-labelledby={headingId}
      className="theme-scroll fixed z-[70] overflow-y-auto overscroll-contain rounded-2xl border border-zinc-200 bg-white p-3 text-zinc-900 shadow-2xl"
      style={{ left: pos.left, top: pos.top, width: pos.width, maxHeight: `calc(100vh - ${EDGE * 2}px)` }}
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p id={headingId} className="text-sm font-semibold">
            {picked.kind}
            {picked.text && <span className="font-normal text-zinc-600"> “{picked.text}”</span>}
          </p>
          {picked.where && <p className="text-[11px] text-zinc-600">{picked.where[0].toUpperCase() + picked.where.slice(1)}</p>}
        </div>
        <button type="button" onClick={onClose} aria-label="Close" className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-zinc-600 cursor-pointer hover:bg-zinc-100 hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900">
          <X className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5">
        <button type="button" onClick={onPickParent} disabled={!canPickParent} className={stepButton}>
          <ArrowUpLeft className="w-3.5 h-3.5" aria-hidden="true" /> The part around it
        </button>
        <button type="button" onClick={onPickChild} disabled={!canPickChild} className={stepButton}>
          <ArrowDownRight className="w-3.5 h-3.5" aria-hidden="true" /> The part inside it
        </button>
      </div>
      {!canPickChild && picked.text && (
        <p className="mt-1.5 text-[11px] text-zinc-600">
          This is the text itself. To colour its words, use <strong className="font-semibold text-zinc-800">Text colour</strong> below.
        </p>
      )}

      {paint.similar && (
        <div role="radiogroup" aria-label="Which ones" className="mt-2.5 grid grid-cols-3 gap-1 rounded-lg bg-zinc-100 p-1">
          {[
            ['one', 'Just this one', { all: false, everywhere: false }],
            ['all', `All ${paint.likeIt} here`, { all: true, everywhere: false }],
            ['everywhere', 'On every page', { all: true, everywhere: true }],
          ].map(([id, label, change]) => {
            const on = (paint.everywhere ? 'everywhere' : paint.all ? 'all' : 'one') === id
            return (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => update({ ...paint, ...change })}
                data-tip={id === 'everywhere' ? `Every ${picked.kind.toLowerCase()} like it, on every page of your site` : undefined}
                className={`rounded-md px-1.5 py-1 text-[11px] leading-tight font-semibold cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 ${
                  on ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-600 hover:text-zinc-900'
                }`}
              >
                {label}
              </button>
            )
          })}
        </div>
      )}
      {paint.everywhere && (
        <p className="mt-1.5 text-[11px] leading-snug text-zinc-600">
          Studio will colour every {picked.kind.toLowerCase()} like this on every page of your site, as you open them.
        </p>
      )}

      {check && <Readability check={check} onFix={fixText} fixed={fixTried} />}

      <div className="mt-3 space-y-2.5">
        {PROPS.map(({ key, label }) => (
          <ColourRow
            key={key}
            label={key === 'text' ? 'Text colour' : label}
            hint={key === 'border' && !paint.hasBorder ? 'adds an outline' : key === 'background' ? 'behind it' : key === 'text' ? 'its words' : null}
            value={paint.props[key]}
            swatches={swatches}
            onChange={(v) => setColour(key, v)}
            inScope={inScope}
            // A background is checked against the text on it, a text colour against the background.
            readsOn={main && key === 'background' ? (hex) => ({ ratio: contrastRatio(main.text, hex), need: main.need }) : main && key === 'text' ? (hex) => ({ ratio: contrastRatio(hex, main.background), need: main.need }) : null}
          />
        ))}
      </div>

      <div className="mt-3 flex gap-2">
        {saved && (
          <button
            type="button"
            onClick={() => {
              removePaint(paint.id)
              onClose()
            }}
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-zinc-300 px-2.5 py-1.5 text-xs font-medium text-zinc-800 cursor-pointer hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900"
          >
            <Trash2 className="w-3.5 h-3.5" aria-hidden="true" /> Undo these
          </button>
        )}
        <button type="button" onClick={onClose} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-zinc-900 px-2.5 py-1.5 text-xs font-medium text-white cursor-pointer hover:bg-zinc-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2">
          <Check className="w-3.5 h-3.5" aria-hidden="true" /> Done
        </button>
      </div>
    </div>
  )
}

/**
 * How readable the part's text is, shown as soon as it's picked: all good, or how many pieces are
 * hard to read, with Fix. Text that still fails after a fix sits on a background of its own.
 */
function Readability({ check, onFix, fixed }) {
  const { checked, failing, worst } = check
  const ok = !failing.length
  const pieces = (n) => (n === 1 ? 'piece' : 'pieces')
  return (
    <div role="status" className={`mt-2.5 rounded-lg p-2.5 text-[11px] leading-snug ${ok ? 'bg-emerald-50 text-emerald-900' : 'bg-amber-50 text-amber-900'}`}>
      <div className="flex items-start justify-between gap-2">
        <p>
          {ok ? (
            <>
              <strong className="font-semibold">Easy to read.</strong> {checked === 1 ? 'Its text' : `All ${checked} ${pieces(checked)} of text`} {checked === 1 ? 'reads' : 'read'} well
              {worst && ` (${checked === 1 ? '' : 'lowest '}${formatRatio(worst.ratio)})`}.
            </>
          ) : (
            <>
              <strong className="font-semibold">Hard to read.</strong> {failing.length === checked ? (checked === 1 ? 'Its text' : `All ${checked} ${pieces(checked)} of text`) : `${failing.length} of ${checked} ${pieces(checked)} of text`}{' '}
              {failing.length === 1 && checked === 1 ? 'is' : 'are'} too faint on {failing.length === 1 ? 'its' : 'their'} background ({formatRatio(worst.ratio)}, needs {formatRatio(worst.need)}).
            </>
          )}
        </p>
        {!ok && (
          <button type="button" onClick={onFix} className="shrink-0 rounded-md bg-amber-900 px-2 py-1 font-semibold text-amber-50 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-900 focus-visible:ring-offset-1">
            Fix
          </button>
        )}
      </div>
      {!ok && fixed && <p className="mt-1">Some of it sits on a background of its own. Click that text to change it on its own.</p>}
    </div>
  )
}

/** One colour: the theme's swatches, any colour, or none (the part's own). */
function ColourRow({ label, hint, value, swatches, onChange, inScope, readsOn }) {
  const id = useId()
  const current = value ? (value.token && inScope ? swatches.find((s) => s.token === value.token)?.hex ?? value.hex : value.hex) : null
  return (
    <div role="group" aria-labelledby={id}>
      <div className="mb-1 flex items-center justify-between">
        <span id={id} className="text-[11px] font-semibold text-zinc-700">
          {label}
          {hint && <span className="ml-1 font-normal text-zinc-500">· {hint}</span>}
        </span>
        {value && (
          <button type="button" onClick={() => onChange(null)} className="text-[11px] font-medium text-zinc-600 underline underline-offset-2 cursor-pointer hover:text-zinc-900">
            Its own
          </button>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-1">
        {swatches.map((s) => {
          const on = value?.token === s.token
          const name = TOKEN_LABELS[s.token] ?? s.token
          // Marked when it would make the text hard to read.
          const reads = readsOn?.(s.hex)
          const poor = reads && reads.ratio < reads.need
          return (
            <button
              key={s.token}
              type="button"
              aria-pressed={on}
              aria-label={`${name} (${s.hex})${poor ? ', hard to read here' : ''}`}
              data-tip={`${name} · ${s.hex}${reads ? (poor ? ` · hard to read here (${formatRatio(reads.ratio)})` : ` · reads well (${formatRatio(reads.ratio)})`) : ''}`}
              onClick={() => onChange({ token: s.token, hex: s.hex })}
              className={`relative h-6 w-6 rounded-md border cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-1 ${on ? 'border-zinc-900 ring-2 ring-zinc-900 ring-offset-1' : 'border-black/15'}`}
              style={{ background: s.hex }}
            >
              {poor && (
                <span aria-hidden="true" className="absolute -top-1 -right-1 grid h-3 w-3 place-items-center rounded-full border border-white bg-amber-500 text-[8px] leading-none font-bold text-white">
                  !
                </span>
              )}
            </button>
          )
        })}
        {/* Any colour at all. */}
        <label
          className={`relative grid h-6 w-6 place-items-center overflow-hidden rounded-md border cursor-pointer ${value && !value.token ? 'border-zinc-900 ring-2 ring-zinc-900 ring-offset-1' : 'border-zinc-300'}`}
          style={{ background: value && !value.token ? value.hex : 'conic-gradient(#f43f5e, #f59e0b, #10b981, #0ea5e9, #6366f1, #d946ef, #f43f5e)' }}
          data-tip="Any colour"
        >
          <span className="sr-only">Any colour for the {label.toLowerCase()}</span>
          <input type="color" value={current ?? '#6366f1'} onChange={(e) => onChange({ hex: e.target.value })} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
        </label>
      </div>
    </div>
  )
}
