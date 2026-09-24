// colorsbymax™ by mrmaxdesigns: a runtime theme switcher for sites built on colour tokens.

export { ThemeProvider, useTheme, applyTokens } from './ThemeProvider.jsx'
export { default as ThemeSwitcher } from './ThemeSwitcher.jsx'
export { prePaintScript, DEFAULT_STORAGE_KEY } from './storage.js'
export { PRESETS, TOKEN_GROUPS, TOKEN_KEYS, BASE_TOKENS, completeTokens, deriveAppTokens } from './tokens.js'
export {
  PAIRINGS,
  checkTheme,
  checkRamp,
  suggestFix,
  fixAll,
  MIN_CONTRAST_TEXT,
  MIN_CONTRAST_LARGE_TEXT,
  MIN_CONTRAST_NON_TEXT,
  MIN_RAMP_STEP_DELTA_E,
} from './contrast.js'
export { contrastRatio, normalizeHex } from './color.js'
export { collectColors, inferRoles, suggestThemes, themeFromRoles, detectSiteName } from './scan.js'
