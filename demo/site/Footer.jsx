import { ArrowUpRight, Mail, Phone } from 'lucide-react'
import { DOCS, GitHubIcon, MCP_NPM, MRMAX, NPM, REPO, SUPPORT } from './ui.jsx'
import { AdminButton } from './Admin.jsx'
import { Wordmark } from './Nav.jsx'
import { openFeedback } from './Feedback.jsx'

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
      ['README', `${DOCS}#readme`],
      ['Changelog', `${DOCS}#changelog`],
      ['All docs', DOCS],
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
      ['Buy Max a coffee', SUPPORT],
    ],
  },
]

// How to reach Max: calls on Airtel, messages on WhatsApp (MTN), and email. Shown as buttons.
const CONTACT = [
  { label: 'Call', href: 'tel:+260779053092', aria: 'Call Max on +260 779 05 30 92', Icon: Phone },
  { label: 'WhatsApp', href: 'https://wa.me/260962095424', aria: 'Message Max on WhatsApp, +260 962 09 54 24', Icon: WhatsAppIcon, external: true },
  { label: 'Email', href: 'mailto:mmkaluku@gmail.com', aria: 'Email Max at mmkaluku@gmail.com', Icon: Mail },
]

/** WhatsApp's mark (Lucide doesn't ship brand icons). */
function WhatsAppIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.64.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.77-1.66-2.07-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.49s1.07 2.89 1.22 3.09c.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.69.63.71.23 1.36.2 1.87.12.57-.09 1.76-.72 2-1.41.25-.7.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35ZM12.04 21.5h-.01a9.45 9.45 0 0 1-4.82-1.32l-.35-.2-3.58.93.96-3.49-.23-.36a9.43 9.43 0 0 1-1.45-5.04c0-5.22 4.25-9.47 9.48-9.47a9.4 9.4 0 0 1 6.7 2.78 9.4 9.4 0 0 1 2.77 6.7c0 5.22-4.25 9.47-9.47 9.47Zm8.06-17.53A11.33 11.33 0 0 0 12.04.63C5.76.63.65 5.74.65 12.02c0 2 .52 3.96 1.52 5.69L.55 23.63l6.05-1.59a11.35 11.35 0 0 0 5.43 1.38h.01c6.27 0 11.39-5.11 11.39-11.39 0-3.04-1.19-5.9-3.33-8.06Z" />
    </svg>
  )
}

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

/** @param {{ home?: string }} props  prefix for in-page links, for pages other than the home page */
export function Footer({ home = '' }) {
  return (
    <footer className="relative mt-16">
      <Waves />
      <div className="relative overflow-hidden bg-secondary px-6 pt-10 pb-8 text-on-secondary">
        <div className="mx-auto max-w-6xl">
          <div className="grid grid-cols-2 gap-10 md:grid-cols-3 lg:grid-cols-[1.3fr_repeat(5,1fr)]">
            <div className="col-span-2 md:col-span-3 lg:col-span-1">
              <a href={`${home}#top`} className="text-2xl" data-colorsbymax-logo>
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
                      <a href={href.startsWith('#') ? home + href : href} className="group inline-flex items-center gap-1 underline-offset-4 opacity-90 transition hover:underline hover:opacity-100">
                        {label}
                        {external(href) && <ArrowUpRight className="h-3 w-3 opacity-60 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" aria-hidden="true" />}
                      </a>
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
            <nav aria-label="Get in touch">
              <h2 className="mb-3 font-display text-sm font-bold tracking-wide uppercase">Get in touch</h2>
              <ul className="space-y-2">
                {CONTACT.map(({ label, href, aria, Icon, external: out }) => (
                  <li key={label}>
                    <a
                      href={href}
                      aria-label={aria}
                      {...(out ? { target: '_blank', rel: 'noopener' } : {})}
                      className="group inline-flex items-center gap-2 rounded-full bg-on-secondary px-4 py-2 text-sm font-semibold text-secondary shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                    >
                      <Icon className="h-4 w-4 transition-transform duration-300 group-hover:-rotate-12 group-hover:scale-110" aria-hidden="true" />
                      {label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          </div>

          <p className="pointer-events-none mt-12 text-center font-display text-[15vw] leading-none font-extrabold tracking-tighter opacity-[0.07] select-none md:text-[11rem]" aria-hidden="true">
            colorsbymax
          </p>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-on-secondary/15 pt-6 text-sm">
            <p>
              © {new Date().getFullYear()} <a href={MRMAX} className="font-semibold underline-offset-4 hover:underline">mrmaxdesigns</a> · colorsbymax™ is MIT licensed
            </p>
            <span className="flex flex-wrap items-center gap-x-5 gap-y-2">
              <button type="button" onClick={openFeedback} className="cursor-pointer font-semibold underline-offset-4 hover:underline">
                Send feedback
              </button>
              <AdminButton />
            </span>
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
