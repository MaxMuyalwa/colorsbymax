// Loads the generated preset library (scripts/generate-presets.mjs) on demand, so its
// ~50 KB (gzipped) only downloads when someone opens the theme panel.

let cache = null

/**
 * @returns {Promise<{ categories: { id: string, label: string, description: string, count: number }[],
 *   themes: (import('./tokens.js').Theme & { tags: string[], library: true })[], source: string }>}
 */
export function loadLibrary() {
  cache ??= import('./library.generated.json').then(({ default: data }) => ({
    source: data.source,
    categories: data.categories,
    themes: data.themes.map((t) => ({
      id: t.id,
      name: t.name,
      tags: t.tags,
      library: true,
      tokens: Object.fromEntries(data.keys.map((key, i) => [key, `#${t.t.slice(i * 6, i * 6 + 6)}`])),
    })),
  }))
  return cache
}
