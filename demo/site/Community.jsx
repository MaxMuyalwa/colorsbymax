import { ArrowUpRight, Bug, Coffee, Heart, Lightbulb, MessageCircleQuestion, MessageSquarePlus, Pointer, Star } from 'lucide-react'
import { openFeedback } from './Feedback.jsx'
import { GitHubIcon, Reveal, REPO, SUPPORT } from './ui.jsx'
import { AirtelMoney } from './AirtelMoney.jsx'

const KINDS = [
  { id: 'bug', label: 'Found a bug?', text: 'Tell Max what broke, with a screenshot.', Icon: Bug, tone: 'danger' },
  { id: 'idea', label: 'Got an idea?', text: 'A feature, a theme, a better way.', Icon: Lightbulb, tone: 'warning' },
  { id: 'praise', label: 'Love something?', text: 'Say so. It really helps.', Icon: Heart, tone: 'primary-alt' },
  { id: 'question', label: 'Stuck?', text: 'Ask how anything works.', Icon: MessageCircleQuestion, tone: 'info' },
]

/** Asks for feedback (and points at where to find it), and offers ways to say thanks. */
export function Community() {
  return (
    <section aria-labelledby="community-title" id="feedback" className="px-6 pb-24">
      <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[1.35fr_1fr]">
        <Reveal className="relative overflow-hidden rounded-[2.5rem] border border-border bg-surface p-8 md:p-10">
          <div className="blob -top-24 -left-16 h-64 w-64 bg-primary opacity-15" aria-hidden="true" />
          <div className="relative">
            <p className="mb-3 inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-1 text-xs font-semibold tracking-wide text-on-secondary uppercase">
              <MessageSquarePlus className="h-3.5 w-3.5" aria-hidden="true" /> Your feedback shapes it
            </p>
            <h2 id="community-title" className="font-display text-3xl font-bold tracking-tight text-ink md:text-4xl">
              Tell Max what you think
            </h2>
            <p className="mt-3 max-w-xl leading-relaxed text-ink-secondary">
              colorsbymax gets better with every report. Bugs, praise, ideas and questions are all welcome, and every one is read. The{' '}
              <strong className="text-ink">Feedback</strong> button in the top bar is always there too.
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {KINDS.map(({ id, label, text, Icon, tone }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => openFeedback(id)}
                  className="group flex cursor-pointer items-start gap-3 rounded-2xl border border-border bg-background p-4 text-left transition hover:-translate-y-0.5 hover:border-primary hover:shadow-lg hover:shadow-shadow/10 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
                >
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110" style={{ color: `var(--color-${tone})`, background: `color-mix(in srgb, var(--color-${tone}) 13%, transparent)` }}>
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <span>
                    <span className="block font-semibold text-ink">{label}</span>
                    <span className="block text-sm text-ink-secondary">{text}</span>
                  </span>
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => openFeedback()}
              className="shine group mt-6 inline-flex cursor-pointer items-center gap-2 rounded-full bg-primary px-6 py-3 font-semibold text-on-primary shadow-xl shadow-primary/25 transition hover:-translate-y-0.5"
            >
              <MessageSquarePlus className="h-5 w-5 transition-transform group-hover:-rotate-12" aria-hidden="true" /> Send feedback
            </button>
          </div>
        </Reveal>

        <Reveal delay={120} className="relative flex flex-col overflow-hidden rounded-[2.5rem] bg-primary p-8 text-on-primary md:p-10">
          <div className="blob -right-16 -bottom-20 h-64 w-64 bg-primary-alt opacity-60" aria-hidden="true" />
          <div className="relative flex flex-1 flex-col">
            <span className="grid h-14 w-14 place-items-center rounded-2xl bg-on-primary/15">
              <Coffee className="h-7 w-7" aria-hidden="true" />
            </span>
            <h2 className="mt-5 font-display text-3xl font-bold tracking-tight">Enjoying colorsbymax?</h2>
            <p className="mt-3 leading-relaxed opacity-90">It’s free and open source, made by one designer. A coffee or a star keeps it going.</p>
            {/* Side by side where the card is wide, stacked where it's narrow; labels never wrap. */}
            <div className="mt-auto grid gap-3 pt-8 sm:grid-cols-2 lg:grid-cols-1">
              <a
                href={SUPPORT}
                className="shine group inline-flex h-12 items-center justify-center gap-2 rounded-full bg-on-primary px-6 font-semibold whitespace-nowrap text-primary shadow-xl transition hover:-translate-y-0.5"
              >
                <Coffee className="h-4 w-4 transition-transform group-hover:-rotate-12" aria-hidden="true" /> Buy Max a coffee
              </a>
              <a
                href={REPO}
                target="_blank"
                rel="noopener"
                className="group inline-flex h-12 items-center justify-center gap-2 rounded-full border-2 border-on-primary/60 px-6 font-semibold whitespace-nowrap transition hover:-translate-y-0.5 hover:border-on-primary hover:bg-on-primary/10"
              >
                <Star className="h-4 w-4 transition-transform duration-500 group-hover:rotate-[72deg]" aria-hidden="true" /> Star on GitHub
                <ArrowUpRight className="h-3.5 w-3.5 opacity-70" aria-hidden="true" />
              </a>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}

/** The support page: ways to thank Max, with the coffee link to come. */
export function Support() {
  return (
    <main id="main" className="relative isolate overflow-hidden px-6 pt-28 pb-16 md:pt-32">
      <div className="absolute inset-0 -z-10" aria-hidden="true">
        <div className="dot-grid absolute inset-0" />
        <div className="blob top-0 left-[-8%] h-[26rem] w-[26rem] bg-primary" />
        <div className="blob blob-slow top-[10%] right-[-10%] h-[24rem] w-[24rem] bg-primary-alt" />
      </div>
      <div className="mx-auto max-w-3xl text-center">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-primary text-on-primary shadow-xl shadow-primary/30">
          <Coffee className="h-7 w-7" aria-hidden="true" />
        </span>
        <h1 className="mt-5 font-display text-5xl font-extrabold tracking-tight text-ink md:text-6xl">
          Support <span className="text-gradient">colorsbymax</span>
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-lg leading-relaxed text-ink-secondary">
          colorsbymax is free and open source, designed and built by Max Muyalwa at mrmaxdesigns. If it saved you time, here’s how to say thanks.
        </p>
      </div>

      <div className="mx-auto mt-10 grid max-w-4xl gap-5 md:grid-cols-3">
        <Reveal className="flex flex-col rounded-[2rem] border border-border bg-surface p-6 text-left">
          {/* In Zambia or elsewhere in Africa: Airtel Money, from the flag, on the cup's row. */}
          <div className="flex items-center justify-between gap-3">
            <Coffee className="h-7 w-7 text-primary" aria-hidden="true" />
            <span className="flex items-center gap-1.5">
              <span className="nudge inline-flex items-center gap-1 text-xs font-semibold text-ink-secondary" aria-hidden="true">
                Zambia?
                <Pointer className="h-4 w-4 rotate-90 text-primary" />
              </span>
              <AirtelMoney />
            </span>
          </div>
          <h2 className="mt-4 font-display text-xl font-bold text-ink">Buy Max a coffee</h2>
          <p className="mt-2 flex-1 text-sm leading-relaxed text-ink-secondary">
            A small one-off thank you. In Zambia or elsewhere in Africa? Tap the flag to send it with Airtel Money. A way to
            support from anywhere else in the world is on the way.
          </p>
          <span className="mt-5 inline-flex items-center justify-center rounded-full border border-dashed border-border px-4 py-2.5 text-sm font-semibold text-ink-muted">International: coming soon</span>
        </Reveal>
        <Reveal delay={90} className="flex flex-col rounded-[2rem] border border-border bg-surface p-6 text-left">
          <Star className="h-7 w-7 text-warning" aria-hidden="true" />
          <h2 className="mt-4 font-display text-xl font-bold text-ink">Star it on GitHub</h2>
          <p className="mt-2 flex-1 text-sm leading-relaxed text-ink-secondary">Stars help other developers find colorsbymax. It takes one click.</p>
          <a href={REPO} target="_blank" rel="noopener" className="mt-5 inline-flex items-center justify-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-on-primary transition hover:-translate-y-0.5">
            <GitHubIcon className="h-4 w-4" /> Star on GitHub
          </a>
        </Reveal>
        <Reveal delay={180} className="flex flex-col rounded-[2rem] border border-border bg-surface p-6 text-left">
          <MessageSquarePlus className="h-7 w-7 text-primary-alt" aria-hidden="true" />
          <h2 className="mt-4 font-display text-xl font-bold text-ink">Send feedback</h2>
          <p className="mt-2 flex-1 text-sm leading-relaxed text-ink-secondary">Bugs, praise, ideas and questions all make colorsbymax better.</p>
          <button type="button" onClick={() => openFeedback()} className="mt-5 inline-flex cursor-pointer items-center justify-center gap-2 rounded-full border border-border bg-background px-4 py-2.5 text-sm font-semibold text-ink transition hover:-translate-y-0.5 hover:border-primary">
            Send feedback
          </button>
        </Reveal>
      </div>
    </main>
  )
}
