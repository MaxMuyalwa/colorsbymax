import { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState } from 'react'
import { AlertTriangle, Check, CheckCircle2, ChevronRight, ClipboardPaste, Copy, Download, ArrowLeft, Globe, ImageUp, Loader2, Monitor, Moon, RotateCcw, ScanLine, ScanSearch, Settings, Shuffle, Paintbrush, Sun, Trash2, Upload, UserRound, Wand2, X } from './icons.jsx'
import { normalizeHex } from './color.js'
import { checkTheme } from './contrast.js'
import { coloursFromFile, themeFromPalette } from './extract.js'
import { BRING_BACK_PROMPT, cssSnippet, keepPrompt, keepSnippet, NODE_PROD, removePrompt, VITE_PROD } from './finish.js'
import { loadLibrary } from './library.js'
import { inMode } from './modes.js'
import { PANEL_PRESETS, useSettings } from './settings.js'
import { useTheme } from './ThemeProvider.jsx'
import { TOKEN_GROUPS, TOKEN_LABELS } from './tokens.js'

const SWATCH_KEYS = ['primary', 'primary-alt', 'primary-dark', 'secondary', 'background', 'ink', 'data-1', 'data-2', 'data-3', 'data-4']

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
const PanelContext = createContext({ toast: () => {}, showGroup: () => {}, reveal: null })
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

export default function ThemePanel() {
  const theme = useTheme()
  const { settings, mode, audit } = useSettings()
  const overrideCount = Object.keys(theme.state.overrides).length
  const [view, setView] = useState('main')
  const returnFocus = useRef(null)
  const rootRef = useRef(null)
  const [toasts, setToasts] = useState([])
  const [reveal, setReveal] = useState(null)

  // At most three toasts at once; the newest goes at the bottom.
  const toast = useCallback((text, action) => setToasts((list) => [...list.slice(-2), { id: ++toastSeq, text, action }]), [])
  const dismiss = useCallback((id) => setToasts((list) => list.filter((t) => t.id !== id)), [])
  const showGroup = useCallback((group, scroll = true) => {
    setView('main')
    setReveal({ group, scroll, at: Date.now() })
  }, [])
  const panelApi = useMemo(() => ({ toast, showGroup, reveal }), [toast, showGroup, reveal])

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

  const resetToDefault = () => {
    theme.resetToDefault()
    // In dark mode, "default" is the dark version of the site's own colours.
    const target = inMode(theme.defaultTheme, mode)
    if (mode === 'dark') theme.selectTheme(target.id, target)
    toast(`Back to ${target.name}, with no overrides.`)
  }

  return (
    <PanelContext.Provider value={panelApi}>
    {/* The panel scrolls inside the dialog, so toasts can sit fixed at its bottom edge. */}
    <div ref={rootRef} className="theme-scroll @container flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain rounded-[inherit]">
      <header className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-zinc-200 bg-white px-4 py-3">
        <div>
          <h2 id="theme-panel-title" className="text-base font-semibold tracking-tight">
            colorsbymax<span className="align-super text-[10px] font-medium">™</span>
          </h2>
          <p className="text-[11px] text-zinc-500">by mrmaxdesigns</p>
        </div>
        <div className="flex items-center gap-1">
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

      {/* Kept mounted while another view is open so open sections and scroll state survive. */}
      <div hidden={view !== 'main'}>
      <ContrastNav.Provider value={(from) => showView('contrast', from)}>
      <Section title="Preset themes" defaultOpen>
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
    </PanelContext.Provider>
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
  const { tokens, active, recolouring } = useTheme()
  const { update } = useSettings()
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
          <CopyBlock label="Code for your site" text={keepSnippet(kind, name, tokens)} />
          <p className="text-[11px] text-zinc-600">
            Not using Vite? Use <code className="font-mono">{NODE_PROD}</code> instead of <code className="font-mono">{VITE_PROD}</code> (Next.js, webpack).
          </p>
          <CopyBlock label="Or ask Claude, Cursor or Copilot" text={keepPrompt(name, tokens)} copyLabel="Copy prompt" />
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
          {!recolouring && <CopyBlock label="CSS for your colours" text={cssSnippet(tokens)} />}
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
        <Toggle checked={settings.showPicks} onChange={(v) => update({ showPicks: v })} label="Max’s picks" note="Hand-tuned colorsbymax themes" />
        <Toggle checked={settings.showLibrary} onChange={(v) => update({ showLibrary: v })} label="Theme library" note="Hundreds of themes in categories, with search" />
        <Toggle checked={settings.showCustom} onChange={(v) => update({ showCustom: v })} label="Custom palettes" />
        <Toggle checked={settings.showOverrides} onChange={(v) => update({ showOverrides: v })} label="Override a single colour" />
        <Toggle checked={settings.showImportExport} onChange={(v) => update({ showImportExport: v })} label="Import / export" />
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
const NO_THEMES = []

function PresetGrid() {
  const { siteName, siteThemes, presets: allPresets, customs, active, selectTheme, state, clearOverrides } = useTheme()
  const { settings, mode, update } = useSettings()
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
      const labels = Object.fromEntries((library?.categories ?? []).map((c) => [c.id, c.label.toLowerCase()]))
      list = list.filter((t) => t.name.toLowerCase().includes(q) || t.tags?.some((tag) => labels[tag]?.includes(q)))
    }
    return list
  }, [q, category, siteThemes, presets, customs, library])

  // Only the cards on screen are converted, since building a dark twin takes a few milliseconds.
  const shown = visible.slice(0, limit).map((t) => inMode(t, mode))
  const needsLibrary = settings.showLibrary && (Boolean(q) || !['site', 'picks', 'yours'].includes(category))
  const catInfo = library?.categories.find((c) => c.id === category)

  const choose = (id) => {
    setCategory(id)
    setQuery('')
    setLimit(PAGE_SIZE)
  }
  const pick = (t) => selectTheme(t.id, t)
  const surprise = () => {
    const pool = visible.length ? visible : (library?.themes ?? [...siteThemes, ...presets])
    pick(inMode(pool[Math.floor(Math.random() * pool.length)], mode))
  }

  return (
    <div ref={wrapRef} className="space-y-3">
      <ScanCard />
      <p className="text-xs text-zinc-600">
        Current theme: <strong className="font-semibold text-zinc-900">{active.name}</strong>
      </p>
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

      <div className="flex gap-2">
        <label htmlFor={searchId} className="sr-only">Search themes</label>
        <input
          id={searchId}
          type="search"
          className={field}
          placeholder={`Search ${(library?.themes.length ?? 0) + presets.length + siteThemes.length + customs.length} themes…`}
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

      <div role="group" aria-label="Your groups" data-groups className="grid grid-cols-3 gap-2">
        {groups.map((g) => {
          const on = !q && category === g.id
          return (
            <button
              key={g.id}
              type="button"
              aria-pressed={on}
              data-tip={`${g.description} (${g.count} ${g.count === 1 ? 'theme' : 'themes'})`}
              onClick={() => choose(g.id)}
              className={`flex h-12 min-w-0 flex-col items-center justify-center gap-0.5 rounded-xl border px-2 text-xs font-semibold @min-[380px]:h-10 @min-[380px]:flex-row @min-[380px]:justify-start @min-[380px]:gap-1.5 @min-[440px]:px-2.5 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-1 ${
                on ? 'border-zinc-900 bg-zinc-900 text-white shadow-sm' : 'border-zinc-200 bg-zinc-100 text-zinc-900 hover:bg-zinc-200'
              }`}
            >
              <g.Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span className="max-w-full truncate">{g.label}</span>
              <span className={`ml-auto hidden pl-1 font-medium tabular-nums @min-[440px]:inline ${on ? 'text-zinc-300' : 'text-zinc-500'}`}>{g.count}</span>
            </button>
          )
        })}
      </div>

      {categories.length > 0 && (
        <>
          <button
            type="button"
            aria-expanded={!settings.libraryCollapsed}
            aria-controls={categoriesId}
            onClick={() => update({ libraryCollapsed: !settings.libraryCollapsed })}
            className="flex w-full items-center gap-1.5 rounded text-[11px] font-semibold uppercase tracking-wide text-zinc-500 hover:text-zinc-900 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900"
          >
            <ChevronRight
              className={`w-3.5 h-3.5 shrink-0 transition-transform motion-reduce:transition-none ${settings.libraryCollapsed ? '' : 'rotate-90'}`}
              aria-hidden="true"
            />
            Library
            {/* Folded away, the label still says which category is showing. */}
            {settings.libraryCollapsed && activeCategory && <span className="normal-case tracking-normal text-zinc-700">· {activeCategory.label}</span>}
            <span className="h-px flex-1 bg-zinc-200" />
            <span className="normal-case tracking-normal font-medium">{settings.libraryCollapsed ? 'Show' : 'Hide'}</span>
          </button>
          <div
            id={categoriesId}
            hidden={settings.libraryCollapsed}
            role="group"
            aria-label="Library categories"
            className="grid grid-cols-2 @min-[380px]:grid-cols-3 gap-2"
          >
            {categories.map((c) => {
              const on = !q && category === c.id
              return (
                <button
                  key={c.id}
                  type="button"
                  aria-pressed={on}
                  data-tip={c.description}
                  onClick={() => choose(c.id)}
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
        </>
      )}

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
          <p className="sr-only" role="status">{visible.length} themes</p>
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
  const { issues } = useTheme()
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
          data-tip="Contrast problems: review and fix"
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
  const { toast } = usePanel()
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
                <button type="button" className={`${btn} w-16 shrink-0`} onClick={() => selectTheme(c.id)}>
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

function ImportExport() {
  const { exportTheme, importTheme } = useTheme()
  const { toast } = usePanel()
  const savedToYours = useSavedToYours()
  const json = exportTheme()
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
        <label htmlFor={exportId} className="block text-xs font-medium text-zinc-700">Current theme as JSON</label>
        <textarea id={exportId} readOnly value={json} rows={5} className={`${field} font-mono text-[11px]`} />
        <div className="flex gap-2">
          <button
            type="button"
            className={btn}
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(json)
                setStatus(null)
                toast('Copied the theme JSON to your clipboard.')
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
