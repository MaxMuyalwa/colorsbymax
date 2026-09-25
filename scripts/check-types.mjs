// Checks the hand-written declarations against the built package (npm run typecheck):
// every value types/index.d.ts and types/pdf.d.ts declare must really be exported by dist/,
// and everything dist/ exports must be declared.

import { readFileSync } from 'node:fs'

let failed = false
for (const [types, built] of [
  ['../types/index.d.ts', '../dist/index.js'],
  ['../types/pdf.d.ts', '../dist/pdf.js'],
  ['../types/auto.d.ts', '../dist/auto.js'],
]) {
  const source = readFileSync(new URL(types, import.meta.url), 'utf8')
  const declared = new Set([...source.matchAll(/^export (?:function|const) (\w+)/gm)].map((m) => m[1]))
  const actual = new Set(Object.keys(await import(new URL(built, import.meta.url))))
  const missing = [...declared].filter((n) => !actual.has(n))
  const undeclared = [...actual].filter((n) => !declared.has(n))
  if (missing.length) console.error(`${types} declares what ${built} doesn't export: ${missing.join(', ')}`)
  if (undeclared.length) console.error(`${built} exports what ${types} doesn't declare: ${undeclared.join(', ')}`)
  failed ||= missing.length > 0 || undeclared.length > 0
}
if (failed) process.exit(1)
console.log('Declarations match the built exports.')
