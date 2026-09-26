// Admin sign-in, step 1: off to GitHub to sign in, with a one-time state to check on the way back.
import { CALLBACK, cookie, random } from '../_lib/admin.js'

export function GET() {
  const id = process.env.GITHUB_CLIENT_ID
  if (!id) return Response.json({ error: 'Admin sign-in isn’t set up yet.' }, { status: 503 })
  const state = random()
  const url = new URL('https://github.com/login/oauth/authorize')
  url.search = new URLSearchParams({ client_id: id, redirect_uri: CALLBACK, state, allow_signup: 'false' })
  return new Response(null, { status: 302, headers: { Location: url.href, 'Set-Cookie': cookie('cbm_oauth', state, 600) } })
}
