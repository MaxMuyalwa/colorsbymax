// The admin space (admin.html): where Max runs the site. Same top bar and footer as everywhere,
// but inside it's an app, not a page to read: a sidebar of sections and working panels.
//
//   Overview      what needs attention: new feedback, counts, quick actions
//   Feedback      the inbox, with replies sent by email from here
//   Posts, Testimonials   write, edit and delete what the docs page shows
//   Announcement  a banner on every page, switched on and off from here
//   Site text     the landing page's hero text
//   Colour panel  switch parts of the colour panel off for everyone (e.g. something buggy)

import { useEffect, useState } from 'react'
import {
  ArrowUpRight, BookOpen, CheckCircle2, Home, Inbox as InboxIcon, LayoutDashboard, LogOut, Megaphone, MessageSquareQuote, Newspaper, Palette, Pencil, Plus, RotateCcw, Save, ShieldCheck, Type,
} from 'lucide-react'
import { FEATURES } from '../../src/ThemeProvider.jsx'
import { AdminButton, avatarOf, useAdmin } from './Admin.jsx'
import { Inbox, useInbox } from './Inbox.jsx'
import { Editor, EntryTools, Loading, niceDate, useContent } from './Docs.jsx'
import { EDITABLE_TEXT, announceSiteSettings, loadSiteSettings, useSiteSettings } from './siteSettings.jsx'
import { DOCS } from './ui.jsx'
import { AnnouncementBar } from './Announcement.jsx'

const SECTIONS = [
  { id: 'overview', label: 'Overview', Icon: LayoutDashboard },
  { id: 'feedback', label: 'Feedback', Icon: InboxIcon },
  { id: 'posts', label: 'Posts', Icon: Newspaper },
  { id: 'testimonials', label: 'Testimonials', Icon: MessageSquareQuote },
  { id: 'announcement', label: 'Announcement', Icon: Megaphone },
  { id: 'text', label: 'Site text', Icon: Type },
  { id: 'panel', label: 'Colour panel', Icon: Palette },
]
/** What each colour panel feature is, for its switch. */
const FEATURE_INFO = {
  picks: ['Max’s picks', 'The hand-tuned themes group.'],
  library: ['Theme library', 'The 715 community palettes, by mood.'],
  search: ['Search', 'The search box and its colour suggestions.'],
  surprise: ['Surprise me', 'Picks a random theme, with a burst of colour.'],
  scan: ['Scan site', 'Reads a site’s colours and builds themes around them.'],
  custom: ['Custom palettes', 'Visitors building their own palettes.'],
  overrides: ['Override a single colour', 'Changing one colour at a time.'],
  importExport: ['Import / export', 'Sharing palettes, and palettes from files.'],
  audit: ['Audit', 'Points out what won’t look right on the page.'],
  addToSite: ['Add to site', 'The light and dark switch for a visitor’s own site.'],
  colourStyle: ['Subtle / Colourful', 'The switch for how boldly a theme paints.'],
  colourCount: ['Colours per theme', '− and + for how many colours a theme uses.'],
}
const sectionFromHash = () => SECTIONS.find((s) => s.id === location.hash.slice(1))?.id ?? 'overview'

export function AdminApp({ home }) {
  const { admin, login, signOut } = useAdmin()
  const [checked, setChecked] = useState(false)
  const [section, setSection] = useState(sectionFromHash)
  useEffect(() => {
    const onHash = () => setSection(sectionFromHash())
    window.addEventListener('hashchange', onHash)
    // Give the session check a moment before showing "sign in".
    const id = setTimeout(() => setChecked(true), 900)
    if (new URLSearchParams(location.search).has('admin')) history.replaceState(null, '', location.pathname + location.hash)
    return () => {
      window.removeEventListener('hashchange', onHash)
      clearTimeout(id)
    }
  }, [])

  return (
    <main id="main" className="px-4 pt-28 pb-12 sm:px-6 md:pt-32">
      <div className="mx-auto max-w-7xl">
        {admin ? (
          <Workspace login={login} signOut={signOut} section={section} home={home} />
        ) : (
          <div className="mx-auto mt-10 max-w-md rounded-3xl border border-border bg-surface p-8 text-center">
            <ShieldCheck className="mx-auto h-9 w-9 text-ink-muted" aria-hidden="true" />
            <h1 className="mt-4 font-display text-2xl font-bold text-ink">{checked ? 'Authorised access only' : 'Checking…'}</h1>
            {checked && (
              <p className="mt-6 flex justify-center">
                <AdminButton className="rounded-full bg-ink px-5 py-2.5 text-background no-underline" />
              </p>
            )}
          </div>
        )}
      </div>
    </main>
  )
}

function Workspace({ login, signOut, section, home }) {
  const [content, reloadContent] = useContent()
  const [inbox, reloadInbox, setInbox] = useInbox(true)
  const [editing, setEditing] = useState(null)
  const [notice, setNotice] = useState(null)
  const fresh = inbox.reports.filter((r) => r.status === 'new').length
  const avatar = avatarOf(login)
  const saved = (message) => {
    setEditing(null)
    setNotice(message)
    reloadContent(true)
  }
  const { announcement } = useSiteSettings()
  const counts = { feedback: fresh, posts: content.posts.length, testimonials: content.testimonials.length, announcement: announcement?.on && announcement.text ? 'On' : 0 }

  return (
    <>
      {/* The admin bar: unmistakably not the public site. */}
      <header className="flex flex-wrap items-center justify-between gap-4 rounded-3xl bg-ink px-5 py-4 text-background shadow-xl shadow-shadow/20">
        <div className="flex items-center gap-3">
          {avatar ? <img src={avatar} alt="" className="h-11 w-11 rounded-2xl" /> : <ShieldCheck className="h-8 w-8" aria-hidden="true" />}
          <div>
            <p className="text-[11px] font-bold tracking-widest uppercase opacity-60">Admin</p>
            <h1 className="font-display text-xl font-bold">colorsbymax admin</h1>
            <p className="text-xs opacity-70">Signed in with GitHub as {login}</p>
          </div>
        </div>
        <nav aria-label="Leave admin" className="flex flex-wrap gap-2 text-sm font-semibold">
          <a href={home} className="inline-flex h-9 items-center gap-1.5 rounded-full border border-background/25 px-3.5 transition hover:border-background/60">
            <Home className="h-4 w-4" aria-hidden="true" /> Landing page
          </a>
          <a href={DOCS} className="inline-flex h-9 items-center gap-1.5 rounded-full border border-background/25 px-3.5 transition hover:border-background/60">
            <BookOpen className="h-4 w-4" aria-hidden="true" /> Docs
          </a>
          <button type="button" onClick={signOut} className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-full bg-background px-3.5 text-ink transition hover:opacity-90">
            <LogOut className="h-4 w-4" aria-hidden="true" /> Sign out
          </button>
        </nav>
      </header>

      {notice && (
        <p role="status" className="mt-4 flex items-center justify-between gap-4 rounded-2xl bg-secondary px-4 py-3 text-sm font-semibold text-on-secondary">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> {notice}
          </span>
          <button type="button" onClick={() => setNotice(null)} className="cursor-pointer underline-offset-4 hover:underline">
            OK
          </button>
        </p>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[230px_minmax(0,1fr)] lg:items-start">
        <nav aria-label="Admin sections" className="flex gap-1.5 overflow-x-auto rounded-3xl border border-border bg-surface p-2 lg:sticky lg:top-28 lg:flex-col lg:overflow-visible">
          {SECTIONS.map(({ id, label, Icon }) => {
            const on = section === id
            return (
              <a
                key={id}
                href={`#${id}`}
                aria-current={on ? 'page' : undefined}
                className={`flex shrink-0 items-center gap-2.5 rounded-2xl px-3.5 py-2.5 text-sm font-semibold whitespace-nowrap transition ${on ? 'bg-ink text-background' : 'text-ink hover:bg-accent hover:text-on-accent'}`}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden="true" /> {label}
                {counts[id] > 0 && <span className={`ml-auto rounded-full px-2 py-0.5 text-[11px] tabular-nums ${on ? 'bg-background text-ink' : id === 'feedback' ? 'bg-primary text-on-primary' : 'bg-secondary text-on-secondary'}`}>{counts[id]}</span>}
              </a>
            )
          })}
        </nav>

        <section className="min-w-0 rounded-3xl border border-border bg-surface p-5 sm:p-7">
          {section === 'overview' && <Overview inbox={inbox} content={content} fresh={fresh} onNew={(kind) => setEditing({ kind })} />}
          {section === 'feedback' && (
            <>
              <Head title="Feedback" text="Every report from colorsbymax and mrmaxdesigns.com. Reply from here: it’s emailed to them, and their answer comes to your inbox." />
              <Inbox inbox={inbox} reload={reloadInbox} setInbox={setInbox} />
            </>
          )}
          {(section === 'posts' || section === 'testimonials') && (
            <EntryList kind={section === 'posts' ? 'post' : 'testimonial'} content={content} onNew={(kind) => setEditing({ kind })} onEdit={(kind, entry) => setEditing({ kind, entry })} onDeleted={saved} />
          )}
          {section === 'announcement' && <AnnouncementEditor onSaved={setNotice} />}
          {section === 'text' && <SiteText onSaved={setNotice} />}
          {section === 'panel' && <PanelFeatures onSaved={setNotice} />}
        </section>
      </div>
      {editing && <Editor {...editing} onClose={() => setEditing(null)} onSaved={saved} />}
    </>
  )
}

function Head({ title, text, children }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3 border-b border-border pb-5">
      <div className="min-w-0">
        <h2 className="font-display text-2xl font-bold text-ink">{title}</h2>
        {text && <p className="mt-1 max-w-2xl text-sm text-ink-secondary">{text}</p>}
      </div>
      {children}
    </div>
  )
}

const tile = 'rounded-2xl border border-border bg-background p-4'

function Overview({ inbox, content, fresh, onNew }) {
  const recent = inbox.reports.filter((r) => r.status === 'new').slice(0, 5)
  const stat = (label, n, href) => (
    <a href={href} className={`${tile} block transition hover:border-primary`}>
      <p className="text-xs font-semibold tracking-wide text-ink-muted uppercase">{label}</p>
      <p className="mt-2 font-display text-3xl font-extrabold text-ink tabular-nums">{n}</p>
    </a>
  )
  return (
    <>
      <Head title="Overview" text="What needs your attention, and the quickest ways to add something." />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stat('New feedback', inbox.loading ? '…' : fresh, '#feedback')}
        {stat('All feedback', inbox.loading ? '…' : inbox.reports.length, '#feedback')}
        {stat('Posts', content.loading ? '…' : content.posts.length, '#posts')}
        {stat('Testimonials', content.loading ? '…' : content.testimonials.length, '#testimonials')}
      </div>
      <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className={tile}>
          <p className="mb-3 text-sm font-bold text-ink">Waiting for a reply</p>
          {inbox.loading ? (
            <Loading />
          ) : recent.length ? (
            <ul className="space-y-1">
              {recent.map((r) => (
                <li key={r.id}>
                  <a href="#feedback" className="flex items-center justify-between gap-3 rounded-xl px-3 py-2 text-sm hover:bg-accent hover:text-on-accent">
                    <span className="min-w-0 truncate font-semibold">{r.summary}</span>
                    <span className="shrink-0 text-xs text-ink-muted">{r.site || 'colorsbymax'} · {r.name}</span>
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ink-secondary">You’re all caught up.</p>
          )}
        </div>
        <div className={`${tile} space-y-2`}>
          <p className="mb-1 text-sm font-bold text-ink">Add something</p>
          <button type="button" onClick={() => onNew('post')} className="flex w-full cursor-pointer items-center gap-2 rounded-xl bg-primary px-3 py-2.5 text-sm font-semibold text-on-primary">
            <Plus className="h-4 w-4" aria-hidden="true" /> New post
          </button>
          <button type="button" onClick={() => onNew('testimonial')} className="flex w-full cursor-pointer items-center gap-2 rounded-xl border border-border px-3 py-2.5 text-sm font-semibold text-ink hover:border-primary">
            <Plus className="h-4 w-4" aria-hidden="true" /> Testimonial
          </button>
          <a href="#text" className="flex w-full items-center gap-2 rounded-xl border border-border px-3 py-2.5 text-sm font-semibold text-ink hover:border-primary">
            <Pencil className="h-4 w-4" aria-hidden="true" /> Edit the hero text
          </a>
        </div>
      </div>
    </>
  )
}

function EntryList({ kind, content, onNew, onEdit, onDeleted }) {
  const isPost = kind === 'post'
  const items = isPost ? content.posts : content.testimonials
  return (
    <>
      <Head title={isPost ? 'Posts' : 'Testimonials'} text={isPost ? 'Shown under Blog on the docs page. Written in Markdown.' : 'What people say, shown on the docs page.'}>
        <button type="button" onClick={() => onNew(kind)} className="inline-flex h-10 cursor-pointer items-center gap-1.5 rounded-full bg-primary px-4 text-sm font-semibold text-on-primary transition hover:-translate-y-px">
          <Plus className="h-4 w-4" aria-hidden="true" /> {isPost ? 'New post' : 'Add testimonial'}
        </button>
      </Head>
      {content.loading ? (
        <Loading />
      ) : items.length ? (
        <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border">
          {items.map((e) => (
            <li key={e.slug} className="flex flex-wrap items-center justify-between gap-3 bg-background px-4 py-3">
              <div className="min-w-0">
                <p className="truncate font-semibold text-ink">{isPost ? e.title : e.name}</p>
                <p className="text-xs text-ink-muted">{[niceDate(e.date), isPost ? e.summary : e.role].filter(Boolean).join(' · ')}</p>
              </div>
              <div className="flex items-center gap-2">
                <a href={`${DOCS}#${isPost ? `post/${e.slug}` : 'testimonials'}`} className="inline-flex h-8 items-center gap-1.5 rounded-full border border-border bg-surface px-3 text-xs font-semibold text-ink transition hover:border-primary">
                  View <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                </a>
                <EntryTools kind={kind} entry={e} onEdit={() => onEdit(kind, e)} onDeleted={() => onDeleted(`Deleted “${e.title || e.name}”.`)} inline />
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-2xl border border-dashed border-border px-4 py-10 text-center text-sm text-ink-secondary">{isPost ? 'No posts yet.' : 'No testimonials yet.'}</p>
      )}
    </>
  )
}

/** Saves the site's settings (text and panel features together, as one file). */
async function saveSettings(next) {
  if (import.meta.env.DEV) {
    announceSiteSettings(next)
    return { ok: true, preview: true }
  }
  const res = await fetch(`${import.meta.env.BASE_URL}api/admin/site`, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(next) }).catch(() => null)
  if (res?.ok) {
    announceSiteSettings(next)
    loadSiteSettings(true)
    return { ok: true }
  }
  return { ok: false, error: (await res?.json().catch(() => null))?.error ?? 'Couldn’t save just now.' }
}

function SaveBar({ dirty, busy, error, onSave, onReset }) {
  return (
    <div className="sticky bottom-4 mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-background/95 px-4 py-3 shadow-lg backdrop-blur">
      <p className="text-sm text-ink-secondary">{error ?? (dirty ? 'Unsaved changes.' : 'Everything’s saved. Changes reach visitors within a minute.')}</p>
      <div className="flex gap-2">
        <button type="button" onClick={onReset} disabled={!dirty || busy} className="h-10 cursor-pointer rounded-full px-4 text-sm font-semibold text-ink-secondary hover:bg-accent hover:text-on-accent disabled:opacity-40">
          Discard
        </button>
        <button type="button" onClick={onSave} disabled={!dirty || busy} className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-on-primary disabled:opacity-40">
          <Save className="h-4 w-4" aria-hidden="true" /> {busy ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  )
}

const NO_ANNOUNCEMENT = { on: false, text: '', link: '', label: '', tone: 'brand' }
const MAX_ANNOUNCEMENT = 200

function AnnouncementEditor({ onSaved }) {
  const settings = useSiteSettings()
  const current = { ...NO_ANNOUNCEMENT, ...(settings.announcement ?? {}) }
  const [draft, setDraft] = useState(current)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const dirty = JSON.stringify(draft) !== JSON.stringify(current)
  const set = (patch) => setDraft((d) => ({ ...d, ...patch }))
  const badLink = draft.link && !/^(https:\/\/\S+|\/\S*)$/.test(draft.link.trim())
  const save = async () => {
    if (draft.on && !draft.text.trim()) return setError('Write the message first.')
    if (badLink) return setError('The link must start with https:// or be a path on the site, like /colorsbymax/docs.')
    setBusy(true)
    const res = await saveSettings({ ...settings, announcement: { ...draft, text: draft.text.trim(), link: draft.link.trim(), label: draft.label.trim() } })
    setBusy(false)
    setError(res.ok ? null : res.error)
    if (res.ok) onSaved(res.preview ? 'Saved (preview only: nothing was stored).' : draft.on ? 'Saved. The banner shows on every page within a minute.' : 'Saved. The banner is off.')
  }
  const input = 'mt-2 w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm text-ink outline-none placeholder:text-ink-muted focus:border-primary focus:ring-2 focus:ring-primary/30'
  return (
    <>
      <Head title="Announcement" text="A banner at the bottom of every page: news, a new release, a heads-up. Visitors can close it; it comes back for them when the message changes." />
      <div className="space-y-4">
        <div className={`${tile} flex items-center justify-between gap-4`}>
          <span>
            <span className="block text-sm font-semibold text-ink">Show on the site</span>
            <span className="block text-xs text-ink-secondary">{draft.on ? 'Visitors see the banner.' : 'Hidden. Write it now and switch it on when you’re ready.'}</span>
          </span>
          <button type="button" role="switch" aria-checked={draft.on} aria-label="Show on the site" onClick={() => set({ on: !draft.on })} className={`relative h-6 w-11 shrink-0 cursor-pointer rounded-full transition ${draft.on ? 'bg-primary' : 'bg-border'}`}>
            <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-surface shadow transition-all ${draft.on ? 'left-[1.375rem]' : 'left-0.5'}`} />
          </button>
        </div>
        <div className={tile}>
          <div className="flex items-center justify-between gap-3">
            <label htmlFor="ann-text" className="text-sm font-semibold text-ink">Message</label>
            <span className={`text-xs tabular-nums ${draft.text.length > MAX_ANNOUNCEMENT - 20 ? 'text-warning' : 'text-ink-muted'}`}>{draft.text.length} / {MAX_ANNOUNCEMENT}</span>
          </div>
          <textarea id="ann-text" rows={2} maxLength={MAX_ANNOUNCEMENT} value={draft.text} onChange={(e) => set({ text: e.target.value })} placeholder="colorsbymax 0.4.0 is out: themes can now take over plain sites." className={input} />
        </div>
        <div className={`${tile} grid gap-4 sm:grid-cols-[1fr_200px]`}>
          <div>
            <label htmlFor="ann-link" className="text-sm font-semibold text-ink">Link <span className="font-normal text-ink-muted">(optional)</span></label>
            <input id="ann-link" value={draft.link} onChange={(e) => set({ link: e.target.value })} placeholder="https://… or /colorsbymax/docs#changelog" className={`${input} ${badLink ? 'border-danger' : ''}`} />
          </div>
          <div>
            <label htmlFor="ann-label" className="text-sm font-semibold text-ink">Link text</label>
            <input id="ann-label" maxLength={40} value={draft.label} onChange={(e) => set({ label: e.target.value })} placeholder="Read more" className={input} disabled={!draft.link} />
          </div>
        </div>
        <div className={tile}>
          <p className="text-sm font-semibold text-ink">Style</p>
          <div role="radiogroup" aria-label="Style" className="mt-2 flex gap-2">
            {[['brand', 'Brand', 'The theme’s own colour'], ['soft', 'Soft', 'A light tint, calmer']].map(([id, label, note]) => (
              <button key={id} type="button" role="radio" aria-checked={draft.tone === id} onClick={() => set({ tone: id })} className={`flex-1 cursor-pointer rounded-xl border px-3 py-2 text-left text-sm transition ${draft.tone === id ? 'border-ink bg-ink text-background' : 'border-border text-ink hover:border-primary'}`}>
                <span className="block font-semibold">{label}</span>
                <span className="block text-xs opacity-75">{note}</span>
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-2 text-xs font-bold tracking-wide text-ink-muted uppercase">Preview, in the current theme</p>
          {draft.text.trim() ? <AnnouncementBar announcement={draft} onClose={() => {}} preview /> : <p className="rounded-2xl border border-dashed border-border px-4 py-6 text-center text-sm text-ink-secondary">Write a message to see it here.</p>}
        </div>
      </div>
      <SaveBar dirty={dirty} busy={busy} error={error} onSave={save} onReset={() => setDraft(current)} />
    </>
  )
}

function SiteText({ onSaved }) {
  const settings = useSiteSettings()
  const [draft, setDraft] = useState(settings.text ?? {})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const dirty = JSON.stringify(draft) !== JSON.stringify(settings.text ?? {})
  const save = async () => {
    setBusy(true)
    const clean = Object.fromEntries(Object.entries(draft).filter(([, v]) => v?.trim()))
    const res = await saveSettings({ ...settings, text: clean })
    setBusy(false)
    setError(res.ok ? null : res.error)
    if (res.ok) onSaved(res.preview ? 'Saved (preview only: nothing was stored).' : 'Saved. The landing page shows the new text within a minute.')
  }
  return (
    <>
      <Head title="Site text" text="The landing page’s hero. Leave a field empty to use its original wording." />
      <div className="space-y-4">
        {EDITABLE_TEXT.map((f) => {
          const value = draft[f.key] ?? ''
          const Field = f.long ? 'textarea' : 'input'
          return (
            <div key={f.key} className={tile}>
              <div className="flex items-center justify-between gap-3">
                <label htmlFor={`text-${f.key}`} className="text-sm font-semibold text-ink">
                  {f.label}
                </label>
                {value && (
                  <button type="button" onClick={() => setDraft((d) => ({ ...d, [f.key]: '' }))} className="inline-flex cursor-pointer items-center gap-1 text-xs font-semibold text-ink-secondary hover:text-ink">
                    <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" /> Original
                  </button>
                )}
              </div>
              <Field
                id={`text-${f.key}`}
                value={value}
                placeholder={f.default}
                rows={f.long ? 3 : undefined}
                onChange={(e) => setDraft((d) => ({ ...d, [f.key]: e.target.value }))}
                className="mt-2 w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm text-ink outline-none placeholder:text-ink-muted focus:border-primary focus:ring-2 focus:ring-primary/30"
              />
            </div>
          )
        })}
      </div>
      <SaveBar dirty={dirty} busy={busy} error={error} onSave={save} onReset={() => setDraft(settings.text ?? {})} />
    </>
  )
}

function PanelFeatures({ onSaved }) {
  const settings = useSiteSettings()
  const saved = { ...FEATURES, ...(settings.features ?? {}) }
  const [draft, setDraft] = useState(saved)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const dirty = Object.keys(FEATURES).some((k) => draft[k] !== saved[k])
  const save = async () => {
    setBusy(true)
    // Only what's switched off needs saving; everything else is on by default.
    const off = Object.fromEntries(Object.entries(draft).filter(([, on]) => !on))
    const res = await saveSettings({ ...settings, features: off })
    setBusy(false)
    setError(res.ok ? null : res.error)
    if (res.ok) onSaved(res.preview ? 'Saved (preview only: nothing was stored).' : 'Saved. The colour panel changes for every visitor within a minute.')
  }
  return (
    <>
      <Head title="Colour panel" text="Switch parts of the colour panel off for everyone, for example while something is buggy. Off hides it from visitors and from their settings." />
      <ul className="grid gap-3 sm:grid-cols-2">
        {Object.keys(FEATURES).map((key) => {
          const [label, text] = FEATURE_INFO[key] ?? [key, '']
          const on = draft[key]
          return (
            <li key={key} className={`${tile} flex items-start justify-between gap-4`}>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-ink">{label}</span>
                <span className="block text-xs text-ink-secondary">{text}</span>
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={on}
                aria-label={label}
                onClick={() => setDraft((d) => ({ ...d, [key]: !d[key] }))}
                className={`relative h-6 w-11 shrink-0 cursor-pointer rounded-full transition ${on ? 'bg-primary' : 'bg-border'}`}
              >
                <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-surface shadow transition-all ${on ? 'left-[1.375rem]' : 'left-0.5'}`} />
              </button>
            </li>
          )
        })}
      </ul>
      <SaveBar dirty={dirty} busy={busy} error={error} onSave={save} onReset={() => setDraft(saved)} />
    </>
  )
}
