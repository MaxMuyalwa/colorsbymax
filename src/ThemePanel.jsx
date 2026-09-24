import { createContext, useContext, useEffect, useId, useMemo, useRef, useState } from 'react'
import { AlertTriangle, Check, ChevronRight, Copy, Download, ArrowLeft, Loader2, RotateCcw, ScanLine, Shuffle, Trash2, Upload, Wand2, X } from 'lucide-react'
import { normalizeHex } from './color.js'
import { checkTheme } from './contrast.js'
import { loadLibrary } from './library.js'
import { useTheme } from './ThemeProvider.jsx'
import { TOKEN_GROUPS, TOKEN_LABELS } from './tokens.js'

const SWATCH_KEYS = ['primary', 'primary-alt', 'primary-dark', 'secondary', 'background', 'ink', 'data-1', 'data-2', 'data-3', 'data-4']

const btn =
  'inline-flex items-center justify-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-800 hover:bg-zinc-50 disabled:opacity-50 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-1'
const btnPrimary =
  'inline-flex items-center justify-center gap-1.5 rounded-lg bg-zinc-900 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-zinc-700 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2'
const field =
  'w-full rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5 text-sm text-zinc-900 placeholder:text-zinc-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900'

// Lets theme cards and sections open the contrast breakdown without prop drilling.
const ContrastNav = createContext(() => {})

export default function ThemePanel({ onClose }) {
  const theme = useTheme()
  const overrideCount = Object.keys(theme.state.overrides).length
  const [view, setView] = useState('main')
  const returnFocus = useRef(null)

  const showContrast = (from) => {
    returnFocus.current = from
    setView('contrast')
  }
  useEffect(() => {
    if (view !== 'main' || !returnFocus.current) return
    // After "Fix all" the badge that opened the breakdown is gone; fall back to the active card.
    const target = returnFocus.current.isConnected
      ? returnFocus.current
      : document.querySelector('#theme-panel [data-theme-grid] button[aria-pressed="true"]')
    target?.focus()
    returnFocus.current = null
  }, [view])

  return (
    <div className="flex flex-col">
      <header className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-zinc-200 bg-white px-4 py-3">
        <div>
          <h2 id="theme-panel-title" className="text-base font-semibold tracking-tight">
            colorsbymax<span className="align-super text-[10px] font-medium">™</span>
          </h2>
          <p className="text-[11px] text-zinc-500">by mrmaxdesigns</p>
        </div>
        <button type="button" onClick={onClose} className={`${btn} border-transparent px-1.5`} aria-label="Close theme settings">
          <X className="w-4 h-4" aria-hidden="true" />
        </button>
      </header>

      {view === 'contrast' && <ContrastView onBack={() => setView('main')} />}

      {/* Kept mounted while the breakdown is open so open sections and scroll state survive. */}
      <div hidden={view !== 'main'}>
      <ContrastNav.Provider value={showContrast}>
      <Section title="Preset themes" defaultOpen>
        <PresetGrid />
      </Section>
      <Section title="Custom palettes">
        <CustomPalettes />
      </Section>
      <Section title="Override a single colour" badge={overrideCount ? `${overrideCount} active` : null}>
        <Overrides />
      </Section>
      <Section title="Import / export">
        <ImportExport />
      </Section>
      </ContrastNav.Provider>

      <footer className="border-t border-zinc-200 px-4 py-3">
        <button type="button" className={`${btn} w-full`} onClick={theme.resetToDefault}>
          <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
          Reset to default
        </button>
      </footer>
      </div>
    </div>
  )
}

function Section({ title, badge, defaultOpen = false, children }) {
  return (
    <details open={defaultOpen} className="border-b border-zinc-200">
      <summary className="flex cursor-pointer items-center gap-2 px-4 py-3 text-sm font-semibold hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-zinc-900">
        <ChevronRight className="theme-chevron w-4 h-4 text-zinc-500 transition-transform motion-reduce:transition-none" aria-hidden="true" />
        <span className="flex-1">{title}</span>
        {badge && <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-700">{badge}</span>}
      </summary>
      <div className="px-4 pb-4">{children}</div>
    </details>
  )
}

/** Full contrast breakdown for the active theme, opened from a warning badge or link. */
function ContrastView({ onBack }) {
  const { issues, fixIssue, fixAllIssues, active } = useTheme()
  const headingRef = useRef(null)
  useEffect(() => headingRef.current?.focus(), [])

  return (
    <div className="px-4 py-3 space-y-3">
      <button type="button" className={`${btn} border-transparent px-1.5`} onClick={onBack}>
        <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" /> Back
      </button>
      <h3 ref={headingRef} tabIndex={-1} className="text-sm font-semibold focus:outline-none">
        Contrast check: {active.name}
      </h3>
      <div aria-live="polite">
        {issues.length === 0 ? (
          <p className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-900">
            <Check className="w-4 h-4 shrink-0" aria-hidden="true" />
            Every colour pairing meets Web Content Accessibility Guidelines (WCAG) contrast.
          </p>
        ) : (
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-amber-950">
            <div className="flex items-center justify-between gap-2">
              <p className="flex items-center gap-2 text-xs font-semibold">
                <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" />
                {issues.length} contrast {issues.length === 1 ? 'problem' : 'problems'}
              </p>
              <button type="button" className={btnPrimary} onClick={fixAllIssues}>
                <Wand2 className="w-3.5 h-3.5" aria-hidden="true" />
                Fix all automatically
              </button>
            </div>
            <p className="mt-2 text-[11px] text-amber-900">
              Text should meet the Web Content Accessibility Guidelines (WCAG) minimum of 4.5:1 (3:1 for large headlines and icons).
              Fixing adjusts only the lightness of the colour involved.
            </p>
            <ul className="mt-2 space-y-1.5">
              {issues.map((issue) => (
                <li key={issue.pairing.id} className="flex items-start justify-between gap-2 text-xs">
                  <span>{issue.message}</span>
                  <button
                    type="button"
                    className={`${btn} shrink-0 px-2 py-1`}
                    onClick={() => fixIssue(issue)}
                    aria-label={`Fix automatically: ${issue.pairing.label}`}
                  >
                    Fix
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}

/** Small entry point to the breakdown, shown in the editing sections only when needed. */
function IssuesLink() {
  const { issues } = useTheme()
  const showContrast = useContext(ContrastNav)
  if (!issues.length) return null
  return (
    <button
      type="button"
      onClick={(e) => showContrast(e.currentTarget)}
      className="flex items-center gap-1.5 text-xs font-medium text-amber-800 underline underline-offset-2 hover:text-amber-950 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 rounded"
    >
      <AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" />
      {issues.length} contrast {issues.length === 1 ? 'problem' : 'problems'} in the current colours. Review
    </button>
  )
}

function Swatches({ tokens }) {
  return (
    <div className="flex overflow-hidden rounded-md border border-zinc-200" aria-hidden="true">
      {SWATCH_KEYS.map((key) => (
        <span key={key} className="h-5 flex-1" style={{ background: tokens[key] }} />
      ))}
    </div>
  )
}

const PAGE_SIZE = 24

function PresetGrid() {
  const { siteName, siteThemes, presets, customs, active, selectTheme, state, clearOverrides } = useTheme()
  const [library, setLibrary] = useState(null)
  const [loadError, setLoadError] = useState(false)
  const [category, setCategory] = useState('site')
  const [query, setQuery] = useState('')
  const [limit, setLimit] = useState(PAGE_SIZE)
  const searchId = useId()
  const overrideCount = Object.keys(state.overrides).length

  useEffect(() => {
    loadLibrary().then(setLibrary, () => setLoadError(true))
  }, [])

  const chips = [
    { id: 'site', label: siteName, count: siteThemes.length, description: `${siteName}'s own colours and themes made for it` },
    { id: 'picks', label: 'Picks', count: presets.length, description: 'Hand-tuned colorsbymax themes that pass every contrast check' },
    ...(customs.length ? [{ id: 'yours', label: 'Yours', count: customs.length, description: 'Palettes you created or imported' }] : []),
    { id: 'all', label: 'All', count: library ? library.themes.length : null, description: 'Every library theme' },
    ...(library?.categories ?? []).filter((c) => c.count),
  ]

  const q = query.trim().toLowerCase()
  const visible = useMemo(() => {
    let list
    if (q) list = [...siteThemes, ...presets, ...customs, ...(library?.themes ?? [])]
    else if (category === 'site') list = siteThemes
    else if (category === 'picks') list = presets
    else if (category === 'yours') list = customs
    else if (category === 'all') list = library?.themes ?? []
    else list = (library?.themes ?? []).filter((t) => t.tags.includes(category))
    if (q) {
      const labels = Object.fromEntries((library?.categories ?? []).map((c) => [c.id, c.label.toLowerCase()]))
      list = list.filter((t) => t.name.toLowerCase().includes(q) || t.tags?.some((tag) => labels[tag]?.includes(q)))
    }
    return list
  }, [q, category, siteThemes, presets, customs, library])

  const shown = visible.slice(0, limit)
  const needsLibrary = Boolean(q) || !['site', 'picks', 'yours'].includes(category)
  const catInfo = library?.categories.find((c) => c.id === category)

  const pick = (t) => selectTheme(t.id, t)
  const surprise = () => {
    const pool = visible.length ? visible : (library?.themes ?? presets)
    pick(pool[Math.floor(Math.random() * pool.length)])
  }

  return (
    <div className="space-y-3">
      <ScanCard
        onScanned={() => {
          setCategory('site')
          setQuery('')
          setLimit(PAGE_SIZE)
        }}
      />
      <p className="text-xs text-zinc-600">
        Current theme: <strong className="font-semibold text-zinc-900">{active.name}</strong>
      </p>
      {overrideCount > 0 && (
        <p className="flex items-center justify-between gap-2 rounded-lg bg-zinc-100 px-3 py-2 text-xs text-zinc-700">
          {overrideCount} single-colour override{overrideCount > 1 ? 's are' : ' is'} applied on top of any theme.
          <button type="button" className={btn} onClick={clearOverrides}>Clear</button>
        </p>
      )}

      <div className="flex gap-2">
        <label htmlFor={searchId} className="sr-only">Search themes</label>
        <input
          id={searchId}
          type="search"
          className={field}
          placeholder={library ? `Search ${library.themes.length + presets.length + siteThemes.length} themes…` : 'Search themes…'}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setLimit(PAGE_SIZE)
          }}
        />
        <button type="button" className={`${btn} shrink-0`} onClick={surprise} disabled={!library && needsLibrary}>
          <Shuffle className="w-3.5 h-3.5" aria-hidden="true" /> Surprise me
        </button>
      </div>

      <div role="group" aria-label="Theme categories" className="grid grid-cols-2 min-[400px]:grid-cols-3 gap-2">
        {chips.map((c) => {
          const on = !q && category === c.id
          return (
            <button
              key={c.id}
              type="button"
              aria-pressed={on}
              title={c.description}
              onClick={() => {
                setCategory(c.id)
                setQuery('')
                setLimit(PAGE_SIZE)
              }}
              className={`flex h-8 min-w-0 items-center gap-1 rounded-lg border px-2 text-xs font-medium cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-1 ${
                on ? 'border-zinc-900 bg-zinc-900 text-white' : 'border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-50'
              }`}
            >
              {on && <Check className="w-3 h-3 shrink-0" aria-hidden="true" />}
              <span className="truncate">{c.label}</span>
              {c.count != null && <span className={`ml-auto pl-1 tabular-nums ${on ? 'text-zinc-300' : 'text-zinc-500'}`}>{c.count}</span>}
            </button>
          )
        })}
      </div>

      {!q && <p className="text-xs text-zinc-600">{(catInfo ?? chips.find((c) => c.id === category))?.description}</p>}

      {needsLibrary && !library ? (
        <p className="py-6 text-center text-xs text-zinc-600" role="status">
          {loadError ? 'Couldn’t load the theme library. Check your connection and reopen the panel.' : 'Loading themes…'}
        </p>
      ) : visible.length === 0 ? (
        <p className="py-6 text-center text-xs text-zinc-600" role="status">No themes match “{query}”.</p>
      ) : (
        <>
          <p className="sr-only" role="status">{visible.length} themes</p>
          <div data-theme-grid className="grid grid-cols-2 gap-2">
            {shown.map((t) => (
              <ThemeCard key={t.id} theme={t} isActive={t.id === active.id} onSelect={() => pick(t)} />
            ))}
          </div>
          {visible.length > limit && (
            <button type="button" className={`${btn} w-full`} onClick={() => setLimit((n) => n + PAGE_SIZE)}>
              Show more ({visible.length - limit} left)
            </button>
          )}
        </>
      )}

      {library && (
        <p className="text-[11px] text-zinc-500">Library palettes: community favourites via nice-color-palettes (MIT), adjusted to pass contrast.</p>
      )}
    </div>
  )
}

/** User-triggered site scan: reads the page's colours and adds themes built around them. */
function ScanCard({ onScanned }) {
  const { siteName, scanned, runScan, clearScan } = useTheme()
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState(null)

  const scan = async () => {
    setBusy(true)
    setMessage(null)
    try {
      const { colours, themes } = await runScan()
      setMessage(`Found ${colours} colours and added ${themes} themes to ${siteName}.`)
      onScanned()
    } catch {
      setMessage('Couldn’t scan this page. Try again after it has finished loading.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-zinc-900">
            {scanned ? `Personalised for ${siteName}` : `Personalise for ${siteName}`}
          </p>
          <p className="mt-0.5 text-[11px] text-zinc-600">
            {scanned
              ? 'Themes built from this site’s colours are in its group below.'
              : 'Scan this page’s colours to get themes built around them.'}
          </p>
        </div>
        <button type="button" className={`${scanned ? btn : btnPrimary} shrink-0`} onClick={scan} disabled={busy} aria-busy={busy}>
          {busy ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin motion-reduce:animate-none" aria-hidden="true" />
          ) : (
            <ScanLine className="w-3.5 h-3.5" aria-hidden="true" />
          )}
          {busy ? 'Scanning…' : scanned ? 'Rescan' : 'Scan site'}
        </button>
      </div>
      {scanned?.palette.length > 0 && (
        <div className="mt-2.5 flex items-center gap-2">
          <span className="text-[11px] text-zinc-600">Detected</span>
          <div className="flex overflow-hidden rounded-md border border-zinc-200" aria-hidden="true">
            {scanned.palette.map((hex) => (
              <span key={hex} className="h-4 w-5" style={{ background: hex }} title={hex} />
            ))}
          </div>
          <button type="button" className="ml-auto text-[11px] font-medium text-zinc-600 underline underline-offset-2 hover:text-zinc-900 cursor-pointer" onClick={clearScan}>
            Remove scan
          </button>
        </div>
      )}
      <p className="sr-only" role="status" aria-live="polite">{message}</p>
      {message && <p className="mt-2 text-[11px] text-zinc-700">{message}</p>}
    </div>
  )
}

function ThemeCard({ theme: t, isActive, onSelect }) {
  const { issues } = useTheme()
  const showContrast = useContext(ContrastNav)
  // The active card reflects live edits and overrides. Library themes are contrast-checked at
  // build time, so only presets and custom palettes can fail.
  const stored = useMemo(() => (t.library ? 0 : checkTheme(t.tokens).length), [t])
  const count = isActive ? issues.length : stored

  return (
    <div className="relative">
      <button
        type="button"
        aria-pressed={isActive}
        onClick={onSelect}
        className={`flex w-full flex-col gap-2 rounded-xl border p-2.5 text-left cursor-pointer hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 ${
          isActive ? 'border-zinc-900 ring-1 ring-zinc-900' : 'border-zinc-200'
        } ${count ? 'pr-12' : ''}`}
      >
        <span className="truncate text-sm font-medium">{t.name}</span>
        <Swatches tokens={t.tokens} />
        {(isActive || t.custom || t.scanned) && (
          <span className="flex items-center gap-1.5 text-[11px]">
            {isActive && (
              <span className="flex items-center gap-0.5 font-semibold text-zinc-900">
                <Check className="w-3.5 h-3.5" aria-hidden="true" /> Active
              </span>
            )}
            {t.custom && <span className="rounded bg-zinc-100 px-1 font-medium text-zinc-700">Custom</span>}
            {t.scanned && (
              <span className="rounded bg-sky-50 px-1 font-medium text-sky-900">{t.match ? 'Library match' : 'From scan'}</span>
            )}
          </span>
        )}
      </button>
      {count > 0 && (
        <button
          type="button"
          onClick={(e) => {
            if (!isActive) onSelect()
            showContrast(e.currentTarget)
          }}
          aria-label={`${t.name} has ${count} contrast ${count === 1 ? 'problem' : 'problems'}. Review and fix`}
          title="Contrast problems: review and fix"
          className="absolute right-1.5 top-1.5 inline-flex items-center gap-0.5 rounded-full border border-amber-300 bg-amber-100 px-1.5 py-0.5 text-[11px] font-semibold text-amber-900 hover:bg-amber-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900"
        >
          <AlertTriangle className="w-3 h-3" aria-hidden="true" />
          {count}
        </button>
      )}
    </div>
  )
}

function CustomPalettes() {
  const { customs, active, createCustom, renameCustom, deleteCustom, selectTheme, updateCustomToken, state } = useTheme()
  const [name, setName] = useState('')
  const nameId = useId()
  const activeCustom = customs.find((c) => c.id === active.id)

  return (
    <div className="space-y-4">
      <IssuesLink />
      <form
        className="space-y-1.5"
        onSubmit={(e) => {
          e.preventDefault()
          createCustom(name)
          setName('')
        }}
      >
        <label htmlFor={nameId} className="block text-xs font-medium text-zinc-700">
          New palette name
        </label>
        <div className="flex gap-2">
          <input id={nameId} className={field} value={name} onChange={(e) => setName(e.target.value)} placeholder="My palette" maxLength={60} />
          <button type="submit" className={`${btnPrimary} shrink-0`}>Create</button>
        </div>
        <p className="text-[11px] text-zinc-600">Starts from the colours you see now. Edits apply live and save automatically.</p>
      </form>

      {customs.length > 0 && (
        <ul className="space-y-2">
          {customs.map((c) => (
            <li key={c.id} className="flex items-center gap-2">
              <input
                className={field}
                value={c.name}
                aria-label={`Rename palette ${c.name}`}
                onChange={(e) => renameCustom(c.id, e.target.value)}
                onBlur={(e) => !e.target.value.trim() && renameCustom(c.id, 'Untitled palette')}
                maxLength={60}
              />
              {c.id === active.id ? (
                <span className="flex w-16 shrink-0 items-center justify-center gap-0.5 text-[11px] font-semibold">
                  <Check className="w-3.5 h-3.5" aria-hidden="true" /> Editing
                </span>
              ) : (
                <button type="button" className={`${btn} w-16 shrink-0`} onClick={() => selectTheme(c.id)}>
                  Edit
                </button>
              )}
              <button
                type="button"
                className={`${btn} shrink-0 px-2`}
                aria-label={`Delete palette ${c.name}`}
                onClick={() => window.confirm(`Delete “${c.name}”?`) && deleteCustom(c.id)}
              >
                <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {activeCustom ? (
        <div className="space-y-2">
          <h3 className="text-xs font-semibold text-zinc-800">Editing “{activeCustom.name}”</h3>
          <TokenEditor
            values={activeCustom.tokens}
            onChange={(key, value) => updateCustomToken(activeCustom.id, key, value)}
            note={(key) => (key in state.overrides ? 'Hidden by an override' : null)}
          />
        </div>
      ) : (
        <p className="text-xs text-zinc-600">Create a palette, or choose Edit on a saved one, to change its colours.</p>
      )}
    </div>
  )
}

function Overrides() {
  const { tokens, state, setOverride, clearOverride, clearOverrides, active } = useTheme()
  const overridden = state.overrides
  return (
    <div className="space-y-3">
      <IssuesLink />
      <p className="text-xs text-zinc-600">
        Change individual colours on top of <strong className="font-semibold text-zinc-800">{active.name}</strong>. Overrides stay when you switch themes.
      </p>
      {Object.keys(overridden).length > 0 && (
        <div className="rounded-lg bg-zinc-100 p-2.5 text-xs">
          <p className="font-medium text-zinc-800">Overridden: {Object.keys(overridden).map((k) => TOKEN_LABELS[k]).join(', ')}</p>
          <button type="button" className={`${btn} mt-2`} onClick={clearOverrides}>
            <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" /> Reset all overrides
          </button>
        </div>
      )}
      <TokenEditor values={tokens} onChange={setOverride} overridden={overridden} onReset={clearOverride} />
    </div>
  )
}

/** Picker + hex input for every token, grouped. Rows involved in a failing pairing get a warning. */
function TokenEditor({ values, onChange, overridden = {}, onReset, note }) {
  const { issues } = useTheme()
  const failing = useMemo(() => new Set(issues.flatMap((i) => i.pairing.fixable)), [issues])
  return (
    <div className="space-y-3">
      {TOKEN_GROUPS.map((g) => (
        <fieldset key={g.group} className="space-y-1.5">
          <legend className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-600">{g.group}</legend>
          {g.tokens.map((t) => (
            <TokenRow
              key={t.key}
              token={t}
              value={values[t.key]}
              onChange={(v) => onChange(t.key, v)}
              isOverridden={t.key in overridden}
              onReset={onReset && (() => onReset(t.key))}
              warn={failing.has(t.key)}
              note={note?.(t.key)}
            />
          ))}
        </fieldset>
      ))}
    </div>
  )
}

function TokenRow({ token, value, onChange, isOverridden, onReset, warn, note }) {
  const { usage } = useTheme()
  const id = useId()
  const [draft, setDraft] = useState(value)
  const focused = useRef(false)
  useEffect(() => {
    if (!focused.current) setDraft(value)
  }, [value])

  const commit = (text) => {
    setDraft(text)
    const hex = normalizeHex(text)
    if (hex && /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.test(text.trim())) onChange(hex)
  }
  const invalid = !normalizeHex(draft)

  return (
    <div className={`flex items-center gap-2 rounded-lg px-1.5 py-1 ${isOverridden ? 'bg-sky-50' : ''}`}>
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={`${token.label} colour picker`}
        className="h-7 w-9 shrink-0 cursor-pointer rounded border border-zinc-300 bg-white p-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900"
      />
      <div className="min-w-0 flex-1">
        <label htmlFor={id} className="flex items-center gap-1 text-xs font-medium text-zinc-900">
          <span className="truncate">{token.label}</span>
          {warn && (
            <span className="flex items-center text-amber-700" title="Part of a failing contrast pairing">
              <AlertTriangle className="w-3 h-3" aria-hidden="true" />
              <span className="sr-only">(contrast problem)</span>
            </span>
          )}
          {isOverridden && <span className="rounded bg-sky-100 px-1 text-[10px] font-semibold text-sky-900">Overridden</span>}
        </label>
        <p className="truncate text-[11px] text-zinc-600">{note ?? usage[token.key] ?? token.usage}</p>
      </div>
      <input
        id={id}
        value={draft}
        onChange={(e) => commit(e.target.value)}
        onFocus={() => (focused.current = true)}
        onBlur={() => {
          focused.current = false
          setDraft(value)
        }}
        spellCheck={false}
        aria-invalid={invalid}
        className={`w-[5.5rem] shrink-0 rounded-md border px-2 py-1 font-mono text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 ${
          invalid ? 'border-red-600' : 'border-zinc-300'
        }`}
      />
      {onReset && (
        <button
          type="button"
          onClick={onReset}
          disabled={!isOverridden}
          aria-label={`Reset ${token.label} override`}
          className={`${btn} shrink-0 px-1.5 ${isOverridden ? '' : 'invisible'}`}
        >
          <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
        </button>
      )}
    </div>
  )
}

function ImportExport() {
  const { exportTheme, importTheme } = useTheme()
  const json = exportTheme()
  const [status, setStatus] = useState(null)
  const [input, setInput] = useState('')
  const exportId = useId()
  const importId = useId()
  const fileRef = useRef(null)

  const doImport = (text) => {
    const err = importTheme(text)
    setStatus(err ? { ok: false, text: err } : { ok: true, text: 'Imported and applied as a new custom palette.' })
    if (!err) setInput('')
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <label htmlFor={exportId} className="block text-xs font-medium text-zinc-700">Current theme as JSON</label>
        <textarea id={exportId} readOnly value={json} rows={5} className={`${field} font-mono text-[11px]`} />
        <div className="flex gap-2">
          <button
            type="button"
            className={btn}
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(json)
                setStatus({ ok: true, text: 'Copied to clipboard.' })
              } catch {
                setStatus({ ok: false, text: 'Couldn’t access the clipboard; select the text and copy it instead.' })
              }
            }}
          >
            <Copy className="w-3.5 h-3.5" aria-hidden="true" /> Copy
          </button>
          <button
            type="button"
            className={btn}
            onClick={() => {
              const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }))
              const a = document.createElement('a')
              a.href = url
              a.download = `${JSON.parse(json).name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.theme.json`
              a.click()
              URL.revokeObjectURL(url)
            }}
          >
            <Download className="w-3.5 h-3.5" aria-hidden="true" /> Download
          </button>
        </div>
      </div>

      <div className="space-y-1.5">
        <label htmlFor={importId} className="block text-xs font-medium text-zinc-700">Paste a theme JSON to import</label>
        <textarea
          id={importId}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          rows={4}
          placeholder='{ "name": "My theme", "tokens": { "primary": "#7fd4f5" } }'
          className={`${field} font-mono text-[11px]`}
        />
        <div className="flex gap-2">
          <button type="button" className={btnPrimary} disabled={!input.trim()} onClick={() => doImport(input)}>
            Import
          </button>
          <button type="button" className={btn} onClick={() => fileRef.current?.click()}>
            <Upload className="w-3.5 h-3.5" aria-hidden="true" /> From file…
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="sr-only"
            tabIndex={-1}
            aria-hidden="true"
            onChange={async (e) => {
              const file = e.target.files?.[0]
              if (file) doImport(await file.text())
              e.target.value = ''
            }}
          />
        </div>
      </div>

      {status && (
        <p role="status" className={`text-xs ${status.ok ? 'text-emerald-800' : 'text-red-700'}`}>
          {status.text}
        </p>
      )}
    </div>
  )
}
