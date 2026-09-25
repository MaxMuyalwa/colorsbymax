// A small made-up website painted entirely with colour roles. The hero shows it off; the colour
// roles section highlights where each role is used as you hover it.

import { createContext, useContext } from 'react'
import { CircleCheck, Info, OctagonX, TriangleAlert } from 'lucide-react'

const Highlight = createContext(null)

/** An element of the specimen, tagged with the roles it paints. */
function R({ as: Tag = 'div', roles, className = '', children, ...rest }) {
  const on = useContext(Highlight)
  const lit = on && roles.split(' ').includes(on)
  return (
    <Tag data-role={roles} className={`${className} ${lit ? 'role-highlight' : ''} transition-[outline-offset]`} {...rest}>
      {children}
    </Tag>
  )
}

const BARS = [62, 88, 45, 74, 96, 58, 80, 40]
const STATUS = [
  ['success', CircleCheck, 'Paid'],
  ['warning', TriangleAlert, 'Due soon'],
  ['danger', OctagonX, 'Failed'],
  ['info', Info, 'New'],
]

/** @param {{ highlight?: string | null, compact?: boolean }} props */
export function Specimen({ highlight = null, compact = false }) {
  return (
    <Highlight.Provider value={highlight}>
      <R roles="background border shadow" className="overflow-hidden rounded-3xl border border-border bg-background text-left shadow-2xl shadow-shadow/15">
        {/* Browser bar */}
        <R roles="surface border" className="flex items-center gap-3 border-b border-border bg-surface px-4 py-2.5">
          <span className="flex gap-1.5" aria-hidden="true">
            <span className="h-2.5 w-2.5 rounded-full bg-danger/60" />
            <span className="h-2.5 w-2.5 rounded-full bg-warning/60" />
            <span className="h-2.5 w-2.5 rounded-full bg-success/60" />
          </span>
          <span className="flex-1 truncate rounded-full bg-background px-3 py-1 text-center font-mono text-[11px] text-ink-muted">brightside.shop</span>
        </R>

        <div className={`grid gap-5 p-5 ${compact ? '' : 'md:grid-cols-[1.25fr_1fr] md:p-7'}`}>
          <div className="min-w-0 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <R as="span" roles="primary-dark" className="font-display text-lg font-bold text-primary-dark">
                Brightside
              </R>
              <R as="span" roles="ink-secondary" className="hidden gap-3 text-xs text-ink-secondary sm:flex">
                <span>Shop</span>
                <span>Stories</span>
                <span>About</span>
              </R>
            </div>
            <R as="span" roles="secondary on-secondary" className="inline-block rounded-full bg-secondary px-2.5 py-1 text-[11px] font-semibold text-on-secondary">
              New season
            </R>
            <R as="p" roles="ink" className="font-display text-2xl leading-tight font-bold text-ink">
              Colour that works on every page
            </R>
            <R as="p" roles="ink-secondary" className="text-sm leading-relaxed text-ink-secondary">
              Buttons stand out, text stays readable, and every tint belongs to the same family.
            </R>
            <div className="flex flex-wrap gap-2">
              <R as="span" roles="primary on-primary" className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-on-primary shadow-md shadow-primary/25">
                Shop now
              </R>
              <R as="span" roles="accent on-accent" className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-on-accent">
                Hovered link
              </R>
            </div>
            <R roles="primary-alt" className="h-2 rounded-full bg-gradient-to-r from-primary to-primary-alt" />
            <R as="p" roles="ink-muted" className="text-[11px] text-ink-muted">
              Free returns within 30 days.
            </R>
          </div>

          <div className="min-w-0 space-y-4">
            <R roles="surface border shadow" className="rounded-2xl border border-border bg-surface p-4 shadow-lg shadow-shadow/10">
              <div className="mb-3 flex items-baseline justify-between">
                <span className="text-xs font-semibold text-ink">Orders by region</span>
                <span className="text-[11px] text-ink-muted">This week</span>
              </div>
              <div className="flex h-20 items-end gap-1.5" aria-hidden="true">
                {BARS.map((h, i) => (
                  <R key={i} roles={`data-${i + 1}`} className="flex-1 rounded-t-md" style={{ height: `${h}%`, background: `var(--color-data-${i + 1})` }} />
                ))}
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {STATUS.map(([key, Icon, label]) => (
                  <R
                    as="span"
                    key={key}
                    roles={key}
                    className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold"
                    style={{ color: `var(--color-${key})`, background: `color-mix(in srgb, var(--color-${key}) 12%, transparent)` }}
                  >
                    <Icon className="h-3 w-3" aria-hidden="true" />
                    {label}
                  </R>
                ))}
              </div>
            </R>

            <R
              roles="app-background app-border app-shadow-dark app-shadow-light"
              className="rounded-2xl border border-app-border bg-app-background p-4"
              style={{ boxShadow: '5px 5px 12px var(--color-app-shadow-dark), -5px -5px 12px var(--color-app-shadow-light)' }}
            >
              <R as="p" roles="app-ink" className="mb-2 text-xs font-semibold text-app-ink">
                Sign in
              </R>
              <R roles="app-input app-ink-muted" className="mb-2 rounded-lg bg-app-input px-3 py-2 text-[11px] text-app-ink-muted">
                you@example.com
              </R>
              <R as="span" roles="app-primary" className="block rounded-lg bg-app-primary px-3 py-2 text-center text-xs font-semibold text-on-primary">
                Continue
              </R>
            </R>
          </div>
        </div>
      </R>
    </Highlight.Provider>
  )
}
