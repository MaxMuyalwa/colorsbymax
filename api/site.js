// The site's editable settings for every visitor: landing page text and which colour panel
// features are on. Written by the admin (api/admin/site.js); cached briefly at the edge.
import { json, readSettings } from './_lib/admin.js'

export async function GET(request) {
  const fresh = new URL(request.url).searchParams.has('fresh')
  try {
    return json(200, await readSettings(), { 'Cache-Control': fresh ? 'no-store' : 'public, s-maxage=60, stale-while-revalidate=600' })
  } catch (e) {
    console.error(e)
    return json(200, {}, { 'Cache-Control': 'no-store' })
  }
}
