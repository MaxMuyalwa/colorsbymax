// The admin dashboard's feedback inbox: every report from the site's feedback form (also emailed),
// kept in a private repo by api/feedback.js. Filter by kind and status, open one to read it all,
// see its screenshots, reply by email, and mark it done.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Bug, CheckCircle2, Circle, Heart, ImageIcon, Lightbulb, Loader2, Mail, MessageCircleQuestion, Star } from 'lucide-react'
import { Modal } from './Admin.jsx'

const API = `${import.meta.env.BASE_URL}api/admin/feedback`
const KINDS = {
  bug: { label: 'Bug', plural: 'Bugs', Icon: Bug, tone: 'text-danger bg-danger/10' },
  idea: { label: 'Idea', plural: 'Ideas', Icon: Lightbulb, tone: 'text-warning bg-warning/10' },
  praise: { label: 'Praise', plural: 'Praise', Icon: Heart, tone: 'text-success bg-success/10' },
  question: { label: 'Question', plural: 'Questions', Icon: MessageCircleQuestion, tone: 'text-info bg-info/10' },
}
const kindOf = (k) => KINDS[k] ?? KINDS.idea
const when = (iso) => (iso ? new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '')
const shotUrl = (r, s) => `${API}?id=${encodeURIComponent(r.id)}&file=${encodeURIComponent(s.file)}`

// On the dev server there's no API; ?admin-preview shows a sample report instead.
const SAMPLE = [
  { id: 'sample-1', received: new Date().toISOString(), status: 'new', kind: 'bug', summary: 'The icons are distracting', name: 'Max', email: 'someone@example.com', contact: true, areas: ['Colour button'], rating: 5, severity: 'cosmetic', frequency: 'always', details: 'Icons are overlapping in the panel on mobile', steps: '1. Open the colour panel', expected: 'Properly aligned icons', actual: 'Overlapping icons', screenshots: [], environment: { Browser: 'Chrome 153', System: 'Android', Screen: '412 × 892' } },
  { id: 'sample-2', received: new Date(Date.now() - 864e5).toISOString(), status: 'done', kind: 'praise', summary: 'This site is da bomb', name: 'Max', rating: 5, details: 'I love how every colour just works.', screenshots: [], environment: { Browser: 'Chrome 153' } },
]

/** The inbox's reports, and a way to reload them. */
export function useInbox(enabled) {
  const [state, setState] = useState({ reports: [], loading: enabled, error: null })
  const load = useCallback(() => {
    if (!enabled) return
    if (import.meta.env.DEV) return setState({ reports: SAMPLE, loading: false, error: null })
    fetch(API, { credentials: 'same-origin', cache: 'no-store' })
      .then(async (r) => ({ ok: r.ok, body: await r.json().catch(() => ({})) }))
      .then(({ ok, body }) => setState({ reports: body.reports ?? [], loading: false, error: ok ? null : (body.error ?? 'Couldn’t read the inbox.') }))
      .catch(() => setState((s) => ({ ...s, loading: false, error: 'Couldn’t read the inbox.' })))
  }, [enabled])
  useEffect(() => load(), [load])
  return [state, load, setState]
}

export function Inbox({ inbox, reload, setInbox }) {
  const [kind, setKind] = useState('all')
  const [site, setSite] = useState('all')
  // Which site each report came from (reports from before sites were recorded are colorsbymax's).
  const siteOf = (r) => r.site || 'colorsbymax'
  const sites = [...new Set(inbox.reports.map(siteOf))]
  const [status, setStatus] = useState('new')
  const [open, setOpen] = useState(null)
  const shown = useMemo(
    () => inbox.reports.filter((r) => (kind === 'all' || r.kind === kind) && (status === 'all' || r.status === status) && (site === 'all' || siteOf(r) === site)),
    [inbox.reports, kind, status, site],
  )
  const count = (k, s) => inbox.reports.filter((r) => (k === 'all' || r.kind === k) && (s === 'all' || r.status === s)).length

  const setReportStatus = async (report, next) => {
    // Straight away on screen; saved to the inbox behind it.
    setInbox((s) => ({ ...s, reports: s.reports.map((r) => (r.id === report.id ? { ...r, status: next } : r)) }))
    setOpen((o) => (o?.id === report.id ? { ...o, status: next } : o))
    if (import.meta.env.DEV) return
    const res = await fetch(API, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: report.id, status: next }) }).catch(() => null)
    if (!res?.ok) reload()
  }

  const chip = (on) => `inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition ${on ? 'border-ink bg-ink text-background' : 'border-border bg-background text-ink-secondary hover:border-primary hover:text-ink'}`

  return (
    <section className="mt-8">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-display text-lg font-bold text-ink">
          Feedback {count('all', 'new') > 0 && <span className="ml-1 rounded-full bg-primary px-2 py-0.5 align-middle text-xs text-on-primary">{count('all', 'new')} new</span>}
        </h3>
        <div role="group" aria-label="Status" className="flex gap-1.5">
          {[['new', 'New'], ['done', 'Done'], ['all', 'All']].map(([id, label]) => (
            <button key={id} type="button" aria-pressed={status === id} onClick={() => setStatus(id)} className={chip(status === id)}>
              {label} <span className="opacity-60">{count(kind, id)}</span>
            </button>
          ))}
        </div>
      </div>
      {sites.length > 1 && (
        <div role="group" aria-label="Site" className="mb-2 flex flex-wrap gap-1.5">
          {['all', ...sites].map((s) => (
            <button key={s} type="button" aria-pressed={site === s} onClick={() => setSite(s)} className={chip(site === s)}>
              {s === 'all' ? 'Every site' : s}
            </button>
          ))}
        </div>
      )}
      <div role="group" aria-label="Kind" className="mb-3 flex flex-wrap gap-1.5">
        <button type="button" aria-pressed={kind === 'all'} onClick={() => setKind('all')} className={chip(kind === 'all')}>
          Everything
        </button>
        {Object.entries(KINDS).map(([id, { plural, Icon }]) => (
          <button key={id} type="button" aria-pressed={kind === id} onClick={() => setKind(id)} className={chip(kind === id)}>
            <Icon className="h-3.5 w-3.5" aria-hidden="true" /> {plural} <span className="opacity-60">{count(id, status)}</span>
          </button>
        ))}
      </div>

      {inbox.loading ? (
        <p className="flex items-center justify-center gap-2 py-10 text-sm text-ink-secondary" role="status">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Loading the inbox…
        </p>
      ) : inbox.error ? (
        <p className="rounded-2xl border border-dashed border-danger/50 px-4 py-6 text-center text-sm text-danger">{inbox.error}</p>
      ) : shown.length ? (
        <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border">
          {shown.map((r) => {
            const k = kindOf(r.kind)
            return (
              <li key={r.id}>
                <button type="button" onClick={() => setOpen(r)} className="flex w-full cursor-pointer items-center gap-3 bg-background px-4 py-3 text-left transition hover:bg-accent/50">
                  <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${k.tone}`}>
                    <k.Icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={`block truncate text-ink ${r.status === 'new' ? 'font-bold' : 'font-medium'}`}>{r.summary}</span>
                    <span className="block truncate text-xs text-ink-muted">
                      {[sites.length > 1 ? siteOf(r) : null, r.name, when(r.received), r.rating ? `${r.rating}/5` : null].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                  {r.screenshots?.length > 0 && (
                    <span className="inline-flex shrink-0 items-center gap-1 text-xs text-ink-secondary">
                      <ImageIcon className="h-3.5 w-3.5" aria-hidden="true" /> {r.screenshots.length}
                    </span>
                  )}
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${r.status === 'new' ? 'bg-primary text-on-primary' : 'bg-secondary text-on-secondary'}`}>{r.status === 'new' ? 'New' : 'Done'}</span>
                </button>
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="rounded-2xl border border-dashed border-border px-4 py-6 text-center text-sm text-ink-secondary">{inbox.reports.length ? 'Nothing here with these filters.' : 'No feedback yet. Reports people send appear here as well as in your email.'}</p>
      )}
      {open && <Report report={open} onClose={() => setOpen(null)} onStatus={(next) => setReportStatus(open, next)} />}
    </section>
  )
}

function Report({ report: r, onClose, onStatus }) {
  const k = kindOf(r.kind)
  const block = (title, text) =>
    text?.trim() && (
      <div className="mt-4">
        <p className="text-xs font-bold tracking-wide text-ink-muted uppercase">{title}</p>
        <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-ink">{text}</p>
      </div>
    )
  const row = (label, value) =>
    value ? (
      <div className="flex gap-3 py-1 text-sm">
        <dt className="w-24 shrink-0 text-ink-muted">{label}</dt>
        <dd className="min-w-0 break-words text-ink">{value}</dd>
      </div>
    ) : null
  const reply = r.email ? `mailto:${r.email}?subject=${encodeURIComponent(`Re: ${r.summary}`)}` : null
  return (
    <Modal title={r.summary} onClose={onClose} wide>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-semibold ${k.tone}`}>
          <k.Icon className="h-3.5 w-3.5" aria-hidden="true" /> {k.label}
        </span>
        <span className="text-ink-muted">{when(r.received)}</span>
        {r.rating > 0 && (
          <span className="inline-flex items-center gap-0.5 text-warning" aria-label={`${r.rating} out of 5`}>
            {Array.from({ length: 5 }, (_, i) => (
              <Star key={i} className={`h-3.5 w-3.5 ${i < r.rating ? 'fill-current' : 'opacity-30'}`} aria-hidden="true" />
            ))}
          </span>
        )}
      </div>

      <dl className="mt-4 rounded-2xl border border-border bg-background px-4 py-2">
        {row('From', [r.name, r.github && `@${r.github}`].filter(Boolean).join(' · '))}
        {row('Email', r.email && `${r.email}${r.contact ? ' (happy to be contacted)' : ''}`)}
        {row('Areas', (r.areas ?? []).join(', '))}
        {row('Severity', r.severity)}
        {row('How often', r.frequency)}
      </dl>

      {block(r.kind === 'bug' ? 'What happened' : 'Details', r.details)}
      {block('Steps to reproduce', r.steps)}
      {block('Expected', r.expected)}
      {block('What happened instead', r.actual)}
      {block('Suggestions', r.suggestion)}

      {r.screenshots?.length > 0 && (
        <div className="mt-5">
          <p className="text-xs font-bold tracking-wide text-ink-muted uppercase">Screenshots</p>
          <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {r.screenshots.map((s) => (
              <a key={s.file} href={shotUrl(r, s)} target="_blank" rel="noopener" className="group overflow-hidden rounded-xl border border-border bg-background" title={`Open ${s.name} full size`}>
                <img src={shotUrl(r, s)} alt={s.name} loading="lazy" className="aspect-video w-full object-cover transition group-hover:scale-[1.02]" />
              </a>
            ))}
          </div>
        </div>
      )}

      {r.environment && (
        <details className="mt-5 rounded-2xl border border-border bg-background px-4 py-3">
          <summary className="cursor-pointer text-sm font-semibold text-ink">Technical details</summary>
          <dl className="mt-2">{Object.entries(r.environment).map(([key, v]) => row(key, String(v)))}</dl>
        </details>
      )}

      <div className="mt-6 flex flex-wrap justify-end gap-2">
        {reply && (
          <a href={reply} className="inline-flex h-10 items-center gap-2 rounded-full border border-border px-4 text-sm font-semibold text-ink transition hover:border-primary">
            <Mail className="h-4 w-4" aria-hidden="true" /> Reply by email
          </a>
        )}
        {r.status === 'new' ? (
          <button type="button" onClick={() => onStatus('done')} className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-on-primary transition hover:-translate-y-px">
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> Mark as done
          </button>
        ) : (
          <button type="button" onClick={() => onStatus('new')} className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-full border border-border px-5 text-sm font-semibold text-ink transition hover:border-primary">
            <Circle className="h-4 w-4" aria-hidden="true" /> Mark as new
          </button>
        )}
      </div>
    </Modal>
  )
}
