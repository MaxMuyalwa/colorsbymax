// A burst of colour: squiggles, dots and dashes in the theme's colours, flung out from the middle
// of whatever it sits in (a `relative` parent). The colour button bursts on its entrance and on
// every click; the panel's "Surprise me" bursts with the theme it just picked.

import { useEffect, useState } from 'react'

export const BURST_TIME = 1100 // ms a burst of colour lasts

// Each piece flies to (x, y) px from the centre, turning from r degrees as it goes.
const BURST_KEYS = ['primary', 'primary-alt', 'data-1', 'data-2', 'data-3', 'data-4', 'warning', 'data-5']
const BURST_PIECES = Array.from({ length: 12 }, (_, i) => {
  const angle = (i * 30 + (i % 2 ? 9 : -6)) * (Math.PI / 180)
  const distance = 30 + (i % 3) * 9
  return {
    x: Math.round(Math.cos(angle) * distance),
    y: Math.round(Math.sin(angle) * distance),
    r: Math.round((angle * 180) / Math.PI),
    shape: ['squiggle', 'dot', 'dash'][i % 3],
    delay: (i % 4) * 25,
  }
})

/** `spread` scales how far the pieces fly, for something wider than the colour button. */
export function Burst({ tokens, spread = 1 }) {
  return (
    <span aria-hidden="true" className="theme-burst pointer-events-none absolute inset-0">
      {BURST_PIECES.map((p, i) => (
        <span
          key={i}
          className={`theme-burst-piece ${p.shape === 'squiggle' ? '' : `theme-piece-${p.shape}`}`}
          style={{
            '--x': `${Math.round(p.x * spread)}px`,
            '--y': `${Math.round(p.y * spread)}px`,
            '--r': `${p.r}deg`,
            color: tokens[BURST_KEYS[i % BURST_KEYS.length]],
            animationDelay: `${p.delay}ms`,
          }}
        >
          {p.shape === 'squiggle' && (
            <svg width="16" height="10" viewBox="0 0 16 10" fill="none">
              <path d="M1 5c1.6-3.6 3.4-3.6 4.6 0s3 3.6 4.6 0 3-3.6 4.4 0" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
            </svg>
          )}
        </span>
      ))}
    </span>
  )
}

/**
 * A burst to show on demand: `celebrate()` starts one (restarting it if one is running), and
 * `burst` is the key to render `<Burst key={burst} />` with while `bursting`.
 */
export function useBurst() {
  const [burst, setBurst] = useState(0)
  const [bursting, setBursting] = useState(false)
  useEffect(() => {
    if (!burst) return
    setBursting(true)
    const id = setTimeout(() => setBursting(false), BURST_TIME)
    return () => clearTimeout(id)
  }, [burst])
  return { burst, bursting, celebrate: () => setBurst((n) => n + 1) }
}
