import { useEffect, useState } from 'react'
import { Star } from 'lucide-react'
import { GitHubIcon, REPO } from './ui.jsx'

const API = 'https://api.github.com/repos/MaxMuyalwa/colorsbymax'
const CACHE_KEY = 'colorsbymax-site:stars'
const CACHE_TIME = 10 * 60 * 1000 // GitHub allows 60 unauthenticated requests an hour per visitor

/** The repo's live star count, cached for a few minutes. null until known (or if GitHub is unreachable). */
function useStars() {
  const [stars, setStars] = useState(() => {
    try {
      const cached = JSON.parse(sessionStorage.getItem(CACHE_KEY) ?? 'null')
      return cached && Date.now() - cached.at < CACHE_TIME ? cached.stars : null
    } catch {
      return null
    }
  })
  useEffect(() => {
    if (stars !== null) return
    const controller = new AbortController()
    fetch(API, { signal: controller.signal, headers: { Accept: 'application/vnd.github+json' } })
      .then((res) => (res.ok ? res.json() : null))
      .then((repo) => {
        if (typeof repo?.stargazers_count !== 'number') return
        setStars(repo.stargazers_count)
        try {
          sessionStorage.setItem(CACHE_KEY, JSON.stringify({ stars: repo.stargazers_count, at: Date.now() }))
        } catch {}
      })
      .catch(() => {})
    return () => controller.abort()
  }, [stars])
  return stars
}

const compact = (n) => (n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : String(n))

/**
 * Opens the repo on GitHub, where visitors add their star (GitHub only lets people star from
 * their own signed-in account), with the live count beside it.
 */
export function StarButton({ className = '' }) {
  const stars = useStars()
  return (
    <a
      href={REPO}
      target="_blank"
      rel="noopener"
      aria-label={`Star colorsbymax on GitHub${stars !== null ? ` (${stars} stars)` : ''}`}
      className={`group inline-flex items-center overflow-hidden rounded-full border border-border bg-surface text-sm font-semibold text-ink shadow-sm transition hover:-translate-y-px hover:border-primary hover:shadow-md ${className}`}
    >
      <span className="inline-flex items-center gap-1.5 px-3 py-1.5">
        <GitHubIcon className="h-4 w-4" />
        <Star className="h-4 w-4 text-warning transition-transform duration-500 group-hover:scale-125 group-hover:rotate-[72deg] group-hover:fill-current" aria-hidden="true" />
        <span className="hidden xl:inline">Star</span>
      </span>
      {stars !== null && <span className="border-l border-border bg-background px-2.5 py-1.5 tabular-nums">{compact(stars)}</span>}
    </a>
  )
}
