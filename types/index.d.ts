// Type declarations for colorsbymax. The package is written in JavaScript; these describe its
// public API and are checked against real usage by types/check.tsx (npm run typecheck).

import type { ReactElement, ReactNode } from 'react'

// ---------------------------------------------------------------- tokens and themes

/** Every themeable colour. Each is exposed to CSS as `--color-<key>`. */
export type TokenKey =
  | 'primary' | 'primary-dark' | 'primary-alt' | 'on-primary'
  | 'background' | 'surface' | 'secondary' | 'on-secondary' | 'accent' | 'on-accent' | 'border' | 'shadow'
  | 'ink' | 'ink-secondary' | 'ink-muted'
  | 'success' | 'warning' | 'danger' | 'info'
  | 'data-1' | 'data-2' | 'data-3' | 'data-4' | 'data-5' | 'data-6' | 'data-7' | 'data-8'
  | 'app-background' | 'app-input' | 'app-border' | 'app-primary' | 'app-shadow-dark' | 'app-shadow-light' | 'app-ink' | 'app-ink-muted'

/** Token key → `"#rrggbb"`. */
export type ThemeTokens = Record<TokenKey, string>

export interface Theme {
  id: string
  name: string
  tokens: ThemeTokens
  /** A palette the visitor created or imported. */
  custom?: boolean
  /** From the generated library. */
  library?: boolean
  /** One of the host site's own themes (including scan suggestions). */
  site?: boolean
  /** Suggested by a site scan. */
  scanned?: boolean
  /** A generated dark twin of a light theme. */
  derived?: boolean
  /** Library categories, for library themes. */
  tags?: string[]
}

export interface TokenGroup {
  group: string
  tokens: { key: TokenKey; label: string; usage: string }[]
}

export const TOKEN_GROUPS: TokenGroup[]
export const TOKEN_KEYS: TokenKey[]
/** The neutral default theme's tokens (Slate). */
export const BASE_TOKENS: ThemeTokens
/** The hand-tuned themes shown as "Max's picks". */
export const PRESETS: Theme[]

/** Fills missing tokens from `base` (the neutral default unless given), deriving the secondary-area ones. */
export function completeTokens(partial: Partial<ThemeTokens>, base?: ThemeTokens): ThemeTokens
/** Derives the secondary-area (`app-*`) tokens from a theme's main palette. */
export function deriveAppTokens(tokens: ThemeTokens): Pick<ThemeTokens, Extract<TokenKey, `app-${string}`>>

// ---------------------------------------------------------------- React API

export interface ColorsByMaxConfig {
  /** Name of the first theme group, e.g. "Tsungi". Detected from the page if left out. */
  siteName?: string
  /** localStorage key; must match the pre-paint script. Defaults to "colorsbymax". */
  storageKey?: string
  /** The site's own colours. Missing tokens are filled in. */
  defaultTheme?: { name: string; tokens: Partial<ThemeTokens> }
  /** Extra themes made for the site. */
  themes?: { id: string; name: string; tokens: Partial<ThemeTokens> }[]
  /** Where each token is used on the site, shown in the colour editors. */
  usage?: Partial<Record<TokenKey, string>>
  /** Colour the page's scrollbars from the theme. Default true. */
  scrollbars?: boolean
  /** Enables PDF uploads: pass `loadPdf` from 'colorsbymax/pdf' (needs pdfjs-dist installed). */
  pdf?: () => Promise<unknown>
  /**
   * Re-colour a site that doesn't paint with the --color-* variables, by swapping the colours
   * actually on the page. 'auto' (the default) does it only when the site doesn't define
   * --color-primary itself; false never does.
   */
  recolour?: boolean | 'auto'
  /**
   * Where the colour button starts. Default 'bottom-right', like chat and help widgets;
   * 'top-right' sits just under a floating nav bar. Visitors can still drag it anywhere.
   */
  position?: 'bottom-right' | 'bottom-left' | 'top-left' | 'top-right'
  /**
   * Hide the colour button and panel; the theme still applies. `hidden: import.meta.env.PROD`
   * keeps it out of production once the colours are chosen, while it still shows in development.
   */
  hidden?: boolean
  /**
   * Bring the colour button in with a short pop and a burst of the theme's colours, a moment after
   * the page loads (default true). With reduced motion it fades in instead.
   */
  intro?: boolean
  /**
   * Whether themes colour the site's logo for a first-time visitor (default false: the logo keeps
   * its own colours). Visitors can still change it in the panel's settings.
   */
  colourLogo?: boolean
  /**
   * How boldly a re-coloured site (one that doesn't paint with the --color-* variables) takes a
   * theme, for a first-time visitor. 'colourful' (default) paints the page's parts by role, as a
   * designer would: header, hero, alternating sections, cards, buttons, links, headings and footer.
   * 'subtle' only swaps the colours the site already has. Visitors can switch in the panel.
   */
  colourStyle?: 'colourful' | 'subtle'
  /**
   * Parts of the panel to switch off for everyone, e.g. `{ scan: false, audit: false }`. All are on
   * by default. Unlike the rest of the config it's read live, so a site can change it after loading.
   */
  features?: Partial<Record<'picks' | 'library' | 'search' | 'surprise' | 'scan' | 'custom' | 'overrides' | 'importExport' | 'audit' | 'addToSite' | 'colourStyle' | 'colourCount', boolean>>
  /**
   * The mode a first-time visitor starts in (default 'light'; 'system' follows their device). Any
   * site can start dark: every theme has a dark twin. Visitors can still change it.
   */
  defaultMode?: 'light' | 'dark' | 'system'
}

export interface ThemeProviderProps {
  config?: ColorsByMaxConfig
  children?: ReactNode
}

/** Applies the saved or chosen theme to the page and provides it to the switcher and useTheme(). */
export function ThemeProvider(props: ThemeProviderProps): ReactElement

/** The floating colour button and panel. Render it once, inside ThemeProvider. */
export function ThemeSwitcher(): ReactElement | null

export interface ScanResult {
  at: number
  palette: string[]
  themes: Theme[]
}

export interface ThemeState {
  activeId: string
  overrides: Partial<ThemeTokens>
  customs: Theme[]
  snapshot: Pick<Theme, 'id' | 'name' | 'tokens'> | null
  scanned: ScanResult | null
}

export interface ThemeApi {
  state: ThemeState
  storageKey: string
  siteName: string
  usage: Partial<Record<TokenKey, string>>
  loadPdf: (() => Promise<unknown>) | null
  position: 'bottom-right' | 'bottom-left' | 'top-left' | 'top-right'
  /** True when the config hides the switcher; the theme still applies. */
  hidden: boolean
  /** Whether the colour button makes an entrance when it first appears. */
  intro: boolean
  /** The mode in effect: every theme shows its light or dark version. */
  mode: 'light' | 'dark'
  /** The visitor's choice; 'system' follows the device. */
  modeSetting: 'light' | 'dark' | 'system'
  /** Sets the mode, for the whole site, and remembers it. */
  setMode(mode: 'light' | 'dark' | 'system'): void
  /** True when colorsbymax is swapping the page's own colours (the site isn't using the variables). */
  recolouring: boolean
  /** Turns re-colouring of the site's logo on or off. */
  setLogoColouring(on: boolean): void
  /** How boldly a re-coloured site takes the theme (the panel's Subtle / Colourful switch). */
  setColourStyle(style: 'colourful' | 'subtle'): void
  /** The site's own themes, then any scan suggestions. */
  siteThemes: Theme[]
  defaultTheme: Theme
  presets: Theme[]
  customs: Theme[]
  /** Site themes, presets and custom palettes (not the library). */
  themes: Theme[]
  /** The applied theme. */
  active: Theme
  /** The applied colours: the active theme plus any overrides. */
  tokens: ThemeTokens
  /** Contrast problems in the applied colours. */
  issues: ContrastIssue[]

  /** Selects a theme by id; pass the theme itself for library themes and dark twins. */
  selectTheme(id: string, theme?: Theme): void
  /** Creates a custom palette from the current colours and applies it. Returns its id. */
  createCustom(name: string): string
  updateCustomToken(id: string, key: TokenKey, value: string): void
  renameCustom(id: string, name: string): void
  deleteCustom(id: string): void
  /** Adds tokens as a new custom palette and applies it. Returns its id. */
  addPalette(name: string, tokens: Partial<ThemeTokens>): string

  setOverride(key: TokenKey, value: string): void
  clearOverride(key: TokenKey): void
  clearOverrides(): void
  resetToDefault(): void

  scanned: ScanResult | null
  /** Reads the page's colours and adds themes built around them. Resolves to counts for the UI. */
  runScan(): Promise<{ colours: number; themes: number }>
  clearScan(): void

  /** Fixes one issue by adjusting lightness. Returns false if no single change could. */
  fixIssue(issue: ContrastIssue): boolean
  fixAllIssues(): void

  /** The applied theme as `{ name, tokens }` JSON. */
  exportTheme(): string
  /** Imports `{ name, tokens }` JSON as a custom palette. Returns an error message, or null. */
  importTheme(json: string): string | null
}

/** The theme state and actions. Must be called inside ThemeProvider. */
export function useTheme(): ThemeApi

/** Writes each token to `--color-<key>` on `<html>`. */
export function applyTokens(tokens: ThemeTokens): void

// ---------------------------------------------------------------- pre-paint and settings

export const DEFAULT_STORAGE_KEY: 'colorsbymax'
/** Source of an inline `<script>` for `<head>` that applies the saved theme before first paint. */
export function prePaintScript(storageKey?: string): string

export interface PanelSettings {
  mode: 'light' | 'dark' | 'system'
  showPicks: boolean
  showLibrary: boolean
  showCustom: boolean
  showOverrides: boolean
  showImportExport: boolean
  draggable: boolean
  animateDot: boolean
  panelWidth: number | null
  panelHeight: number | 'full' | null
  libraryCollapsed: boolean
  /** Whether themes re-colour the site's logo too. Off (the default) keeps its own colours. */
  colourLogo: boolean
  /** On a re-coloured site: 'colourful' paints its parts by role, 'subtle' only swaps its colours. */
  colourStyle: 'colourful' | 'subtle'
  /** Hidden on this device (from the finish screen); Alt+Shift+C or ?colorsbymax brings it back. */
  hideButton: boolean
}
/** The visitor settings the panel starts with. */
export const DEFAULT_SETTINGS: PanelSettings

// ---------------------------------------------------------------- contrast

export type PairingKind = 'text' | 'large-text' | 'non-text'

export interface Pairing {
  id: string
  label: string
  kind: PairingKind
  fg(tokens: ThemeTokens): string
  bg(tokens: ThemeTokens): string
  /** Tokens auto-fix may adjust, in preference order. */
  fixable: TokenKey[]
}

export interface ContrastIssue {
  pairing: Pairing
  ratio: number
  required: number
  /** e.g. "Primary text on background: 2.7:1 — text will be hard to read (needs 4.5:1)" */
  message: string
}

/** Every foreground/background pairing colorsbymax checks. */
export const PAIRINGS: Pairing[]
export const MIN_CONTRAST_TEXT: number
export const MIN_CONTRAST_LARGE_TEXT: number
export const MIN_CONTRAST_NON_TEXT: number
export const MIN_RAMP_STEP_DELTA_E: number

/** Every failing pairing in a theme. */
export function checkTheme(tokens: ThemeTokens): ContrastIssue[]
/** The smallest lightness change to one token that makes a pairing pass, or null. */
export function suggestFix(pairing: Pairing, tokens: ThemeTokens): { key: TokenKey; value: string } | null
/** Fixes failing pairings until the theme passes or nothing more helps. Returns the changed tokens. */
export function fixAll(tokens: ThemeTokens): Partial<ThemeTokens>
/** Problems with an ordered colour ramp drawn on `surface`, as sentences. */
export function checkRamp(colors: string[], surface: string): string[]

// ---------------------------------------------------------------- colour helpers

/** WCAG 2 contrast ratio between two hex colours, 1–21. */
export function contrastRatio(a: string, b: string): number
/** "#abc", "abc" or "#AABBCC" → "#aabbcc"; null for anything else. */
export function normalizeHex(input: unknown): string | null

// ---------------------------------------------------------------- light and dark

/** True when a theme's page background is dark. */
export function isDarkTheme(tokens: ThemeTokens): boolean
/** Dark versions of a light theme's tokens, adjusted to pass contrast. */
export function darkTokens(tokens: ThemeTokens): ThemeTokens
/** The dark twin of a light theme (themes that are already dark come back unchanged). */
export function toDark<T extends Theme>(theme: T): T

// ---------------------------------------------------------------- site scan

export interface ColourTally {
  hex: string
  /** Area painted as a background. */
  bg: number
  /** Weighted amount of text in this colour. */
  text: number
  /** Border length in this colour. */
  border: number
}

export type Roles = Partial<Record<TokenKey, string>>

/** The page's painted colours, ignoring any applied theme. `exclude` is a selector to skip. */
export function collectColors(options?: { exclude?: string }): ColourTally[]
/** Works out token roles from collected colours. */
export function inferRoles(colors: ColourTally[]): { roles: Roles; palette: string[] }
/** A complete theme from detected roles, deriving whatever wasn't found. */
export function themeFromRoles(
  roles: Roles,
  variant?: { softness?: number; boldness?: number; complementary?: boolean },
): ThemeTokens
/** Themes suggested for a scanned site, named after it, plus the closest library themes. */
export function suggestThemes(scan: { roles: Roles }, siteName: string, library?: Theme[]): Theme[]
/** Best guess at the site's name: og:site_name, then the title, then the host. */
export function detectSiteName(doc?: Document): string

// ---------------------------------------------------------------- palettes from files

/** The main colours in an image (or a PDF, with `loadPdf`), most important first. */
export function coloursFromFile(
  file: File,
  options?: { loadPdf?: (() => Promise<unknown>) | null },
): Promise<{ colours: string[]; from: 'image' | 'pdf-text' | 'pdf' }>
/** The dominant colours in sets of RGBA pixels, edge blends removed. */
export function dominantColours(pixelSets: Uint8ClampedArray[]): string[]
/** Assigns a palette's colours to theme roles. */
export function rolesFromPalette(colours: string[]): Roles
/** A complete, contrast-checked theme built around a palette. */
export function themeFromPalette(colours: string[]): ThemeTokens
