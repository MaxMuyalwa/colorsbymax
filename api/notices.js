// The messages in colorsbymax's bell, for every install that checks (the switcher asks once a day,
// on development addresses by default). Written by the admin in the admin space (api/admin/site.js).
// Any site may read them, so they're served to every origin; nothing about the caller is kept.
import { json, readSettings } from './_lib/admin.js'

const OPEN = { 'Access-Control-Allow-Origin': '*' }

export async function GET() {
  try {
    const { notices } = await readSettings()
    return json(200, { notices: Array.isArray(notices) ? notices : [] }, { ...OPEN, 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=3600' })
  } catch (e) {
    console.error(e)
    return json(200, { notices: [] }, { ...OPEN, 'Cache-Control': 'no-store' })
  }
}
