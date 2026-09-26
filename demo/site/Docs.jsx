// The docs: colorsbymax's README and changelog, read live from GitHub so they're always the
// current ones (with a copy built into the site in case GitHub can't be reached), and the posts
// and testimonials Max writes in admin mode (saved in the repo's content branch, see api/).
// Laid out like a book: the contents on the left, the reading on the right.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import { ArrowLeft, ArrowUpRight, BookOpen, ChevronDown, History, Loader2, MessageSquareQuote, Newspaper, Pencil, Plus, Quote, RefreshCw, Trash2 } from 'lucide-react'
import readmeCopy from '../../README.md?raw'
import changelogCopy from '../../CHANGELOG.md?raw'
import { REPO } from './ui.jsx'
import { Modal, useAdmin } from './Admin.jsx'

const RAW = 'https://raw.githubusercontent.com/MaxMuyalwa/colorsbymax/main/'
const BLOB = `${REPO}/blob/main/`
const API = `${import.meta.env.BASE_URL}api`

const GUIDES = [
  { id: 'readme', group: 'Guides', title: 'README', blurb: 'Install it, set it up, and every option.', Icon: BookOpen, file: 'README.md', copy: readmeCopy },
  { id: 'changelog', group: 'Updates', title: 'Changelog', blurb: 'What changed in each release.', Icon: History, file: 'CHANGELOG.md', copy: changelogCopy },
]

/** GitHub's heading anchors: lower case, punctuation dropped, spaces to hyphens. */
const slug = (text) =>
  text
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .replace(/\s/g, '-')
const slugFor = (title) => slug(title).replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || `entry-${Date.now().toString(36)}`
const niceDate = (d) => (d ? new Date(`${d}T12:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' }) : '')

/** Markdown to safe HTML: headings get GitHub's anchors, relative links and images point at the repo. */
function render(markdown) {
  const html = DOMPurify.sanitize(marked.parse(markdown || '', { gfm: true }), { ADD_ATTR: ['target', 'align'] })
  const box = document.createElement('div')
  box.innerHTML = html
  const seen = new Map()
  const toc = []
  for (const h of box.querySelectorAll('h1, h2, h3')) {
    let id = slug(h.textContent)
    const n = seen.get(id) ?? 0
    seen.set(id, n + 1)
    if (n) id += `-${n}`
    h.id = id
    if (h.localName === 'h2') toc.push({ id, text: h.textContent })
  }
  for (const a of box.querySelectorAll('a[href]')) {
    const href = a.getAttribute('href')
    if (/^(https?:|mailto:|#)/.test(href)) {
      if (href.startsWith('http')) Object.assign(a, { target: '_blank', rel: 'noopener' })
    } else a.href = BLOB + href.replace(/^\.\//, '')
  }
  for (const img of box.querySelectorAll('img[src]')) {
    const src = img.getAttribute('src')
    if (!/^(https?:|data:)/.test(src)) img.src = RAW + src.replace(/^\.\//, '')
    img.loading = 'lazy'
  }
  return { html: box.innerHTML, toc }
}

/** A guide's text: GitHub's current copy, falling back to the one built into the site. */
function useGuides() {
  const [live, setLive] = useState({})
  useEffect(() => {
    const controller = new AbortController()
    for (const g of GUIDES)
      fetch(RAW + g.file, { signal: controller.signal, cache: 'no-cache' })
        .then((res) => (res.ok ? res.text() : Promise.reject(res.status)))
        .then((text) => setLive((l) => ({ ...l, [g.id]: text })))
        .catch(() => {})
    return () => controller.abort()
  }, [])
  return live
}

/** Posts and testimonials from the content API (none on the dev server, which has no API). */
function useContent() {
  const [content, setContent] = useState({ posts: [], testimonials: [], loading: !import.meta.env.DEV })
  const load = useCallback((fresh = false) => {
    if (import.meta.env.DEV) return
    fetch(`${API}/content${fresh ? '?fresh=1' : ''}`, { cache: fresh ? 'no-store' : 'default' })
      .then((r) => r.json())
      .then((c) => setContent({ posts: c.posts ?? [], testimonials: c.testimonials ?? [], loading: false }))
      .catch(() => setContent((c) => ({ ...c, loading: false })))
  }, [])
  useEffect(() => load(), [load])
  return [content, load]
}

/** Where the address points: #readme, #changelog, #posts, #post/<slug> or #testimonials. */
const routeOf = (hash) => {
  const [first, second] = decodeURIComponent(hash.slice(1)).split('/')
  if (GUIDES.some((g) => g.id === first)) return { type: 'guide', id: first }
  if (first === 'post' && second) return { type: 'post', slug: second }
  if (first === 'posts') return { type: 'posts' }
  if (first === 'testimonials') return { type: 'testimonials' }
  return null
}

export function Docs({ home }) {
  const [route, setRoute] = useState(() => routeOf(location.hash) ?? { type: 'guide', id: 'readme' })
  const [menuOpen, setMenuOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [notice, setNotice] = useState(() => ({ 'signed-in': 'Signed in. Welcome back, Max.', denied: 'That GitHub account isn’t the admin.', failed: 'Sign-in didn’t finish. Try again.' })[new URLSearchParams(location.search).get('admin')] ?? null)
  const live = useGuides()
  const [content, reload] = useContent()
  const { admin } = useAdmin()

  // #changelog, #post/… open that page; any other #anchor is a heading in the page that's open.
  useEffect(() => {
    const onHash = () => {
      const next = routeOf(location.hash)
      if (next) {
        setRoute(next)
        window.scrollTo({ top: 0 })
      } else if (location.hash) document.getElementById(decodeURIComponent(location.hash.slice(1)))?.scrollIntoView()
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])
  // Tidy the address after sign-in (?admin=…), keeping the page.
  useEffect(() => {
    if (new URLSearchParams(location.search).has('admin')) history.replaceState(null, '', location.pathname + location.hash)
  }, [])

  const guide = route.type === 'guide' ? GUIDES.find((g) => g.id === route.id) : null
  const post = route.type === 'post' ? content.posts.find((p) => p.slug === route.slug) : null
  const { html, toc } = useMemo(() => render(guide ? (live[guide.id] ?? guide.copy) : (post?.body ?? '')), [guide, post, live])
  useEffect(() => {
    const id = decodeURIComponent(location.hash.slice(1))
    if (id && !routeOf(location.hash)) document.getElementById(id)?.scrollIntoView()
  }, [html])

  const saved = (message) => {
    setEditing(null)
    setNotice(message)
    reload(true)
  }

  const Item = ({ href, on, Icon, children, sub }) => (
    <div>
      <a
        href={href}
        onClick={() => setMenuOpen(false)}
        aria-current={on ? 'page' : undefined}
        className={`flex items-center gap-2.5 rounded-2xl px-3 py-2.5 text-sm font-semibold transition ${on ? 'bg-primary text-on-primary shadow-md shadow-primary/20' : 'text-ink hover:bg-accent hover:text-on-accent'}`}
      >
        <Icon className="h-4 w-4 shrink-0" aria-hidden="true" /> <span className="min-w-0 truncate">{children}</span>
      </a>
      {sub}
    </div>
  )
  const Headings = () =>
    toc.length > 0 && (
      <ol className="my-1.5 ml-5 space-y-0.5 border-l border-border pl-3">
        {toc.map((h) => (
          <li key={h.id}>
            <a href={`#${h.id}`} onClick={() => setMenuOpen(false)} className="block truncate rounded-lg px-2 py-1 text-[13px] text-ink-secondary transition hover:bg-accent hover:text-on-accent">
              {h.text}
            </a>
          </li>
        ))}
      </ol>
    )
  const current =
    guide ?? (route.type === 'testimonials' ? { title: 'Testimonials', Icon: MessageSquareQuote } : route.type === 'post' ? { title: post?.title ?? 'Post', Icon: Newspaper } : { title: 'Posts', Icon: Newspaper })

  return (
    <main id="main" className="relative isolate px-4 pt-28 pb-10 sm:px-6 md:pt-32">
      <div className="hero-backdrop absolute inset-x-0 top-0 -z-10 h-[28rem]" aria-hidden="true">
        <div className="absolute inset-0 bg-[radial-gradient(90%_80%_at_50%_0%,color-mix(in_srgb,var(--color-primary)_16%,transparent),transparent_70%)]" />
        <div className="dot-grid absolute inset-0 opacity-60" />
      </div>

      <div className="mx-auto max-w-6xl">
        <a href={home} className="group inline-flex items-center gap-1.5 text-sm font-semibold text-ink-secondary transition hover:text-primary">
          <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" aria-hidden="true" /> Back to colorsbymax
        </a>
        <header className="mt-5 flex flex-wrap items-end justify-between gap-6">
          <div className="max-w-2xl">
            <p className="inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-1 text-xs font-semibold tracking-wide text-on-secondary uppercase">
              <BookOpen className="h-3.5 w-3.5" aria-hidden="true" /> Docs
            </p>
            <h1 className="mt-4 font-display text-4xl font-extrabold tracking-tight text-ink md:text-5xl">
              Everything about <span className="text-gradient">colorsbymax</span>
            </h1>
            <p className="mt-3 text-lg text-ink-secondary">How to set it up, what’s new, and posts about colour. The guides come straight from GitHub, so they’re always current.</p>
          </div>
          {admin && (
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => setEditing({ kind: 'post' })} className="shine inline-flex h-11 cursor-pointer items-center gap-2 rounded-full bg-primary px-5 font-semibold text-on-primary shadow-lg shadow-primary/25 transition hover:-translate-y-px">
                <Plus className="h-4 w-4" aria-hidden="true" /> New post
              </button>
              <button type="button" onClick={() => setEditing({ kind: 'testimonial' })} className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-full border border-border bg-surface px-5 font-semibold text-ink transition hover:-translate-y-px hover:border-primary">
                <Plus className="h-4 w-4" aria-hidden="true" /> Add testimonial
              </button>
            </div>
          )}
        </header>
        {notice && (
          <p role="status" className="mt-6 flex items-center justify-between gap-4 rounded-2xl bg-secondary px-4 py-3 text-sm font-semibold text-on-secondary">
            {notice}
            <button type="button" onClick={() => setNotice(null)} className="cursor-pointer underline-offset-4 hover:underline">
              OK
            </button>
          </p>
        )}

        <div className="mt-10 grid gap-8 lg:grid-cols-[260px_minmax(0,1fr)] lg:items-start">
          {/* Contents: the guides, posts and testimonials, and the sections of the page that's open. */}
          <nav aria-label="Docs" className="lg:sticky lg:top-28">
            <button
              type="button"
              onClick={() => setMenuOpen((o) => !o)}
              aria-expanded={menuOpen}
              className="flex w-full cursor-pointer items-center justify-between rounded-2xl border border-border bg-surface px-4 py-3 text-left font-semibold text-ink lg:hidden"
            >
              <span className="flex min-w-0 items-center gap-2">
                <current.Icon className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" /> <span className="truncate">{current.title}</span>
              </span>
              <span className="flex shrink-0 items-center gap-1 text-sm font-medium text-ink-secondary">
                Contents <ChevronDown className={`h-4 w-4 transition-transform ${menuOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
              </span>
            </button>
            <div className={`${menuOpen ? 'block' : 'hidden'} mt-2 max-h-[calc(100vh-9rem)] space-y-2 overflow-y-auto rounded-3xl border border-border bg-surface p-3 lg:mt-0 lg:block`}>
              {GUIDES.map((g) => (
                <div key={g.id}>
                  <p className="px-3 pt-2 pb-1 text-[11px] font-bold tracking-wider text-ink-muted uppercase">{g.group}</p>
                  <Item href={`#${g.id}`} on={guide?.id === g.id} Icon={g.Icon} sub={guide?.id === g.id && <Headings />}>
                    {g.title}
                  </Item>
                </div>
              ))}
              <div>
                <p className="px-3 pt-2 pb-1 text-[11px] font-bold tracking-wider text-ink-muted uppercase">Blog</p>
                <Item href="#posts" on={route.type === 'posts'} Icon={Newspaper}>
                  All posts{content.posts.length ? ` (${content.posts.length})` : ''}
                </Item>
                {content.posts.slice(0, 8).map((p) => (
                  <Item key={p.slug} href={`#post/${p.slug}`} on={route.type === 'post' && route.slug === p.slug} Icon={Pencil} sub={route.type === 'post' && route.slug === p.slug && <Headings />}>
                    {p.title}
                  </Item>
                ))}
              </div>
              <div>
                <p className="px-3 pt-2 pb-1 text-[11px] font-bold tracking-wider text-ink-muted uppercase">People</p>
                <Item href="#testimonials" on={route.type === 'testimonials'} Icon={MessageSquareQuote}>
                  Testimonials{content.testimonials.length ? ` (${content.testimonials.length})` : ''}
                </Item>
              </div>
            </div>
          </nav>

          {/* The reading. */}
          <article className="min-w-0 rounded-[2rem] border border-border bg-surface p-5 shadow-sm sm:p-8 md:p-10">
            {guide && (
              <>
                <PageHead Icon={guide.Icon} title={guide.title} blurb={guide.blurb}>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1 font-semibold text-on-secondary" title={live[guide.id] ? 'Read from GitHub just now' : 'GitHub couldn’t be reached, so this is the copy built into the site'}>
                    <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" /> {live[guide.id] ? 'Live from GitHub' : 'Saved copy'}
                  </span>
                  <a href={BLOB + guide.file} target="_blank" rel="noopener" className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1 font-semibold text-ink-secondary transition hover:border-primary hover:text-ink">
                    On GitHub <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </a>
                </PageHead>
                <div className="doc-prose" dangerouslySetInnerHTML={{ __html: html }} />
              </>
            )}

            {route.type === 'posts' && (
              <>
                <PageHead Icon={Newspaper} title="Posts" blurb="Notes on colour, design and building colorsbymax." />
                {content.loading ? (
                  <Loading />
                ) : content.posts.length ? (
                  <ul className="grid gap-4 sm:grid-cols-2">
                    {content.posts.map((p) => (
                      <li key={p.slug} className="group relative flex flex-col rounded-3xl border border-border bg-background p-5 transition hover:-translate-y-0.5 hover:border-primary">
                        <p className="text-xs font-semibold text-ink-muted">{niceDate(p.date)}</p>
                        <a href={`#post/${p.slug}`} className="mt-1 font-display text-xl font-bold text-ink after:absolute after:inset-0 after:content-['']">
                          {p.title}
                        </a>
                        {p.summary && <p className="mt-2 text-sm leading-relaxed text-ink-secondary">{p.summary}</p>}
                        {admin && <EntryTools onEdit={() => setEditing({ kind: 'post', entry: p })} onDeleted={() => saved(`Deleted “${p.title}”.`)} kind="post" entry={p} />}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <Empty Icon={Newspaper} text="No posts yet." admin={admin} onAdd={() => setEditing({ kind: 'post' })} addLabel="Write the first post" />
                )}
              </>
            )}

            {route.type === 'post' &&
              (post ? (
                <>
                  <PageHead Icon={Newspaper} title={post.title} blurb={[niceDate(post.date), post.summary].filter(Boolean).join(' · ')}>
                    {admin && <EntryTools onEdit={() => setEditing({ kind: 'post', entry: post })} onDeleted={() => (saved(`Deleted “${post.title}”.`), (location.hash = 'posts'))} kind="post" entry={post} inline />}
                  </PageHead>
                  <div className="doc-prose" dangerouslySetInnerHTML={{ __html: html }} />
                </>
              ) : content.loading ? (
                <Loading />
              ) : (
                <Empty Icon={Newspaper} text="That post isn’t here any more." />
              ))}

            {route.type === 'testimonials' && (
              <>
                <PageHead Icon={MessageSquareQuote} title="Testimonials" blurb="What people say about colorsbymax." />
                {content.loading ? (
                  <Loading />
                ) : content.testimonials.length ? (
                  <ul className="grid gap-4 sm:grid-cols-2">
                    {content.testimonials.map((t) => (
                      <li key={t.slug} className="relative flex flex-col rounded-3xl border border-border bg-background p-6">
                        <Quote className="h-7 w-7 text-primary" aria-hidden="true" />
                        <div className="doc-prose mt-3 flex-1 text-ink" dangerouslySetInnerHTML={{ __html: render(t.body).html }} />
                        <p className="mt-4 font-semibold text-ink">{t.name}</p>
                        {t.role && <p className="text-sm text-ink-secondary">{t.role}</p>}
                        {admin && <EntryTools onEdit={() => setEditing({ kind: 'testimonial', entry: t })} onDeleted={() => saved(`Deleted ${t.name}’s testimonial.`)} kind="testimonial" entry={t} />}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <Empty Icon={MessageSquareQuote} text="No testimonials yet." admin={admin} onAdd={() => setEditing({ kind: 'testimonial' })} addLabel="Add the first one" />
                )}
              </>
            )}
          </article>
        </div>
      </div>
      {editing && <Editor {...editing} onClose={() => setEditing(null)} onSaved={saved} />}
    </main>
  )
}

function PageHead({ Icon, title, blurb, children }) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-border pb-5">
      <div className="min-w-0">
        <p className="flex items-center gap-2 font-display text-2xl font-bold text-ink">
          <Icon className="h-6 w-6 shrink-0 text-primary" aria-hidden="true" /> {title}
        </p>
        {blurb && <p className="mt-1 text-sm text-ink-secondary">{blurb}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2 text-xs">{children}</div>}
    </div>
  )
}

const Loading = () => (
  <p className="flex items-center justify-center gap-2 py-12 text-sm text-ink-secondary" role="status">
    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Loading…
  </p>
)

function Empty({ Icon, text, admin, onAdd, addLabel }) {
  return (
    <div className="flex flex-col items-center rounded-3xl border border-dashed border-border px-6 py-14 text-center">
      <Icon className="h-8 w-8 text-ink-muted" aria-hidden="true" />
      <p className="mt-3 font-semibold text-ink">{text}</p>
      {!admin && <p className="mt-1 text-sm text-ink-secondary">They’re on the way.</p>}
      {admin && onAdd && (
        <button type="button" onClick={onAdd} className="mt-5 inline-flex h-10 cursor-pointer items-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-on-primary transition hover:-translate-y-px">
          <Plus className="h-4 w-4" aria-hidden="true" /> {addLabel}
        </button>
      )}
    </div>
  )
}

/** Edit and delete, for the admin. Delete asks first. */
function EntryTools({ kind, entry, onEdit, onDeleted, inline = false }) {
  const [confirm, setConfirm] = useState(false)
  const [busy, setBusy] = useState(false)
  const remove = async () => {
    setBusy(true)
    const res = await fetch(`${API}/admin/entry`, { method: 'DELETE', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind, slug: entry.slug }) }).catch(() => null)
    setBusy(false)
    if (res?.ok) onDeleted()
    else setConfirm(false)
  }
  const btn = 'relative z-10 inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full border border-border bg-surface px-3 text-xs font-semibold text-ink transition hover:border-primary'
  return (
    <div className={`${inline ? '' : 'mt-4'} flex flex-wrap gap-2`}>
      <button type="button" onClick={onEdit} className={btn}>
        <Pencil className="h-3.5 w-3.5" aria-hidden="true" /> Edit
      </button>
      {confirm ? (
        <button type="button" onClick={remove} disabled={busy} className={`${btn} border-danger text-danger`}>
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />} Delete for good?
        </button>
      ) : (
        <button type="button" onClick={() => setConfirm(true)} className={btn}>
          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" /> Delete
        </button>
      )}
    </div>
  )
}

const today = () => new Date().toISOString().slice(0, 10)

/** Writing a post or testimonial: its fields, the text in Markdown, and a preview. */
function Editor({ kind, entry, onClose, onSaved }) {
  const isPost = kind === 'post'
  const [fields, setFields] = useState(() => (isPost ? { title: entry?.title ?? '', date: entry?.date ?? today(), summary: entry?.summary ?? '' } : { name: entry?.name ?? '', role: entry?.role ?? '', date: entry?.date ?? today() }))
  const [body, setBody] = useState(entry?.body ?? '')
  const [tab, setTab] = useState('write')
  const [status, setStatus] = useState(null)
  const set = (k) => (e) => setFields((f) => ({ ...f, [k]: e.target.value }))
  const input = 'w-full rounded-xl border border-border bg-background px-3 py-2.5 text-ink outline-none focus:border-primary focus:ring-2 focus:ring-primary/30'
  const label = 'block text-sm font-semibold'

  const save = async (e) => {
    e.preventDefault()
    setStatus('saving')
    const slug = entry?.slug ?? slugFor(isPost ? fields.title : `${fields.name}-${fields.date}`)
    const res = await fetch(`${API}/admin/entry`, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind, slug, fields, body }) }).catch(() => null)
    if (res?.ok) return onSaved(isPost ? `Saved “${fields.title}”. It’s live on the docs page.` : `Saved ${fields.name}’s testimonial.`)
    setStatus((await res?.json().catch(() => null))?.error ?? 'Couldn’t save just now. Your writing is still here; try again.')
  }

  return (
    <Modal title={`${entry ? 'Edit' : 'New'} ${isPost ? 'post' : 'testimonial'}`} onClose={onClose} wide>
      <form onSubmit={save} className="mt-5 space-y-4">
        {isPost ? (
          <>
            <div>
              <label className={label} htmlFor="ed-title">Title</label>
              <input id="ed-title" required value={fields.title} onChange={set('title')} className={`${input} mt-1.5`} />
            </div>
            <div className="grid gap-4 sm:grid-cols-[1fr_180px]">
              <div>
                <label className={label} htmlFor="ed-summary">Summary <span className="font-normal text-ink-muted">(shown on the list of posts)</span></label>
                <input id="ed-summary" value={fields.summary} onChange={set('summary')} className={`${input} mt-1.5`} />
              </div>
              <div>
                <label className={label} htmlFor="ed-date">Date</label>
                <input id="ed-date" type="date" value={fields.date} onChange={set('date')} className={`${input} mt-1.5`} />
              </div>
            </div>
          </>
        ) : (
          <div className="grid gap-4 sm:grid-cols-[1fr_1fr_160px]">
            <div>
              <label className={label} htmlFor="ed-name">Name</label>
              <input id="ed-name" required value={fields.name} onChange={set('name')} className={`${input} mt-1.5`} />
            </div>
            <div>
              <label className={label} htmlFor="ed-role">Role or company <span className="font-normal text-ink-muted">(optional)</span></label>
              <input id="ed-role" value={fields.role} onChange={set('role')} className={`${input} mt-1.5`} />
            </div>
            <div>
              <label className={label} htmlFor="ed-date">Date</label>
              <input id="ed-date" type="date" value={fields.date} onChange={set('date')} className={`${input} mt-1.5`} />
            </div>
          </div>
        )}
        <div>
          <div className="flex items-center justify-between gap-3">
            <span className={label}>{isPost ? 'Post' : 'What they said'}</span>
            <span role="tablist" aria-label="Write or preview" className="inline-flex rounded-full border border-border p-0.5 text-xs font-semibold">
              {['write', 'preview'].map((t) => (
                <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={`cursor-pointer rounded-full px-3 py-1 capitalize ${tab === t ? 'bg-ink text-background' : 'text-ink-secondary hover:text-ink'}`}>
                  {t}
                </button>
              ))}
            </span>
          </div>
          {tab === 'write' ? (
            <textarea
              required
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={isPost ? 14 : 5}
              placeholder={isPost ? 'Write in Markdown: ## for headings, **bold**, [links](https://…), - lists.' : '“colorsbymax made our site…”'}
              className={`${input} mt-1.5 font-mono text-sm leading-relaxed`}
            />
          ) : (
            <div className="doc-prose mt-1.5 min-h-40 rounded-xl border border-border bg-background p-4" dangerouslySetInnerHTML={{ __html: render(body).html || '<p>Nothing to preview yet.</p>' }} />
          )}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <p role="status" className="text-sm text-ink-secondary">
            {status === 'saving' ? 'Saving to GitHub…' : status}
          </p>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="h-11 cursor-pointer rounded-full px-5 font-semibold text-ink-secondary hover:bg-accent hover:text-on-accent">
              Cancel
            </button>
            <button type="submit" disabled={status === 'saving'} className="shine inline-flex h-11 cursor-pointer items-center gap-2 rounded-full bg-primary px-6 font-semibold text-on-primary shadow-lg shadow-primary/25 transition hover:-translate-y-px disabled:opacity-60">
              {status === 'saving' && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />} {entry ? 'Save changes' : 'Publish'}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  )
}
