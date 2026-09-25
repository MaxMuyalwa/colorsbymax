import { ArrowUpRight } from 'lucide-react'
import { GitHubIcon, MCP_NPM, MRMAX, NPM, REPO } from './ui.jsx'
import { Wordmark } from './Nav.jsx'

const COLUMNS = [
  {
    title: 'Learn',
    links: [
      ['Why colorsbymax', '#why'],
      ['Colour roles', '#roles'],
      ['The rules of colour', '#rules'],
      ['Features', '#features'],
    ],
  },
  {
    title: 'Build',
    links: [
      ['Set it up', '#setup'],
      ['Coding agents', '#agents'],
      ['README', `${REPO}#readme`],
      ['Changelog', `${REPO}/blob/main/CHANGELOG.md`],
    ],
  },
  {
    title: 'Packages',
    links: [
      ['colorsbymax on npm', NPM],
      ['colorsbymax-mcp', MCP_NPM],
      ['GitHub', REPO],
    ],
  },
  {
    title: 'mrmaxdesigns',
    links: [
      ['mrmaxdesigns.com', MRMAX],
      ['Projects', `${MRMAX}/projects`],
      ['Contact', `${MRMAX}/contact`],
      ['Follow on GitHub', 'https://github.com/MaxMuyalwa'],
    ],
  },
]

const external = (href) => href.startsWith('http')

/** Layered waves in the theme's brand colours, drifting slowly, above the footer. */
function Waves() {
  return (
    <div className="relative -mb-px h-28 overflow-hidden md:h-40" aria-hidden="true">
      <svg className="wave absolute bottom-0 left-0 h-full w-[108%]" viewBox="0 0 1440 160" preserveAspectRatio="none">
        <path style={{ fill: 'var(--color-primary-alt)' }} opacity="0.55" d="M0 96C180 40 360 40 540 80s360 60 540 20 270-50 360-30v90H0Z" />
      </svg>
      <svg className="wave wave-2 absolute bottom-0 left-[-6%] h-full w-[112%]" viewBox="0 0 1440 160" preserveAspectRatio="none">
        <path style={{ fill: 'var(--color-primary)' }} opacity="0.7" d="M0 110c200-40 380 20 600 0s380-60 580-30c140 20 220 40 260 35v45H0Z" />
      </svg>
      <svg className="wave wave-3 absolute bottom-0 left-0 h-full w-[108%]" viewBox="0 0 1440 160" preserveAspectRatio="none">
        <path style={{ fill: 'var(--color-data-3)' }} opacity="0.45" d="M0 122c160-30 330 10 520 4s420-50 620-26 240 30 300 22v38H0Z" />
      </svg>
      <svg className="absolute bottom-0 left-0 h-full w-full" viewBox="0 0 1440 160" preserveAspectRatio="none">
        <path style={{ fill: 'var(--color-secondary)' }} d="M0 134c240-30 420 20 720-6s500-2 720-10v42H0Z" />
      </svg>
    </div>
  )
}

export function Footer() {
  return (
    <footer className="relative mt-16">
      <Waves />
      <div className="relative overflow-hidden bg-secondary px-6 pt-10 pb-8 text-on-secondary">
        <div className="mx-auto max-w-6xl">
          <div className="grid grid-cols-2 gap-10 md:grid-cols-[1.4fr_repeat(4,1fr)]">
            <div className="col-span-2 md:col-span-1">
              <a href="#top" className="text-2xl" data-colorsbymax-logo>
                <Wordmark />
              </a>
              <p className="mt-3 max-w-xs text-sm leading-relaxed">
                A live theme switcher for any website. 700+ palettes, 35 colour roles, contrast checked. Every colour in this footer comes from
                the theme you picked.
              </p>
              <a href={REPO} className="mt-5 inline-flex items-center gap-2 rounded-full bg-on-secondary px-4 py-2 text-sm font-semibold text-secondary transition hover:-translate-y-0.5">
                <GitHubIcon className="h-4 w-4" /> Star on GitHub
              </a>
            </div>
            {COLUMNS.map((col) => (
              <nav key={col.title} aria-label={col.title}>
                <h2 className="mb-3 font-display text-sm font-bold tracking-wide uppercase">{col.title}</h2>
                <ul className="space-y-2 text-sm">
                  {col.links.map(([label, href]) => (
                    <li key={label}>
                      <a href={href} className="group inline-flex items-center gap-1 underline-offset-4 opacity-90 transition hover:underline hover:opacity-100">
                        {label}
                        {external(href) && <ArrowUpRight className="h-3 w-3 opacity-60 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" aria-hidden="true" />}
                      </a>
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
          </div>

          <p className="pointer-events-none mt-12 text-center font-display text-[15vw] leading-none font-extrabold tracking-tighter opacity-[0.07] select-none md:text-[11rem]" aria-hidden="true">
            colorsbymax
          </p>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-on-secondary/15 pt-6 text-sm">
            <p>
              © {new Date().getFullYear()} <a href={MRMAX} className="font-semibold underline-offset-4 hover:underline">mrmaxdesigns</a> · colorsbymax™ is MIT licensed
            </p>
            <a href={MRMAX} className="group inline-flex items-center gap-1 font-semibold underline-offset-4 hover:underline">
              Back to mrmaxdesigns.com
              <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" aria-hidden="true" />
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}
