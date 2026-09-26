// Replies to a feedback report by email, for the signed-in admin only. The reply goes to the
// person who sent it (from the site's feedback address, with Reply-To set to Max's inbox), quotes
// what they wrote, and is kept on the report's thread, which is then marked done.
import { adminOf, fromSite, json } from '../_lib/admin.js'
import { addReply, readReport } from '../_lib/inbox.js'

const MAX_MESSAGE = 10_000
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
const SITE_NAMES = { colorsbymax: 'colorsbymax', mrmaxdesigns: 'mrmaxdesigns' }

export async function POST(request) {
  if (!fromSite(request)) return json(403, { error: 'Not allowed.' })
  let login = null
  try {
    login = adminOf(request)
  } catch {}
  if (!login) return json(401, { error: 'Sign in first.' })
  const { id, message } = (await request.json().catch(() => null)) ?? {}
  const text = String(message ?? '').trim()
  if (!text || text.length > MAX_MESSAGE) return json(400, { error: 'Write a reply first.' })

  const report = await readReport(id).catch(() => null)
  if (!report) return json(404, { error: 'That report isn’t there any more.' })
  if (!/^\S+@\S+\.\S+$/.test(report.email || '')) return json(400, { error: 'They didn’t leave an email address.' })
  const key = process.env.RESEND_API_KEY
  if (!key) return json(503, { error: 'Email isn’t set up.' })

  // From the site's feedback address, named for the site the report came from.
  const address = (process.env.FEEDBACK_FROM || 'feedback <onboarding@resend.dev>').match(/<([^>]+)>/)?.[1] ?? 'onboarding@resend.dev'
  const site = SITE_NAMES[report.site] ?? 'colorsbymax'
  const inbox = (process.env.FEEDBACK_TO || 'mmkaluku@gmail.com').split(',')[0].trim()
  const quote = [report.summary, report.details].filter(Boolean).join('\n\n')
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: `Max at ${site} <${address}>`,
      to: [report.email],
      reply_to: inbox,
      subject: `Re: ${report.summary}`,
      text: `${text}\n\n— Max\n\nOn ${new Date(report.received).toDateString()} you wrote:\n> ${quote.replace(/\n/g, '\n> ')}`,
      html: `<div style="font-family:system-ui,sans-serif;font-size:15px;line-height:1.6;color:#111827;max-width:600px"><div style="white-space:pre-wrap">${esc(text)}</div><p>— Max</p><blockquote style="margin:24px 0 0;padding:8px 14px;border-left:3px solid #d1d5db;color:#6b7280;white-space:pre-wrap">${esc(quote)}</blockquote></div>`,
    }),
  })
  if (!res.ok) {
    console.error('Resend refused the reply', res.status, await res.text().catch(() => ''))
    return json(502, { error: 'Couldn’t send the reply just now.' })
  }
  const updated = await addReply(id, { at: new Date().toISOString(), by: login, message: text }).catch(() => null)
  return json(200, { ok: true, report: updated })
}
