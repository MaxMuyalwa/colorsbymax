// The feedback form: a bug report, suggestion, praise or question, with the areas it's about, a
// rating, screenshots (pasted, dropped, chosen or captured) and the technical details a QA would
// want, attached automatically. Drafts are kept in this browser until sent.
//
// Delivery: the report is POSTed to the site's /api/feedback function (api/feedback.js, which
// emails it through Resend) as multipart form data: a "report" JSON field plus the screenshots as
// files. VITE_FEEDBACK_ENDPOINT points it elsewhere. With no endpoint (the dev server), or if
// sending fails, the visitor gets the finished report to open as a GitHub issue, copy, or download.

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import {
  Bug, Camera, Check, ChevronDown, ClipboardPaste, Copy, Download, Heart, ImagePlus, Lightbulb, Loader2, MessageCircleQuestion,
  MessageSquarePlus, Send, Star, Trash2, X,
} from 'lucide-react'
import { useTheme } from '../../src/index.js'
import { version } from '../../package.json'
import { GitHubIcon, REPO } from './ui.jsx'

const ENDPOINT = import.meta.env.VITE_FEEDBACK_ENDPOINT ?? (import.meta.env.PROD ? `${import.meta.env.BASE_URL}api/feedback` : null)
const SEND_BUDGET = 3.5 * 1024 * 1024 // screenshots together, under the server's 4 MB limit
const DRAFT_KEY = 'colorsbymax-site:feedback-draft'
const MAX_SHOTS = 6
const MAX_SHOT_BYTES = 12 * 1024 * 1024
const MAX_SHOT_SIDE = 2400 // larger screenshots are scaled down to keep reports light
const OPEN_EVENT = 'colorsbymax:feedback'

/** Opens the feedback form from anywhere on the page, optionally set to a kind (bug, idea, praise, question). */
export const openFeedback = (kind) => window.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: typeof kind === 'string' ? kind : null }))

// `send` is the submit button's text: short and friendly, since every report helps.
const KINDS = [
  { id: 'bug', label: 'Bug report', hint: 'Something broke or looks wrong', Icon: Bug, send: 'Squash this bug' },
  { id: 'idea', label: 'Suggestion', hint: 'An idea or a missing feature', Icon: Lightbulb, send: 'Share the spark' },
  { id: 'praise', label: 'Praise', hint: 'Something you love', Icon: Heart, send: 'Send the love' },
  { id: 'question', label: 'Question', hint: 'Not sure how something works', Icon: MessageCircleQuestion, send: 'Ask away' },
]

const AREAS = [
  'Colour button', 'Panel', 'Theme library', 'Max’s picks', 'Custom palettes', 'Palette from an image', 'Contrast checks', 'Audit',
  'Light & dark mode', 'Settings', 'Import / export', '“I’m done”', 'Re-colouring my site', 'Installing', 'MCP / AI agents', 'Docs & README',
  'This website', 'Other',
]

const RATINGS = ['Poor', 'Needs work', 'Good', 'Great', 'Love it']
const SEVERITY = [
  ['blocker', 'Blocks me'],
  ['major', 'Major'],
  ['minor', 'Minor'],
  ['cosmetic', 'Cosmetic'],
]
const FREQUENCY = [
  ['always', 'Every time'],
  ['sometimes', 'Sometimes'],
  ['once', 'Happened once'],
]

const EMPTY = { kind: 'bug', areas: [], rating: 0, summary: '', details: '', steps: '', expected: '', actual: '', severity: '', frequency: '', suggestion: '', name: '', github: '', email: '', contact: false, includeTech: true }

// Recent errors on the page, for bug reports. Collected from the moment this module loads.
const recentErrors = []
if (typeof window !== 'undefined') {
  const note = (message) => {
    recentErrors.push({ at: new Date().toISOString(), message: String(message).slice(0, 300) })
    if (recentErrors.length > 10) recentErrors.shift()
  }
  window.addEventListener('error', (e) => note(e.message || e.error))
  window.addEventListener('unhandledrejection', (e) => note(e.reason?.message ?? e.reason))
}

function loadDraft() {
  try {
    return { ...EMPTY, ...JSON.parse(localStorage.getItem(DRAFT_KEY) ?? '{}') }
  } catch {
    return EMPTY
  }
}

function browserName(ua) {
  const m = ua.match(/(Edg|OPR|Firefox|Chrome|Safari)\/([\d.]+)/g) ?? []
  const pick = (name) => m.find((x) => x.startsWith(name))
  const found = pick('Edg') ?? pick('OPR') ?? pick('Firefox') ?? pick('Chrome') ?? pick('Safari')
  return found ? found.replace('Edg', 'Edge').replace('OPR', 'Opera').replace('/', ' ') : 'Unknown'
}
function osName(ua) {
  if (/Windows NT 10/.test(ua)) return 'Windows 10/11'
  if (/Windows/.test(ua)) return 'Windows'
  if (/iPhone|iPad/.test(ua)) return 'iOS'
  if (/Mac OS X/.test(ua)) return 'macOS'
  if (/Android/.test(ua)) return 'Android'
  if (/Linux/.test(ua)) return 'Linux'
  return 'Unknown'
}

/** What the report says about where it came from. */
function useEnvironment() {
  const { active } = useTheme()
  return useCallback(() => {
    let panelMode = 'light'
    try {
      panelMode = JSON.parse(localStorage.getItem('colorsbymax-demo:settings') ?? '{}').mode ?? 'light'
    } catch {}
    const ua = navigator.userAgent
    return {
      Page: location.href,
      Browser: browserName(ua),
      System: osName(ua),
      Screen: `${screen.width} × ${screen.height} (${window.devicePixelRatio}x)`,
      Window: `${innerWidth} × ${innerHeight}`,
      'Device colour scheme': matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
      'Reduced motion': matchMedia('(prefers-reduced-motion: reduce)').matches ? 'on' : 'off',
      Language: navigator.language,
      Theme: `${active.name} (${active.id})`,
      'Panel mode': panelMode,
      colorsbymax: version,
      Time: new Date().toISOString(),
      'Recent page errors': recentErrors.length ? recentErrors.map((e) => e.message).join(' | ') : 'none',
    }
  }, [active])
}

/** Reads an image file as a data URL, scaled down if it's very large. */
async function readShot(file, name = file.name) {
  if (!file.type.startsWith('image/')) throw new Error(`${name} isn’t an image.`)
  if (file.size > MAX_SHOT_BYTES) throw new Error(`${name} is over 12 MB.`)
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise((resolve, reject) => {
      const i = new Image()
      i.onload = () => resolve(i)
      i.onerror = () => reject(new Error(`Couldn’t read ${name}.`))
      i.src = url
    })
    const scale = Math.min(1, MAX_SHOT_SIDE / Math.max(img.naturalWidth, img.naturalHeight))
    const canvas = Object.assign(document.createElement('canvas'), { width: Math.round(img.naturalWidth * scale), height: Math.round(img.naturalHeight * scale) })
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
    const type = file.type === 'image/png' || file.type === 'image/webp' ? 'image/png' : 'image/jpeg'
    const data = canvas.toDataURL(type, 0.9)
    return { id: crypto.randomUUID?.() ?? String(Math.random()), name, data, width: canvas.width, height: canvas.height }
  } finally {
    URL.revokeObjectURL(url)
  }
}

/** A screenshot as a JPEG blob for sending, at most `side` pixels on its longer edge. */
async function shotBlob(shot, side, quality) {
  const img = await new Promise((resolve, reject) => {
    const i = new Image()
    i.onload = () => resolve(i)
    i.onerror = reject
    i.src = shot.data
  })
  const scale = Math.min(1, side / Math.max(img.naturalWidth, img.naturalHeight))
  const canvas = Object.assign(document.createElement('canvas'), { width: Math.round(img.naturalWidth * scale), height: Math.round(img.naturalHeight * scale) })
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#ffffff' // JPEG has no transparency
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality))
}

/** All the screenshots as JPEGs, made smaller until they fit the send budget together. */
async function shotsForSending(shots) {
  for (const [side, quality] of [[1920, 0.85], [1600, 0.8], [1280, 0.75], [1024, 0.7], [800, 0.6]]) {
    const blobs = await Promise.all(shots.map((s) => shotBlob(s, side, quality)))
    if (blobs.reduce((n, b) => n + b.size, 0) <= SEND_BUDGET) return blobs.map((b, i) => [b, shots[i].name.replace(/\.\w+$/, '') + '.jpg'])
  }
  throw new Error('Screenshots too large')
}

const stars = (n) => (n ? `${'★'.repeat(n)}${'☆'.repeat(5 - n)} (${n}/5, ${RATINGS[n - 1]})` : 'not rated')

/** The report as Markdown, for GitHub issues and copying. */
function toMarkdown(f, env, shots) {
  const kind = KINDS.find((k) => k.id === f.kind)?.label ?? f.kind
  const lines = [`## ${kind}: ${f.summary.trim() || '(no summary)'}`, '']
  const meta = [`**Areas:** ${f.areas.length ? f.areas.join(', ') : 'not given'}`, `**Rating:** ${stars(f.rating)}`]
  if (f.kind === 'bug') {
    meta.push(`**Severity:** ${SEVERITY.find((s) => s[0] === f.severity)?.[1] ?? 'not given'}`)
    meta.push(`**How often:** ${FREQUENCY.find((s) => s[0] === f.frequency)?.[1] ?? 'not given'}`)
  }
  lines.push(meta.join('  \n'), '')
  const section = (title, text) => text.trim() && lines.push(`### ${title}`, '', text.trim(), '')
  section(f.kind === 'bug' ? 'What happened' : 'Details', f.details)
  if (f.kind === 'bug') {
    section('Steps to reproduce', f.steps)
    section('Expected', f.expected)
    section('Actual', f.actual)
  }
  section('Suggestions', f.suggestion)
  const from = [f.name && `Name: ${f.name}`, f.github && `GitHub: @${f.github.replace(/^@/, '')}`, f.email && `Email: ${f.email}`, f.email && `Happy to be contacted: ${f.contact ? 'yes' : 'no'}`].filter(Boolean)
  if (from.length) lines.push('### From', '', from.join('  \n'), '')
  if (shots.length) lines.push(`### Screenshots`, '', `${shots.length} attached: ${shots.map((s) => s.name).join(', ')}`, '')
  if (env) lines.push('### Technical details', '', '| | |', '| --- | --- |', ...Object.entries(env).map(([k, v]) => `| ${k} | ${String(v).replace(/\|/g, '\\|')} |`), '')
  return lines.join('\n')
}

// ------------------------------------------------------------------ small parts

function Field({ label, hint, children, id, error, optional }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 flex items-baseline justify-between gap-2 text-sm font-semibold text-ink">
        <span>{label}</span>
        {optional && <span className="text-xs font-normal text-ink-muted">Optional</span>}
      </label>
      {children}
      {hint && !error && <p className="mt-1 text-xs text-ink-muted">{hint}</p>}
      {error && (
        <p id={`${id}-error`} className="mt-1 text-xs font-semibold text-danger">
          {error}
        </p>
      )}
    </div>
  )
}

const input =
  'w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-ink placeholder:text-ink-muted transition focus:border-primary focus:ring-2 focus:ring-primary/25 focus:outline-none aria-[invalid=true]:border-danger'

function Legend({ children, optional }) {
  return (
    <legend className="mb-2 flex w-full items-baseline justify-between gap-2 text-sm font-semibold text-ink">
      <span>{children}</span>
      {optional && <span className="text-xs font-normal text-ink-muted">Optional</span>}
    </legend>
  )
}

function StarRating({ value, onChange }) {
  const [hover, setHover] = useState(0)
  const shown = hover || value
  return (
    <fieldset>
      <Legend optional>How would you rate colorsbymax?</Legend>
      <div className="flex flex-wrap items-center gap-3" onMouseLeave={() => setHover(0)}>
        <div role="radiogroup" aria-label="Rating" className="flex gap-1">
          {RATINGS.map((label, i) => {
            const n = i + 1
            return (
              <button
                key={label}
                type="button"
                role="radio"
                aria-checked={value === n}
                aria-label={`${n} of 5: ${label}`}
                onMouseEnter={() => setHover(n)}
                onFocus={() => setHover(n)}
                onBlur={() => setHover(0)}
                onClick={() => onChange(value === n ? 0 : n)}
                className="group grid h-10 w-10 cursor-pointer place-items-center rounded-xl transition hover:bg-accent focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
              >
                <Star className={`h-6 w-6 transition-transform duration-200 group-hover:scale-110 ${n <= shown ? 'fill-warning text-warning' : 'text-ink-muted'}`} aria-hidden="true" />
              </button>
            )
          })}
        </div>
        <span className="text-sm font-semibold text-ink-secondary" aria-live="polite">
          {shown ? RATINGS[shown - 1] : 'Tap a star'}
        </span>
      </div>
    </fieldset>
  )
}

/** Choice chips. `onToggle` is called with the chip's id; the parent works out the new value. */
function Chips({ options, value, onToggle, multiple, label, optional }) {
  const toggle = onToggle
  return (
    <fieldset>
      <Legend optional={optional}>{label}</Legend>
      <div className="flex flex-wrap gap-2">
        {options.map(([id, text]) => {
          const on = multiple ? value.includes(id) : value === id
          return (
            <button
              key={id}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(id)}
              className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none ${
                on ? 'border-primary bg-primary text-on-primary' : 'border-border bg-background text-ink-secondary hover:border-primary hover:text-ink'
              }`}
            >
              {on && <Check className="h-3.5 w-3.5" aria-hidden="true" />}
              {text}
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}

// ------------------------------------------------------------------ screenshots

function Screenshots({ shots, setShots, onError, capturing, setCapturing }) {
  const fileRef = useRef(null)
  const [drag, setDrag] = useState(false)
  const canCapture = typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices?.getDisplayMedia)

  const add = async (files, label) => {
    const room = MAX_SHOTS - shots.length
    if (room <= 0) return onError(`Up to ${MAX_SHOTS} screenshots.`)
    const list = [...files].filter((f) => f.type.startsWith('image/')).slice(0, room)
    if (!list.length) return onError('Those files aren’t images.')
    try {
      const read = await Promise.all(list.map((f, i) => readShot(f, label ? `${label}${list.length > 1 ? ` ${i + 1}` : ''}.png` : f.name)))
      setShots((s) => [...s, ...read])
      onError(null)
    } catch (e) {
      onError(e.message)
    }
  }

  // A screenshot of this page: the browser asks which tab or screen to share; the form hides
  // itself for the moment of capture.
  const capture = async () => {
    let stream
    try {
      stream = await navigator.mediaDevices.getDisplayMedia({ video: { displaySurface: 'browser' }, audio: false, preferCurrentTab: true, selfBrowserSurface: 'include' })
      setCapturing(true)
      await new Promise((r) => setTimeout(r, 450))
      const video = Object.assign(document.createElement('video'), { srcObject: stream, muted: true, playsInline: true })
      await video.play()
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
      const canvas = Object.assign(document.createElement('canvas'), { width: video.videoWidth, height: video.videoHeight })
      canvas.getContext('2d').drawImage(video, 0, 0)
      const blob = await new Promise((r) => canvas.toBlob(r, 'image/png'))
      await add([new File([blob], 'Page capture.png', { type: 'image/png' })], 'Page capture')
    } catch (e) {
      if (e?.name !== 'NotAllowedError') onError('Couldn’t capture the page. Take a screenshot yourself and paste it here instead.')
    } finally {
      stream?.getTracks().forEach((t) => t.stop())
      setCapturing(false)
    }
  }

  return (
    <fieldset>
      <Legend optional>Screenshots</Legend>
      <div
        onDragOver={(e) => {
          e.preventDefault()
          setDrag(true)
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDrag(false)
          add(e.dataTransfer.files)
        }}
        className={`rounded-2xl border-2 border-dashed p-4 text-center transition ${drag ? 'border-primary bg-secondary' : 'border-border bg-background'}`}
      >
        <ImagePlus className="mx-auto h-7 w-7 text-primary" aria-hidden="true" />
        <p className="mt-2 text-sm text-ink">
          <strong>Paste</strong> ({/Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent) ? '⌘V' : 'Ctrl+V'}), drop or choose up to {MAX_SHOTS} screenshots
        </p>
        <div className="mt-3 flex flex-wrap justify-center gap-2">
          <button type="button" onClick={() => fileRef.current?.click()} disabled={shots.length >= MAX_SHOTS} className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-sm font-semibold text-ink transition hover:border-primary disabled:opacity-50">
            <ClipboardPaste className="h-4 w-4" aria-hidden="true" /> Choose images
          </button>
          {canCapture && (
            <button type="button" onClick={capture} disabled={shots.length >= MAX_SHOTS || capturing} className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-sm font-semibold text-ink transition hover:border-primary disabled:opacity-50">
              <Camera className="h-4 w-4" aria-hidden="true" /> Capture this page
            </button>
          )}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
          onChange={(e) => {
            add(e.target.files)
            e.target.value = ''
          }}
        />
      </div>
      {shots.length > 0 && (
        <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {shots.map((s, i) => (
            <li key={s.id} className="group relative overflow-hidden rounded-xl border border-border bg-background">
              <img src={s.data} alt={`Screenshot ${i + 1}: ${s.name}`} className="aspect-video w-full object-cover object-top" />
              <p className="truncate px-2 py-1 text-[11px] text-ink-muted">
                {s.name} · {s.width}×{s.height}
              </p>
              <button
                type="button"
                onClick={() => setShots((all) => all.filter((x) => x.id !== s.id))}
                aria-label={`Remove ${s.name}`}
                className="absolute top-1.5 right-1.5 grid h-7 w-7 cursor-pointer place-items-center rounded-full bg-surface/90 text-ink shadow transition hover:bg-danger hover:text-on-primary"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </fieldset>
  )
}

// ------------------------------------------------------------------ the form

export function Feedback() {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(loadDraft)
  const [shots, setShots] = useState([])
  const [errors, setErrors] = useState({})
  const [shotError, setShotError] = useState(null)
  const [status, setStatus] = useState('editing') // editing | sending | sent | ready | failed
  const [capturing, setCapturing] = useState(false)
  const [copied, setCopied] = useState(false)
  const [showTech, setShowTech] = useState(false)
  const dialogRef = useRef(null)
  const openerRef = useRef(null)
  const ids = useId()
  const environment = useEnvironment()
  // After a failed send, focus moves to the first field that needs attention, once it has rendered.
  const focusError = useRef(false)
  const honeypot = useRef(null)
  useEffect(() => {
    if (!focusError.current) return
    focusError.current = false
    dialogRef.current?.querySelector('[aria-invalid="true"]')?.focus()
  }, [errors])
  // Patches build on the latest form, so quick successive clicks are never lost.
  const set = (patch) => setForm((f) => ({ ...f, ...(typeof patch === 'function' ? patch(f) : patch) }))
  const pickOne = (key) => (id) => set((f) => ({ [key]: f[key] === id ? '' : id }))

  // Opened from the top bar, the menu or the footer.
  useEffect(() => {
    const onOpen = (e) => {
      openerRef.current = document.activeElement
      if (KINDS.some((k) => k.id === e.detail)) setForm((f) => ({ ...f, kind: e.detail }))
      setStatus('editing')
      setOpen(true)
    }
    window.addEventListener(OPEN_EVENT, onOpen)
    return () => window.removeEventListener(OPEN_EVENT, onOpen)
  }, [])

  // Keep the draft (text only; screenshots stay in memory).
  useEffect(() => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(form))
    } catch {}
  }, [form])

  const close = useCallback(() => {
    setOpen(false)
    setTimeout(() => openerRef.current?.focus?.(), 0)
  }, [])

  // Focus, Escape, a simple focus trap, and no page scrolling behind the form.
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    requestAnimationFrame(() => dialogRef.current?.querySelector('[data-autofocus]')?.focus())
    const onKey = (e) => {
      if (e.key === 'Escape') close()
      if (e.key !== 'Tab') return
      const items = [...dialogRef.current.querySelectorAll('button, input, textarea, select, a[href]')].filter((el) => !el.disabled && el.offsetParent !== null)
      if (!items.length) return
      const [first, last] = [items[0], items[items.length - 1]]
      if (e.shiftKey && document.activeElement === first) (e.preventDefault(), last.focus())
      else if (!e.shiftKey && document.activeElement === last) (e.preventDefault(), first.focus())
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      document.removeEventListener('keydown', onKey)
    }
  }, [open, close])

  // Pasting a screenshot anywhere in the form adds it (text pasted into a field goes in as usual).
  const onPaste = async (e) => {
    const files = [...(e.clipboardData?.files ?? [])].filter((f) => f.type.startsWith('image/'))
    if (!files.length) return
    const typing = /^(input|textarea)$/.test(e.target.localName)
    if (typing && e.clipboardData.types.includes('text/plain')) return
    e.preventDefault()
    const room = MAX_SHOTS - shots.length
    if (room <= 0) return setShotError(`Up to ${MAX_SHOTS} screenshots.`)
    try {
      const read = await Promise.all(files.slice(0, room).map((f, i) => readShot(f, `Pasted screenshot ${shots.length + i + 1}.png`)))
      setShots((s) => [...s, ...read])
      setShotError(null)
    } catch (err) {
      setShotError(err.message)
    }
  }

  const env = useMemo(() => (open && form.includeTech ? environment() : null), [open, form.includeTech, environment, status])
  const markdown = () => toMarkdown(form, form.includeTech ? environment() : null, shots)

  const validate = () => {
    const e = {}
    if (!form.summary.trim()) e.summary = 'Give it a short title, so it’s easy to find.'
    if (!form.name.trim()) e.name = 'Add your name, so Max knows who to thank.'
    if (form.kind === 'bug' && !form.details.trim() && !form.steps.trim()) e.details = 'Say what happened, or list the steps to reproduce it.'
    if (form.kind !== 'bug' && !form.details.trim() && !form.suggestion.trim() && !form.rating) e.details = 'Add a few words, a suggestion or a rating.'
    if (form.email && !/^\S+@\S+\.\S+$/.test(form.email)) e.email = 'That doesn’t look like an email address.'
    setErrors(e)
    if (Object.keys(e).length) {
      focusError.current = true
      return false
    }
    return true
  }

  const submit = async (e) => {
    e.preventDefault()
    if (!validate()) return
    const report = { ...form, github: form.github.replace(/^@/, ''), environment: form.includeTech ? environment() : null, markdown: markdown(), screenshots: shots.map(({ name, width, height }) => ({ name, width, height })) }
    if (!ENDPOINT) return setStatus('ready')
    setStatus('sending')
    try {
      const body = new FormData()
      body.append('report', JSON.stringify(report))
      body.append('website', honeypot.current?.value ?? '')
      for (const [blob, name] of await shotsForSending(shots)) body.append('screenshots', blob, name)
      const res = await fetch(ENDPOINT, { method: 'POST', body })
      if (!res.ok) throw new Error(String(res.status))
      setStatus('sent')
      clearDraft()
    } catch {
      setStatus('failed')
    }
  }

  const clearDraft = () => {
    setForm(EMPTY)
    setShots([])
    setErrors({})
    try {
      localStorage.removeItem(DRAFT_KEY)
    } catch {}
  }

  const issueUrl = () => {
    const kind = KINDS.find((k) => k.id === form.kind)?.label
    let body = markdown()
    if (shots.length) body += `\n_${shots.length} screenshot${shots.length > 1 ? 's' : ''} to attach: drag ${shots.length > 1 ? 'them' : 'it'} into this issue._`
    if (body.length > 6000) body = `${body.slice(0, 6000)}\n\n…(shortened)`
    return `${REPO}/issues/new?${new URLSearchParams({ title: `${kind}: ${form.summary.trim()}`, body })}`
  }
  const copyMarkdown = async () => {
    try {
      await navigator.clipboard.writeText(markdown())
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch {}
  }
  const download = () => {
    const report = { ...form, environment: form.includeTech ? environment() : null, markdown: markdown(), screenshots: shots.map(({ name, data }) => ({ name, data })) }
    const a = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' })),
      download: `colorsbymax-feedback-${new Date().toISOString().slice(0, 10)}.json`,
    })
    a.click()
    URL.revokeObjectURL(a.href)
  }

  if (!open) return null
  const kind = KINDS.find((k) => k.id === form.kind)
  const done = status === 'sent' || status === 'ready'

  return (
    <div className={`fixed inset-0 z-[80] flex items-end justify-center sm:items-center sm:p-6 ${capturing ? 'invisible' : ''}`}>
      <div className="absolute inset-0 animate-[fade-in_200ms_ease-out] bg-ink/40 backdrop-blur-sm" onClick={close} aria-hidden="true" />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${ids}-title`}
        onPaste={onPaste}
        className="relative flex max-h-[94vh] w-full max-w-2xl animate-[tab-in_300ms_ease-out] flex-col overflow-hidden rounded-t-[2rem] border border-border bg-surface shadow-2xl shadow-shadow/30 sm:rounded-[2rem]"
      >
        <header className="relative flex shrink-0 items-start justify-between gap-4 overflow-hidden border-b border-border px-6 pt-6 pb-5">
          <div className="blob -top-24 -right-10 h-48 w-48 bg-primary-alt opacity-25" aria-hidden="true" />
          <div className="relative">
            <p className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-secondary px-2.5 py-0.5 text-xs font-semibold text-on-secondary">
              <MessageSquarePlus className="h-3.5 w-3.5" aria-hidden="true" /> Feedback
            </p>
            <h2 id={`${ids}-title`} className="font-display text-2xl font-bold text-ink">
              {done ? (status === 'sent' ? 'Thank you!' : 'Your report is ready') : 'Help make colorsbymax better'}
            </h2>
            {!done && <p className="mt-1 text-sm text-ink-secondary">Found a bug, have an idea, or just love it? Every report is read.</p>}
          </div>
          <button type="button" onClick={close} aria-label="Close feedback" className="relative grid h-9 w-9 shrink-0 cursor-pointer place-items-center rounded-full text-ink transition hover:bg-accent hover:text-on-accent">
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </header>

        {done ? (
          <div className="space-y-5 overflow-y-auto px-6 py-6">
            {status === 'sent' ? (
              <p className="text-ink-secondary">Your feedback was sent. Thanks for taking the time.</p>
            ) : (
              <>
                <p className="text-ink-secondary">
                  Send it by opening a GitHub issue with everything filled in, or copy or download it.
                  {shots.length > 0 && ' GitHub can’t take screenshots through a link, so drag them into the issue, or download the full report with them included.'}
                </p>
                <div className="grid gap-3 sm:grid-cols-3">
                  <a href={issueUrl()} target="_blank" rel="noopener" className="shine inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 font-semibold text-on-primary shadow-lg shadow-primary/25 transition hover:-translate-y-0.5">
                    <GitHubIcon className="h-4 w-4" /> Open as an issue
                  </a>
                  <button type="button" onClick={copyMarkdown} className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-border bg-background px-4 py-3 font-semibold text-ink transition hover:border-primary">
                    {copied ? <Check className="h-4 w-4 text-success" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />} {copied ? 'Copied' : 'Copy report'}
                  </button>
                  <button type="button" onClick={download} className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-border bg-background px-4 py-3 font-semibold text-ink transition hover:border-primary">
                    <Download className="h-4 w-4" aria-hidden="true" /> Download
                  </button>
                </div>
              </>
            )}
            <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-5">
              {status === 'ready' && (
                <button type="button" onClick={() => setStatus('editing')} className="cursor-pointer rounded-full px-4 py-2 text-sm font-semibold text-ink-secondary hover:bg-accent hover:text-on-accent">
                  Back to the form
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  clearDraft()
                  close()
                }}
                className="cursor-pointer rounded-full bg-ink px-5 py-2 text-sm font-semibold text-background"
              >
                {status === 'sent' ? 'Close' : 'Done, clear the form'}
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} noValidate className="flex min-h-0 flex-1 flex-col">
            <div className="flex-1 space-y-7 overflow-y-auto px-6 py-6">
              <fieldset>
                <Legend>What kind of feedback?</Legend>
                <div role="radiogroup" aria-label="Kind of feedback" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {KINDS.map(({ id, label, hint, Icon }, i) => {
                    const on = form.kind === id
                    return (
                      <button
                        key={id}
                        type="button"
                        role="radio"
                        aria-checked={on}
                        data-autofocus={i === 0 ? true : undefined}
                        onClick={() => set({ kind: id })}
                        className={`group flex cursor-pointer flex-col items-start gap-1 rounded-2xl border p-3 text-left transition focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none ${
                          on ? 'border-primary bg-secondary text-on-secondary shadow-md shadow-primary/15' : 'border-border bg-background text-ink hover:-translate-y-0.5 hover:border-primary'
                        }`}
                      >
                        <Icon className={`h-5 w-5 transition-transform duration-300 group-hover:-rotate-6 ${on ? '' : 'text-primary'}`} aria-hidden="true" />
                        <span className="text-sm font-bold">{label}</span>
                        <span className="text-[11px] leading-snug opacity-80">{hint}</span>
                      </button>
                    )
                  })}
                </div>
              </fieldset>

              <Chips label="What’s it about?" optional multiple options={AREAS.map((a) => [a, a])} value={form.areas} onToggle={(id) => set((f) => ({ areas: f.areas.includes(id) ? f.areas.filter((a) => a !== id) : [...f.areas, id] }))} />

              <Field label="Summary" id={`${ids}-summary`} error={errors.summary} hint="One line, like a title.">
                <input
                  id={`${ids}-summary`}
                  className={input}
                  value={form.summary}
                  maxLength={120}
                  aria-invalid={Boolean(errors.summary)}
                  aria-describedby={errors.summary ? `${ids}-summary-error` : undefined}
                  placeholder={{ bug: 'The panel closes when I pick a dark theme', idea: 'Let me pin favourite themes', praise: 'The dark twins look great', question: 'Can I use it without React?' }[form.kind]}
                  onChange={(e) => set({ summary: e.target.value })}
                />
              </Field>

              <Field label={form.kind === 'bug' ? 'What happened?' : 'Tell us more'} id={`${ids}-details`} error={errors.details} optional={form.kind !== 'bug'}>
                <textarea
                  id={`${ids}-details`}
                  className={`${input} min-h-28 resize-y`}
                  value={form.details}
                  aria-invalid={Boolean(errors.details)}
                  aria-describedby={errors.details ? `${ids}-details-error` : undefined}
                  placeholder={form.kind === 'bug' ? 'Describe the problem. You can paste screenshots right here too.' : 'Anything you’d like to say. You can paste screenshots here too.'}
                  onChange={(e) => set({ details: e.target.value })}
                />
              </Field>

              {form.kind === 'bug' && (
                <div className="space-y-5 rounded-2xl border border-border bg-background/60 p-4">
                  <p className="text-xs font-semibold tracking-wide text-ink-muted uppercase">For bug reports</p>
                  <Field label="Steps to reproduce" id={`${ids}-steps`} optional>
                    <textarea id={`${ids}-steps`} className={`${input} min-h-24 resize-y font-mono text-[13px]`} value={form.steps} placeholder={'1. Open the colour panel\n2. Pick “Ocean” in the library\n3. Switch to dark mode'} onChange={(e) => set({ steps: e.target.value })} />
                  </Field>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="What you expected" id={`${ids}-expected`} optional>
                      <textarea id={`${ids}-expected`} className={`${input} min-h-20 resize-y`} value={form.expected} onChange={(e) => set({ expected: e.target.value })} />
                    </Field>
                    <Field label="What happened instead" id={`${ids}-actual`} optional>
                      <textarea id={`${ids}-actual`} className={`${input} min-h-20 resize-y`} value={form.actual} onChange={(e) => set({ actual: e.target.value })} />
                    </Field>
                  </div>
                  <Chips label="How bad is it?" optional options={SEVERITY} value={form.severity} onToggle={pickOne('severity')} />
                  <Chips label="How often?" optional options={FREQUENCY} value={form.frequency} onToggle={pickOne('frequency')} />
                </div>
              )}

              <Screenshots shots={shots} setShots={setShots} onError={setShotError} capturing={capturing} setCapturing={setCapturing} />
              {shotError && <p className="-mt-5 text-xs font-semibold text-danger">{shotError}</p>}

              <StarRating value={form.rating} onChange={(rating) => set({ rating })} />

              <Field label="Suggestions" id={`${ids}-suggestion`} optional hint="What would make colorsbymax better for you?">
                <textarea id={`${ids}-suggestion`} className={`${input} min-h-20 resize-y`} value={form.suggestion} onChange={(e) => set({ suggestion: e.target.value })} />
              </Field>

              <fieldset className="rounded-2xl border border-border p-4">
                <Legend>About you</Legend>
                <div className="grid gap-4 sm:grid-cols-3">
                  <Field label="Name" id={`${ids}-name`} error={errors.name}>
                    <input
                      id={`${ids}-name`}
                      className={input}
                      value={form.name}
                      autoComplete="name"
                      required
                      aria-invalid={Boolean(errors.name)}
                      aria-describedby={errors.name ? `${ids}-name-error` : undefined}
                      onChange={(e) => set({ name: e.target.value })}
                    />
                  </Field>
                  <Field label="GitHub username" id={`${ids}-github`} optional>
                    <div className="relative">
                      <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-ink-muted">@</span>
                      <input id={`${ids}-github`} className={`${input} pl-7`} value={form.github.replace(/^@/, '')} autoComplete="username" spellCheck={false} onChange={(e) => set({ github: e.target.value })} />
                    </div>
                  </Field>
                  <Field label="Email" id={`${ids}-email`} error={errors.email} optional>
                    <input
                      id={`${ids}-email`}
                      type="email"
                      className={input}
                      value={form.email}
                      autoComplete="email"
                      aria-invalid={Boolean(errors.email)}
                      aria-describedby={errors.email ? `${ids}-email-error` : undefined}
                      onChange={(e) => set({ email: e.target.value })}
                    />
                  </Field>
                </div>
                {form.email && (
                  <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm text-ink-secondary">
                    <input type="checkbox" className="h-4 w-4 accent-primary" checked={form.contact} onChange={(e) => set({ contact: e.target.checked })} />
                    It’s OK to email me about this
                  </label>
                )}
              </fieldset>

              <div className="rounded-2xl border border-border p-4">
                <label className="flex cursor-pointer items-start gap-3">
                  <input type="checkbox" className="mt-0.5 h-4 w-4 accent-primary" checked={form.includeTech} onChange={(e) => set({ includeTech: e.target.checked })} />
                  <span>
                    <span className="block text-sm font-semibold text-ink">Include technical details</span>
                    <span className="block text-xs text-ink-muted">Browser, screen size, the theme you’re on and recent page errors. It helps reproduce bugs.</span>
                  </span>
                </label>
                {form.includeTech && (
                  <>
                    <button type="button" onClick={() => setShowTech((s) => !s)} aria-expanded={showTech} className="mt-3 inline-flex cursor-pointer items-center gap-1 text-xs font-semibold text-primary">
                      <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showTech ? 'rotate-180' : ''}`} aria-hidden="true" /> {showTech ? 'Hide' : 'See'} what’s included
                    </button>
                    {showTech && env && (
                      <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 rounded-xl bg-background p-3 text-xs">
                        {Object.entries(env).map(([k, v]) => (
                          <div key={k} className="contents">
                            <dt className="text-ink-muted">{k}</dt>
                            <dd className="min-w-0 truncate font-mono text-ink" title={String(v)}>
                              {String(v)}
                            </dd>
                          </div>
                        ))}
                      </dl>
                    )}
                  </>
                )}
              </div>
              {status === 'failed' && (
                <p className="rounded-xl bg-danger/10 p-3 text-sm font-semibold text-danger">
                  Couldn’t send it just now. Your report is saved here; try again in a moment, or{' '}
                  <button type="button" onClick={() => setStatus('ready')} className="cursor-pointer underline underline-offset-2">
                    send it another way
                  </button>
                  .
                </p>
              )}
              {/* Hidden from people; bots that fill in every field give themselves away. */}
              <input ref={honeypot} type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="sr-only" />
            </div>

            <footer className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-border bg-surface px-6 py-4">
              <p className="text-xs text-ink-muted">Your draft is saved in this browser.</p>
              <div className="flex gap-2">
                <button type="button" onClick={close} className="cursor-pointer rounded-full px-4 py-2.5 text-sm font-semibold text-ink-secondary hover:bg-accent hover:text-on-accent">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={status === 'sending'}
                  className="shine group inline-flex cursor-pointer items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-on-primary shadow-lg shadow-primary/25 transition hover:-translate-y-0.5 disabled:opacity-60"
                >
                  {status === 'sending' ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Send className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" aria-hidden="true" />}
                  {status === 'sending' ? 'Sending…' : kind.send}
                </button>
              </div>
            </footer>
          </form>
        )}
      </div>
    </div>
  )
}

/** The top bar's feedback button. */
export function FeedbackButton({ className = '' }) {
  return (
    <button
      type="button"
      onClick={openFeedback}
      aria-label="Send feedback"
      className={`group inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-sm font-semibold text-ink shadow-sm transition hover:-translate-y-px hover:border-primary hover:shadow-md ${className}`}
    >
      <MessageSquarePlus className="h-4 w-4 text-primary transition-transform duration-300 group-hover:-rotate-12 group-hover:scale-110" aria-hidden="true" />
      <span className="hidden 2xl:inline">Feedback</span>
    </button>
  )
}
