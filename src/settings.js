// The visitor's own preferences for the switcher (not the theme): what it lists, which
// sections it shows and how the colour button behaves. Saved per site in localStorage.

import { createContext, useContext, useEffect, useState } from 'react'

/**
 * @typedef {Object} PanelSettings
 * @property {'light' | 'dark' | 'system'} mode  Which version of each theme to list; the panel matches it
 * @property {boolean} showPicks
 * @property {boolean} showLibrary
 * @property {boolean} showCustom      "Custom palettes" section
 * @property {boolean} showOverrides   "Override a single colour" section
 * @property {boolean} showImportExport
 * @property {boolean} draggable       Whether the colour button can be dragged
 * @property {boolean} animateDot      Whether the colour button's dot cycles through the theme's colours
 * @property {number | null} panelWidth           Pixels; null is the standard width
 * @property {number | 'full' | null} panelHeight  Pixels, 'full' for all the room there is, or null to fit the content
 * @property {boolean} libraryCollapsed  Whether the library's category chips are folded away
 * @property {boolean} colourLogo  Whether themes re-colour the site's logo too (off keeps its own colours)
 * @property {boolean} hideButton  Hidden on this device from the finish screen (Alt+Shift+C brings it back)
 */

/** @type {PanelSettings} */
export const DEFAULT_SETTINGS = {
  mode: 'light',
  showPicks: true,
  showLibrary: true,
  showCustom: true,
  showOverrides: true,
  showImportExport: true,
  draggable: true,
  animateDot: true,
  panelWidth: null,
  panelHeight: null,
  libraryCollapsed: false,
  colourLogo: false,
  hideButton: false,
}

/** Size presets offered in settings; dragging an edge gives a custom size instead. */
export const PANEL_PRESETS = [
  { id: 'compact', label: 'Compact', width: 340, height: null },
  { id: 'standard', label: 'Standard', width: null, height: null },
  { id: 'large', label: 'Large', width: 560, height: 'full' },
]

/** @returns {PanelSettings} */
export function loadSettings(storageKey) {
  try {
    const saved = JSON.parse(window.localStorage.getItem(`${storageKey}:settings`) || 'null')
    if (!saved || typeof saved !== 'object') return DEFAULT_SETTINGS
    const out = { ...DEFAULT_SETTINGS }
    for (const [key, fallback] of Object.entries(DEFAULT_SETTINGS)) {
      if (typeof saved[key] === typeof fallback) out[key] = saved[key]
    }
    if (!['light', 'dark', 'system'].includes(out.mode)) out.mode = DEFAULT_SETTINGS.mode
    const size = (v) => typeof v === 'number' && v > 0 && v < 10000
    out.panelWidth = size(saved.panelWidth) ? saved.panelWidth : null
    out.panelHeight = size(saved.panelHeight) || saved.panelHeight === 'full' ? saved.panelHeight : null
    return out
  } catch {
    return DEFAULT_SETTINGS
  }
}

export function saveSettings(storageKey, settings) {
  try {
    window.localStorage.setItem(`${storageKey}:settings`, JSON.stringify(settings))
  } catch {
    // Storage unavailable: settings last for this page view.
  }
}

/** True while the device prefers dark colours. */
export function usePrefersDark() {
  const query = '(prefers-color-scheme: dark)'
  const [dark, setDark] = useState(() => window.matchMedia(query).matches)
  useEffect(() => {
    const mq = window.matchMedia(query)
    const update = () => setDark(mq.matches)
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])
  return dark
}

/**
 * @typedef {Object} SettingsApi
 * @property {PanelSettings} settings
 * @property {(patch: Partial<PanelSettings>) => void} update
 * @property {() => void} reset
 * @property {'light' | 'dark'} mode        `settings.mode` with "system" resolved
 * @property {(() => void) | null} resetButton  Moves the colour button back to its corner; null when it's there
 */

/** @type {import('react').Context<SettingsApi | null>} */
export const SettingsContext = createContext(null)

export function useSettings() {
  const ctx = useContext(SettingsContext)
  if (!ctx) throw new Error('useSettings must be used inside the colorsbymax switcher')
  return ctx
}
