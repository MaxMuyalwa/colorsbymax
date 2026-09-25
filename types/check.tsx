// Compile-only test for the type declarations (npm run typecheck). Written the way a site in a
// strict TypeScript project would use colorsbymax; never run.

import {
  ThemeProvider,
  ThemeSwitcher,
  useTheme,
  contrastRatio,
  checkTheme,
  suggestFix,
  fixAll,
  themeFromPalette,
  prePaintScript,
  PRESETS,
  TOKEN_KEYS,
  MIN_CONTRAST_TEXT,
  type ColorsByMaxConfig,
  type ThemeTokens,
  type TokenKey,
} from 'colorsbymax'
import { loadPdf } from 'colorsbymax/pdf'

const config: ColorsByMaxConfig = {
  siteName: 'Example',
  storageKey: 'example-theme',
  defaultTheme: { name: 'Example blue', tokens: { primary: '#2f6fdb', background: '#f8fafd' } },
  usage: { primary: 'Buttons' },
  pdf: loadPdf,
}

function Status() {
  const { active, tokens, issues, selectTheme, fixAllIssues, importTheme } = useTheme()
  const key: TokenKey = 'primary'
  const hex: string = tokens[key]
  const ratio: number = contrastRatio(tokens.ink, tokens.background)
  const error: string | null = importTheme('{}')
  return (
    <p onClick={() => (issues.length ? fixAllIssues() : selectTheme(PRESETS[0].id))}>
      {active.name} {hex} {ratio.toFixed(1)} {error}
    </p>
  )
}

export function App() {
  return (
    <ThemeProvider config={config}>
      <Status />
      <ThemeSwitcher />
    </ThemeProvider>
  )
}

const tokens: ThemeTokens = themeFromPalette(['#5b3df5', '#e0457b'])
const passes: boolean = checkTheme(tokens).every((i) => i.ratio >= MIN_CONTRAST_TEXT)
const fix = suggestFix(checkTheme(tokens)[0].pairing, tokens)
const value: string | undefined = fix?.value
const changed: Partial<ThemeTokens> = fixAll(tokens)
const script: string = prePaintScript('example-theme')
const keys: number = TOKEN_KEYS.length
export { passes, value, changed, script, keys }

// @ts-expect-error: tokens must be known keys
const bad: ColorsByMaxConfig = { defaultTheme: { name: 'x', tokens: { primry: '#fff' } } }
export { bad }
