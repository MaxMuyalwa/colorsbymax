// Feedback from the colorsbymax site, emailed to Max through Resend (https://resend.com).
//
// The site's feedback form POSTs multipart form data: a "report" field (JSON) and up to six
// "screenshots" files. This Vercel function checks it and sends one email, with the screenshots
// attached and Reply-To set to the sender's email when they gave one.
//
// Environment variables (Vercel → Settings → Environment Variables):
//   RESEND_API_KEY   a Resend API key with sending access (required)
//   FEEDBACK_TO      where reports go (default mmkaluku@gmail.com)
//   FEEDBACK_FROM    the sender, on a domain verified in Resend, e.g.
//                    "colorsbymax feedback <feedback@mrmaxdesigns.com>"
//                    (default Resend's test sender, which only delivers to the Resend account's own email)

const MAX_SHOTS = 6
const MAX_TOTAL_BYTES = 4 * 1024 * 1024 // Vercel accepts request bodies up to 4.5 MB
const MAX_FIELD = 5000
const ALLOWED_ORIGINS = [/^https:\/\/(www\.)?mrmaxdesigns\.com$/, /^https:\/\/colorsbymax(-[a-z0-9-]+)?\.vercel\.app$/, /^http:\/\/localhost(:\d+)?$/]
const KINDS = { bug: 'Bug report', idea: 'Suggestion', praise: 'Praise', question: 'Question' }

const json = (status, body) => Response.json(body, { status })
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
const clip = (s, n = MAX_FIELD) => String(s ?? '').slice(0, n)

/** The report as a readable email. */
function emailHtml(r, env, shots) {
  const row = (label, value) => (value ? `<tr><td style="padding:4px 12px 4px 0;color:#6b7280;vertical-align:top;white-space:nowrap">${esc(label)}</td><td style="padding:4px 0">${esc(value)}</td></tr>` : '')
  const block = (title, text) => (text?.trim() ? `<h3 style="margin:20px 0 6px;font-size:14px">${esc(title)}</h3><div style="white-space:pre-wrap;line-height:1.5">${esc(text)}</div>` : '')
  const stars = r.rating ? `${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)} (${r.rating}/5)` : ''
  const envRows = env ? Object.entries(env).map(([k, v]) => row(k, v)).join('') : ''
  return `<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;font-size:14px;color:#111827;max-width:640px">
  <p style="margin:0 0 4px;color:#6b7280;font-size:12px;text-transform:uppercase;letter-spacing:.05em">${esc(KINDS[r.kind] ?? 'Feedback')} · colorsbymax</p>
  <h2 style="margin:0 0 16px;font-size:20px">${esc(r.summary)}</h2>
  <table style="border-collapse:collapse">${row('From', [r.name, r.github && `@${r.github}`].filter(Boolean).join(' · '))}${row('Email', r.email && `${r.email}${r.contact ? ' (happy to be contacted)' : ''}`)}${row('Areas', (r.areas ?? []).join(', '))}${row('Rating', stars)}${row('Severity', r.severity)}${row('How often', r.frequency)}</table>
  ${block(r.kind === 'bug' ? 'What happened' : 'Details', r.details)}
  ${block('Steps to reproduce', r.steps)}${block('Expected', r.expected)}${block('What happened instead', r.actual)}${block('Suggestions', r.suggestion)}
  ${shots.length ? `<p style="margin-top:20px">${shots.length} screenshot${shots.length > 1 ? 's' : ''} attached.</p>` : ''}
  ${envRows ? `<h3 style="margin:24px 0 6px;font-size:14px">Technical details</h3><table style="border-collapse:collapse;font-size:12px">${envRows}</table>` : ''}
</div>`
}

export async function POST(request) {
  // Only the colorsbymax site may send.
  const origin = request.headers.get('origin') ?? ''
  if (origin && !ALLOWED_ORIGINS.some((re) => re.test(origin))) return json(403, { error: 'Not allowed.' })
  if (Number(request.headers.get('content-length') ?? 0) > MAX_TOTAL_BYTES + 256 * 1024) return json(413, { error: 'That report is too large. Try fewer or smaller screenshots.' })

  let form
  try {
    form = await request.formData()
  } catch {
    return json(400, { error: 'Couldn’t read the report.' })
  }
  // A field people never see: bots fill it in.
  if (form.get('website')) return json(200, { ok: true })

  let r
  try {
    r = JSON.parse(form.get('report') ?? '')
  } catch {
    return json(400, { error: 'Couldn’t read the report.' })
  }
  const summary = clip(r.summary, 200).trim()
  const name = clip(r.name, 120).trim()
  if (!summary || !name) return json(400, { error: 'A summary and a name are needed.' })
  const email = /^\S+@\S+\.\S+$/.test(r.email ?? '') ? clip(r.email, 200) : ''
  const report = {
    kind: KINDS[r.kind] ? r.kind : 'idea',
    summary,
    name,
    github: clip(r.github, 60).replace(/^@/, ''),
    email,
    contact: Boolean(r.contact),
    areas: Array.isArray(r.areas) ? r.areas.slice(0, 20).map((a) => clip(a, 60)) : [],
    rating: Number.isInteger(r.rating) && r.rating >= 1 && r.rating <= 5 ? r.rating : 0,
    severity: clip(r.severity, 30),
    frequency: clip(r.frequency, 30),
    details: clip(r.details),
    steps: clip(r.steps),
    expected: clip(r.expected),
    actual: clip(r.actual),
    suggestion: clip(r.suggestion),
  }
  const env = r.environment && typeof r.environment === 'object' ? Object.fromEntries(Object.entries(r.environment).slice(0, 20).map(([k, v]) => [clip(k, 40), clip(v, 400)])) : null

  const files = form.getAll('screenshots').filter((f) => typeof f === 'object' && f.type?.startsWith('image/')).slice(0, MAX_SHOTS)
  const total = files.reduce((n, f) => n + f.size, 0)
  if (total > MAX_TOTAL_BYTES) return json(413, { error: 'Those screenshots are too large together. Try fewer.' })
  const attachments = await Promise.all(
    files.map(async (f, i) => ({ filename: clip(f.name, 80).replace(/[^\w .()-]/g, '_') || `screenshot-${i + 1}.png`, content: Buffer.from(await f.arrayBuffer()).toString('base64') })),
  )

  const key = process.env.RESEND_API_KEY
  if (!key) return json(503, { error: 'Feedback email isn’t set up yet.' })
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: process.env.FEEDBACK_FROM || 'colorsbymax feedback <onboarding@resend.dev>',
      to: (process.env.FEEDBACK_TO || 'mmkaluku@gmail.com').split(',').map((s) => s.trim()),
      subject: `[colorsbymax] ${KINDS[report.kind]}: ${report.summary}`,
      html: emailHtml(report, env, files),
      text: clip(r.markdown, 20000) || `${KINDS[report.kind]}: ${report.summary}\nFrom: ${report.name}`,
      ...(email ? { reply_to: email } : {}),
      ...(attachments.length ? { attachments } : {}),
    }),
  })
  if (!res.ok) {
    console.error('Resend refused the email', res.status, await res.text().catch(() => ''))
    return json(502, { error: 'Couldn’t send it just now.' })
  }
  return json(200, { ok: true })
}
