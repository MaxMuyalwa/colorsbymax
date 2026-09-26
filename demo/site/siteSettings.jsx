// The site's own settings, edited in the admin space and saved in the repo (api/site.js): the
// landing page's editable text, and which parts of the colour panel are on. Loaded once per page,
// and kept in this browser too, so the next visit shows them straight away.

import { useEffect, useState } from 'react'
import { ThemeProvider } from '../../src/index.js'

const API = `${import.meta.env.BASE_URL}api/site`
const CACHE = 'colorsbymax-site:settings'

/** The landing page text the admin can edit, with what it says by default. */
export const EDITABLE_TEXT = [
  { key: 'hero.badge', label: 'Hero badge', default: 'A live theme switcher · 700+ palettes · contrast checked' },
  { key: 'hero.title', label: 'Headline', default: 'Colour your whole site' },
  { key: 'hero.highlight', label: 'Headline highlight (in the gradient)', default: 'like a designer would.' },
  {
    key: 'hero.subtitle',
    label: 'Subtext',
    long: true,
    default:
      'colorsbymax adds a colour button to your website. Try hundreds of professionally built palettes on your real pages, live, with every colour in the right role and every pairing checked so text stays readable.',
  },
  { key: 'hero.primary', label: 'Main button', default: 'Try it on this page' },
  { key: 'hero.secondary', label: 'Second button', default: 'Add it to your site' },
]
const DEFAULTS = Object.fromEntries(EDITABLE_TEXT.map((t) => [t.key, t.default]))

const cached = () => {
  try {
    return JSON.parse(localStorage.getItem(CACHE) || 'null') ?? {}
  } catch {
    return {}
  }
}

let loading = null
const listeners = new Set()
let current = cached()

/** Fetches the settings once per page (every hook shares it); `fresh` skips the edge cache. */
export function loadSiteSettings(fresh = false) {
  if (import.meta.env.DEV && !fresh) return Promise.resolve(current)
  if (!loading || fresh)
    loading = fetch(`${API}${fresh ? '?fresh=1' : ''}`, { cache: fresh ? 'no-store' : 'default' })
      .then((r) => (r.ok ? r.json() : current))
      .then((settings) => {
        current = settings ?? {}
        try {
          localStorage.setItem(CACHE, JSON.stringify(current))
        } catch {}
        for (const l of listeners) l(current)
        return current
      })
      .catch(() => current)
  return loading
}

/** The settings, as they load and whenever the admin saves new ones. */
export function useSiteSettings() {
  const [settings, setSettings] = useState(current)
  useEffect(() => {
    listeners.add(setSettings)
    if (!import.meta.env.DEV) loadSiteSettings()
    return () => listeners.delete(setSettings)
  }, [])
  return settings
}
/** Tells every page's hooks about settings just saved (so the admin sees them at once). */
export function announceSiteSettings(settings) {
  current = settings
  for (const l of listeners) l(current)
}

/** One piece of editable text: the admin's, or the default. */
export function useSiteText() {
  const { text } = useSiteSettings()
  return (key) => (text?.[key]?.trim() ? text[key] : DEFAULTS[key])
}

/** The theme provider, with the colour panel features the admin chose. */
export function SiteThemeProvider({ config, children }) {
  const { features } = useSiteSettings()
  return <ThemeProvider config={{ ...config, features: features ?? {} }}>{children}</ThemeProvider>
}
