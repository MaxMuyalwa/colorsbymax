// Support from Zambia and the rest of Africa: a small Zambian flag that opens Max's Airtel Money
// details, for a thank-you of any amount.

import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, Copy, Heart, Link2, X } from 'lucide-react'

const NUMBER = '+260 779 05 30 92'
const NUMBER_PLAIN = '+260779053092'
const NAME = 'Kaluku Muyalwa'

/** Zambia's flag: green, with the eagle over red, black and orange stripes at the fly. */
export function ZambiaFlag({ className = '' }) {
  return (
    <svg viewBox="0 0 60 40" className={className} aria-hidden="true">
      <rect width="60" height="40" fill="#198a00" />
      <rect x="42" y="16" width="6" height="24" fill="#de2010" />
      <rect x="48" y="16" width="6" height="24" fill="#000000" />
      <rect x="54" y="16" width="6" height="24" fill="#ef7d00" />
      <path d="M43 9.5c3-2.2 5.6-1.6 7.5.6 1.9-2.2 4.5-2.8 7.5-.6-2.3.1-4.1 1.1-5.3 3l-2.2 3.3-2.2-3.3c-1.2-1.9-3-2.9-5.3-3Z" fill="#ef7d00" />
    </svg>
  )
}

/** A simple outline of Africa (with Madagascar), with a dot where Zambia is. */
export function AfricaMap({ className = '' }) {
  return (
    <svg viewBox="0 0 100 108" className={className} aria-hidden="true">
      <path
        d="M21 6c7-2 13-3 19-2l9 3 13-1c3 1 5 5 7 9l4 11 5 7c6 1 11-1 18-1 2 1 1 4-1 7l-8 9-6 8-3 11-2 9-6 10-7 9-9 8c-4 2-8 2-11-1l-3-8-3-11-2-11-3-9-6-6-8-2-9-3-7-7-4-9 1-10 5-9Z"
        fill="currentColor"
      />
      <path d="M87 74c2 0 3 2 2 6l-2 8c-1 3-3 4-4 2-1-3 0-8 1-11 1-3 2-5 3-5Z" fill="currentColor" />
      <circle cx="61" cy="74" r="4.5" fill="#ef7d00" stroke="var(--color-surface)" strokeWidth="1.5" />
    </svg>
  )
}

/** The flag button, and the pop-up it opens. */
export function AirtelMoney({ className = '' }) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const openerRef = useRef(null)
  const closeRef = useRef(null)
  const id = useId()

  const close = () => {
    setOpen(false)
    setTimeout(() => openerRef.current?.focus(), 0)
  }
  useEffect(() => {
    if (!open) return
    closeRef.current?.focus()
    const onKey = (e) => e.key === 'Escape' && close()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(NUMBER_PLAIN)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {}
  }

  return (
    <>
      <button
        ref={openerRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-label="In Zambia or elsewhere in Africa? Support Max with Airtel Money"
        title="In Zambia or Africa? Support with Airtel Money"
        className={`group grid cursor-pointer place-items-center overflow-hidden rounded-md shadow-md ring-1 ring-border transition hover:-translate-y-0.5 hover:-rotate-6 hover:shadow-lg focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none ${className}`}
      >
        <ZambiaFlag className="h-6 w-9" />
      </button>

      {/* Rendered straight into <body>, so no section's stacking keeps it under the top bar. */}
      {open &&
        createPortal(
          <div className="fixed inset-0 z-[90] flex items-end justify-center sm:items-center sm:p-6">
            <div className="absolute inset-0 animate-[fade-in_200ms_ease-out] bg-ink/40 backdrop-blur-sm" onClick={close} aria-hidden="true" />
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby={`${id}-title`}
              className="relative grid max-h-[90vh] w-full max-w-3xl animate-[tab-in_300ms_ease-out] overflow-y-auto rounded-t-[2rem] border border-border bg-surface text-left shadow-2xl shadow-shadow/30 sm:rounded-[2rem] md:grid-cols-[0.9fr_1.1fr] md:overflow-hidden"
            >
              <button ref={closeRef} type="button" onClick={close} aria-label="Close" className="absolute top-4 right-4 z-10 grid h-9 w-9 cursor-pointer place-items-center rounded-full text-ink transition hover:bg-accent hover:text-on-accent">
                <X className="h-5 w-5" aria-hidden="true" />
              </button>

              {/* Left: who it's for, and the thanks. */}
              <div className="relative flex flex-col overflow-hidden bg-secondary p-6 text-on-secondary md:p-7">
                <div className="blob -top-16 -left-12 h-48 w-48 bg-primary-alt opacity-25" aria-hidden="true" />
                <div className="relative flex flex-1 flex-col">
                  {/* Zambia, linked to the rest of Africa: who this is for. */}
                  <div className="flex items-center gap-2.5">
                    <ZambiaFlag className="h-9 w-14 rounded shadow-md ring-1 ring-border" />
                    <Link2 className="h-5 w-5 opacity-70" aria-hidden="true" />
                    <AfricaMap className="h-11 w-11 text-primary drop-shadow-sm" />
                  </div>
                  <h2 id={`${id}-title`} className="mt-4 pr-8 font-display text-2xl leading-tight font-bold md:pr-0">
                    Support from Zambia or Africa
                  </h2>
                  <p className="mt-2 text-sm leading-relaxed opacity-90">If you live in Zambia or elsewhere in Africa, you can say thanks with Airtel Money. Any amount you like.</p>
                  <p className="mt-5 flex items-start gap-2 rounded-2xl bg-surface/60 p-3 text-sm font-semibold md:mt-auto">
                    <Heart className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /> Thank you in advance. Every bit of support keeps colorsbymax going.
                  </p>
                </div>
              </div>

              {/* Right: the number, and how to send. */}
              <div className="space-y-4 p-6 md:p-7 md:pt-12">
                <div className="rounded-2xl border border-border bg-background p-4">
                  <p className="text-xs font-semibold tracking-wide text-ink-muted uppercase">Airtel Money number</p>
                  <p className="mt-1 font-mono text-2xl font-bold tracking-wide whitespace-nowrap text-ink">{NUMBER}</p>
                  <p className="mt-1 text-sm text-ink-secondary">
                    Name that appears: <strong className="text-ink">{NAME}</strong>
                  </p>
                  <button
                    type="button"
                    onClick={copy}
                    className="mt-3 inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-on-primary shadow-md shadow-primary/25 transition hover:-translate-y-0.5"
                  >
                    {copied ? <Check className="h-4 w-4" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
                    <span aria-live="polite">{copied ? 'Copied' : 'Copy number'}</span>
                  </button>
                </div>
                <ol className="space-y-2 text-sm text-ink-secondary">
                  {['Open Airtel Money on your phone.', 'Choose Send money and enter the number.', `Check the name shows ${NAME}, then send whatever you’d like.`].map((step, i) => (
                    <li key={step} className="flex gap-3">
                      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-secondary text-xs font-bold text-on-secondary">{i + 1}</span>
                      <span className="pt-0.5">{step}</span>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  )
}
