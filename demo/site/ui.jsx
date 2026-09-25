// Small building blocks shared by the landing page's sections. Every colour is a colorsbymax
// token, so they all follow the theme a visitor picks.

import { useEffect, useId, useRef, useState } from 'react'
import { Check, Copy } from 'lucide-react'

export const REPO = 'https://github.com/MaxMuyalwa/colorsbymax'
export const NPM = 'https://www.npmjs.com/package/colorsbymax'
export const MCP_NPM = 'https://www.npmjs.com/package/colorsbymax-mcp'
export const MRMAX = 'https://mrmaxdesigns.com'
/** The support page (buy Max a coffee), next to the home page. */
export const SUPPORT = `${import.meta.env.BASE_URL}support.html`

/** The colour button, inside the switcher's shadow root (null until it has made its entrance). */
const colourButton = () => document.querySelector('colorsbymax-root')?.shadowRoot?.querySelector('button')

/** Opens the switcher from a button on the page. */
export function openPanel() {
  const button = colourButton()
  if (!button) {
    // The colour button makes its entrance a moment after the page loads.
    setTimeout(openPanel, 300)
    return
  }
  if (button.getAttribute('aria-expanded') !== 'true') button.click()
}

// Whether the panel was open when a page button was pressed. The press itself counts as a click
// outside the panel, which closes it before the click arrives, so it's noted on pointer down.
let openAtPress = null

/**
 * Props for a page button that opens and closes the switcher, like the colour button does:
 * <button {...panelToggle}>.
 */
export const panelToggle = {
  onPointerDown: () => {
    openAtPress = colourButton()?.getAttribute('aria-expanded') === 'true'
  },
  onClick: () => {
    // Keyboard presses have no pointer down: read the panel's state now.
    const wasOpen = openAtPress ?? colourButton()?.getAttribute('aria-expanded') === 'true'
    openAtPress = null
    if (!wasOpen) return openPanel()
    const button = colourButton()
    if (button?.getAttribute('aria-expanded') === 'true') button.click()
  },
}

/** Rises into view the first time it scrolls on screen. */
export function Reveal({ as: Tag = 'div', delay = 0, className = '', children, ...rest }) {
  const ref = useRef(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el || !('IntersectionObserver' in window)) return setVisible(true)
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true)
          io.disconnect()
        }
      },
      { rootMargin: '0px 0px -8% 0px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])
  return (
    <Tag ref={ref} className={`reveal ${visible ? 'is-visible' : ''} ${className}`} style={{ '--reveal-delay': `${delay}ms` }} {...rest}>
      {children}
    </Tag>
  )
}

/** A section's eyebrow, heading and intro. */
export function SectionHeading({ eyebrow, title, children, id, align = 'center' }) {
  return (
    <Reveal className={`mb-12 ${align === 'center' ? 'mx-auto max-w-2xl text-center' : 'max-w-2xl'}`}>
      {eyebrow && (
        <p className="mb-3 inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-1 text-xs font-semibold tracking-wide text-on-secondary uppercase">
          <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden="true" />
          {eyebrow}
        </p>
      )}
      <h2 id={id} className="font-display text-3xl font-bold tracking-tight text-ink md:text-5xl">
        {title}
      </h2>
      {children && <p className="mt-4 text-lg leading-relaxed text-ink-secondary">{children}</p>}
    </Reveal>
  )
}

/** Copies text, and says so for a moment. */
export function useCopy() {
  const [copied, setCopied] = useState(null)
  const timer = useRef(0)
  const copy = async (text, key = text) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(key)
      clearTimeout(timer.current)
      timer.current = setTimeout(() => setCopied(null), 1600)
    } catch {
      setCopied(null)
    }
  }
  return [copied, copy]
}

export function CopyButton({ text, label = 'Copy', className = '' }) {
  const [copied, copy] = useCopy()
  return (
    <button
      type="button"
      onClick={() => copy(text)}
      className={`group inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs font-semibold text-ink-secondary transition hover:-translate-y-px hover:border-primary hover:text-primary focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none ${className}`}
    >
      {copied ? <Check className="h-3.5 w-3.5 text-success" aria-hidden="true" /> : <Copy className="h-3.5 w-3.5 transition-transform group-hover:-rotate-12" aria-hidden="true" />}
      <span aria-live="polite">{copied ? 'Copied' : label}</span>
    </button>
  )
}

/** Code with a title bar and a copy button. */
export function CodeBlock({ code, title, lang, wrap = false }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-border bg-background/60 px-4 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex gap-1.5" aria-hidden="true">
            <span className="h-2.5 w-2.5 rounded-full bg-danger/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-warning/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-success/70" />
          </span>
          <span className="truncate font-mono text-xs text-ink-muted">{title ?? lang}</span>
        </div>
        <CopyButton text={code} />
      </div>
      <pre className={`overflow-x-auto p-4 text-[13px] leading-relaxed text-ink ${wrap ? "whitespace-pre-wrap" : ""}`}>
        <code className="font-mono">{code}</code>
      </pre>
    </div>
  )
}

/** Accessible tabs: a row of buttons and one panel. */
export function Tabs({ tabs, label, className = '' }) {
  const [current, setCurrent] = useState(0)
  const id = useId()
  const refs = useRef([])
  const onKey = (e) => {
    const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0
    if (!step) return
    e.preventDefault()
    const next = (current + step + tabs.length) % tabs.length
    setCurrent(next)
    refs.current[next]?.focus()
  }
  return (
    <div className={className}>
      <div role="tablist" aria-label={label} onKeyDown={onKey} className="mb-6 flex flex-wrap gap-2">
        {tabs.map((t, i) => (
          <button
            key={t.label}
            ref={(el) => (refs.current[i] = el)}
            role="tab"
            type="button"
            id={`${id}-tab-${i}`}
            aria-selected={i === current}
            aria-controls={`${id}-panel`}
            tabIndex={i === current ? 0 : -1}
            onClick={() => setCurrent(i)}
            className={`inline-flex cursor-pointer items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none ${
              i === current ? 'bg-primary text-on-primary shadow-lg shadow-primary/25' : 'border border-border bg-surface text-ink-secondary hover:-translate-y-px hover:border-primary hover:text-ink'
            }`}
          >
            {t.icon && <t.icon className="h-4 w-4" aria-hidden="true" />}
            {t.label}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`${id}-panel`} aria-labelledby={`${id}-tab-${current}`} key={current} className="animate-[tab-in_350ms_ease-out]">
        {tabs[current].content}
      </div>
    </div>
  )
}

/** GitHub's mark (Lucide no longer ships brand icons). */
export function GitHubIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M12 .5a11.5 11.5 0 0 0-3.64 22.41c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.37-3.88-1.37-.52-1.33-1.28-1.69-1.28-1.69-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.78 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.84 1.19 3.1 0 4.42-2.7 5.4-5.26 5.68.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .5Z" />
    </svg>
  )
}
