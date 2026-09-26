// Admin sign-in, step 2: GitHub sends the visitor back here. Only the admin's own GitHub account
// gets a session; anyone else is sent back to the docs, signed out.
import { CALLBACK, SITE_URL, cookie, cookies, isAdmin, sessionCookie } from '../_lib/admin.js'

const back = (result, setCookies) => {
  // Signed in: straight to the dashboard. Otherwise back to the docs, with why.
  const headers = new Headers({ Location: `${SITE_URL}/docs?admin=${result}${result === 'signed-in' ? '#admin' : ''}` })
  for (const c of setCookies) headers.append('Set-Cookie', c)
  return new Response(null, { status: 302, headers })
}

export async function GET(request) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const clearState = cookie('cbm_oauth', '', 0)
  if (!code || !state || state !== cookies(request).cbm_oauth) return back('failed', [clearState])

  const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: process.env.GITHUB_CLIENT_ID, client_secret: process.env.GITHUB_CLIENT_SECRET, code, redirect_uri: CALLBACK }),
  })
  const { access_token: token } = tokenRes.ok ? await tokenRes.json() : {}
  if (!token) return back('failed', [clearState])
  const userRes = await fetch('https://api.github.com/user', { headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' } })
  const { login } = userRes.ok ? await userRes.json() : {}
  if (!isAdmin(login)) return back('denied', [clearState])
  return back('signed-in', [clearState, sessionCookie(login)])
}
