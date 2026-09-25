// Draws the README's artwork as SVGs in docs/readme/: the hero banner, a colour-coded banner for
// each group of sections, and the matching navigation chips. The README links them from GitHub
// so they also show on npm.
//
//   node scripts/make-readme-art.mjs

import { mkdirSync, writeFileSync } from 'node:fs'

const dir = new URL('../docs/readme/', import.meta.url)
mkdirSync(dir, { recursive: true })

const FONT = `font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"`
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/'/g, '&#39;')

// Max's picks, as painted on a page: primary, gradient partner, tint, background, text.
const PICKS = {
  ocean: ['#0d6b84', '#0891b2', '#dff3f8', '#f8fcfd', '#122126'],
  forest: ['#127136', '#159c47', '#e1f3e6', '#f9fcf9', '#17231b'],
  sunset: ['#ac3a0b', '#ea580c', '#fde8dc', '#fffbf8', '#2a1a12'],
  slate: ['#334155', '#64748b', '#e2e8f0', '#f8fafc', '#0f172a'],
  rose: ['#b7175a', '#db2777', '#fce4ef', '#fffafc', '#2b1520'],
}

// Section groups: gradient from → to (both keep white text above 4.5:1), and the swatches shown.
export const GROUPS = [
  { id: 'start', label: 'Get started', kicker: 'Get started', title: 'Two steps to a live colour switcher', sub: 'Install it, add one line, and the colour button appears.', from: '#0d6b84', to: '#0e7490', swatches: ['#0d6b84', '#0891b2', '#67e8f9', '#dff3f8', '#122126'] },
  { id: 'agents', label: 'Coding agents', kicker: 'Coding agents', title: 'Let Claude, Cursor or Copilot do it', sub: 'The colorsbymax MCP server sets it up, picks themes and finishes.', from: '#5b21b6', to: '#86198f', swatches: ['#5b21b6', '#7c3aed', '#c026d3', '#f0abfc', '#ede9fe'] },
  { id: 'inside', label: 'Features', kicker: 'What’s inside', title: 'Everything in the panel', sub: '720 themes, contrast checks, palettes from images, and an Audit.', from: '#9d174d', to: '#be185d', swatches: ['#b7175a', '#db2777', '#f9a8d4', '#fce4ef', '#2b1520'] },
  { id: 'control', label: 'Full control', kicker: 'Full control', title: 'Paint with colour tokens', sub: 'Decide exactly which colour goes where, with 35 CSS variables.', from: '#127136', to: '#15803d', swatches: ['#127136', '#159c47', '#86efac', '#e1f3e6', '#17231b'] },
  { id: 'ship', label: 'Ship it', kicker: 'Ship it', title: 'Keep your colours and go live', sub: 'Make your pick the default, hide the switcher, stay up to date.', from: '#9a3412', to: '#c2410c', swatches: ['#ac3a0b', '#ea580c', '#fdba74', '#fde8dc', '#2a1a12'] },
  { id: 'hood', label: 'Under the hood', kicker: 'Under the hood', title: 'Build, regenerate, contribute', sub: 'How the package, panel styles and theme library are built.', from: '#1e293b', to: '#475569', swatches: ['#334155', '#64748b', '#94a3b8', '#e2e8f0', '#0f172a'] },
]

const svg = (w, h, body, title) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(title)}"><title>${esc(title)}</title>${body}</svg>\n`

// ---------------------------------------------------------------- section banners

GROUPS.forEach((g, i) => {
  const n = String(i + 1).padStart(2, '0')
  const discs = g.swatches
    .map((c, k) => `<circle cx="${676 + k * 38}" cy="60" r="28" fill="${c}" stroke="#ffffff" stroke-opacity="0.85" stroke-width="3"/>`)
    .join('')
  const body = `
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${g.from}"/><stop offset="1" stop-color="${g.to}"/></linearGradient>
    <clipPath id="c"><rect width="880" height="120" rx="20"/></clipPath>
  </defs>
  <g clip-path="url(#c)">
    <rect width="880" height="120" fill="url(#g)"/>
    <circle cx="860" cy="-20" r="120" fill="#ffffff" opacity="0.07"/>
    <circle cx="610" cy="150" r="90" fill="#ffffff" opacity="0.05"/>
  </g>
  <text x="36" y="38" ${FONT} font-size="12" font-weight="700" letter-spacing="2.4" fill="#ffffff">${n} · ${esc(g.kicker.toUpperCase())}</text>
  <text x="36" y="72" ${FONT} font-size="27" font-weight="700" fill="#ffffff">${esc(g.title)}</text>
  <text x="36" y="98" ${FONT} font-size="15" fill="#ffffff">${esc(g.sub)}</text>
  ${discs}`
  writeFileSync(new URL(`section-${g.id}.svg`, dir), svg(880, 120, body, `${g.kicker}: ${g.title}`))
})

// ---------------------------------------------------------------- navigation chips

GROUPS.forEach((g, i) => {
  const w = Math.round(52 + g.label.length * 8.4)
  const body = `
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${g.from}"/><stop offset="1" stop-color="${g.to}"/></linearGradient></defs>
  <rect width="${w}" height="36" rx="18" fill="url(#g)"/>
  <circle cx="18" cy="18" r="11" fill="#ffffff"/>
  <text x="18" y="22" text-anchor="middle" ${FONT} font-size="11" font-weight="800" fill="${g.from}">${i + 1}</text>
  <text x="38" y="23" ${FONT} font-size="14" font-weight="600" fill="#ffffff">${esc(g.label)}</text>`
  writeFileSync(new URL(`nav-${g.id}.svg`, dir), svg(w, 36, body, g.label))
})

// ---------------------------------------------------------------- hero

/** A small web page painted in one theme, for the hero's fan of re-coloured sites. */
const miniSite = ([primary, alt, tint, bg, ink], x, y, angle) => `
  <g transform="rotate(${angle} ${x + 120} ${y + 85})">
    <rect x="${x}" y="${y + 6}" width="240" height="170" rx="14" fill="#000000" opacity="0.28"/>
    <rect x="${x}" y="${y}" width="240" height="170" rx="14" fill="${bg}"/>
    <path d="M${x} ${y + 14} a14 14 0 0 1 14 -14 h212 a14 14 0 0 1 14 14 v16 h-240 z" fill="${primary}"/>
    <circle cx="${x + 14}" cy="${y + 15}" r="3.5" fill="#ffffff" opacity="0.9"/>
    <circle cx="${x + 26}" cy="${y + 15}" r="3.5" fill="#ffffff" opacity="0.6"/>
    <circle cx="${x + 38}" cy="${y + 15}" r="3.5" fill="#ffffff" opacity="0.4"/>
    <rect x="${x + 18}" y="${y + 48}" width="120" height="12" rx="6" fill="${ink}"/>
    <rect x="${x + 18}" y="${y + 68}" width="170" height="7" rx="3.5" fill="${ink}" opacity="0.35"/>
    <rect x="${x + 18}" y="${y + 81}" width="140" height="7" rx="3.5" fill="${ink}" opacity="0.35"/>
    <rect x="${x + 18}" y="${y + 100}" width="70" height="22" rx="11" fill="${primary}"/>
    <rect x="${x + 96}" y="${y + 100}" width="62" height="22" rx="11" fill="none" stroke="${alt}" stroke-width="2"/>
    <rect x="${x + 18}" y="${y + 134}" width="98" height="24" rx="7" fill="${tint}"/>
    <rect x="${x + 124}" y="${y + 134}" width="98" height="24" rx="7" fill="${tint}"/>
  </g>`

// The colour button: a ring of the picks' primaries around a white dot.
const button = (cx, cy) => {
  const colours = Object.values(PICKS).map((p) => p[1])
  const r = 24
  const arcs = colours
    .map((c, k) => {
      const a0 = (k / colours.length) * Math.PI * 2 - Math.PI / 2
      const a1 = ((k + 1) / colours.length) * Math.PI * 2 - Math.PI / 2
      const p = (a) => `${(cx + r * Math.cos(a)).toFixed(2)} ${(cy + r * Math.sin(a)).toFixed(2)}`
      return `<path d="M${cx} ${cy} L${p(a0)} A${r} ${r} 0 0 1 ${p(a1)} Z" fill="${c}"/>`
    })
    .join('')
  return `<circle cx="${cx}" cy="${cy + 4}" r="29" fill="#000000" opacity="0.3"/><circle cx="${cx}" cy="${cy}" r="29" fill="#ffffff"/>${arcs}<circle cx="${cx}" cy="${cy}" r="9" fill="#ffffff"/>`
}

const strip = Object.values(PICKS)
  .map((p, k) => p.slice(0, 4).map((c, j) => `<rect x="${48 + k * 92 + j * 20}" y="238" width="18" height="18" rx="5" fill="${c}"/>`).join(''))
  .join('')

const hero = `
  <defs>
    <radialGradient id="glowA" cx="0.85" cy="0.15" r="0.6"><stop offset="0" stop-color="#0891b2" stop-opacity="0.55"/><stop offset="1" stop-color="#0891b2" stop-opacity="0"/></radialGradient>
    <radialGradient id="glowB" cx="0.6" cy="1" r="0.55"><stop offset="0" stop-color="#db2777" stop-opacity="0.45"/><stop offset="1" stop-color="#db2777" stop-opacity="0"/></radialGradient>
    <radialGradient id="glowC" cx="0.05" cy="0.05" r="0.5"><stop offset="0" stop-color="#ea580c" stop-opacity="0.35"/><stop offset="1" stop-color="#ea580c" stop-opacity="0"/></radialGradient>
    <clipPath id="c"><rect width="880" height="300" rx="28"/></clipPath>
  </defs>
  <g clip-path="url(#c)">
    <rect width="880" height="300" fill="#0b1120"/>
    <rect width="880" height="300" fill="url(#glowA)"/>
    <rect width="880" height="300" fill="url(#glowB)"/>
    <rect width="880" height="300" fill="url(#glowC)"/>
    ${miniSite(PICKS.sunset, 520, 70, -9)}
    ${miniSite(PICKS.rose, 580, 52, 4)}
    ${miniSite(PICKS.ocean, 548, 96, -2)}
    ${button(810, 246)}
  </g>
  <text x="46" y="92" ${FONT} font-size="54" font-weight="800" fill="#ffffff" letter-spacing="-1">colorsbymax<tspan font-size="20" dy="-26" font-weight="600">™</tspan></text>
  <text x="48" y="122" ${FONT} font-size="15" font-weight="600" letter-spacing="1.5" fill="#cbd5e1">BY MRMAXDESIGNS</text>
  <text x="48" y="170" ${FONT} font-size="25" font-weight="700" fill="#ffffff">Re-colour any website, live.</text>
  <text x="48" y="200" ${FONT} font-size="15" fill="#e2e8f0">720 themes · WCAG contrast checks · works with your coding agent</text>
  ${strip}`
writeFileSync(new URL('hero.svg', dir), svg(880, 300, hero, 'colorsbymax by mrmaxdesigns: re-colour any website, live.'))

console.log(`Wrote docs/readme/: hero.svg, ${GROUPS.length} section banners and ${GROUPS.length} nav chips`)
