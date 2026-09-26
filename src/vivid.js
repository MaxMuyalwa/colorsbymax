// The "Colourful" style for re-coloured sites: on top of swapping the site's own colours, it
// paints the page the way colorsbymax's own site is painted, by role. A plain site (white page,
// black text, grey borders) otherwise barely changes with a theme; here its parts take the
// theme's colours as a designer would give them:
//
//   the page's header        surface, with a border        the hero      a glow of the brand colour
//   every other section      alternates with a soft tint   the last call to action   a brand gradient
//   the footer               the secondary colour          cards    surface, with a brand border on hover
//   buttons                  the brand colour (outlined ones the secondary)   links   the brand colour
//   headings                 the deep brand colour, with any emphasis in the hero as a gradient
//   badges, fields, tables, quotes, code, marks, list markers, text selection, checkboxes: their roles
//
// It works in two steps. `markZones` finds the page's big parts once (header, hero, sections,
// call to action, footer) and marks them `data-cbm-z`. `rolesOf` then names the part each element
// plays (`data-cbm-v`), read from the site's original look while the engine tags the page. The
// colours themselves come from `vividCss(tokens)`, a stylesheet that follows every theme; each
// text colour is checked against what it sits on, falling back to the theme's plain text colours
// when a pairing wouldn't read.

import { contrastRatio, deltaE, mix } from './color.js'

export const ZONE = 'data-cbm-z'
export const ROLE = 'data-cbm-v'

const MIN_TEXT = 4.5
const MIN_LARGE = 3 // headings and big emphasis
const IGNORE = new Set(['script', 'style', 'noscript', 'template', 'link', 'meta', 'colorsbymax-root'])
const BUTTON_INPUTS = new Set(['button', 'submit', 'reset'])
const FIELD_SKIP = new Set(['checkbox', 'radio', 'range', 'color', 'file', 'hidden', 'image', ...BUTTON_INPUTS])
const WRAPPERS = new Set(['div', 'main', 'section', 'article'])

const visibleBlocks = (el) =>
  [...el.children].filter((c) => {
    if (IGNORE.has(c.localName) || c.dataset?.colorsbymax !== undefined) return false
    const r = c.getBoundingClientRect()
    return r.height > 8 && getComputedStyle(c).display !== 'none'
  })
const pageHeight = () => Math.max(document.documentElement.scrollHeight, 1)
const isTag = (el, ...tags) => tags.includes(el.localName)

/**
 * The page's top-level parts, top to bottom: past any single wrapper (an app's root div), with a
 * <main>, or a wrapper holding most of the page, opened up into its sections.
 */
function pageParts() {
  let container = document.body
  for (let i = 0; i < 6; i++) {
    const kids = visibleBlocks(container)
    if (kids.length !== 1) break
    container = kids[0]
  }
  const parts = []
  for (const kid of visibleBlocks(container)) {
    const r = kid.getBoundingClientRect()
    const opens = kid.localName === 'main' || kid.getAttribute('role') === 'main' || (WRAPPERS.has(kid.localName) && r.height > pageHeight() * 0.5 && visibleBlocks(kid).length > 1)
    if (opens) parts.push(...visibleBlocks(kid))
    else parts.push(kid)
  }
  return parts.filter((p) => p.getBoundingClientRect().height > 30)
}

const hasButton = (el) => el.querySelector('button, [role="button"], input[type="submit"], a[class*="btn" i], a[class*="button" i]')

/** Marks the page's header, hero, sections, closing call to action and footer. */
export function markZones() {
  for (const el of document.querySelectorAll(`[${ZONE}]`)) el.removeAttribute(ZONE)
  const parts = pageParts()
  if (parts.length < 2) return
  let header = parts.find((p) => isTag(p, 'header') || p.getAttribute('role') === 'banner')
  if (!header && parts[0].getBoundingClientRect().height < 200 && parts[0].querySelector('nav, a')) header = parts[0]
  const last = parts[parts.length - 1]
  const footer = parts.find((p) => isTag(p, 'footer') || p.getAttribute('role') === 'contentinfo') ?? (isTag(last, 'footer') ? last : null)
  const body = parts.filter((p) => p !== header && p !== footer)
  const hero = body.find((p) => p.querySelector('h1')) ?? body[0]
  // A closing call to action: the last section, short, with a heading and a button.
  const end = body[body.length - 1]
  const cta =
    end && end !== hero && end.querySelector('h1, h2, h3') && hasButton(end) && end.textContent.trim().length < 400 ? end : null
  if (header) header.setAttribute(ZONE, 'header')
  if (footer) footer.setAttribute(ZONE, 'footer')
  if (hero) hero.setAttribute(ZONE, 'hero')
  if (cta) cta.setAttribute(ZONE, 'cta')
  // The sections between take turns: tinted, plain, tinted…
  body.filter((p) => p !== hero && p !== cta).forEach((p, i) => i % 2 === 0 && p.setAttribute(ZONE, 'tint'))
}

/** What an element paints over: 'primary' (a brand-coloured band), 'secondary' (the footer), or 'page'. */
const zoneOf = (el) => {
  const z = el.closest(`[${ZONE}]`)?.getAttribute(ZONE)
  return z === 'cta' ? 'primary' : z === 'footer' ? 'secondary' : 'page'
}

const px = (v) => parseFloat(v) || 0
const allBorders = (cs) => ['top', 'right', 'bottom', 'left'].every((s) => px(cs.getPropertyValue(`border-${s}-width`)) > 0 && cs.getPropertyValue(`border-${s}-style`) !== 'none')

/**
 * The roles an element plays, from its original look. `ownFill` is its own background (a hex, or
 * null if it has none worth counting) and `under` the hex of what it sits on.
 */
export function rolesOf(el, cs, ownFill, under) {
  const roles = []
  const name = el.localName
  const zoneRole = el.getAttribute(ZONE)
  const zone = zoneOf(el)
  if (zoneRole) roles.push(`z-${zoneRole}`)

  // Inside a button: its label and icons take the button's text colour.
  const inButton = el.parentElement?.closest(`[${ROLE}~="btn"], [${ROLE}~="btn2"], [${ROLE}~="btn-inv"]`)
  if (inButton) {
    const kind = inButton.getAttribute(ROLE).match(/\b(btn-inv|btn2|btn)\b/)[1]
    roles.push(`${kind}-in`)
    return roles
  }
  // On a brand band or the footer, all text takes that colour's text colour.
  if (zone === 'primary') roles.push('on1')
  else if (zone === 'secondary') roles.push('on2')

  const type = (el.getAttribute('type') || '').toLowerCase()
  const radius = px(cs.borderTopLeftRadius)
  const filled = Boolean(ownFill) && deltaE(ownFill, under) > 12
  const buttonish =
    name === 'button' ||
    el.getAttribute('role') === 'button' ||
    (name === 'input' && BUTTON_INPUTS.has(type)) ||
    ((name === 'a' || name === 'label') && (filled || allBorders(cs)) && px(cs.paddingLeft) >= 6 && cs.display !== 'inline')
  if (buttonish) {
    roles.push(zone === 'primary' ? 'btn-inv' : filled ? 'btn' : 'btn2')
    return roles
  }
  if (name === 'a') {
    roles.push(el.closest(`nav, [${ZONE}="header"]`) ? 'navlink' : zone === 'page' ? 'link' : 'link-on')
    return roles
  }
  if (/^h[1-3]$/.test(name) && zone === 'page') roles.push('head')
  // Emphasis inside the hero's headline: a gradient of the brand colours.
  if (zone === 'page' && ['em', 'strong', 'b', 'i', 'span', 'mark'].includes(name) && el.parentElement?.localName === 'h1') roles.push('hl')
  if (name === 'input' && !FIELD_SKIP.has(type)) roles.push('field')
  else if (name === 'textarea' || name === 'select') roles.push('field')
  if (zone !== 'page') return roles
  if (name === 'th') roles.push('th')
  else if (name === 'blockquote') roles.push('quote')
  else if (name === 'pre' || (name === 'code' && el.parentElement?.localName !== 'pre')) roles.push('code')
  else if (name === 'hr') roles.push('rule')
  else if (name === 'mark') roles.push('mark')

  // A card: a rounded box with an edge (border, shadow or a fill of its own), narrower than what
  // holds it, with something in it.
  const blockish = ['block', 'flex', 'grid', 'flow-root', 'list-item'].includes(cs.display)
  if (blockish && !zoneRole && radius >= 6 && (allBorders(cs) || cs.boxShadow !== 'none' || filled) && !['input', 'textarea', 'select', 'img'].includes(name)) {
    const r = el.getBoundingClientRect()
    const parent = el.parentElement?.getBoundingClientRect()
    if (r.height >= 56 && parent && r.width <= parent.width * 0.96 && el.textContent.trim()) roles.push('card')
  }
  // A badge: a small rounded label with a fill of its own.
  // (Its fill may be only a shade off what it sits on, like a light grey pill on a white card.)
  const tinted = Boolean(ownFill) && deltaE(ownFill, under) > 2
  if (!blockish && tinted && radius >= 6 && el.textContent.trim().length <= 30 && !el.querySelector('div, p')) roles.push('badge')
  return roles
}

// ------------------------------------------------------------------ colours

const readsOn = (fg, bgs, min) => bgs.every((bg) => contrastRatio(fg, bg) >= min)
/** The first colour that reads on every background, else the theme's plain text colour. */
const firstReadable = (candidates, bgs, min) => candidates.find((c) => c && readsOn(c, bgs, min)) ?? candidates[candidates.length - 1]

/** The Colourful stylesheet for a theme's tokens. */
export function vividCss(t) {
  const bg = t.background
  const tint = mix(t.secondary, bg, 0.55)
  const glow = mix(t.primary, bg, 0.16)
  const glowAlt = mix(t['primary-alt'], bg, 0.12)
  const pageBgs = [bg, t.surface, tint, glow]
  const ink = firstReadable([t.ink], pageBgs, MIN_TEXT)
  const head = firstReadable([t['primary-dark'], ink], pageBgs, MIN_LARGE)
  const link = firstReadable([t.primary, t['primary-dark'], ink], pageBgs, MIN_TEXT)
  const linkHover = firstReadable([t['primary-dark'], ink], pageBgs, MIN_TEXT)
  const navHover = firstReadable([t.primary, t['primary-dark'], ink], [t.surface, bg], MIN_TEXT)

  // Brand band: a gradient of the brand colours when its text reads on both ends, else solid.
  const bandEnd = mix(t['primary-alt'], t.primary, 0.45)
  const onPrimary = firstReadable([t['on-primary'], '#ffffff', '#000000'], [t.primary], MIN_TEXT)
  const band = readsOn(onPrimary, [t.primary, bandEnd], MIN_TEXT) ? `linear-gradient(135deg,${t.primary},${bandEnd})` : t.primary
  const footerBg = t.secondary
  const onSecondary = firstReadable([t['on-secondary'], ink], [footerBg], MIN_TEXT)
  const btnHover = mix(t['primary-dark'], t.primary, 0.22)
  const onBtnHover = firstReadable([onPrimary, '#ffffff', '#000000'], [btnHover], MIN_TEXT)
  const quiet = firstReadable([t['on-secondary'], ink], [t.secondary], MIN_TEXT)
  // Badges: a clear wash of the brand colour on the card they sit on, in light and dark alike.
  const badgeBg = mix(t.primary, t.surface, 0.2)
  const badgeInk = firstReadable([t['primary-dark'], t['on-secondary'], ink], [badgeBg], MIN_TEXT)
  // The hero's emphasis: a gradient when both brand colours read as large text, else solid.
  const hlGradient = readsOn(t.primary, [bg, glow], MIN_LARGE) && readsOn(t['primary-alt'], [bg, glow], MIN_LARGE)
  const shadow = `0 18px 40px -22px ${t.shadow}`
  const move = 'transition:background-color .25s,color .25s,border-color .25s,box-shadow .25s,transform .25s!important'
  const r = (role, css) => `[${ROLE}~="${role}"]{${css}}`
  const imp = (decls) => decls.map((d) => `${d}!important`).join(';')

  return [
    `html{accent-color:${t.primary}}`,
    `::selection{background:${mix(t.primary, bg, 0.28)}}`,
    `[${ROLE}] li::marker,li[${ROLE}]::marker{color:${t.primary}}`,
    // Zones.
    r('z-header', imp([`background-color:${t.surface}`, `border-bottom-color:${t.border}`])),
    r('z-hero', imp([`background-color:${bg}`, `background-image:radial-gradient(120% 85% at 50% -10%,${glow} 0%,transparent 62%),radial-gradient(60% 60% at 100% 100%,${glowAlt} 0%,transparent 70%)`])),
    r('z-tint', imp([`background-color:${tint}`])),
    r('z-cta', imp([`background-color:${t.primary}`, `background-image:${band}`, `color:${onPrimary}`])),
    r('z-footer', imp([`background-color:${footerBg}`, `border-top-color:transparent`, `color:${onSecondary}`])),
    // Text on the brand band and the footer.
    r('on1', imp([`color:${onPrimary}`])),
    r('on2', imp([`color:${onSecondary}`])),
    // Headings and emphasis.
    r('head', imp([`color:${head}`])),
    r('hl', hlGradient
      ? imp([`background-image:linear-gradient(100deg,${t.primary},${t['primary-alt']})`, 'background-color:transparent', '-webkit-background-clip:text', 'background-clip:text', 'color:transparent', '-webkit-text-fill-color:transparent'])
      : imp([`color:${t.primary}`])),
    // Links.
    r('link', imp([`color:${link}`, `text-decoration-color:${mix(link, bg, 0.45)}`, move])),
    `[${ROLE}~="link"]:hover{${imp([`color:${linkHover}`, `text-decoration-color:${linkHover}`])}}`,
    r('link-on', imp(['color:inherit', 'text-decoration-color:currentColor'])),
    r('navlink', imp([`color:${firstReadable([t['ink-secondary'], ink], [t.surface, bg], MIN_TEXT)}`, move])),
    `[${ROLE}~="navlink"]:hover{${imp([`color:${navHover}`])}}`,
    // Cards, badges, fields and the rest.
    r('card', imp([`background-color:${t.surface}`, `border-color:${t.border}`, move])),
    `[${ROLE}~="card"]:hover{${imp([`border-color:${t.primary}`, `box-shadow:${shadow}`, 'transform:translateY(-2px)'])}}`,
    r('badge', imp([`background-color:${badgeBg}`, `color:${badgeInk}`, `border-color:transparent`])),
    r('field', imp([`background-color:${t.surface}`, `border-color:${t.border}`, `color:${ink}`, move])),
    `[${ROLE}~="field"]:focus{${imp([`border-color:${t.primary}`, `outline:2px solid ${mix(t.primary, bg, 0.35)}`, 'outline-offset:1px'])}}`,
    r('th', imp([`background-color:${tint}`, `color:${head}`])),
    r('quote', imp([`border-left-color:${t.primary}`, `background-color:${t.surface}`, 'border-radius:0 12px 12px 0'])),
    r('code', imp([`background-color:${t.secondary}`, `color:${quiet}`])),
    r('rule', imp([`border-color:${t.border}`])),
    r('mark', imp([`background-color:${mix(t['primary-alt'], bg, 0.3)}`, `color:${ink}`])),
    // Buttons last, so they win over everything they sit in.
    r('btn', imp([`background-color:${t.primary}`, 'background-image:none', `color:${onPrimary}`, `border-color:${t.primary}`, `box-shadow:0 8px 20px -10px ${t.primary}`, move])),
    `[${ROLE}~="btn"]:hover{${imp([`background-color:${btnHover}`, `border-color:${btnHover}`, `color:${onBtnHover}`, 'transform:translateY(-1px)'])}}`,
    r('btn-in', imp([`color:${onPrimary}`])),
    `[${ROLE}~="btn"]:hover [${ROLE}~="btn-in"]{${imp([`color:${onBtnHover}`])}}`,
    r('btn2', imp([`background-color:${t.secondary}`, 'background-image:none', `color:${quiet}`, `border-color:${t.border}`, move])),
    `[${ROLE}~="btn2"]:hover{${imp([`border-color:${t.primary}`, 'transform:translateY(-1px)'])}}`,
    r('btn2-in', imp([`color:${quiet}`])),
    r('btn-inv', imp([`background-color:${onPrimary}`, 'background-image:none', `color:${firstReadable([t.primary, t['primary-dark'], ink], [onPrimary], MIN_TEXT)}`, `border-color:${onPrimary}`, move])),
    `[${ROLE}~="btn-inv"]:hover{${imp(['transform:translateY(-1px)', `box-shadow:0 10px 24px -12px ${t.shadow}`])}}`,
    r('btn-inv-in', imp([`color:${firstReadable([t.primary, t['primary-dark'], ink], [onPrimary], MIN_TEXT)}`])),
  ].join('\n')
}
