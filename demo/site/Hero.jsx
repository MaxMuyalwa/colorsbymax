import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { ArrowDown, Moon, Palette, Sparkles, Sun } from 'lucide-react'
import { useTheme } from '../../src/index.js'
import { CopyButton, panelToggle } from './ui.jsx'
import { PREVIEW } from './preview.js'
import THEMES from '../assets/hero/themes.json'
import violetDesktop from '../assets/hero/violet-desktop.webp'
import violetPhone from '../assets/hero/violet-phone.webp'
import oceanDesktop from '../assets/hero/ocean-desktop.webp'
import oceanPhone from '../assets/hero/ocean-phone.webp'
import sunsetDesktop from '../assets/hero/sunset-desktop.webp'
import sunsetPhone from '../assets/hero/sunset-phone.webp'
import forestDesktop from '../assets/hero/forest-desktop.webp'
import forestPhone from '../assets/hero/forest-phone.webp'
import roseDesktop from '../assets/hero/rose-desktop.webp'
import rosePhone from '../assets/hero/rose-phone.webp'

// Real screenshots of this site in use, each taken after picking the theme in the colour panel:
// its preview pages (preview.js), the "Why" section with the panel open on a desktop and the
// "colorsbymax way" card on a phone. Each comes with that theme's colours (themes.json), which
// paint the hero's text around it.
const SHOTS = [
  { id: 'violet', name: 'Violet', mode: 'dark', desktop: violetDesktop, phone: violetPhone },
  { id: 'ocean', name: 'Ocean', mode: 'light', desktop: oceanDesktop, phone: oceanPhone },
  { id: 'sunset', name: 'Sunset', mode: 'dark', desktop: sunsetDesktop, phone: sunsetPhone },
  { id: 'forest', name: 'Forest', mode: 'light', desktop: forestDesktop, phone: forestPhone },
  { id: 'rose', name: 'Rose', mode: 'dark', desktop: roseDesktop, phone: rosePhone },
]
const LIVE = -1 // "This site": the same preview pages, live, in whatever theme the page has
const DESKTOP = { width: 1440, height: 900 } // the screenshots' size in CSS pixels
const PHONE = { width: 390, height: 844 }

/** A theme's colours as CSS variables, so every token utility inside re-colours to it. */
const themeVars = (id) => Object.fromEntries(Object.entries(THEMES[id]).map(([k, v]) => [`--color-${k}`, v]))

/** Draws `children` at a fixed size, scaled down to fill the box it sits in, like a screenshot. */
function Scaled({ width, height, children }) {
  const box = useRef(null)
  const [scale, setScale] = useState(0)
  useLayoutEffect(() => {
    const ro = new ResizeObserver(([e]) => setScale(e.contentRect.width / width))
    ro.observe(box.current)
    return () => ro.disconnect()
  }, [width])
  return (
    <div ref={box} className="absolute inset-0 overflow-hidden">
      <div inert aria-hidden="true" className="origin-top-left bg-background" style={{ width, height, transform: `scale(${scale})` }}>
        {children}
      </div>
    </div>
  )
}

/**
 * This site's preview page (`kind` is desktop or phone), live in the visitor's theme. A new
 * theme reloads it, and the last one stays up until the new one has set itself up.
 */
function LivePreview({ kind, version }) {
  const [shown, setShown] = useState(null)
  const [start, setStart] = useState(false)
  // Wait for the hero to rise in first, so the page itself loads before its copies.
  useEffect(() => {
    const id = setTimeout(() => setStart(true), 1200)
    return () => clearTimeout(id)
  }, [])
  if (PREVIEW || !start) return null
  const frames = [...new Set([shown, version])].filter((v) => v !== null)
  return frames.map((v) => <PreviewFrame key={v} kind={kind} version={v} visible={v === shown} onReady={() => setShown(v)} />)
}

function PreviewFrame({ kind, version, visible, onReady }) {
  const frame = useRef(null)
  useEffect(() => {
    const onMessage = (e) => e.source === frame.current?.contentWindow && e.data?.colorsbymaxPreview === 'ready' && onReady()
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [onReady])
  return (
    <iframe
      ref={frame}
      src={`${import.meta.env.BASE_URL}?preview=${kind}&v=${version}`}
      title={`This site on a ${kind}, in its current theme`}
      tabIndex={-1}
      className="absolute inset-0 h-full w-full border-0 transition-opacity duration-500"
      style={{ opacity: visible ? 1 : 0 }}
    />
  )
}

/** The page's colours as a short key: it changes with every new theme or mode, after a pause. */
function useColourVersion() {
  const { tokens } = useTheme()
  const colours = Object.values(tokens).join()
  const [version, setVersion] = useState(() => hash(colours))
  useEffect(() => {
    const id = setTimeout(() => setVersion(hash(colours)), 600)
    return () => clearTimeout(id)
  }, [colours])
  return version
}
const hash = (s) => [...s].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) | 0, 0).toString(36)

/** A phone (after the iPhone 15 Pro's outline) showing a screenshot, or this site live. */
function Phone({ index, version }) {
  return (
    <div className="relative aspect-[433/882] rounded-[16.9%/8.3%] bg-zinc-600 p-[1%] shadow-2xl shadow-black/40">
      <div className="absolute inset-[0.9%] rounded-[16.2%/7.9%] bg-zinc-900" />
      <div className="absolute top-[2.18%] right-[4.9%] bottom-[2.18%] left-[4.9%] overflow-hidden rounded-[14.3%/6.6%] bg-black">
        <Scaled {...PHONE}>
          <LivePreview kind="phone" version={version} />
        </Scaled>
        {SHOTS.map((s, i) => (
          <img
            key={s.id}
            src={s.phone}
            alt=""
            className="absolute inset-0 h-full w-full object-cover object-top transition-opacity duration-700 ease-out"
            style={{ opacity: i === index ? 1 : 0 }}
          />
        ))}
      </div>
      <div className="absolute top-[3.4%] left-[35.6%] h-[4.2%] w-[28.6%] rounded-full bg-black" />
    </div>
  )
}

export function Hero() {
  const { tokens } = useTheme()
  const [index, setIndex] = useState(LIVE)
  // A new theme or mode for the page brings the window back to it, so it always matches.
  const siteColours = Object.values(tokens).join()
  useEffect(() => setIndex(LIVE), [siteColours])
  const version = useColourVersion()
  const shot = SHOTS[index]
  const options = [{ id: 'live', name: 'This site', swatch: tokens.primary }, ...SHOTS.map((s) => ({ ...s, swatch: THEMES[s.id].primary }))]

  return (
    <header id="top" className="relative isolate overflow-hidden px-4 pt-36 sm:px-6 sm:pt-24 md:pt-28">
      {/* The page background turning into the brand colour towards the edges, like light through glass. */}
      <div className="hero-backdrop absolute inset-0 -z-10" aria-hidden="true">
        <div className="absolute inset-0 bg-[radial-gradient(125%_125%_at_50%_10%,var(--color-background)_40%,var(--color-primary)_100%)]" />
        <div className="dot-grid absolute inset-0 opacity-60" />
      </div>

      {/* A site in a browser window, with this page's own pitch as its heading. It shows this page
          live, or a screenshot of it in another theme, whose colours then paint the window. */}
      <div className="relative mx-auto max-w-6xl pb-[21%] sm:pb-[6%]">
        <div
          className="hero-rise overflow-hidden rounded-2xl border border-border bg-background shadow-2xl shadow-shadow/20 transition-colors duration-700 md:rounded-3xl"
          style={shot ? themeVars(shot.id) : undefined}
        >
          <div className="flex items-center gap-3 border-b border-border bg-surface px-3 py-2.5 transition-colors duration-700 sm:px-4">
            <span className="hidden gap-1.5 sm:flex" aria-hidden="true">
              <span className="h-3 w-3 rounded-full bg-danger/60" />
              <span className="h-3 w-3 rounded-full bg-warning/60" />
              <span className="h-3 w-3 rounded-full bg-success/60" />
            </span>
            <div role="group" aria-label="Show this site in" className="flex flex-1 flex-wrap items-center justify-center gap-1.5">
              {options.map((o, i) => {
                const on = i - 1 === index
                return (
                  <button
                    key={o.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setIndex(i - 1)}
                    className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold transition sm:text-sm ${
                      on ? 'border-ink bg-ink text-background' : 'border-border bg-background text-ink-secondary hover:border-primary hover:text-ink'
                    }`}
                  >
                    <span className="h-2.5 w-2.5 rounded-full ring-1 ring-white/40" style={{ background: o.swatch }} aria-hidden="true" />
                    {o.name}
                    {o.mode && (o.mode === 'dark' ? <Moon className="h-3 w-3 opacity-70" aria-label="dark" /> : <Sun className="h-3 w-3 opacity-70" aria-label="light" />)}
                  </button>
                )
              })}
            </div>
            <span className="hidden w-[46px] sm:block" aria-hidden="true" />
          </div>

          <div className="flex flex-col items-center px-5 pt-10 pb-4 text-center sm:px-8 md:pt-14">
            <p className="hero-in inline-flex items-center gap-2 rounded-full border border-border bg-surface/80 px-3 py-1 text-xs font-medium text-ink-secondary shadow-sm transition-colors duration-700 sm:text-sm" style={{ '--hero-delay': '150ms' }}>
              <Sparkles className="h-4 w-4 text-primary" aria-hidden="true" />
              <span className="hidden sm:inline">A live theme switcher · </span>700+ palettes · contrast checked
            </p>
            <h1 className="hero-in mt-5 font-display text-4xl leading-[1.05] font-extrabold tracking-tight text-ink transition-colors duration-700 sm:text-5xl lg:text-6xl" style={{ '--hero-delay': '250ms' }}>
              Colour your whole site <br className="hidden sm:block" />
              <span className="text-gradient">like a designer would.</span>
            </h1>
            <p className="hero-in mx-auto mt-5 max-w-2xl text-base leading-relaxed text-ink-secondary transition-colors duration-700 md:text-lg" style={{ '--hero-delay': '350ms' }}>
              colorsbymax adds a colour button to your website. Try hundreds of professionally built palettes on your real pages, live, with every colour in the right role and
              every pairing checked so text stays readable.
            </p>
            <div className="hero-in mt-7 flex w-full flex-col items-center justify-center gap-3 sm:w-auto sm:flex-row" style={{ '--hero-delay': '450ms' }}>
              <button
                type="button"
                {...panelToggle}
                className="shine group inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 font-semibold text-on-primary shadow-xl shadow-primary/30 transition hover:-translate-y-0.5 hover:shadow-2xl hover:shadow-primary/40 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none sm:w-auto"
              >
                <Palette className="h-5 w-5 transition-transform duration-500 group-hover:rotate-[20deg] group-hover:scale-110" aria-hidden="true" />
                Try it on this page
              </button>
              <a
                href="#setup"
                className="group inline-flex w-full items-center justify-center gap-2 rounded-full border border-border bg-surface px-6 py-3 font-semibold text-ink shadow-sm transition hover:-translate-y-0.5 hover:border-primary hover:shadow-md sm:w-auto"
              >
                Add it to your site
                <ArrowDown className="h-4 w-4 transition-transform group-hover:translate-y-0.5" aria-hidden="true" />
              </a>
            </div>
            <div className="hero-in mt-4 flex w-fit items-center gap-3 rounded-full border border-border bg-surface/80 py-1 pr-1 pl-4 shadow-sm transition-colors duration-700" style={{ '--hero-delay': '550ms' }}>
              <code className="font-mono text-sm text-ink">npm install colorsbymax</code>
              <CopyButton text="npm install colorsbymax" className="rounded-full" />
            </div>
          </div>

          {/* The rest of the page: live, or a screenshot fading in from under the heading. */}
          <div
            className="relative aspect-[16/10] [mask-image:linear-gradient(to_bottom,transparent,#000_8%)]"
            role="img"
            aria-label={shot ? `This site in the ${shot.name} theme, ${shot.mode} mode` : 'This site in its current theme'}
          >
            <Scaled {...DESKTOP}>
              <LivePreview kind="desktop" version={version} />
            </Scaled>
            {SHOTS.map((s, i) => (
              <img
                key={s.id}
                src={s.desktop}
                alt=""
                width={DESKTOP.width}
                height={DESKTOP.height}
                className="absolute inset-0 h-full w-full object-cover object-top transition-opacity duration-700 ease-out"
                style={{ opacity: i === index ? 1 : 0 }}
              />
            ))}
          </div>
        </div>

        <div className="hero-rise absolute bottom-0 left-[3%] w-[36%] max-w-[330px] sm:-left-[2%] sm:w-[26%] lg:-left-[4%] lg:w-[24%]" style={{ '--hero-delay': '700ms' }} aria-hidden="true">
          <Phone index={index} version={version} />
        </div>
      </div>

      {/* The window and the glow fade into the page, so the hero melts into the next section. */}
      <div className="pointer-events-none absolute inset-x-0 -bottom-px h-[clamp(6rem,18vw,16rem)] bg-gradient-to-t from-background via-background/80 to-transparent" aria-hidden="true" />
    </header>
  )
}
