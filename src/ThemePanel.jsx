import { createContext, useCallback, useContext, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, Check, CheckCircle2, ChevronRight, ClipboardPaste, Copy, Download, ArrowLeft, Globe, ImageUp, Loader2, Monitor, Moon, MousePointerClick, Palette, RotateCcw, ScanLine, ScanSearch, Settings, Shuffle, Paintbrush, Sun, ToggleRight, Trash2, Upload, UserRound, Wand2, X, LibraryBig, Contrast, Minus, Plus } from './icons.jsx'
import { normalizeHex } from './color.js'
import { checkTheme } from './contrast.js'
import { coloursFromFile, themeFromPalette } from './extract.js'
import { BRING_BACK_PROMPT, cssSnippet, keepPrompt, keepSnippet, NODE_PROD, removePrompt, VITE_PROD } from './finish.js'
import { TOGGLE_CSS, TOGGLE_HTML, TOGGLE_PROMPT, TOGGLE_REACT, isPreviewing, previewToggle, removePreview } from './modeToggle.js'
import { LogoMark } from './logoMark.jsx'
import { Burst, useBurst } from './burst.jsx'
import { colourMatcher, suggestWords } from './colourWords.js'
import { MAX_COLOURS, MIN_COLOURS, paletteKeys } from './palette.js'

// The dark panel's background (--color-white in panel.css's dark palette), for the logo mark.
const PANEL_DARK = '#18181b'
import { loadLibrary } from './library.js'
import { inMode } from './modes.js'
import { PANEL_PRESETS, useSettings } from './settings.js'
import { linkedPages, normalPath, pageMatches, pagesPrompt, pagesSnippet } from './scope.js'
import { PROPS, pageOf, paintsCssExport, paintsPrompt } from './studio.js'
import { useTheme } from './ThemeProvider.jsx'
import { TOKEN_GROUPS, TOKEN_LABELS } from './tokens.js'


const btn =
  'inline-flex items-center justify-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-800 hover:bg-zinc-50 disabled:opacity-50 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-1'
const btnPrimary =
  'inline-flex items-center justify-center gap-1.5 rounded-lg bg-zinc-900 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-zinc-700 disabled:opacity-50 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2'
const field =
  'w-full rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5 text-sm text-zinc-900 placeholder:text-zinc-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900'

// Lets theme cards and sections open the contrast breakdown without prop drilling.
const ContrastNav = createContext(() => {})

/**
 * Panel-wide helpers: `toast(text, action?)` confirms something happened, and
 * `showGroup(id)` jumps to a theme group (e.g. "yours" after saving a palette).
 */
const PanelContext = createContext({ toast: () => {}, showGroup: () => {}, reveal: null, confirmTheme: (run) => run() })
const usePanel = () => useContext(PanelContext)

/** How long a toast stays up, unless hovered or focused. */
const TOAST_MS = 5000
let toastSeq = 0

/** Toast for a palette that just landed in Yours, with a way to go and see it. */
function useSavedToYours() {
  const { toast, showGroup } = usePanel()
  const phrase = { Saved: 'Saved “%” to Yours', Created: 'Created “%” in Yours', Imported: 'Imported “%” into Yours' }
  return (name, verb = 'Saved') => {
    showGroup('yours', false)
    toast(`${phrase[verb].replace('%', () => name)} and applied it.`, { label: 'Show', run: () => showGroup('yours') })
  }
}

/**
 * The panel's contents. It stays mounted while the panel is closed (see ThemeSwitcher), so closing
 * it is like minimising: the chosen group or mood, a search, open sections and the view all stay.
 * `open` brings the scroll position back, since a hidden panel can't keep its own.
 */
export default function ThemePanel({ open = true }) {
  const theme = useTheme()
  const { settings, mode, audit, update } = useSettings()
  const overrideCount = Object.keys(theme.state.overrides).length
  const [view, setView] = useState('main')
  const returnFocus = useRef(null)
  const rootRef = useRef(null)
  const [toasts, setToasts] = useState([])
  const [reveal, setReveal] = useState(null)
  const scrollTop = useRef(0)
  useLayoutEffect(() => {
    const el = rootRef.current
    if (open && el) el.scrollTop = scrollTop.current
  }, [open])

  // At most three toasts at once; the newest goes at the bottom.
  const toast = useCallback((text, action) => setToasts((list) => [...list.slice(-2), { id: ++toastSeq, text, action }]), [])
  const dismiss = useCallback((id) => setToasts((list) => list.filter((t) => t.id !== id)), [])
  const showGroup = useCallback((group, scroll = true) => {
    setView('main')
    setReveal({ group, scroll, at: Date.now() })
  }, [])
  // Picking another theme with Studio changes on the page asks first: keep them on the new theme,
  // or clear them. "Don't ask again" lasts until the page is reloaded.
  const [themeAsk, setThemeAsk] = useState(null)
  const askedRef = useRef(false)
  const paintCount = theme.paints.length
  const confirmTheme = useCallback(
    (run) => {
      if (!paintCount || askedRef.current) return run()
      setView('main')
      setThemeAsk({ run })
    },
    [paintCount],
  )
  const panelApi = useMemo(() => ({ toast, showGroup, reveal, confirmTheme }), [toast, showGroup, reveal, confirmTheme])

  const showView = (next, from) => {
    returnFocus.current = from
    setView(next)
  }
  useEffect(() => {
    if (view !== 'main' || !returnFocus.current) return
    // After "Fix all" the badge that opened the breakdown is gone; fall back to the active card.
    const target = returnFocus.current.isConnected
      ? returnFocus.current
      : rootRef.current?.querySelector('[data-theme-grid] button[aria-pressed="true"]')
    target?.focus()
    returnFocus.current = null
  }, [view])

  const resetToDefault = () =>
    confirmTheme(() => {
      theme.resetToDefault()
      // In dark mode, "default" is the dark version of the site's own colours.
      const target = inMode(theme.defaultTheme, mode)
      if (mode === 'dark') theme.selectTheme(target.id, target)
      toast(`Back to ${target.name}, with no overrides.`)
    })

  return (
    <PanelContext.Provider value={panelApi}>
    {/* The panel scrolls inside the dialog, so toasts can sit fixed at its bottom edge. */}
    <div
      ref={rootRef}
      onScroll={(e) => {
        // Only while showing: hiding the panel resets a scroll box to the top.
        if (open) scrollTop.current = e.currentTarget.scrollTop
      }}
      className="theme-scroll @container flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain rounded-[inherit]"
    >
      {/* The title never shrinks under the tools: on a narrow panel (a phone) the logo and title sit
          centred on top, and the tools get their own centred row below, with room to breathe. */}
      <header className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-x-3 gap-y-3.5 border-b border-zinc-200 bg-white px-4 py-3">
        <div className="flex w-full shrink-0 items-center justify-center gap-2 @min-[520px]:w-auto @min-[520px]:justify-start">
          {/* The mrmaxdesigns mark, in this theme's colours, on the panel's own background. */}
          <LogoMark tokens={theme.tokens} background={mode === 'dark' ? PANEL_DARK : '#ffffff'} className="h-7 w-auto shrink-0" />
          <div>
            <h2 id="theme-panel-title" className="text-base font-semibold tracking-tight">
              colorsbymax
            </h2>
            <p className="text-[11px] text-zinc-500">by mrmaxdesigns</p>
          </div>
        </div>
        <div className="flex w-full items-center justify-center gap-1 @min-[520px]:ml-auto @min-[520px]:w-auto">
        {/* Light, dark or the device's mode, one click away (it's also in settings). */}
        <div role="radiogroup" aria-label="Theme mode" className="flex items-center rounded-lg border border-zinc-200 p-0.5">
          {MODES.map(({ id, label, Icon }) => {
            const on = settings.mode === id
            return (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={on}
                aria-label={label}
                data-tip={id === 'system' ? 'Auto: follow this device' : label}
                onClick={() => update({ mode: id })}
                className={`grid h-7 w-7 place-items-center rounded-md cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 ${
                  on ? 'bg-zinc-900 text-white' : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'
                }`}
              >
                <Icon className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            )
          })}
        </div>
        {theme.features.studio && (
        <button
          type="button"
          onClick={(e) => (view === 'studio' ? setView('main') : showView('studio', e.currentTarget))}
          className={`${btn} shrink-0 whitespace-nowrap px-2 ${view === 'studio' ? 'border-zinc-900 bg-zinc-100' : 'border-transparent'}`}
          aria-pressed={view === 'studio'}
          aria-label="Studio"
          data-tip="Studio: go deeper and choose exactly where your colours go"
        >
          <StudioMark className="w-4 h-4" />
          Studio
        </button>
        )}
        {theme.features.addToSite && (
        <button
          type="button"
          onClick={(e) => (view === 'mode-toggle' ? setView('main') : showView('mode-toggle', e.currentTarget))}
          className={`${btn} shrink-0 whitespace-nowrap px-1.5 @min-[500px]:px-2 ${view === 'mode-toggle' ? 'border-zinc-900 bg-zinc-100' : 'border-transparent'}`}
          aria-pressed={view === 'mode-toggle'}
          aria-label="Add a light and dark switch to your site"
          data-tip="Add a light and dark switch to your site"
        >
          <ToggleRight className="w-4 h-4" aria-hidden="true" />
          <span className="hidden @min-[500px]:inline">Add to site</span>
        </button>
        )}
        {theme.features.audit && (
        <button
          type="button"
          onClick={audit.toggle}
          className={`${btn} px-2 ${audit.on ? 'border-zinc-900 bg-zinc-100' : 'border-transparent'}`}
          aria-pressed={audit.on}
          data-tip="Audit the page: point out what won’t look right with these colours"
        >
          <ScanSearch className="w-4 h-4" aria-hidden="true" />
          Audit
        </button>
        )}
        <button
          type="button"
          onClick={(e) => (view === 'settings' ? setView('main') : showView('settings', e.currentTarget))}
          className={`${btn} px-1.5 ${view === 'settings' ? 'border-zinc-900 bg-zinc-100' : 'border-transparent'}`}
          aria-label="Panel settings"
          aria-pressed={view === 'settings'}
          data-tip="Panel settings"
        >
          <Settings className="w-4 h-4" aria-hidden="true" />
        </button>
        </div>
      </header>

      {view === 'contrast' && <ContrastView onBack={() => setView('main')} />}
      {view === 'settings' && <SettingsView onBack={() => setView('main')} />}
      {view === 'finish' && <FinishView onBack={() => setView('main')} />}
      {view === 'mode-toggle' && <ModeToggleView onBack={() => setView('main')} />}
      {view === 'studio' && <StudioView onBack={() => setView('main')} />}

      {/* Kept mounted while another view is open so open sections and scroll state survive. */}
      <div hidden={view !== 'main'}>
      {!theme.inScope && (
        <div className="mx-4 mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          <p>
            <strong className="font-semibold">This page keeps its own colours.</strong> The theme only goes on{' '}
            {theme.scope.pages.length === 1 ? 'one page' : `${theme.scope.pages.length} pages`} of your site.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" className={btnPrimary} onClick={() => theme.setScope({ mode: 'pages', pages: [...theme.scope.pages, theme.pathname] })}>
              Colour this page too
            </button>
            {theme.features.studio && (
              <button type="button" className={btn} onClick={(e) => showView('studio', e.currentTarget)}>
                <StudioMark className="w-3.5 h-3.5" /> Open Studio
              </button>
            )}
          </div>
        </div>
      )}
      <ContrastNav.Provider value={(from) => showView('contrast', from)}>
      {/* Every section starts folded, so a first look isn't overwhelming; each opens with a tap. */}
      {(theme.features.colourStyle || theme.features.scan) && (
        <Section title={theme.features.colourStyle ? 'Colour style' : 'Scan site'} badge={theme.features.colourStyle ? COLOUR_STYLES.find((c) => c.id === settings.colourStyle)?.label : null}>
          <StyleAndScan />
        </Section>
      )}
      <Section title="Preset themes" badge={theme.active.name} wideBadge>
        <PresetGrid />
      </Section>
      {settings.showCustom && (
        <Section title="Custom palettes">
          <CustomPalettes />
        </Section>
      )}
      {settings.showOverrides && (
        <Section title="Override a single colour" badge={overrideCount ? `${overrideCount} active` : null}>
          <Overrides />
        </Section>
      )}
      {settings.showImportExport && (
        <Section title="Import / export">
          <ImportExport />
        </Section>
      )}
      </ContrastNav.Provider>

      <footer className="border-t border-zinc-200 px-4 py-3">
        <div className="flex gap-2">
          <button type="button" className={`${btn} flex-1`} onClick={resetToDefault}>
            <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
            Reset to default
          </button>
          <button type="button" className={`${btnPrimary} flex-1`} onClick={(e) => showView('finish', e.currentTarget)}>
            <Check className="w-3.5 h-3.5" aria-hidden="true" />
            I’m done
          </button>
        </div>
      </footer>
      </div>
    </div>
    <Toasts items={toasts} onDismiss={dismiss} />
    {themeAsk && (
      <StudioChangesAsk
        count={paintCount}
        onKeep={(always) => {
          askedRef.current = always
          themeAsk.run()
          setThemeAsk(null)
          toast(`Kept your ${paintCount} Studio ${paintCount === 1 ? 'change' : 'changes'}. Theme colours in them follow the new theme.`)
        }}
        onClear={(always) => {
          askedRef.current = always
          theme.clearPaints()
          themeAsk.run()
          setThemeAsk(null)
          toast('Cleared your Studio changes. The new theme shows as it is.')
        }}
        onCancel={() => setThemeAsk(null)}
      />
    )}
    </PanelContext.Provider>
  )
}

/**
 * Asked before another theme replaces the one Studio changes were made on: keep them (their theme
 * colours follow the new theme; colours picked by hand stay as they are) or clear them.
 */
function StudioChangesAsk({ count, onKeep, onClear, onCancel }) {
  const [always, setAlways] = useState(false)
  const headingId = useId()
  const ref = useRef(null)
  useEffect(() => ref.current?.querySelector('button')?.focus(), [])
  return (
    <div className="absolute inset-0 z-30 grid place-items-center rounded-[inherit] bg-zinc-900/40 p-4" onKeyDown={(e) => e.key === 'Escape' && (e.stopPropagation(), onCancel())}>
      <div ref={ref} role="alertdialog" aria-modal="true" aria-labelledby={headingId} className="w-full max-w-[320px] space-y-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-2xl">
        <div className="flex items-center gap-2">
          <StudioMark className="h-6 w-6" />
          <h3 id={headingId} className="text-sm font-semibold text-zinc-900">
            You have {count} Studio {count === 1 ? 'change' : 'changes'}
          </h3>
        </div>
        <p className="text-xs leading-snug text-zinc-600">
          Keep them on the new theme, or clear them and see the theme as it is? Kept changes that use theme colours take the new theme’s colours; ones you
          picked by hand stay exactly as they are.
        </p>
        <div className="grid gap-2">
          <button type="button" className={`${btnPrimary} py-2`} onClick={() => onKeep(always)}>
            Keep my changes
          </button>
          <button type="button" className={`${btn} py-2`} onClick={() => onClear(always)}>
            Clear them and use the theme
          </button>
          <button type="button" className={`${btn} border-transparent py-1.5`} onClick={onCancel}>
            Cancel
          </button>
        </div>
        <label className="flex items-center gap-2 text-[11px] text-zinc-700">
          <input type="checkbox" checked={always} onChange={(e) => setAlways(e.target.checked)} className="h-3.5 w-3.5 accent-zinc-900" />
          Don’t ask again until I reload the page
        </label>
      </div>
    </div>
  )
}

function Toasts({ items, onDismiss }) {
  return (
    <div role="status" aria-live="polite" className="pointer-events-none absolute inset-x-3 bottom-3 z-20 flex flex-col gap-2">
      {items.map((t) => (
        <Toast key={t.id} toast={t} onDismiss={onDismiss} />
      ))}
    </div>
  )
}

function Toast({ toast, onDismiss }) {
  const [paused, setPaused] = useState(false)
  useEffect(() => {
    if (paused) return
    const timer = setTimeout(() => onDismiss(toast.id), TOAST_MS)
    return () => clearTimeout(timer)
  }, [paused, toast.id, onDismiss])

  return (
    <div
      onPointerEnter={() => setPaused(true)}
      onPointerLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      className="theme-toast pointer-events-auto flex items-start gap-2 rounded-xl bg-zinc-900 px-3 py-2.5 text-xs text-white shadow-xl"
    >
      <CheckCircle2 className="mt-px w-4 h-4 shrink-0" aria-hidden="true" />
      <p className="min-w-0 flex-1 leading-snug">{toast.text}</p>
      {toast.action && (
        <button
          type="button"
          onClick={() => {
            toast.action.run()
            onDismiss(toast.id)
          }}
          className="shrink-0 rounded font-semibold underline underline-offset-2 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
        >
          {toast.action.label}
        </button>
      )}
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        aria-label="Dismiss"
        className="-mr-1 shrink-0 rounded opacity-70 hover:opacity-100 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
      >
        <X className="w-3.5 h-3.5" aria-hidden="true" />
      </button>
    </div>
  )
}

// ---------------------------------------------------------------- finishing

/**
 * "Add to site": a light and dark switch for the site itself. Every theme has a dark version, so any
 * site can switch; this shows the switch, previews it in the page's top bar, and gives the code and
 * an AI-editor prompt to add it for good.
 */
function ModeToggleView({ onBack }) {
  const { settings, update } = useSettings()
  const { toast } = usePanel()
  const headingRef = useRef(null)
  const [previewing, setPreviewing] = useState(isPreviewing)
  const [tab, setTab] = useState('html')
  useEffect(() => headingRef.current?.focus(), [])

  const preview = () => {
    const where = previewToggle()
    setPreviewing(true)
    toast(where === 'nav' ? 'The switch is in your top bar. Try it; it’s gone when you reload.' : 'No top bar found, so the switch is in the top-left corner. It’s gone when you reload.')
  }
  const stop = () => {
    removePreview()
    setPreviewing(false)
  }

  return (
    <div className="px-4 py-3 space-y-4">
      <button type="button" className={`${btn} border-transparent px-1.5`} onClick={onBack}>
        <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" /> Back
      </button>
      <h3 ref={headingRef} tabIndex={-1} className="text-sm font-semibold focus:outline-none">
        Add a light and dark switch to your site
      </h3>
      <p className="text-xs text-zinc-600">
        Every theme has a dark version, so your whole site can switch, even if it never had a dark mode. Put a switch in your top bar and
        visitors can choose; colorsbymax does the rest and remembers their choice. It keeps working when the colour button is hidden.
      </p>

      <div className="flex items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-3">
        <div className="text-xs text-zinc-700">
          <p className="font-semibold text-zinc-900">Try it here first</p>
          <p>{previewing ? 'The switch is on this page. It’s gone when you reload.' : 'Puts a working switch in this page’s top bar.'}</p>
        </div>
        {previewing ? (
          <button type="button" className={btn} onClick={stop}>
            Remove
          </button>
        ) : (
          <button type="button" className={btnPrimary} onClick={preview}>
            <ToggleRight className="w-3.5 h-3.5" aria-hidden="true" /> Preview it
          </button>
        )}
      </div>

      <div role="radiogroup" aria-label="Mode" className="grid grid-cols-3 gap-2">
        {MODES.map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={settings.mode === id}
            onClick={() => update({ mode: id })}
            className={`flex h-8 items-center justify-center gap-1.5 rounded-lg border text-xs font-medium cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 ${
              settings.mode === id ? 'border-zinc-900 bg-zinc-900 text-white' : 'border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-50'
            }`}
          >
            <Icon className="w-3.5 h-3.5" aria-hidden="true" /> {label}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold text-zinc-900">Add it for good</p>
        <div role="tablist" aria-label="Code for" className="flex gap-1">
          {[
            ['html', 'HTML'],
            ['react', 'React'],
          ].map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
              className={`rounded-md px-2 py-1 text-[11px] font-semibold cursor-pointer ${tab === id ? 'bg-zinc-900 text-white' : 'text-zinc-600 hover:bg-zinc-100'}`}
            >
              {label}
            </button>
          ))}
        </div>
        <CopyBlock label={tab === 'html' ? 'In your top bar' : 'ModeToggle.jsx'} text={tab === 'html' ? TOGGLE_HTML : TOGGLE_REACT} />
        <CopyBlock label="In your global stylesheet" text={TOGGLE_CSS} />
        <CopyBlock label="Or ask Claude, Cursor or Copilot" text={TOGGLE_PROMPT} copyLabel="Copy prompt" />
      </div>
      <p className="rounded-lg bg-zinc-100 p-2.5 text-[11px] text-zinc-700">
        <strong className="font-semibold text-zinc-900">Already have a dark mode?</strong> You don’t need this. The theme you pick colours your
        site well in light and dark, with contrast checked in both.
      </p>
    </div>
  )
}

// ---------------------------------------------------------------- Studio

/** Studio's mark: the parts of a page (header, hero, cards), each in its own colour, cycling. */
function StudioMark({ className = '' }) {
  return (
    <svg viewBox="0 0 24 24" className={`theme-studio-mark shrink-0 ${className}`} aria-hidden="true">
      <rect x="2" y="2" width="12.5" height="8.5" rx="2.5" fill="#f43f5e" />
      <rect x="16.5" y="2" width="5.5" height="8.5" rx="2.5" fill="#f59e0b" />
      <rect x="2" y="12.5" width="5.5" height="9.5" rx="2.5" fill="#10b981" />
      <rect x="9.5" y="12.5" width="12.5" height="9.5" rx="2.5" fill="#6366f1" />
    </svg>
  )
}

const WHERE = [
  { id: 'all', label: 'Whole site', note: 'Every page takes the theme.' },
  { id: 'pages', label: 'Only some pages', note: 'The rest keep their own colours.' },
]

/**
 * Studio: going deeper than a theme. Point and click any part of the page to give it its own
 * colours, and choose where the theme goes: the whole site or only some of its pages, read from
 * the site itself (the pages this one links to, and the ones the visitor has opened). Choices live
 * on this device; the prompt, CSS and config make them everyone's.
 */
function StudioView({ onBack }) {
  const { scope, setScope, inScope: here, pathname, configPages, scopeChosen, seenPages } = useTheme()
  const { studio } = useSettings()
  const { toast } = usePanel()
  const headingRef = useRef(null)
  const inputId = useId()
  const [draft, setDraft] = useState('')
  const [error, setError] = useState(null)
  // The site's pages this one links to: its nav, footer and so on. Read again on each new page.
  const [linked, setLinked] = useState(() => linkedPages())
  useEffect(() => setLinked(linkedPages()), [pathname])
  useEffect(() => headingRef.current?.focus(), [])

  const pages = scope.pages
  const onlySome = scope.mode === 'pages'
  const setPages = (list) => setScope({ mode: 'pages', pages: list })
  const choose = (mode) => setScope({ mode, pages: mode === 'pages' && !pages.length ? [pathname] : pages })
  const add = (page) => {
    if (pages.includes(page)) return
    setPages([...pages, page])
    toast(`${page} now gets the colours.`)
  }
  const remove = (page) => setPages(pages.filter((p) => p !== page))
  const covering = pages.find((p) => p !== pathname && pageMatches(p, pathname))
  const suggestions = [...new Set([pathname, ...seenPages, ...linked])].filter((p) => !pages.includes(p)).slice(0, 14)

  const addDraft = (e) => {
    e.preventDefault()
    const page = normalPath(draft)
    if (!page) return setError('That doesn’t look like a page on this site. Try /pricing, or /blog/* for a whole section.')
    setError(null)
    setDraft('')
    add(page)
  }

  return (
    <div className="px-4 py-3 space-y-4">
      <button type="button" className={`${btn} border-transparent px-1.5`} onClick={onBack}>
        <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" /> Back to the switcher
      </button>

      <div className="flex items-center gap-3">
        <StudioMark className="h-9 w-9" />
        <div>
          <h3 ref={headingRef} tabIndex={-1} className="text-base font-semibold tracking-tight focus:outline-none">
            Studio
          </h3>
          <p className="text-xs text-zinc-600">Go deeper than a theme: colour any part of your site, and choose exactly where your colours go.</p>
        </div>
      </div>

      <section className="space-y-2.5 rounded-xl border border-zinc-200 p-3">
        <div className="flex items-start gap-2.5">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-zinc-100 text-zinc-800">
            <MousePointerClick className="w-4 h-4" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h4 className="text-xs font-semibold text-zinc-900">Colour any part of the page</h4>
            <p className="text-[11px] leading-snug text-zinc-600">
              Point and click a button, a card, a heading, the footer, anything, and give it its own background, text and border. Every part like it
              can change at once.
            </p>
          </div>
        </div>
        <button type="button" className={`${btnPrimary} w-full py-2`} onClick={studio.start}>
          <MousePointerClick className="w-3.5 h-3.5" aria-hidden="true" /> Point and click
        </button>
      </section>

      <StudioChanges />

      <section aria-labelledby={`${inputId}-where`} className="space-y-3 rounded-xl border border-zinc-200 p-3">
        <h4 id={`${inputId}-where`} className="text-xs font-semibold text-zinc-900">Where the colours go</h4>
        <div role="radiogroup" aria-labelledby={`${inputId}-where`} className="grid grid-cols-2 gap-2">
          {WHERE.map((w) => {
            const on = scope.mode === w.id
            return (
              <button
                key={w.id}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => choose(w.id)}
                className={`rounded-lg border p-2 text-left cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 ${
                  on ? 'border-zinc-900 bg-zinc-900 text-white' : 'border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-50'
                }`}
              >
                <span className="block text-xs font-semibold">{w.label}</span>
                <span className={`block text-[11px] leading-snug ${on ? 'text-white/80' : 'text-zinc-600'}`}>{w.note}</span>
              </button>
            )
          })}
        </div>

        {/* This page, and whether it's in. */}
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-zinc-50 p-2.5">
          <div className="min-w-0 text-xs">
            <p className="text-zinc-600">This page</p>
            <p className="truncate font-mono text-[11px] font-semibold text-zinc-900">{pathname}</p>
          </div>
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${here ? 'bg-emerald-50 text-emerald-900' : 'bg-amber-50 text-amber-900'}`}>
            {here ? 'Gets the colours' : 'Keeps its own colours'}
          </span>
          {onlySome && (
            <div className="w-full">
              {covering ? (
                <p className="text-[11px] text-zinc-600">
                  Part of <code className="font-mono">{covering}</code>.
                </p>
              ) : pages.includes(pathname) ? (
                <button type="button" className={`${btn} w-full`} onClick={() => remove(pathname)}>
                  Leave this page alone
                </button>
              ) : (
                <button type="button" className={`${btnPrimary} w-full`} onClick={() => add(pathname)}>
                  Colour this page
                </button>
              )}
            </div>
          )}
        </div>

        {onlySome && (
          <>
            <div className="space-y-1.5">
              <p className="text-[11px] font-semibold text-zinc-700">Pages that get the colours</p>
              {pages.length ? (
                <ul className="space-y-1">
                  {pages.map((p) => (
                    <li key={p} className="flex items-center justify-between gap-2 rounded-lg border border-zinc-200 px-2.5 py-1.5">
                      <span className="min-w-0 truncate font-mono text-[11px] text-zinc-900">
                        {p}
                        {p.endsWith('/*') && <span className="ml-1.5 font-sans text-zinc-500">and every page under it</span>}
                      </span>
                      <button type="button" onClick={() => remove(p)} aria-label={`Remove ${p}`} className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-zinc-600 cursor-pointer hover:bg-zinc-100 hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900">
                        <X className="w-3.5 h-3.5" aria-hidden="true" />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="rounded-lg bg-amber-50 p-2.5 text-[11px] text-amber-900">No pages yet, so the colours show nowhere. Add one below.</p>
              )}
            </div>

            <form onSubmit={addDraft} className="space-y-1.5">
              <label htmlFor={inputId} className="block text-[11px] font-semibold text-zinc-700">Add a page</label>
              <div className="flex gap-2">
                <input
                  id={inputId}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="/pricing or /blog/*"
                  className={`${field} font-mono text-xs`}
                  aria-describedby={`${inputId}-hint`}
                  aria-invalid={Boolean(error)}
                />
                <button type="submit" className={`${btn} shrink-0`} disabled={!draft.trim()}>
                  <Plus className="w-3.5 h-3.5" aria-hidden="true" /> Add
                </button>
              </div>
              <p id={`${inputId}-hint`} className={`text-[11px] ${error ? 'text-red-700' : 'text-zinc-600'}`} role={error ? 'alert' : undefined}>
                {error ?? 'End with /* for a whole section: /blog/* is /blog and every page under it.'}
              </p>
            </form>

            {suggestions.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[11px] font-semibold text-zinc-700">Found on your site</p>
                <div className="flex flex-wrap gap-1.5">
                  {suggestions.map((p) => (
                    <button key={p} type="button" onClick={() => add(p)} className="inline-flex max-w-full items-center gap-1 rounded-full border border-zinc-300 px-2 py-0.5 font-mono text-[11px] text-zinc-800 cursor-pointer hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900">
                      <Plus className="w-3 h-3 shrink-0" aria-hidden="true" />
                      <span className="truncate">{p}</span>
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-zinc-600">Pages this one links to, and pages you’ve opened. Open more of your site and they show up here.</p>
              </div>
            )}
          </>
        )}

        {configPages && (
          <p className="rounded-lg bg-sky-50 p-2.5 text-[11px] text-sky-900">
            Your site’s config colours {configPages.length === 1 ? 'one page' : `${configPages.length} pages`}: {configPages.join(', ')}.
            {scopeChosen && (
              <>
                {' '}
                <button type="button" onClick={() => setScope(null)} className="font-semibold underline underline-offset-2 cursor-pointer">
                  Go back to it
                </button>
              </>
            )}
          </p>
        )}
      </section>

      {onlySome && pages.length > 0 && (
        <section className="space-y-2">
          <p className="text-xs font-semibold text-zinc-900">Make it the same for every visitor</p>
          <p className="text-[11px] text-zinc-600">What you choose here is saved on this device. Add this to your colorsbymax config and everyone gets it.</p>
          <CopyBlock label="Your config" text={pagesSnippet(pages)} />
          <CopyBlock label="Or ask Claude, Cursor or Copilot" text={pagesPrompt(pages)} copyLabel="Copy prompt" />
        </section>
      )}

      <section className="rounded-xl border border-dashed border-zinc-300 p-3">
        <p className="text-xs font-semibold text-zinc-900">Coming to Studio</p>
        <ul className="mt-1.5 list-disc space-y-1 pl-4 text-[11px] text-zinc-600">
          <li>A map of your whole site: every page and its parts, in one place.</li>
        </ul>
      </section>
    </div>
  )
}

/** What's been coloured by pointing and clicking, page by page, and how to keep it for good. */
function StudioChanges() {
  const { paints, removePaint, clearPaints, pathname, tokens } = useTheme()
  const { studio } = useSettings()
  const [format, setFormat] = useState('prompt')
  if (!paints.length) return null
  const pages = [...new Set(paints.map(pageOf))].sort((a, b) => (a === '*' ? -1 : b === '*' ? 1 : 0))
  const colourOf = (v) => (v.token ? tokens[v.token] : v.hex)
  return (
    <section className="space-y-3 rounded-xl border border-zinc-200 p-3">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-xs font-semibold text-zinc-900">
          Your changes <span className="font-normal text-zinc-600">({paints.length})</span>
        </h4>
        <button type="button" onClick={() => clearPaints()} className="text-[11px] font-medium text-zinc-600 underline underline-offset-2 cursor-pointer hover:text-zinc-900">
          Clear all
        </button>
      </div>
      {pages.map((page) => (
        <div key={page} className="space-y-1">
          <p className={`text-[11px] font-semibold text-zinc-700 ${page === '*' ? '' : 'font-mono'}`}>
            {page === '*' ? 'On every page' : page}
            {page === pathname && <span className="ml-1.5 font-sans font-normal text-zinc-500">(this page)</span>}
          </p>
          <ul className="space-y-1">
            {paints
              .filter((p) => pageOf(p) === page)
              .map((p) => (
                <li key={p.id} className="flex items-center gap-2 rounded-lg border border-zinc-200 px-2.5 py-1.5">
                  <span className="flex shrink-0 -space-x-1">
                    {PROPS.filter(({ key }) => p.props[key]).map(({ key, label }) => (
                      <span key={key} title={label} className="h-4 w-4 rounded-full border-2 border-white" style={{ background: colourOf(p.props[key]) }} />
                    ))}
                  </span>
                  <span className="min-w-0 flex-1 text-[11px] leading-snug text-zinc-800">
                    <span className="font-semibold">{p.kind}</span>
                    {p.text && <span className="text-zinc-600"> “{p.text}”</span>}
                    {p.everywhere ? <span className="text-zinc-600"> and every one like it</span> : p.all && p.similar && <span className="text-zinc-600"> and {p.likeIt - 1} like it</span>}
                  </span>
                  <button
                    type="button"
                    onClick={() => removePaint(p.id)}
                    aria-label={`Undo the change to ${p.kind.toLowerCase()} ${p.text}`}
                    className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-zinc-600 cursor-pointer hover:bg-zinc-100 hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900"
                  >
                    <X className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                </li>
              ))}
          </ul>
        </div>
      ))}
      <button type="button" className={`${btn} w-full`} onClick={studio.start}>
        <MousePointerClick className="w-3.5 h-3.5" aria-hidden="true" /> Colour more
      </button>

      <div className="space-y-2 border-t border-zinc-200 pt-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-semibold text-zinc-900">Keep them for good</p>
          <div role="radiogroup" aria-label="Save as" className="flex shrink-0 items-center rounded-lg border border-zinc-200 p-0.5">
            {[
              ['prompt', 'Prompt'],
              ['css', 'CSS'],
            ].map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={format === id}
                onClick={() => setFormat(id)}
                className={`h-6 rounded-md px-2 text-[11px] font-semibold cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 ${
                  format === id ? 'bg-zinc-900 text-white' : 'text-zinc-700 hover:bg-zinc-100'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <p className="text-[11px] text-zinc-600">
          {format === 'prompt'
            ? 'Recommended. Paste it into Claude, Cursor or Copilot and it makes these changes in your site’s code, using your own colour settings where you have them.'
            : 'Plain CSS for your stylesheet. The selectors come from the page as it is now, so they can break if its layout changes; the prompt holds up better.'}
        </p>
        {format === 'prompt' ? (
          <CopyBlock label="Prompt for your AI editor" text={paintsPrompt(paints, tokens)} copyLabel="Copy prompt" />
        ) : (
          <CopyBlock label="CSS" text={paintsCssExport(paints, tokens)} />
        )}
        <p className="text-[11px] text-zinc-600">Until then, your changes are saved on this device only.</p>
      </div>
    </section>
  )
}

/** Shows code with a copy button. */
function CopyBlock({ label, text, copyLabel = 'Copy' }) {
  const { toast } = usePanel()
  const id = useId()
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2">
        <span id={id} className="text-[11px] font-semibold text-zinc-700">{label}</span>
        <button
          type="button"
          className={`${btn} px-2 py-1`}
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(text)
              toast(`Copied: ${label.toLowerCase()}.`)
            } catch {
              toast('Couldn’t reach the clipboard. Select the text and copy it instead.')
            }
          }}
        >
          <Copy className="w-3.5 h-3.5" aria-hidden="true" /> {copyLabel}
        </button>
      </div>
      <pre aria-labelledby={id} tabIndex={0} className="max-h-40 overflow-auto rounded-lg border border-zinc-200 bg-zinc-50 p-2.5 font-mono text-[11px] leading-snug text-zinc-800 whitespace-pre-wrap break-all">
        {text}
      </pre>
    </div>
  )
}

const FINISH_OPTIONS = [
  { id: 'keep', label: 'Keep these colours and hide it in production', note: 'Recommended. Everyone sees your colours; the button still shows while you develop.' },
  { id: 'local', label: 'Hide it on this device only', note: 'Quick and undoable. Nothing changes for anyone else.' },
  { id: 'remove', label: 'Remove colorsbymax', note: 'Uninstall it and keep the colours in your own CSS.' },
]

/**
 * After "I'm done": how to keep the chosen colours for every visitor and hide the switcher, hide it
 * here only, or remove colorsbymax, each with code and a prompt for an AI editor. Cancel goes back.
 */
function FinishView({ onBack }) {
  const { tokens: themeTokens, appliedTokens, colourStyle, active, recolouring } = useTheme()
  const { settings, update } = useSettings()
  // The colours as the page shows them. Colourful keeps the theme's own and says so in the config,
  // since its painting by role happens on the page; Subtle's mix is kept as it is.
  const tokens = colourStyle === 'colourful' ? themeTokens : appliedTokens
  const style = colourStyle === 'colourful' ? 'colourful' : 'balanced'
  const [choice, setChoice] = useState('keep')
  const [kind, setKind] = useState(() => (document.querySelector('[data-colorsbymax="auto"]') ? 'auto' : 'provider'))
  const headingRef = useRef(null)
  useEffect(() => headingRef.current?.focus(), [])
  const name = active.name.replace(/ \(dark\)$/, ' dark')

  return (
    <div className="px-4 py-3 space-y-4">
      <button type="button" className={`${btn} border-transparent px-1.5`} onClick={onBack}>
        <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" /> Back
      </button>
      <div className="space-y-1.5">
        <h3 ref={headingRef} tabIndex={-1} className="text-sm font-semibold focus:outline-none">Happy with your colours?</h3>
        <p className="text-[11px] text-zinc-600">
          Your pick, <strong className="font-semibold text-zinc-900">{active.name}</strong>, is only saved in this browser. To show it to every visitor and keep the button out of production, put it in your code:
        </p>
        <Swatches tokens={tokens} />
      </div>

      <div role="radiogroup" aria-label="What to do" className="space-y-1.5">
        {FINISH_OPTIONS.map((o) => (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={choice === o.id}
            onClick={() => setChoice(o.id)}
            className={`w-full rounded-xl border px-3 py-2 text-left cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 ${
              choice === o.id ? 'border-zinc-900 bg-zinc-100' : 'border-zinc-200 hover:bg-zinc-50'
            }`}
          >
            <span className="block text-xs font-semibold text-zinc-900">{o.label}</span>
            <span className="block text-[11px] text-zinc-600">{o.note}</span>
          </button>
        ))}
      </div>

      {choice === 'keep' && (
        <div className="space-y-3">
          <div role="radiogroup" aria-label="How colorsbymax is set up" className="grid grid-cols-2 gap-2">
            {[
              ['auto', 'One-line import'],
              ['provider', 'ThemeProvider'],
            ].map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={kind === id}
                onClick={() => setKind(id)}
                className={`h-8 rounded-lg border px-2 text-xs font-medium cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 ${
                  kind === id ? 'border-zinc-900 bg-zinc-900 text-white' : 'border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-50'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <CopyBlock label="Code for your site" text={keepSnippet(kind, name, tokens, VITE_PROD, style)} />
          <p className="text-[11px] text-zinc-600">
            Not using Vite? Use <code className="font-mono">{NODE_PROD}</code> instead of <code className="font-mono">{VITE_PROD}</code> (Next.js, webpack).
          </p>
          <CopyBlock label="Or ask Claude, Cursor or Copilot" text={keepPrompt(name, tokens, style)} copyLabel="Copy prompt" />
          <div className="rounded-lg bg-zinc-100 p-2.5 text-[11px] text-zinc-700 space-y-1.5">
            <p><strong className="font-semibold text-zinc-900">Bring it back later:</strong> it still shows when you run the site locally, so you can keep iterating. To show it in production too, set <code className="font-mono">hidden: false</code>.</p>
            <CopyBlock label="Prompt to bring it back" text={BRING_BACK_PROMPT} copyLabel="Copy prompt" />
          </div>
        </div>
      )}

      {choice === 'local' && (
        <div className="space-y-2">
          <p className="text-[11px] text-zinc-600">
            Hides the colour button in this browser only, and keeps showing your current colours here. It doesn’t change your code or what anyone else sees.
          </p>
          <p className="rounded-lg bg-zinc-100 p-2.5 text-[11px] text-zinc-700">
            <strong className="font-semibold text-zinc-900">To bring it back:</strong> press <kbd className="font-mono">Alt</kbd>+<kbd className="font-mono">Shift</kbd>+<kbd className="font-mono">C</kbd> on the page, or open it with <code className="font-mono">?colorsbymax</code> at the end of the address.
          </p>
          <button type="button" className={`${btnPrimary} w-full`} onClick={() => update({ hideButton: true })}>
            Hide the button here
          </button>
        </div>
      )}

      {choice === 'remove' && (
        <div className="space-y-3">
          <ol className="list-decimal space-y-1 pl-4 text-[11px] text-zinc-700">
            <li>Uninstall it: <code className="font-mono">npm uninstall colorsbymax</code></li>
            <li>Delete its import (<code className="font-mono">import 'colorsbymax/auto'</code>, <code className="font-mono">autoMount</code>, or <code className="font-mono">ThemeProvider</code> and <code className="font-mono">ThemeSwitcher</code>) and any colorsbymax pre-paint script.</li>
            <li>
              {recolouring
                ? 'Keep the colours: your site’s CSS uses its own hard-coded colours, which colorsbymax was swapping as the page ran, so they need writing into your CSS. The prompt below asks your AI editor to do that.'
                : 'Keep the colours: paste these into your global stylesheet, replacing your current --color-* values.'}
            </li>
          </ol>
          {!recolouring && <CopyBlock label="CSS for your colours" text={cssSnippet(appliedTokens)} />}
          <CopyBlock label="Or ask Claude, Cursor or Copilot" text={removePrompt(tokens, recolouring)} copyLabel="Copy prompt" />
          <p className="text-[11px] text-zinc-600">To bring it back later, install it again and follow the Quick start in the README.</p>
        </div>
      )}

      <button type="button" className={`${btn} w-full`} onClick={onBack}>
        Cancel, keep using colorsbymax
      </button>
    </div>
  )
}

const MODES = [
  { id: 'light', label: 'Light', Icon: Sun },
  { id: 'dark', label: 'Dark', Icon: Moon },
  { id: 'system', label: 'Auto', Icon: Monitor },
]

/** The visitor's preferences for the panel and colour button. */
function SettingsView({ onBack }) {
  const { settings, update, reset, resetButton } = useSettings()
  const { active, features } = useTheme()
  const { toast } = usePanel()
  const headingRef = useRef(null)
  useEffect(() => headingRef.current?.focus(), [])

  return (
    <div className="px-4 py-3 space-y-4">
      <button type="button" className={`${btn} border-transparent px-1.5`} onClick={onBack}>
        <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" /> Back
      </button>
      <h3 ref={headingRef} tabIndex={-1} className="text-sm font-semibold focus:outline-none">
        Settings
      </h3>

      <fieldset className="space-y-1.5">
        <legend className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-600">Theme mode</legend>
        <div role="radiogroup" aria-label="Theme mode" className="grid grid-cols-3 gap-2">
          {MODES.map(({ id, label, Icon }) => {
            const on = settings.mode === id
            return (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => update({ mode: id })}
                className={`flex h-8 min-w-0 items-center justify-center gap-1.5 rounded-lg border px-2 text-xs font-medium cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-1 ${
                  on ? 'border-zinc-900 bg-zinc-900 text-white' : 'border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-50'
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span className="truncate">{label}</span>
              </button>
            )
          })}
        </div>
        <p className="text-[11px] text-zinc-600">
          Shows every theme in light or dark colours and switches the current one to match. Auto follows your device. The panel matches too, and your own palettes stay as you made them.
        </p>
      </fieldset>

      {features.colourCount && (
      <fieldset className="space-y-1.5">
        <legend className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-600">Colours per theme</legend>
        {/* A sample: the current theme's colours at the chosen count. */}
        <div className="flex items-center gap-3 rounded-xl border border-zinc-200 p-2.5">
          <div className="min-w-0 flex-1">
            <Swatches tokens={active.tokens} count={settings.paletteSize} />
          </div>
          <ColourStepper value={settings.paletteSize} onChange={(n) => update({ paletteSize: n })} label="Colours every theme uses" size="md" />
        </div>
        <p className="text-[11px] text-zinc-600">
          How many colours every theme uses, from {MIN_COLOURS} to {MAX_COLOURS}. Fewer keeps a site calmer, with only a theme’s main colours; the ones that fit it best
          stay. You can still change it on any theme with − and + on its card.
        </p>
      </fieldset>
      )}

      <fieldset className="space-y-1.5">
        <legend className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-600">Panel size</legend>
        <div role="radiogroup" aria-label="Panel size" className="grid grid-cols-3 gap-2">
          {PANEL_PRESETS.map((preset) => {
            const on = settings.panelWidth === preset.width && settings.panelHeight === preset.height
            return (
              <button
                key={preset.id}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => update({ panelWidth: preset.width, panelHeight: preset.height })}
                className={`flex h-8 min-w-0 items-center justify-center rounded-lg border px-2 text-xs font-medium cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-1 ${
                  on ? 'border-zinc-900 bg-zinc-900 text-white' : 'border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-50'
                }`}
              >
                <span className="truncate">{preset.label}</span>
              </button>
            )
          })}
        </div>
        <p className="text-[11px] text-zinc-600">
          {PANEL_PRESETS.some((pr) => pr.width === settings.panelWidth && pr.height === settings.panelHeight)
            ? 'Or drag the panel’s edges or corner to any size. Double-click an edge to reset it.'
            : 'Custom size from dragging. Pick a size above to go back, or double-click an edge.'}
        </p>
      </fieldset>

      <fieldset className="space-y-1">
        <legend className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-600">Show</legend>
        {features.picks && <Toggle checked={settings.showPicks} onChange={(v) => update({ showPicks: v })} label="Max’s picks" note="Hand-tuned colorsbymax themes" />}
        {features.library && <Toggle checked={settings.showLibrary} onChange={(v) => update({ showLibrary: v })} label="Theme library" note="Hundreds of themes in categories, with search" />}
        {features.custom && <Toggle checked={settings.showCustom} onChange={(v) => update({ showCustom: v })} label="Custom palettes" />}
        {features.overrides && <Toggle checked={settings.showOverrides} onChange={(v) => update({ showOverrides: v })} label="Override a single colour" />}
        {features.importExport && <Toggle checked={settings.showImportExport} onChange={(v) => update({ showImportExport: v })} label="Import / export" />}
      </fieldset>

      <fieldset className="space-y-1">
        <legend className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-600">Page</legend>
        <Toggle
          checked={settings.colourLogo}
          onChange={(v) => update({ colourLogo: v })}
          label="Colour the logo too"
          note="Off keeps the site’s logo in its own colours whatever the theme"
        />
      </fieldset>

      <fieldset className="space-y-1">
        <legend className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-600">Colour button</legend>
        <Toggle checked={settings.draggable} onChange={(v) => update({ draggable: v })} label="Drag to move" note="Hold and drag the button anywhere on the screen" />
        <Toggle checked={settings.animateDot} onChange={(v) => update({ animateDot: v })} label="Cycle the dot’s colours" note="Shows the current theme’s colours in turn" />
        {resetButton && (
          <button
            type="button"
            className={`${btn} mt-1 w-full`}
            onClick={() => {
              resetButton()
              toast('Moved the colour button back to its corner.')
            }}
          >
            <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" /> Move the button back to the corner
          </button>
        )}
      </fieldset>

      <button
        type="button"
        className="rounded text-[11px] font-medium text-zinc-600 underline underline-offset-2 hover:text-zinc-900 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900"
        onClick={() => {
          reset()
          toast('Settings are back to their defaults.')
        }}
      >
        Restore default settings
      </button>
    </div>
  )
}

function Toggle({ checked, onChange, label, note }) {
  const id = useId()
  return (
    <div className="flex items-start gap-2.5 rounded-lg px-1.5 py-1.5 hover:bg-zinc-50">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-1"
      />
      <label htmlFor={id} className="min-w-0 flex-1 cursor-pointer">
        <span className="block text-xs font-medium text-zinc-900">{label}</span>
        {note && <span className="block text-[11px] text-zinc-600">{note}</span>}
      </label>
    </div>
  )
}

function Section({ title, badge, wideBadge = false, defaultOpen = false, children }) {
  return (
    <details open={defaultOpen} className="border-b border-zinc-200">
      <summary className="flex cursor-pointer items-center gap-2 px-4 py-3 text-sm font-semibold hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-zinc-900">
        <ChevronRight className="theme-chevron w-4 h-4 text-zinc-500 transition-transform motion-reduce:transition-none" aria-hidden="true" />
        <span className="flex-1">{title}</span>
        {badge && (
          <span className={`rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-700 ${wideBadge ? 'max-w-[50%] truncate' : ''}`} title={wideBadge ? badge : undefined}>
            {badge}
          </span>
        )}
      </summary>
      <div className="px-4 pb-4">{children}</div>
    </details>
  )
}

/** Full contrast breakdown for the active theme, opened from a warning badge or link. */
function ContrastView({ onBack }) {
  const { issues, fixIssue, fixAllIssues, active } = useTheme()
  const { toast } = usePanel()
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
              <button
                type="button"
                className={btnPrimary}
                onClick={() => {
                  fixAllIssues()
                  toast(`Fixed ${issues.length} contrast ${issues.length === 1 ? 'problem' : 'problems'} by adjusting lightness.`)
                }}
              >
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

/** A theme's colours as a strip: the `count` it uses (5 to 10), its most fitting ones. */
function Swatches({ tokens, count = MAX_COLOURS }) {
  return (
    <div className="flex overflow-hidden rounded-md border border-zinc-200" aria-hidden="true">
      {paletteKeys(tokens, count).map((key) => (
        <span key={key} className="h-5 flex-1" style={{ background: tokens[key] }} />
      ))}
    </div>
  )
}

/**
 * − n + for how many colours a theme uses. Each end dims when it's as far as it goes.
 * @param {{ value: number, onChange: (n: number) => void, label: string, size?: 'sm' | 'md' }} props
 */
function ColourStepper({ value, onChange, label, size = 'sm' }) {
  const box = size === 'sm' ? 'h-6 w-6' : 'h-8 w-8'
  const step = (d) => (e) => {
    e.stopPropagation()
    onChange(value + d)
  }
  return (
    <span role="group" aria-label={label} className="inline-flex items-center gap-1">
      <button
        type="button"
        onClick={step(-1)}
        disabled={value <= MIN_COLOURS}
        aria-label={`Fewer colours (${value} now)`}
        data-tip={value <= MIN_COLOURS ? `${MIN_COLOURS} is the fewest` : 'Use fewer colours'}
        className={`${box} grid place-items-center rounded-full border border-zinc-300 bg-white text-zinc-800 cursor-pointer hover:border-zinc-900 disabled:cursor-default disabled:opacity-35 disabled:hover:border-zinc-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900`}
      >
        <Minus className="w-3.5 h-3.5" aria-hidden="true" />
      </button>
      <span className="min-w-[1.25rem] text-center text-xs font-semibold tabular-nums text-zinc-900" aria-live="polite">
        {value}
      </span>
      <button
        type="button"
        onClick={step(1)}
        disabled={value >= MAX_COLOURS}
        aria-label={`More colours (${value} now)`}
        data-tip={value >= MAX_COLOURS ? `${MAX_COLOURS} is every colour` : 'Use more colours'}
        className={`${box} grid place-items-center rounded-full border border-zinc-300 bg-white text-zinc-800 cursor-pointer hover:border-zinc-900 disabled:cursor-default disabled:opacity-35 disabled:hover:border-zinc-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900`}
      >
        <Plus className="w-3.5 h-3.5" aria-hidden="true" />
      </button>
    </span>
  )
}

const PAGE_SIZE = 24
const NO_THEMES = []

const COLOUR_STYLES = [
  { id: 'subtle', label: 'Subtle', Icon: Contrast },
  { id: 'balanced', label: 'Balanced', Icon: Palette },
  { id: 'colourful', label: 'Colourful', Icon: Paintbrush },
]
const STYLE_NOTES = {
  subtle: 'Subtle: your site keeps its own backgrounds, cards and text. The theme comes in on buttons, links, highlights and accents.',
  balanced: 'Balanced: the theme as it’s designed, every colour in its role.',
  colourful:
    'Colourful: an overhaul. Tinted backgrounds, and the theme paints your header, hero, sections, headings, cards, buttons and footer, like a designer would. Text is still checked for contrast.',
}

function PresetGrid() {
  const { siteName, siteThemes, presets: allPresets, customs, active, selectTheme, state, clearOverrides, tokens, recolouring, features } = useTheme()
  const surpriseBurst = useBurst()
  const { settings, mode, update } = useSettings()
  const { confirmTheme } = usePanel()
  const categoriesId = useId()
  const [loaded, setLoaded] = useState(null)
  const [loadError, setLoadError] = useState(false)
  const [chosen, setCategory] = useState('site')
  const [query, setQuery] = useState('')
  const [limit, setLimit] = useState(PAGE_SIZE)
  const searchId = useId()
  const overrideCount = Object.keys(state.overrides).length
  const { toast, reveal } = usePanel()
  const wrapRef = useRef(null)
  const pendingScroll = useRef(false)
  // Picking a group or a library category brings its themes into view, so the colours are right there.
  const themesRef = useRef(null)
  const scrollToThemes = useRef(false)

  // Jump to a group when asked (e.g. "Show" on a toast), opening the section and bringing the
  // active card into view once it has rendered.
  useEffect(() => {
    if (!reveal) return
    setCategory(reveal.group)
    setQuery('')
    setLimit(PAGE_SIZE)
    if (!reveal.scroll) return
    const details = wrapRef.current?.closest('details')
    if (details) details.open = true
    pendingScroll.current = true
  }, [reveal])
  useEffect(() => {
    if (scrollToThemes.current && themesRef.current) {
      scrollToThemes.current = false
      const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      // Clear of the panel's pinned header, which is taller when its tools wrap on a phone.
      const header = themesRef.current.closest('.theme-scroll')?.querySelector('header')
      themesRef.current.style.scrollMarginTop = `${(header?.offsetHeight ?? 0) + 12}px`
      themesRef.current.scrollIntoView({ block: 'start', behavior: still ? 'auto' : 'smooth' })
    }
    if (!pendingScroll.current) return
    pendingScroll.current = false
    const root = wrapRef.current
    const target = root?.querySelector('[data-theme-grid] button[aria-pressed="true"]') ?? root?.querySelector('[data-groups] [aria-pressed="true"]')
    const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches
    target?.scrollIntoView({ block: 'center', behavior: smooth ? 'smooth' : 'auto' })
    target?.focus({ preventScroll: true })
  })

  // Groups the visitor turned off in settings are left out everywhere, search included.
  const presets = settings.showPicks ? allPresets : NO_THEMES
  const library = settings.showLibrary ? loaded : null

  useEffect(() => {
    if (settings.showLibrary) loadLibrary().then(setLoaded, () => setLoadError(true))
  }, [settings.showLibrary])

  // The site's own group, Picks and Yours are set apart from the library's categories.
  const groups = [
    { id: 'site', label: siteName, Icon: Globe, count: siteThemes.length, description: `${siteName}'s own colours, and themes made for it` },
    ...(settings.showPicks
      ? [{ id: 'picks', label: 'Max’s picks', Icon: Paintbrush, count: presets.length, description: 'Hand-tuned colorsbymax themes that pass every contrast check' }]
      : []),
    { id: 'yours', label: 'Yours', Icon: UserRound, count: customs.length, description: 'Palettes you create, import or build from an image' },
  ]
  const categories = [
    ...(settings.showLibrary ? [{ id: 'all', label: 'All', count: library ? library.themes.length : null, description: 'Every library theme' }] : []),
    ...(library?.categories ?? []).filter((c) => c.count),
  ]
  const chips = [...groups, ...categories]
  // A group hidden in settings falls back to the site's own. Library categories only appear
  // once it has loaded, so keep one chosen meanwhile.
  const loadingCategory = settings.showLibrary && !library && !['site', 'picks', 'yours'].includes(chosen)
  const category = chips.some((c) => c.id === chosen) || loadingCategory ? chosen : 'site'

  const q = query.trim().toLowerCase()
  const activeCategory = q ? null : categories.find((c) => c.id === category)
  const visible = useMemo(() => {
    let list
    if (q) list = [...siteThemes, ...presets, ...customs, ...(library?.themes ?? [])]
    else if (category === 'site') list = siteThemes
    else if (category === 'picks') list = presets
    else if (category === 'yours') list = customs
    else if (category === 'all') list = library?.themes ?? []
    else list = (library?.themes ?? []).filter((t) => t.tags.includes(category))
    if (q) {
      // By name or mood, and, for a colour word ("red"), by the theme's own colours: names first.
      const labels = Object.fromEntries((library?.categories ?? []).map((c) => [c.id, c.label.toLowerCase()]))
      const byName = (t) => t.name.toLowerCase().includes(q) || t.tags?.some((tag) => labels[tag]?.includes(q))
      const byColour = colourMatcher(q)
      list = [...list.filter(byName), ...(byColour ? list.filter((t) => !byName(t) && byColour(t.tokens)) : [])]
    }
    return list
  }, [q, category, siteThemes, presets, customs, library])

  // Only the cards on screen are converted, since building a dark twin takes a few milliseconds.
  const shown = visible.slice(0, limit).map((t) => inMode(t, mode))
  const needsLibrary = settings.showLibrary && (Boolean(q) || !['site', 'picks', 'yours'].includes(category))
  const catInfo = library?.categories.find((c) => c.id === category)

  const choose = (id, { scroll = false } = {}) => {
    setCategory(id)
    setQuery('')
    setLimit(PAGE_SIZE)
    scrollToThemes.current = scroll
  }
  const pick = (t) => confirmTheme(() => selectTheme(t.id, t))
  const surprise = () => {
    // From what's showing, or everything when that's a single theme; never the one already on.
    const everything = library?.themes ?? [...siteThemes, ...presets]
    const pool = (visible.length > 1 ? visible : everything).filter((t) => t.id !== active.id && inMode(t, mode).id !== active.id)
    if (!pool.length) return
    pick(inMode(pool[Math.floor(Math.random() * pool.length)], mode))
    surpriseBurst.celebrate()
  }
  const suggestions = suggestWords(query, categories.map((c) => c.label))
  // "Search 700+ themes", not an exact count that shifts as groups are shown or hidden.
  const themeCount = (library?.themes.length ?? 0) + presets.length + siteThemes.length + customs.length
  const roughCount = themeCount >= 100 ? `${Math.floor(themeCount / 100) * 100}+` : themeCount

  return (
    <div ref={wrapRef} className="space-y-3">
      {overrideCount > 0 && (
        <p className="flex items-center justify-between gap-2 rounded-lg bg-zinc-100 px-3 py-2 text-xs text-zinc-700">
          {overrideCount} single-colour override{overrideCount > 1 ? 's are' : ' is'} applied on top of any theme.
          <button
            type="button"
            className={btn}
            onClick={() => {
              clearOverrides()
              toast(`Cleared ${overrideCount} single-colour ${overrideCount === 1 ? 'override' : 'overrides'}.`)
            }}
          >
            Clear
          </button>
        </p>
      )}

      {(features.search || features.surprise) && (
      <div className="flex gap-2">
        {features.search && (
        <>
        <label htmlFor={searchId} className="sr-only">Search themes</label>
        <input
          id={searchId}
          type="search"
          className={field}
          placeholder={`Search ${roughCount} themes…`}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setLimit(PAGE_SIZE)
          }}
        />
        </>
        )}
        {features.surprise && (
        <button type="button" className={`${btn} relative shrink-0 ${features.search ? '' : 'flex-1'}`} onClick={surprise} disabled={!library && needsLibrary}>
          {/* "Surprise" alone on a narrow panel, leaving the search box room for its hint. */}
          <Shuffle className="w-3.5 h-3.5" aria-hidden="true" />
          <span>
            Surprise<span className="hidden @min-[400px]:inline"> me</span>
          </span>
          {/* A burst of the theme it just picked, like the colour button's. */}
          {surpriseBurst.bursting && <Burst key={surpriseBurst.burst} tokens={tokens} spread={1.7} />}
        </button>
        )}
      </div>
      )}
      {/* Words that finish what's being typed ("b": black, blue, brown…); a tap completes it. */}
      {suggestions.length > 0 && (
        <div role="group" aria-label="Suggestions" className="-mt-1 flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] text-zinc-500">Try</span>
          {suggestions.map((w) => (
            <button
              key={w}
              type="button"
              onClick={() => {
                setQuery(w)
                setLimit(PAGE_SIZE)
              }}
              className="rounded-full border border-zinc-300 bg-white px-2.5 py-0.5 text-xs font-medium text-zinc-800 capitalize hover:border-zinc-900 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900"
            >
              {w}
            </button>
          ))}
        </div>
      )}
      {/* Searching: only the results, with how many there are and light or dark to see them in. */}
      {q && (
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-zinc-600" role="status">
            {visible.length} {visible.length === 1 ? 'theme' : 'themes'} for “{query.trim()}”
          </p>
          <div role="radiogroup" aria-label="Show them in" className="flex shrink-0 items-center rounded-lg border border-zinc-200 p-0.5">
            {MODES.filter((m) => m.id !== 'system').map(({ id, label, Icon }) => {
              const on = mode === id
              return (
                <button
                  key={id}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => update({ mode: id })}
                  className={`inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs font-semibold cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 ${
                    on ? 'bg-zinc-900 text-white' : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" aria-hidden="true" />
                  {label}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {!q && (
        <>

      <div role="group" aria-label="Your groups" data-groups className="grid grid-cols-3 gap-2">
        {groups.map((g) => {
          const on = !q && category === g.id
          return (
            <button
              key={g.id}
              type="button"
              aria-pressed={on}
              data-tip={`${g.description} (${g.count} ${g.count === 1 ? 'theme' : 'themes'})`}
              onClick={() => choose(g.id, { scroll: true })}
              className={`flex min-h-12 min-w-0 flex-col items-center justify-center gap-1 rounded-xl border px-1.5 py-2 text-[11px] leading-tight font-semibold @min-[460px]:h-10 @min-[460px]:min-h-0 @min-[460px]:flex-row @min-[460px]:justify-start @min-[460px]:gap-1.5 @min-[460px]:px-2.5 @min-[460px]:py-0 @min-[460px]:text-xs cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-1 ${
                on ? 'border-zinc-900 bg-zinc-900 text-white shadow-sm' : 'border-zinc-200 bg-zinc-100 text-zinc-900 hover:bg-zinc-200'
              }`}
            >
              <g.Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
              {/* Narrow, the label wraps under its icon rather than being cut off. */}
              <span className="max-w-full text-center break-words @min-[460px]:truncate @min-[460px]:text-left">{g.label}</span>
              <span className={`ml-auto hidden pl-1 font-medium tabular-nums @min-[460px]:inline ${on ? 'text-zinc-300' : 'text-zinc-500'}`}>{g.count}</span>
            </button>
          )
        })}
      </div>

      {/* The library: community palettes sorted by mood, in a box of its own so it reads as one
          place to browse. Its header says what it is and folds it away. */}
      {categories.length > 0 && (
        <section aria-label="Theme library" className="rounded-xl border border-zinc-200 bg-zinc-50 p-2.5">
          <button
            type="button"
            aria-expanded={!settings.libraryCollapsed}
            aria-controls={categoriesId}
            onClick={() => update({ libraryCollapsed: !settings.libraryCollapsed })}
            className="flex w-full items-center gap-2.5 rounded-lg px-1 py-0.5 text-left cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900"
          >
            <LibraryBig className="h-5 w-5 shrink-0 text-zinc-700" aria-hidden="true" />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-zinc-900">Library</span>
              <span className="block text-[11px] leading-snug text-zinc-600">
                {settings.libraryCollapsed && activeCategory
                  ? `Showing ${activeCategory.label}`
                  : `${library ? `${library.themes.length} palettes` : 'Palettes'} sorted by mood. Pick one to see its themes.`}
              </span>
            </span>
            <span className="flex shrink-0 items-center gap-1 text-[11px] font-medium text-zinc-600">
              {settings.libraryCollapsed ? 'Show' : 'Hide'}
              <ChevronRight
                className={`w-3.5 h-3.5 transition-transform motion-reduce:transition-none ${settings.libraryCollapsed ? '' : 'rotate-90'}`}
                aria-hidden="true"
              />
            </span>
          </button>
          <div
            id={categoriesId}
            hidden={settings.libraryCollapsed}
            role="group"
            aria-label="Library moods"
            className="mt-2.5 grid grid-cols-2 @min-[380px]:grid-cols-3 gap-2"
          >
            {categories.map((c) => {
              const on = !q && category === c.id
              return (
                <button
                  key={c.id}
                  type="button"
                  aria-pressed={on}
                  data-tip={c.description}
                  onClick={() => choose(c.id, { scroll: true })}
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
        </section>
      )}
        </>
      )}

      {/* scroll-mt keeps a little room above the category's description when it's scrolled to. */}
      <div ref={themesRef} className="scroll-mt-3" />
      {!q && <p className="text-xs text-zinc-600">{(catInfo ?? chips.find((c) => c.id === category))?.description}</p>}

      {needsLibrary && !library ? (
        <p className="py-6 text-center text-xs text-zinc-600" role="status">
          {loadError ? 'Couldn’t load the theme library. Check your connection and reopen the panel.' : 'Loading themes…'}
        </p>
      ) : visible.length === 0 && !q && category === 'yours' ? (
        <p className="rounded-xl border border-dashed border-zinc-300 px-4 py-5 text-center text-xs text-zinc-600">
          Nothing here yet. Palettes you create in Custom palettes, import, or build from a file in Import / export are saved here.
        </p>
      ) : visible.length === 0 ? (
        <p className="py-6 text-center text-xs text-zinc-600" role="status">No themes match “{query}”.</p>
      ) : (
        <>
          {!q && <p className="sr-only" role="status">{visible.length} themes</p>}
          <div data-theme-grid className="grid grid-cols-2 @min-[520px]:grid-cols-3 gap-2">
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
/**
 * Above the themes: how boldly the site takes whichever theme is on (Subtle or Colourful), and the
 * scan that builds themes from the site's own colours.
 */
function StyleAndScan() {
  const { features, recolouring } = useTheme()
  const { settings, update } = useSettings()
  return (
    <div className="space-y-3">
      {/* How boldly the site takes the theme: Subtle keeps the site's own look and brings the theme in
          on its accents, Balanced is the theme as designed, Colourful an overhaul. */}
      {features.colourStyle && (
        <div className="rounded-xl border border-zinc-200 p-2.5">
          <div role="radiogroup" aria-label="Colour style" className="grid grid-cols-3 gap-1 rounded-lg bg-zinc-100 p-1">
            {COLOUR_STYLES.map(({ id, label, Icon }) => {
              const on = settings.colourStyle === id
              return (
                <button
                  key={id}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => update({ colourStyle: id })}
                  className={`inline-flex h-8 cursor-pointer items-center justify-center gap-1.5 rounded-md text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 ${
                    on ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-600 hover:text-zinc-900'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" aria-hidden="true" />
                  {label}
                </button>
              )
            })}
          </div>
          <p className="mt-2 px-0.5 text-[11px] leading-snug text-zinc-600">
            {settings.colourStyle === 'balanced' && recolouring
              ? 'Balanced: every colour on your site swapped for its match in the theme.'
              : settings.colourStyle === 'colourful' && !recolouring
                ? 'Colourful: an overhaul. Your page, cards and borders take a clear tint of the theme, and text a hint of it, wherever your design already uses colour. Text is still checked for contrast.'
                : STYLE_NOTES[settings.colourStyle] ?? STYLE_NOTES.balanced}
          </p>
          {settings.colourStyle === 'colourful' && <ColourfulControls />}
        </div>
      )}
      {features.scan && <ScanCard />}
    </div>
  )
}

/** Colourful's strength, from a light wash to bold, and tints from the site's own pictures. */
function ColourfulControls() {
  const { pictureColours, pictureTint } = useTheme()
  const { settings, update } = useSettings()
  const id = useId()
  const strength = settings.colourStrength
  const word = strength < 25 ? 'A light wash' : strength < 50 ? 'Soft' : strength < 75 ? 'Lively' : 'Bold'
  return (
    <div className="mt-3 space-y-3 border-t border-zinc-200 pt-3">
      <div>
        <div className="mb-1 flex items-center justify-between">
          <label htmlFor={id} className="text-[11px] font-semibold text-zinc-700">
            Strength
          </label>
          <span className="text-[11px] font-medium text-zinc-600">{word}</span>
        </div>
        <input
          id={id}
          type="range"
          min="0"
          max="100"
          step="5"
          value={strength}
          onChange={(e) => update({ colourStrength: Number(e.target.value) })}
          aria-valuetext={word}
          className="w-full cursor-pointer accent-zinc-900"
        />
        <div className="flex justify-between text-[10px] text-zinc-500" aria-hidden="true">
          <span>Light wash</span>
          <span>Bold</span>
        </div>
      </div>
      <label className="flex cursor-pointer items-start gap-2">
        <input type="checkbox" checked={settings.imageTints} onChange={(e) => update({ imageTints: e.target.checked })} className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-zinc-900" />
        <span className="min-w-0 text-[11px] leading-snug text-zinc-700">
          <span className="font-semibold text-zinc-900">Tint with my pictures’ colours</span>
          <span className="block text-zinc-600">
            {!settings.imageTints
              ? 'The washes use the theme’s own colours.'
              : pictureTint
                ? 'The washes take a colour from your logo and photos, so they feel made for your site. Buttons and links keep the theme’s.'
                : pictureColours.length
                  ? 'Your pictures are mostly greys, so the washes use the theme’s colours.'
                  : 'No pictures colorsbymax can read on this page, so the washes use the theme’s colours.'}
          </span>
          {settings.imageTints && pictureColours.length > 0 && (
            <span className="mt-1.5 flex items-center gap-1" aria-hidden="true">
              {pictureColours.slice(0, 8).map((hex) => (
                <span key={hex} data-tip={hex} className={`h-4 w-4 rounded border ${hex === pictureTint ? 'border-zinc-900 ring-2 ring-zinc-900 ring-offset-1' : 'border-black/15'}`} style={{ background: hex }} />
              ))}
            </span>
          )}
        </span>
      </label>
    </div>
  )
}

function ScanCard() {
  const { siteName, scanned, runScan, clearScan } = useTheme()
  const { toast, showGroup } = usePanel()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const scan = async () => {
    setBusy(true)
    setError(null)
    try {
      const { colours, themes } = await runScan()
      showGroup('site', false)
      toast(`Found ${colours} colours and added ${themes} themes to the ${siteName} group.`, { label: 'Show', run: () => showGroup('site') })
    } catch {
      setError('Couldn’t scan this page. Try again after it has finished loading.')
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
              ? 'Themes built from this site’s colours are in its group in Preset themes.'
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
              <span key={hex} className="h-4 w-5" style={{ background: hex }} data-tip={hex} />
            ))}
          </div>
          <button type="button" className="ml-auto text-[11px] font-medium text-zinc-600 underline underline-offset-2 hover:text-zinc-900 cursor-pointer" onClick={() => {
              clearScan()
              toast(`Removed the scanned themes from ${siteName}.`)
            }}
          >
            Remove scan
          </button>
        </div>
      )}
      {error && (
        <p role="alert" className="mt-2 text-[11px] text-red-700">
          {error}
        </p>
      )}
    </div>
  )
}

function ThemeCard({ theme: t, isActive, onSelect }) {
  const { issues, coloursOf, setThemeColours, features } = useTheme()
  const colours = coloursOf(t.id)
  const showContrast = useContext(ContrastNav)
  // The active card reflects live edits and overrides. Library themes are contrast-checked at
  // build time, so only presets, custom palettes and dark twins can fail.
  const stored = useMemo(() => (t.library && !t.derived ? 0 : checkTheme(t.tokens).length), [t])
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
        <Swatches tokens={t.tokens} count={colours} />
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
          data-tip="Contrast problems: review and fix"
          className="absolute right-1.5 top-1.5 inline-flex items-center gap-0.5 rounded-full border border-amber-300 bg-amber-100 px-1.5 py-0.5 text-[11px] font-semibold text-amber-900 hover:bg-amber-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900"
        >
          <AlertTriangle className="w-3 h-3" aria-hidden="true" />
          {count}
        </button>
      )}
      {/* The theme in use: how many of its colours the site uses (5 to 10). */}
      {isActive && features.colourCount && (
        <span className="absolute right-2 bottom-2">
          <ColourStepper value={colours} onChange={(n) => setThemeColours(t.id, n)} label={`Colours ${t.name} uses`} />
        </span>
      )}
    </div>
  )
}

function CustomPalettes() {
  const { customs, active, createCustom, renameCustom, deleteCustom, selectTheme, updateCustomToken, state } = useTheme()
  const { toast, confirmTheme } = usePanel()
  const savedToYours = useSavedToYours()
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
          savedToYours(name.trim() || 'My palette', 'Created')
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
                <button type="button" className={`${btn} w-16 shrink-0`} onClick={() => confirmTheme(() => selectTheme(c.id))}>
                  Edit
                </button>
              )}
              <button
                type="button"
                className={`${btn} shrink-0 px-2`}
                aria-label={`Delete palette ${c.name}`}
                onClick={() => {
                  if (!window.confirm(`Delete “${c.name}”?`)) return
                  deleteCustom(c.id)
                  toast(`Deleted “${c.name}” from Yours.`)
                }}
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
  const { toast } = usePanel()
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
          <button
            type="button"
            className={`${btn} mt-2`}
            onClick={() => {
              const n = Object.keys(overridden).length
              clearOverrides()
              toast(`Cleared ${n} single-colour ${n === 1 ? 'override' : 'overrides'}.`)
            }}
          >
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
        <fieldset key={g.group} className="min-w-0 space-y-1.5">
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
            <span className="flex items-center text-amber-700" data-tip="Part of a failing contrast pairing">
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

const FROM_NOTE = {
  image: 'Picked from the picture’s main colours.',
  pdf: 'Picked from the colours on the first pages.',
  'pdf-text': 'Found colour codes written in the PDF.',
}

const IS_MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)
/** The paste shortcut, as the visitor's keyboard shows it. */
const PASTE_KEYS = IS_MAC ? '⌘V' : 'Ctrl+V'
const PASTED = 'Pasted image'

/** The first image (or PDF) in a clipboard's files: a screenshot, or a copied picture. */
const fileFromClipboard = (data) => [...(data?.files ?? [])].find((f) => f.type.startsWith('image/') || f.type === 'application/pdf')

/**
 * Builds a custom palette from the colours in an image (uploaded, dropped or pasted from the
 * clipboard), or a PDF where the site allows it.
 */
function PaletteFromFile() {
  const { addPalette, loadPdf } = useTheme()
  const kinds = loadPdf ? 'image or PDF' : 'image'
  const savedToYours = useSavedToYours()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [found, setFound] = useState(null) // { fileName, colours, from }
  const [off, setOff] = useState(() => new Set())
  const [name, setName] = useState('')
  const [dragOver, setDragOver] = useState(false)
  // The file being read, shown in the drop zone so it's clear what was added: an image's
  // thumbnail, or a PDF's name. { url (object URL, images only), label, pasted, size? }
  const [picture, setPicture] = useState(null)
  const [flash, setFlash] = useState(false)
  const fileRef = useRef(null)
  const zoneRef = useRef(null)
  const nameId = useId()

  const chosen = found ? found.colours.filter((c) => !off.has(c)) : []
  const preview = useMemo(() => (chosen.length ? themeFromPalette(chosen) : null), [chosen.join()])

  // Object URLs hold the image in memory until revoked: release the old one on change and unmount.
  useEffect(() => () => picture?.url && URL.revokeObjectURL(picture.url), [picture?.url])
  // A paste can come from anywhere in the panel: bring the drop zone, now showing the image, into view.
  useEffect(() => {
    if (!picture?.pasted) return
    const still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    zoneRef.current?.scrollIntoView({ block: 'nearest', behavior: still ? 'auto' : 'smooth' })
  }, [picture?.url, picture?.pasted])
  useEffect(() => {
    if (!flash) return
    const t = setTimeout(() => setFlash(false), 1200)
    return () => clearTimeout(t)
  }, [flash])

  /**
   * @param {string} [label]  what to call the file; pasted images have no useful name
   * @param {boolean} [pasted]
   */
  const read = async (file, label = file?.name, pasted = false) => {
    if (!file) return
    setBusy(true)
    setError(null)
    setFound(null)
    setPicture({ url: file.type.startsWith('image/') ? URL.createObjectURL(file) : null, label, pasted })
    try {
      const { colours, from } = await coloursFromFile(file, { loadPdf })
      if (!colours.length) throw new Error('Couldn’t find any colours in that file.')
      setFound({ fileName: label, colours, from })
      setOff(new Set())
      setName(label.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').trim().slice(0, 60) || 'Uploaded palette')
    } catch (e) {
      setPicture(null)
      setError(e.message || 'Couldn’t read that file.')
    } finally {
      setBusy(false)
    }
  }

  const clear = () => {
    setFound(null)
    setPicture(null)
  }

  /** Reads a pasted image, opening Import / export first if it's collapsed, so the result shows. */
  const readPasted = (file) => {
    const section = zoneRef.current?.closest('details')
    if (section && !section.open) section.open = true
    setFlash(true)
    read(file, PASTED, true)
  }
  const readPastedRef = useRef(readPasted)
  readPastedRef.current = readPasted

  // Ctrl+V / ⌘V anywhere in the panel. Text pasted into a field (a palette name, theme JSON)
  // goes in as usual; only an image on the clipboard is taken.
  useEffect(() => {
    const root = zoneRef.current?.getRootNode()
    if (!root) return
    const onPaste = (e) => {
      const file = fileFromClipboard(e.clipboardData)
      if (!file) return
      const target = e.composedPath()[0]
      const typing = target instanceof HTMLElement && (target.isContentEditable || target.localName === 'input' || target.localName === 'textarea')
      if (typing && e.clipboardData.types.includes('text/plain')) return
      e.preventDefault()
      readPastedRef.current(file)
    }
    root.addEventListener('paste', onPaste)
    return () => root.removeEventListener('paste', onPaste)
  }, [])

  // The Paste button reads the clipboard directly. Browsers that don't allow it, or a visitor
  // who declines, can still use the keyboard shortcut.
  const pasteFromClipboard = async () => {
    setError(null)
    if (!navigator.clipboard?.read) {
      setError(`This browser can’t paste from a button. Press ${PASTE_KEYS} instead.`)
      return
    }
    try {
      for (const item of await navigator.clipboard.read()) {
        const type = item.types.find((t) => t.startsWith('image/'))
        if (type) return readPasted(new File([await item.getType(type)], PASTED, { type }))
      }
      setError('There’s no image on the clipboard. Take a screenshot or copy a picture, then paste.')
    } catch {
      setError(`Couldn’t read the clipboard. Press ${PASTE_KEYS} to paste instead.`)
    }
  }

  const create = () => {
    addPalette(name, preview)
    savedToYours(name.trim() || 'Uploaded palette')
    clear()
  }

  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-zinc-700">Palette from an {kinds}</p>
      <div
        ref={zoneRef}
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragOver(false)
          read(e.dataTransfer.files?.[0])
        }}
        className={`rounded-xl border border-dashed p-3 text-center transition-shadow motion-reduce:transition-none ${dragOver || flash ? 'border-zinc-900 bg-zinc-100' : 'border-zinc-300 bg-zinc-50'} ${flash ? 'ring-2 ring-zinc-900 ring-offset-1' : ''}`}
      >
        {picture && (
          <figure className="mb-2.5 flex items-center gap-3 rounded-lg border border-zinc-200 bg-white p-2 text-left">
            {picture.url ? (
              <img
                src={picture.url}
                alt={picture.label}
                className="h-16 w-24 shrink-0 rounded-md border border-zinc-200 bg-zinc-100 object-contain"
                onLoad={(e) => {
                  // Read the event now: React clears currentTarget before a state updater runs.
                  const { naturalWidth: w, naturalHeight: h, src } = e.currentTarget
                  setPicture((p) => (p && p.url === src ? { ...p, size: `${w} × ${h}` } : p))
                }}
              />
            ) : (
              <span className="grid h-16 w-24 shrink-0 place-items-center rounded-md border border-zinc-200 bg-zinc-100 font-mono text-xs font-semibold text-zinc-600" aria-hidden="true">
                PDF
              </span>
            )}
            <figcaption role="status" className="min-w-0 flex-1 space-y-0.5 text-[11px] text-zinc-600">
              <span className="flex items-center gap-1 font-medium text-zinc-900">
                {busy ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                ) : (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-800" aria-hidden="true" />
                )}
                {picture.pasted ? 'Image pasted' : picture.url ? 'Image added' : 'PDF added'}
              </span>
              <span className="block truncate">
                {picture.label}
                {picture.size ? ` · ${picture.size}` : ''}
              </span>
              <span className="block">{busy ? 'Reading its colours…' : 'Its colours are below.'}</span>
            </figcaption>
            <button type="button" className={`${btn} shrink-0 border-transparent px-1.5`} onClick={clear} aria-label={`Remove ${picture.label}`} data-tip="Remove">
              <X className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </figure>
        )}
        <button type="button" className={btn} onClick={() => fileRef.current?.click()} disabled={busy} aria-busy={busy}>
          {busy ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin motion-reduce:animate-none" aria-hidden="true" />
          ) : (
            <ImageUp className="w-3.5 h-3.5" aria-hidden="true" />
          )}
          {busy ? 'Reading colours…' : picture ? 'Choose another…' : `Choose ${kinds}…`}
        </button>{' '}
        <button type="button" className={btn} onClick={pasteFromClipboard} disabled={busy} aria-keyshortcuts={IS_MAC ? 'Meta+V' : 'Control+V'}>
          <ClipboardPaste className="w-3.5 h-3.5" aria-hidden="true" />
          {picture ? 'Paste another' : 'Paste image'}
        </button>
        {!picture && (
          <p className="mt-1.5 text-[11px] text-zinc-600">
            or drop one here, or press <kbd className="font-mono">{PASTE_KEYS}</kbd> to paste a screenshot. A mood board, screenshot or photo{loadPdf ? ', or a brand guide PDF,' : ''} works.
          </p>
        )}
        <input
          ref={fileRef}
          type="file"
          accept={loadPdf ? 'image/*,application/pdf,.pdf' : 'image/*'}
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
          onChange={(e) => {
            read(e.target.files?.[0])
            e.target.value = ''
          }}
        />
      </div>

      {found && (
        <div className="space-y-2 rounded-xl border border-zinc-200 p-3">
          <p className="text-[11px] text-zinc-600">
            <span className="font-medium text-zinc-900">{found.fileName}</span>: {FROM_NOTE[found.from]} Select a colour to leave it out.
          </p>
          <div role="group" aria-label="Colours found" className="flex flex-wrap gap-1.5">
            {found.colours.map((hex) => {
              const on = !off.has(hex)
              return (
                <button
                  key={hex}
                  type="button"
                  aria-pressed={on}
                  aria-label={`${hex}${on ? '' : ' (left out)'}`}
                  data-tip={hex}
                  onClick={() =>
                    setOff((prev) => {
                      const next = new Set(prev)
                      if (next.has(hex)) next.delete(hex)
                      else next.add(hex)
                      return next
                    })
                  }
                  className={`h-7 w-7 rounded-md border cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-1 ${
                    on ? 'border-zinc-300' : 'border-zinc-300 opacity-25'
                  }`}
                  style={{ background: hex }}
                />
              )
            })}
          </div>
          {preview ? (
            <>
              <p className="text-[11px] text-zinc-600">The palette it builds:</p>
              <Swatches tokens={preview} />
            </>
          ) : (
            <p className="text-[11px] text-zinc-600">Keep at least one colour to build a palette.</p>
          )}
          <label htmlFor={nameId} className="block text-xs font-medium text-zinc-700">Palette name</label>
          <input id={nameId} className={field} value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
          <div className="flex gap-2">
            <button type="button" className={btnPrimary} onClick={create} disabled={!preview}>
              Create palette
            </button>
            <button type="button" className={btn} onClick={clear}>
              Discard
            </button>
          </div>
        </div>
      )}

      {error && (
        <p role="alert" className="text-xs text-red-700">
          {error}
        </p>
      )}
    </div>
  )
}

const EXPORT_FORMATS = [
  { id: 'json', label: 'JSON', type: 'application/json', ext: 'theme.json', what: 'theme JSON' },
  { id: 'css', label: 'CSS', type: 'text/css', ext: 'theme.css', what: 'theme CSS' },
]

function ImportExport() {
  const { exportTheme, importTheme, tokens } = useTheme()
  const { toast } = usePanel()
  const savedToYours = useSavedToYours()
  const json = exportTheme()
  const themeName = JSON.parse(json).name
  const [format, setFormat] = useState('json')
  const out = EXPORT_FORMATS.find((f) => f.id === format)
  // CSS: the theme as --color-* variables on :root, ready to paste into a stylesheet.
  const text = format === 'css' ? `/* ${themeName.replace(/\*\//g, '')}, from colorsbymax */\n${cssSnippet(tokens)}\n` : json
  const [status, setStatus] = useState(null)
  const [input, setInput] = useState('')
  const exportId = useId()
  const importId = useId()
  const fileRef = useRef(null)

  const doImport = (text) => {
    const err = importTheme(text)
    setStatus(err ? { ok: false, text: err } : null)
    if (err) return
    setInput('')
    let name = 'Imported palette'
    try {
      name = JSON.parse(text).name?.trim() || name
    } catch {}
    savedToYours(name, 'Imported')
  }

  return (
    <div className="space-y-4">
      <PaletteFromFile />

      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <label htmlFor={exportId} className="block text-xs font-medium text-zinc-700">Current theme as {out.label}</label>
          <div role="radiogroup" aria-label="Export as" className="flex shrink-0 items-center rounded-lg border border-zinc-200 p-0.5">
            {EXPORT_FORMATS.map((f) => (
              <button
                key={f.id}
                type="button"
                role="radio"
                aria-checked={format === f.id}
                onClick={() => setFormat(f.id)}
                className={`h-6 rounded-md px-2 text-[11px] font-semibold cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 ${
                  format === f.id ? 'bg-zinc-900 text-white' : 'text-zinc-700 hover:bg-zinc-100'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
        <textarea id={exportId} readOnly value={text} rows={5} className={`${field} font-mono text-[11px]`} />
        <div className="flex gap-2">
          <button
            type="button"
            className={btn}
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(text)
                setStatus(null)
                toast(`Copied the ${out.what} to your clipboard.`)
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
              const url = URL.createObjectURL(new Blob([text], { type: out.type }))
              const a = document.createElement('a')
              a.href = url
              a.download = `${themeName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.${out.ext}`
              a.click()
              toast(`Downloaded ${a.download}.`)
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
