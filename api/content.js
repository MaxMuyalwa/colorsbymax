// The site's posts and testimonials, for the docs page: read from the content branch of the
// repo, cached briefly at the edge so pages stay quick and GitHub isn't asked on every visit.
import { json, listEntries } from './_lib/admin.js'

export async function GET(request) {
  const fresh = new URL(request.url).searchParams.has('fresh')
  try {
    const [posts, testimonials] = await Promise.all([listEntries('post'), listEntries('testimonial')])
    return json(200, { posts, testimonials }, { 'Cache-Control': fresh ? 'no-store' : 'public, s-maxage=60, stale-while-revalidate=600' })
  } catch (e) {
    console.error(e)
    return json(502, { error: 'Couldn’t read the posts just now.', posts: [], testimonials: [] })
  }
}
