import { createContext, createElement, useCallback, useContext, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
import { createPortal } from "react-dom";
//#region src/color.js
var HEX_RE = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;
/** Normalises "#abc", "abc", "#AABBCC" to "#aabbcc"; returns null for anything else. */
function normalizeHex(input) {
	if (typeof input !== "string") return null;
	const m = input.trim().match(HEX_RE);
	if (!m) return null;
	let h = m[1].toLowerCase();
	if (h.length === 3) h = h.split("").map((c) => c + c).join("");
	return `#${h}`;
}
function hexToRgb(hex) {
	const h = normalizeHex(hex).slice(1);
	return [
		0,
		2,
		4
	].map((i) => parseInt(h.slice(i, i + 2), 16));
}
function rgbToHex([r, g, b]) {
	return "#" + [
		r,
		g,
		b
	].map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, "0")).join("");
}
/** Composites `fg` over `bg` at the given alpha (0–1), like `color-mix(fg alpha, bg)`. */
function mix(fg, bg, alpha) {
	const a = hexToRgb(fg);
	const b = hexToRgb(bg);
	return rgbToHex(a.map((v, i) => v * alpha + b[i] * (1 - alpha)));
}
function channelToLinear(c) {
	const s = c / 255;
	return s <= .04045 ? s / 12.92 : ((s + .055) / 1.055) ** 2.4;
}
/** WCAG 2.x relative luminance. */
function luminance(hex) {
	const [r, g, b] = hexToRgb(hex).map(channelToLinear);
	return .2126 * r + .7152 * g + .0722 * b;
}
/** WCAG 2.x contrast ratio between two colours (1–21). */
function contrastRatio(a, b) {
	const la = luminance(a);
	const lb = luminance(b);
	return (Math.max(la, lb) + .05) / (Math.min(la, lb) + .05);
}
function rgbToHsl([r, g, b]) {
	r /= 255;
	g /= 255;
	b /= 255;
	const max = Math.max(r, g, b);
	const min = Math.min(r, g, b);
	const l = (max + min) / 2;
	if (max === min) return [
		0,
		0,
		l
	];
	const d = max - min;
	const s = l > .5 ? d / (2 - max - min) : d / (max + min);
	let h;
	if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
	else if (max === g) h = (b - r) / d + 2;
	else h = (r - g) / d + 4;
	return [
		h * 60,
		s,
		l
	];
}
function hslToRgb([h, s, l]) {
	const k = (n) => (n + h / 30) % 12;
	const a = s * Math.min(l, 1 - l);
	const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
	return [
		f(0) * 255,
		f(8) * 255,
		f(4) * 255
	];
}
/** Returns `hex` with its HSL lightness replaced (hue and saturation kept). */
function withLightness(hex, l) {
	const [h, s] = rgbToHsl(hexToRgb(hex));
	return rgbToHex(hslToRgb([
		h,
		s,
		Math.min(1, Math.max(0, l))
	]));
}
function lightness(hex) {
	return rgbToHsl(hexToRgb(hex))[2];
}
/** CIE L*a*b* (D65), used for perceptual checks on ramps. */
function toLab(hex) {
	const [r, g, b] = hexToRgb(hex).map(channelToLinear);
	const x = (.4124 * r + .3576 * g + .1805 * b) / .95047;
	const y = .2126 * r + .7152 * g + .0722 * b;
	const z = (.0193 * r + .1192 * g + .9505 * b) / 1.08883;
	const f = (t) => t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116;
	const [fx, fy, fz] = [
		f(x),
		f(y),
		f(z)
	];
	return [
		116 * fy - 16,
		500 * (fx - fy),
		200 * (fy - fz)
	];
}
/** CIE76 colour difference. */
function deltaE(a, b) {
	const [l1, a1, b1] = toLab(a);
	const [l2, a2, b2] = toLab(b);
	return Math.hypot(l1 - l2, a1 - a2, b1 - b2);
}
//#endregion
//#region src/contrast.js
/** WCAG 2.x SC 1.4.3: normal-size text. */
var MIN_CONTRAST_TEXT = 4.5;
/** WCAG 2.x SC 1.4.3: large text (≥24px, or ≥18.66px bold). */
var MIN_CONTRAST_LARGE_TEXT = 3;
/** WCAG 2.x SC 1.4.11: icons, chart marks, meaningful borders. */
var MIN_CONTRAST_NON_TEXT = 3;
/** Minimum CIE76 ΔE between adjacent steps of an ordinal/sequential ramp. */
var MIN_RAMP_STEP_DELTA_E = 10;
/** HSL lightness step used when searching for the nearest passing value. */
var AUTO_FIX_LIGHTNESS_STEP = .005;
var THRESHOLDS = {
	text: MIN_CONTRAST_TEXT,
	"large-text": 3,
	"non-text": 3
};
var CONSEQUENCE = {
	text: "text will be hard to read",
	"large-text": "headline will be hard to read",
	"non-text": "icon will be hard to see"
};
var GLASS_ALPHA = .6;
var CHIP_ALPHA = .15;
var BADGE_ALPHA = .1;
var MUTED_ON_PRIMARY_ALPHA = .8;
var APP_GRADIENT_LIGHT_ALPHA = .8;
var glass = (t) => mix(t.surface, t.background, GLASS_ALPHA);
var chip = (key) => (t) => mix(t[key], glass(t), CHIP_ALPHA);
/**
* @typedef {Object} Pairing
* @property {string} id
* @property {string} label       Human name, e.g. "Primary on surface"
* @property {'text'|'large-text'|'non-text'} kind
* @property {(t: import('./tokens.js').ThemeTokens) => string} fg
* @property {(t: import('./tokens.js').ThemeTokens) => string} bg
* @property {import('./tokens.js').TokenKey[]} fixable  Tokens auto-fix may adjust, in preference order
*/
/** @type {Pairing[]} */
var PAIRINGS = [
	{
		id: "ink-bg",
		label: "Text on page background",
		kind: "text",
		fg: (t) => t.ink,
		bg: (t) => t.background,
		fixable: ["ink"]
	},
	{
		id: "ink-card",
		label: "Text on cards",
		kind: "text",
		fg: (t) => t.ink,
		bg: glass,
		fixable: ["ink"]
	},
	{
		id: "ink2-bg",
		label: "Secondary text on page background",
		kind: "text",
		fg: (t) => t["ink-secondary"],
		bg: (t) => t.background,
		fixable: ["ink-secondary"]
	},
	{
		id: "ink2-card",
		label: "Secondary text on cards",
		kind: "text",
		fg: (t) => t["ink-secondary"],
		bg: glass,
		fixable: ["ink-secondary"]
	},
	{
		id: "ink3-surface",
		label: "Muted text on surface",
		kind: "text",
		fg: (t) => t["ink-muted"],
		bg: (t) => t.surface,
		fixable: ["ink-muted"]
	},
	{
		id: "ink3-bg",
		label: "Muted text on page background",
		kind: "text",
		fg: (t) => t["ink-muted"],
		bg: (t) => t.background,
		fixable: ["ink-muted"]
	},
	{
		id: "on-primary",
		label: "Button text on primary",
		kind: "text",
		fg: (t) => t["on-primary"],
		bg: (t) => t.primary,
		fixable: ["primary", "on-primary"]
	},
	{
		id: "muted-on-primary",
		label: "Secondary text on primary",
		kind: "text",
		fg: (t) => mix(t["on-primary"], t.primary, MUTED_ON_PRIMARY_ALPHA),
		bg: (t) => t.primary,
		fixable: ["primary", "on-primary"]
	},
	{
		id: "primary-text",
		label: "Primary text on background",
		kind: "text",
		fg: (t) => t.primary,
		bg: (t) => mix(t.primary, t.background, BADGE_ALPHA),
		fixable: ["primary"]
	},
	{
		id: "primary-dark-nav",
		label: "Brand-dark text on cards",
		kind: "text",
		fg: (t) => t["primary-dark"],
		bg: glass,
		fixable: ["primary-dark"]
	},
	{
		id: "gradient-a",
		label: "Headline gradient (primary) on background",
		kind: "large-text",
		fg: (t) => t.primary,
		bg: (t) => t.background,
		fixable: ["primary"]
	},
	{
		id: "gradient-b",
		label: "Headline gradient (partner) on background",
		kind: "large-text",
		fg: (t) => t["primary-alt"],
		bg: (t) => t.background,
		fixable: ["primary-alt"]
	},
	{
		id: "on-secondary",
		label: "Text on tint",
		kind: "text",
		fg: (t) => t["on-secondary"],
		bg: (t) => t.secondary,
		fixable: ["on-secondary"]
	},
	{
		id: "on-accent",
		label: "Hover text on hover tint",
		kind: "text",
		fg: (t) => t["on-accent"],
		bg: (t) => t.accent,
		fixable: ["on-accent"]
	},
	{
		id: "icon-primary",
		label: "Primary icon on its chip",
		kind: "non-text",
		fg: (t) => t.primary,
		bg: chip("primary"),
		fixable: ["primary"]
	},
	...[
		1,
		2,
		3,
		4,
		5,
		6,
		7,
		8
	].map((n) => ({
		id: `icon-data-${n}`,
		label: `Data ${n} icon on its tint`,
		kind: "non-text",
		fg: (t) => t[`data-${n}`],
		bg: chip(`data-${n}`),
		fixable: [`data-${n}`]
	})),
	{
		id: "text-data-1",
		label: "Data 1 as text on background",
		kind: "text",
		fg: (t) => t["data-1"],
		bg: (t) => t.background,
		fixable: ["data-1"]
	},
	{
		id: "text-data-2",
		label: "Data 2 as text on background",
		kind: "text",
		fg: (t) => t["data-2"],
		bg: (t) => t.background,
		fixable: ["data-2"]
	},
	...[
		"success",
		"danger",
		"info",
		"warning"
	].map((key) => ({
		id: `icon-${key}`,
		label: `${key[0].toUpperCase()}${key.slice(1)} icon on its tint`,
		kind: "non-text",
		fg: (t) => t[key],
		bg: (t) => mix(t[key], t.surface, CHIP_ALPHA),
		fixable: [key]
	})),
	{
		id: "text-success",
		label: "Success text on cards",
		kind: "text",
		fg: (t) => t.success,
		bg: glass,
		fixable: ["success"]
	},
	{
		id: "text-danger",
		label: "Error text on cards",
		kind: "text",
		fg: (t) => t.danger,
		bg: glass,
		fixable: ["danger"]
	},
	{
		id: "app-ink",
		label: "Area text on area background",
		kind: "text",
		fg: (t) => t["app-ink"],
		bg: (t) => t["app-background"],
		fixable: ["app-ink"]
	},
	{
		id: "app-muted",
		label: "Area muted text on area background",
		kind: "text",
		fg: (t) => t["app-ink-muted"],
		bg: (t) => t["app-background"],
		fixable: ["app-ink-muted"]
	},
	{
		id: "app-placeholder",
		label: "Placeholder text in area fields",
		kind: "text",
		fg: (t) => t["app-ink-muted"],
		bg: (t) => t["app-input"],
		fixable: ["app-ink-muted"]
	},
	{
		id: "app-button",
		label: "Area button text on gradient",
		kind: "text",
		fg: (t) => t["on-primary"],
		bg: (t) => mix(t["app-primary"], "#ffffff", APP_GRADIENT_LIGHT_ALPHA),
		fixable: ["app-primary", "on-primary"]
	},
	{
		id: "app-link",
		label: "Area links on area background",
		kind: "text",
		fg: (t) => t["app-primary"],
		bg: (t) => t["app-background"],
		fixable: ["app-primary"]
	},
	{
		id: "app-title-a",
		label: "Area headline gradient (primary)",
		kind: "large-text",
		fg: (t) => t.primary,
		bg: (t) => t["app-background"],
		fixable: ["primary"]
	},
	{
		id: "app-title-b",
		label: "Area headline gradient (partner)",
		kind: "large-text",
		fg: (t) => t["primary-alt"],
		bg: (t) => t["app-background"],
		fixable: ["primary-alt"]
	}
];
/**
* @typedef {Object} ContrastIssue
* @property {Pairing} pairing
* @property {number} ratio
* @property {number} required
* @property {string} message   e.g. "Primary text on background: 2.7:1 — text will be hard to read (needs 4.5:1)"
*/
var formatRatio = (r) => `${(Math.floor(r * 10) / 10).toFixed(1)}:1`;
function evaluatePairing(pairing, tokens) {
	const ratio = contrastRatio(pairing.fg(tokens), pairing.bg(tokens));
	const required = THRESHOLDS[pairing.kind];
	return {
		ratio,
		required,
		pass: ratio >= required
	};
}
/** Returns every failing pairing for a theme. */
function checkTheme(tokens) {
	/** @type {ContrastIssue[]} */
	const issues = [];
	for (const pairing of PAIRINGS) {
		const { ratio, required, pass } = evaluatePairing(pairing, tokens);
		if (!pass) issues.push({
			pairing,
			ratio,
			required,
			message: `${pairing.label}: ${formatRatio(ratio)} — ${CONSEQUENCE[pairing.kind]} (needs ${required}:1)`
		});
	}
	return issues;
}
/**
* Finds the smallest lightness change to one of the pairing's fixable tokens that makes
* it pass. Returns `{ key, value }` or null if no single-token change can pass.
*/
function suggestFix(pairing, tokens) {
	let best = null;
	for (const key of pairing.fixable) {
		const start = lightness(tokens[key]);
		for (const dir of [-1, 1]) for (let d = AUTO_FIX_LIGHTNESS_STEP; start + dir * d >= 0 && start + dir * d <= 1; d += AUTO_FIX_LIGHTNESS_STEP) {
			const value = withLightness(tokens[key], start + dir * d);
			if (evaluatePairing(pairing, {
				...tokens,
				[key]: value
			}).pass) {
				if (!best || d < best.delta) best = {
					key,
					value,
					delta: d
				};
				break;
			}
		}
	}
	return best && {
		key: best.key,
		value: best.value
	};
}
/**
* Repeatedly fixes failing pairings until the theme passes or no progress is possible.
* Returns the changed tokens only.
*/
function fixAll(tokens) {
	let current = { ...tokens };
	const changes = {};
	for (let pass = 0; pass < PAIRINGS.length * 3; pass++) {
		const fixable = checkTheme(current).map((issue) => suggestFix(issue.pairing, current)).find(Boolean);
		if (!fixable) break;
		current = {
			...current,
			[fixable.key]: fixable.value
		};
		changes[fixable.key] = fixable.value;
	}
	return changes;
}
/**
* Checks an ordinal/sequential ramp (lightest → darkest or darkest → lightest):
* lightness must be monotonic, adjacent steps distinguishable, and the lightest step
* must still clear the surface it is drawn on. Returns a list of problem strings.
* The site has no charts today, so no ramp tokens exist yet; this is ready for them.
*/
function checkRamp(colors, surface) {
	const problems = [];
	const L = colors.map((c) => toLab(c)[0]);
	const rising = L.every((v, i) => i === 0 || v >= L[i - 1]);
	const falling = L.every((v, i) => i === 0 || v <= L[i - 1]);
	if (!rising && !falling) problems.push("Lightness is not monotonic across the ramp");
	for (let i = 1; i < colors.length; i++) {
		const d = deltaE(colors[i - 1], colors[i]);
		if (d < 10) problems.push(`Steps ${i} and ${i + 1} are too similar (ΔE ${d.toFixed(1)})`);
	}
	const lightest = colors[L.indexOf(Math.max(...L))];
	const r = contrastRatio(lightest, surface);
	if (r < 3) problems.push(`Lightest step on surface: ${formatRatio(r)} (needs 3:1)`);
	return problems;
}
//#endregion
//#region src/library.js
var cache = null;
/**
* @returns {Promise<{ categories: { id: string, label: string, description: string, count: number }[],
*   themes: (import('./tokens.js').Theme & { tags: string[], library: true })[], source: string }>}
*/
function loadLibrary() {
	cache ??= import("./library.generated-DIDiWlBK.js").then(({ default: data }) => ({
		source: data.source,
		categories: data.categories,
		themes: data.themes.map((t) => ({
			id: t.id,
			name: t.name,
			tags: t.tags,
			library: true,
			tokens: Object.fromEntries(data.keys.map((key, i) => [key, `#${t.t.slice(i * 6, i * 6 + 6)}`]))
		}))
	}));
	return cache;
}
//#endregion
//#region src/tokens.js
/**
* @typedef {'primary'|'primary-dark'|'primary-alt'|'on-primary'
*   |'background'|'surface'|'secondary'|'on-secondary'|'accent'|'on-accent'|'border'|'shadow'
*   |'ink'|'ink-secondary'|'ink-muted'
*   |'success'|'warning'|'danger'|'info'
*   |'data-1'|'data-2'|'data-3'|'data-4'|'data-5'|'data-6'|'data-7'|'data-8'
*   |'app-background'|'app-input'|'app-border'|'app-primary'|'app-shadow-dark'|'app-shadow-light'|'app-ink'|'app-ink-muted'} TokenKey
*/
/** @typedef {Record<TokenKey, string>} ThemeTokens  Token key → "#rrggbb". */
/**
* @typedef {Object} Theme
* @property {string} id
* @property {string} name
* @property {ThemeTokens} tokens
* @property {boolean} [custom]   true for user-created palettes
* @property {boolean} [library]  true for themes from the generated library
* @property {boolean} [site]     true for the host site's own themes
*/
/** @type {{ group: string, tokens: { key: TokenKey, label: string, usage: string }[] }[]} */
var TOKEN_GROUPS = [
	{
		group: "Brand",
		tokens: [
			{
				key: "primary",
				label: "Primary",
				usage: "Buttons, highlighted bands, links, focus rings"
			},
			{
				key: "primary-dark",
				label: "Primary dark",
				usage: "Logo or brand text"
			},
			{
				key: "primary-alt",
				label: "Primary gradient partner",
				usage: "Gradients and glows"
			},
			{
				key: "on-primary",
				label: "Text on primary",
				usage: "Text on primary buttons and bands"
			}
		]
	},
	{
		group: "Surfaces",
		tokens: [
			{
				key: "background",
				label: "Page background",
				usage: "Behind everything"
			},
			{
				key: "surface",
				label: "Surface",
				usage: "Cards, panels, inputs"
			},
			{
				key: "secondary",
				label: "Tint",
				usage: "Badges, tinted areas, footers"
			},
			{
				key: "on-secondary",
				label: "Text on tint",
				usage: "Text on tinted areas"
			},
			{
				key: "accent",
				label: "Hover tint",
				usage: "Hover backgrounds"
			},
			{
				key: "on-accent",
				label: "Text on hover tint",
				usage: "Text on hover backgrounds"
			},
			{
				key: "border",
				label: "Border",
				usage: "Dividers (decorative)"
			},
			{
				key: "shadow",
				label: "Shadow",
				usage: "Card and panel shadows"
			}
		]
	},
	{
		group: "Text",
		tokens: [
			{
				key: "ink",
				label: "Text",
				usage: "Headings and body text"
			},
			{
				key: "ink-secondary",
				label: "Secondary text",
				usage: "Paragraphs, nav links"
			},
			{
				key: "ink-muted",
				label: "Muted text",
				usage: "Placeholders, footnotes"
			}
		]
	},
	{
		group: "Status",
		tokens: [
			{
				key: "success",
				label: "Success",
				usage: "Confirmations, positive icons"
			},
			{
				key: "warning",
				label: "Warning",
				usage: "Reserved for warnings"
			},
			{
				key: "danger",
				label: "Danger",
				usage: "Errors, problem icons"
			},
			{
				key: "info",
				label: "Info",
				usage: "Informational icons"
			}
		]
	},
	{
		group: "Data / categorical",
		tokens: [
			{
				key: "data-1",
				label: "Data 1",
				usage: "Charts, icons, category colour 1"
			},
			{
				key: "data-2",
				label: "Data 2",
				usage: "Category colour 2"
			},
			{
				key: "data-3",
				label: "Data 3",
				usage: "Category colour 3"
			},
			{
				key: "data-4",
				label: "Data 4",
				usage: "Category colour 4"
			},
			{
				key: "data-5",
				label: "Data 5",
				usage: "Category colour 5"
			},
			{
				key: "data-6",
				label: "Data 6",
				usage: "Category colour 6"
			},
			{
				key: "data-7",
				label: "Data 7",
				usage: "Category colour 7"
			},
			{
				key: "data-8",
				label: "Data 8",
				usage: "Category colour 8"
			}
		]
	},
	{
		group: "Secondary area",
		tokens: [
			{
				key: "app-background",
				label: "Area background",
				usage: "A distinct section, e.g. sign-in pages"
			},
			{
				key: "app-input",
				label: "Area input fill",
				usage: "Form fields"
			},
			{
				key: "app-border",
				label: "Area border",
				usage: "Card, field and divider lines"
			},
			{
				key: "app-primary",
				label: "Area primary",
				usage: "Buttons and links in the area"
			},
			{
				key: "app-shadow-dark",
				label: "Area shadow (dark)",
				usage: "Neumorphic lower shadow"
			},
			{
				key: "app-shadow-light",
				label: "Area shadow (light)",
				usage: "Neumorphic upper highlight"
			},
			{
				key: "app-ink",
				label: "Area text",
				usage: "Labels and input text"
			},
			{
				key: "app-ink-muted",
				label: "Area muted text",
				usage: "Descriptions, placeholders, icons"
			}
		]
	}
];
/** @type {TokenKey[]} */
var TOKEN_KEYS = TOKEN_GROUPS.flatMap((g) => g.tokens.map((t) => t.key));
var TOKEN_LABELS = Object.fromEntries(TOKEN_GROUPS.flatMap((g) => g.tokens.map((t) => [t.key, t.label])));
var DATA_ACCESSIBLE = {
	"data-1": "#1d4ed8",
	"data-2": "#047857",
	"data-3": "#be185d",
	"data-4": "#c2410c",
	"data-5": "#4b5563",
	"data-6": "#7c3aed",
	"data-7": "#0e7490",
	"data-8": "#4d7c0f"
};
var STATUS_ACCESSIBLE = {
	success: "#15803d",
	warning: "#b45309",
	danger: "#b91c1c",
	info: "#1d4ed8"
};
var APP_KEYS = TOKEN_GROUPS.find((g) => g.group === "Secondary area").tokens.map((t) => t.key);
/**
* Derives the secondary-area tokens from a theme's main palette, for themes that don't
* define them: a soft tinted area with neumorphic shadows, reusing its text and primary.
*/
function deriveAppTokens(t) {
	const bg = withLightness(t.secondary, Math.min(.93, lightness(t.secondary)));
	const l = lightness(bg);
	return {
		"app-background": bg,
		"app-input": withLightness(bg, l - .05),
		"app-border": withLightness(bg, l - .1),
		"app-primary": t.primary,
		"app-shadow-dark": withLightness(bg, l - .08),
		"app-shadow-light": withLightness(bg, Math.min(.99, l + .08)),
		"app-ink": t.ink,
		"app-ink-muted": t["ink-secondary"]
	};
}
/** @type {Theme[]} */
var RAW_PRESETS = [
	{
		id: "ocean",
		name: "Ocean",
		tokens: {
			primary: "#0d6b84",
			"app-primary": "#0b5e74",
			"primary-dark": "#164e63",
			"primary-alt": "#0891b2",
			"on-primary": "#ffffff",
			background: "#f8fcfd",
			surface: "#ffffff",
			secondary: "#dff3f8",
			"on-secondary": "#155e75",
			accent: "#e0f2f7",
			"on-accent": "#155e75",
			border: "#d5e7ec",
			shadow: "#0c2a33",
			ink: "#122126",
			"ink-secondary": "#4a5f66",
			"ink-muted": "#56696f",
			...STATUS_ACCESSIBLE,
			...DATA_ACCESSIBLE
		}
	},
	{
		id: "forest",
		name: "Forest",
		tokens: {
			primary: "#127136",
			"app-primary": "#106430",
			"primary-dark": "#14532d",
			"primary-alt": "#159c47",
			"on-primary": "#ffffff",
			background: "#f9fcf9",
			surface: "#ffffff",
			secondary: "#e1f3e6",
			"on-secondary": "#166534",
			accent: "#e6f4ea",
			"on-accent": "#166534",
			border: "#d7e8dc",
			shadow: "#0f2a18",
			ink: "#17231b",
			"ink-secondary": "#4d5f53",
			"ink-muted": "#56685c",
			...STATUS_ACCESSIBLE,
			...DATA_ACCESSIBLE
		}
	},
	{
		id: "sunset",
		name: "Sunset",
		tokens: {
			primary: "#ac3a0b",
			"app-primary": "#a2370a",
			"primary-dark": "#7c2d12",
			"primary-alt": "#ea580c",
			"on-primary": "#ffffff",
			background: "#fffbf8",
			surface: "#ffffff",
			secondary: "#fde8dc",
			"on-secondary": "#9a3412",
			accent: "#fdeee4",
			"on-accent": "#9a3412",
			border: "#f1ddd0",
			shadow: "#3b1a0c",
			ink: "#2a1a12",
			"ink-secondary": "#6b5448",
			"ink-muted": "#6f584c",
			...STATUS_ACCESSIBLE,
			...DATA_ACCESSIBLE
		}
	},
	{
		id: "slate",
		name: "Slate",
		tokens: {
			primary: "#334155",
			"primary-dark": "#0f172a",
			"primary-alt": "#64748b",
			"on-primary": "#ffffff",
			background: "#f8fafc",
			surface: "#ffffff",
			secondary: "#e2e8f0",
			"on-secondary": "#1e293b",
			accent: "#eef2f6",
			"on-accent": "#1e293b",
			border: "#dbe2ea",
			shadow: "#0f172a",
			ink: "#0f172a",
			"ink-secondary": "#475569",
			"ink-muted": "#556274",
			...STATUS_ACCESSIBLE,
			...DATA_ACCESSIBLE
		}
	},
	{
		id: "rose",
		name: "Rose",
		tokens: {
			primary: "#b7175a",
			"primary-dark": "#831843",
			"primary-alt": "#db2777",
			"on-primary": "#ffffff",
			background: "#fffafc",
			surface: "#ffffff",
			secondary: "#fce4ef",
			"on-secondary": "#9d174d",
			accent: "#fdecf3",
			"on-accent": "#9d174d",
			border: "#f2d9e4",
			shadow: "#3d0f22",
			ink: "#2b1520",
			"ink-secondary": "#6b4f5c",
			"ink-muted": "#6f5360",
			...STATUS_ACCESSIBLE,
			...DATA_ACCESSIBLE
		}
	}
];
/** Neutral fallback used to fill tokens a theme leaves out (Slate). */
var BASE_TOKENS = {
	...RAW_PRESETS.find((t) => t.id === "slate").tokens,
	...deriveAppTokens(RAW_PRESETS.find((t) => t.id === "slate").tokens)
};
/**
* Fills any missing tokens: secondary-area tokens are derived from the theme itself, the
* rest come from `base` (the site's default theme, or the neutral fallback).
*/
function completeTokens(partial, base = BASE_TOKENS) {
	const full = {
		...base,
		...partial
	};
	const derived = deriveAppTokens(full);
	for (const key of APP_KEYS) if (!(key in partial)) full[key] = derived[key];
	return full;
}
/** The built-in "colorsbymax picks": hand-tuned themes that pass every contrast check. */
/** @type {Theme[]} */
var PRESETS = RAW_PRESETS.map((t) => ({
	...t,
	tokens: completeTokens(t.tokens)
}));
//#endregion
//#region src/modes.js
/** Suffix on a dark twin's id: `ocean` → `ocean~dark`. */
var DARK_SUFFIX = "~dark";
/** True when a theme's page background is dark. */
var isDarkTheme = (tokens) => luminance(tokens.background) < .2;
var hslOf$2 = (hex) => rgbToHsl(hexToRgb(hex));
var hsl$1 = (h, s, l) => rgbToHex(hslToRgb([
	h,
	Math.min(1, Math.max(0, s)),
	Math.min(1, Math.max(0, l))
]));
/** Same hue, saturation capped at `maxS`, lightness set to `l`. */
var tone = (hex, l, maxS = 1) => {
	const [h, s] = hslOf$2(hex);
	return hsl$1(h, Math.min(s, maxS), l);
};
/** Keeps hue and saturation, lifting lightness into [min, max] so it reads on a dark page. */
var lift = (hex, min, max = .78) => {
	const [h, s, l] = hslOf$2(hex);
	return hsl$1(h, s, Math.min(max, Math.max(min, l)));
};
/**
* Lightens a colour, keeping its hue and saturation, until it reaches `ratio` against `bg`.
* Lightness alone doesn't guarantee that: a vivid blue or violet at 60% lightness still reads dark.
*/
var readOn = (hex, bg, ratio) => {
	const [h, s, l] = hslOf$2(hex);
	let out = hex;
	for (let x = l; contrastRatio(out, bg) < ratio && x < .96; x += .01) out = hsl$1(h, s, x);
	return out;
};
var TEXT = 4.8;
var ICON = 3.3;
/** @param {import('./tokens.js').ThemeTokens} t */
function darkTokens(t) {
	const background = tone(t.background, .08, .3);
	const secondary = tone(t.secondary, .2, .45);
	const areaBg = deriveAppTokens({
		...t,
		secondary
	})["app-background"];
	const lighterBg = luminance(areaBg) > luminance(background) ? areaBg : background;
	const primary = readOn(lift(t.primary, .58, .7), lighterBg, TEXT);
	const onPrimary = [background, "#ffffff"].sort((a, b) => contrastRatio(b, primary) - contrastRatio(a, primary))[0];
	const tokens = {
		...t,
		primary,
		"on-primary": onPrimary,
		"primary-dark": tone(t["primary-dark"], .82, .7),
		"primary-alt": readOn(lift(t["primary-alt"], .6), lighterBg, ICON),
		background,
		surface: tone(t.background, .12, .25),
		secondary,
		"on-secondary": tone(t["on-secondary"], .86, .6),
		accent: tone(t.accent, .17, .45),
		"on-accent": tone(t["on-accent"], .86, .6),
		border: tone(t.border, .24, .25),
		shadow: "#000000",
		ink: tone(t.ink, .94, .15),
		"ink-secondary": tone(t["ink-secondary"], .76, .12),
		"ink-muted": tone(t["ink-muted"], .7, .12),
		success: readOn(lift(t.success, .6), background, ICON),
		warning: readOn(lift(t.warning, .6), background, ICON),
		danger: readOn(lift(t.danger, .66), background, ICON),
		info: readOn(lift(t.info, .66), background, ICON)
	};
	for (let n = 1; n <= 8; n++) tokens[`data-${n}`] = readOn(lift(t[`data-${n}`], .6), background, n <= 2 ? TEXT : ICON);
	const full = {
		...tokens,
		...deriveAppTokens(tokens)
	};
	return {
		...full,
		...fixAll(full)
	};
}
var twins = /* @__PURE__ */ new WeakMap();
/**
* The dark twin of a light theme (cached per theme object). Themes that are already dark are
* returned as they are.
* @param {import('./tokens.js').Theme} theme
*/
function toDark(theme) {
	if (isDarkTheme(theme.tokens)) return theme;
	let twin = twins.get(theme);
	if (!twin) {
		twin = {
			...theme,
			id: theme.id + DARK_SUFFIX,
			name: `${theme.name} (dark)`,
			tokens: darkTokens(theme.tokens),
			derived: true
		};
		twins.set(theme, twin);
	}
	return twin;
}
/**
* The version of a theme to list for a mode. Custom palettes always appear exactly as the
* visitor made them.
* @param {import('./tokens.js').Theme} theme
* @param {'light' | 'dark'} mode
*/
var inMode = (theme, mode) => mode === "dark" && !theme.custom ? toDark(theme) : theme;
//#endregion
//#region src/scan.js
/** Elements beyond this count are ignored so scanning stays fast on huge pages. */
var MAX_SCANNED_ELEMENTS = 5e3;
var COLOR_IN_GRADIENT = /(?:rgba?|hsla?|oklab|oklch|lab|lch|color)\([^()]*\)|#[0-9a-f]{3,8}\b/gi;
var hueDist$1 = (a, b) => Math.min(Math.abs(a - b), 360 - Math.abs(a - b));
var hsl = (h, s, l) => rgbToHex(hslToRgb([
	(h % 360 + 360) % 360,
	Math.min(1, Math.max(0, s)),
	Math.min(1, Math.max(0, l))
]));
var toHsl = (hex) => rgbToHsl(hexToRgb(hex));
/** Best guess at the site's name: og:site_name, then the first part of the title, then the host. */
function detectSiteName(doc = document) {
	const og = doc.querySelector("meta[property=\"og:site_name\"]")?.content?.trim();
	if (og) return og;
	const title = doc.title?.split(/\s+[|–—-]\s+/)[0]?.trim();
	if (title) return title.length > 24 ? title.slice(0, 24).trim() + "…" : title;
	return doc.location?.hostname?.replace(/^www\./, "") || "This site";
}
function createColorParser() {
	const canvas = document.createElement("canvas");
	canvas.width = canvas.height = 1;
	const ctx = canvas.getContext("2d", { willReadFrequently: true });
	const cache = /* @__PURE__ */ new Map();
	return (css) => {
		if (!css || css === "transparent" || css === "rgba(0, 0, 0, 0)") return null;
		if (cache.has(css)) return cache.get(css);
		ctx.clearRect(0, 0, 1, 1);
		ctx.fillStyle = "#000";
		ctx.fillStyle = css;
		ctx.fillRect(0, 0, 1, 1);
		const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
		const out = a < 128 ? null : rgbToHex([
			r,
			g,
			b
		]);
		cache.set(css, out);
		return out;
	};
}
/**
* Temporarily removes colorsbymax's inline token overrides, and its re-colouring stylesheet, so a
* read sees the site's own colours. Everything happens synchronously, so nothing repaints in between.
*/
function withoutAppliedTheme(fn) {
	const freeze = document.createElement("style");
	freeze.textContent = "*,*::before,*::after{transition:none!important}";
	document.head.appendChild(freeze);
	const recolour = document.querySelector("style[data-colorsbymax=\"recolour\"]");
	if (recolour) recolour.disabled = true;
	const style = document.documentElement.style;
	const saved = [];
	for (let i = style.length - 1; i >= 0; i--) {
		const prop = style[i];
		if (prop.startsWith("--color-")) {
			saved.push([prop, style.getPropertyValue(prop)]);
			style.removeProperty(prop);
		}
	}
	try {
		return fn();
	} finally {
		for (const [prop, value] of saved) style.setProperty(prop, value);
		if (recolour) recolour.disabled = false;
		getComputedStyle(document.documentElement).color;
		document.body.offsetHeight;
		freeze.remove();
	}
}
/**
* Collects the page's painted colours with how much each is used as a background (by area),
* as text (by length × font size²) and as a border.
* @param {{ exclude?: string }} [options]  selector for UI to skip, e.g. the switcher itself
*/
function collectColors({ exclude = "colorsbymax-root, .theme-switcher" } = {}) {
	return withoutAppliedTheme(() => {
		const parse = createColorParser();
		/** @type {Map<string, { hex: string, bg: number, text: number, border: number }>} */
		const tally = /* @__PURE__ */ new Map();
		const add = (hex, kind, weight) => {
			if (!hex || !(weight > 0)) return;
			const entry = tally.get(hex) ?? {
				hex,
				bg: 0,
				text: 0,
				border: 0
			};
			entry[kind] += weight;
			tally.set(hex, entry);
		};
		const pageArea = document.documentElement.scrollWidth * document.documentElement.scrollHeight;
		add(parse(getComputedStyle(document.body).backgroundColor) ?? parse(getComputedStyle(document.documentElement).backgroundColor) ?? "#ffffff", "bg", pageArea);
		const elements = [...document.body.querySelectorAll("*")].slice(0, MAX_SCANNED_ELEMENTS);
		for (const el of elements) {
			if (exclude && el.closest(exclude)) continue;
			if (el.checkVisibility && !el.checkVisibility({
				opacityProperty: true,
				visibilityProperty: true
			})) continue;
			const rect = el.getBoundingClientRect();
			const area = rect.width * rect.height;
			if (!area) continue;
			const cs = getComputedStyle(el);
			add(parse(cs.backgroundColor), "bg", area);
			let chars = 0;
			for (const node of el.childNodes) if (node.nodeType === 3) chars += node.textContent.trim().length;
			const textWeight = chars * parseFloat(cs.fontSize) ** 2;
			const gradientText = cs.backgroundClip === "text" || cs.webkitBackgroundClip === "text";
			if (chars && !gradientText) add(parse(cs.color), "text", textWeight);
			if (cs.backgroundImage && cs.backgroundImage !== "none") {
				const stops = cs.backgroundImage.match(COLOR_IN_GRADIENT) ?? [];
				for (const stop of stops) if (gradientText) add(parse(stop), "text", (textWeight || area) / stops.length);
				else add(parse(stop), "bg", area / stops.length);
			}
			if (parseFloat(cs.borderTopWidth) > 0 && cs.borderTopStyle !== "none") add(parse(cs.borderTopColor), "border", rect.width + rect.height);
			if (el instanceof SVGElement) {
				add(parse(cs.fill), "text", area / 4);
				add(parse(cs.stroke), "text", area / 8);
			}
		}
		return mergeSimilar([...tally.values()]);
	});
}
function mergeSimilar(entries) {
	const sorted = entries.sort((a, b) => b.bg + b.text * 50 + b.border - (a.bg + a.text * 50 + a.border));
	const out = [];
	for (const e of sorted) {
		const into = out.find((o) => deltaE(o.hex, e.hex) < 6);
		if (into) {
			into.bg += e.bg;
			into.text += e.text;
			into.border += e.border;
		} else out.push({ ...e });
	}
	return out;
}
/**
* Works out token roles from collected colours.
* @returns {{ roles: Record<string, string>, palette: string[] }}
*/
function inferRoles(colors) {
	const total = (k) => colors.reduce((t, c) => t + c[k], 0) || 1;
	const [BG, TEXT, BORDER] = [
		total("bg"),
		total("text"),
		total("border")
	];
	const byBg = [...colors].filter((c) => c.bg > 0).sort((a, b) => b.bg - a.bg);
	const byText = [...colors].filter((c) => c.text > 0).sort((a, b) => b.text - a.text);
	const background = byBg[0]?.hex ?? "#ffffff";
	const surface = byBg.find((c) => c.hex !== background && deltaE(c.hex, background) > 2 && lightness(c.hex) >= Math.min(.9, lightness(background)))?.hex ?? (lightness(background) > .97 ? background : "#ffffff");
	const readable = (c, min) => contrastRatio(c.hex, background) >= min;
	const ink = (byText.find((c) => readable(c, 4.5)) ?? byText[0])?.hex ?? "#1f2937";
	const inkSecondary = byText.find((c) => c.hex !== ink && deltaE(c.hex, ink) > 8 && readable(c, 3))?.hex;
	const accents = colors.filter((c) => c.hex !== ink && c.hex !== inkSecondary).map((c) => {
		const [h, s, l] = toHsl(c.hex);
		const share = c.bg / BG + c.text / TEXT + c.border / BORDER * .5;
		return {
			hex: c.hex,
			h,
			s,
			l,
			score: share * s * (1 - Math.abs(l - .5))
		};
	}).filter((c) => c.s >= .25 && c.l >= .15 && c.l <= .85).sort((a, b) => b.score - a.score);
	const primary = accents[0]?.hex;
	const alt = accents.slice(1).find((c) => hueDist$1(c.h, accents[0].h) >= 20)?.hex;
	const tint = byBg.find((c) => {
		const [, s, l] = toHsl(c.hex);
		return l >= .82 && s >= .1 && c.hex !== background && c.hex !== surface;
	})?.hex;
	const roles = {
		background,
		surface,
		ink
	};
	if (inkSecondary) roles["ink-secondary"] = inkSecondary;
	if (primary) roles.primary = primary;
	if (alt) roles["primary-alt"] = alt;
	if (tint) roles.secondary = tint;
	accents.slice(0, 8).forEach((c, i) => roles[`data-${i + 1}`] = c.hex);
	const palette = [
		background,
		surface,
		ink,
		...inkSecondary ? [inkSecondary] : [],
		...accents.slice(0, 6).map((c) => c.hex)
	];
	return {
		roles,
		palette: [...new Set(palette)]
	};
}
/**
* Builds a complete theme from detected roles, deriving whatever wasn't found.
* @param {Record<string, string>} roles
* @param {{ softness?: number, boldness?: number, complementary?: boolean }} [variant]
*/
function themeFromRoles(roles, { softness = 0, boldness = 0, complementary = false } = {}) {
	const primary = roles.primary ?? "#334155";
	const [H, S] = toHsl(primary);
	const alt = complementary ? hsl(H + 180, Math.max(S, .45), .5) : roles["primary-alt"] ?? hsl(H + 30, Math.max(S, .4), .55);
	const [AH, AS] = toHsl(alt);
	const ink = roles.ink ?? hsl(H, .15, .13);
	let background = roles.background ?? hsl(H, Math.min(S, .5) * .4, .985);
	if (softness) background = hsl(H, Math.min(S, .6) * .5, .97);
	if (boldness) background = "#ffffff";
	const secondary = roles.secondary && !softness && !boldness ? roles.secondary : hsl(H, Math.min(S, .7) * (.6 + boldness * .3), .92 - boldness * .05);
	const data = Array.from({ length: 8 }, (_, i) => roles[`data-${i + 1}`] ?? hsl(H + 45 * (i + 1), Math.max(S, .5), .45));
	return completeTokens({
		primary,
		"primary-dark": hsl(H, Math.min(S, .7), .25),
		"primary-alt": alt,
		"on-primary": "#ffffff",
		background,
		surface: boldness ? "#ffffff" : roles.surface ?? "#ffffff",
		secondary,
		"on-secondary": hsl(H, Math.min(S, .8), .28),
		accent: hsl(AH, Math.min(AS, .7) * .6, .93),
		"on-accent": hsl(AH, Math.min(AS, .8), .3),
		border: hsl(H, Math.min(S, .4) * .5, .9),
		shadow: hsl(H, .4, .1),
		ink,
		"ink-secondary": roles["ink-secondary"] ?? withLightness(ink, Math.min(.45, lightness(ink) + .3)),
		"ink-muted": roles["ink-secondary"] ?? withLightness(ink, Math.min(.45, lightness(ink) + .32)),
		success: "#15803d",
		warning: "#b45309",
		danger: "#b91c1c",
		info: "#1d4ed8",
		...Object.fromEntries(data.map((hex, i) => [`data-${i + 1}`, hex]))
	});
}
var passing = (tokens) => ({
	...tokens,
	...fixAll(tokens)
});
/**
* Suggested themes for a scanned site, all named after it. "Scanned" keeps the colours as
* found; every other suggestion passes contrast.
* @param {{ roles: Record<string, string> }} scan
* @param {string} siteName
* @param {import('./tokens.js').Theme[]} [library]  generated library, for closest matches
*/
function suggestThemes(scan, siteName, library = []) {
	const stamp = Date.now().toString(36);
	const make = (key, name, tokens) => ({
		id: `scan-${stamp}-${key}`,
		name: `${siteName} ${name}`,
		site: true,
		scanned: true,
		tokens
	});
	const found = themeFromRoles(scan.roles);
	const themes = [make("found", "Scanned", found)];
	if (checkTheme(found).length) themes.push(make("accessible", "Accessible", passing(found)));
	themes.push(make("soft", "Soft", passing(themeFromRoles(scan.roles, { softness: 1 }))), make("bold", "Bold", passing(themeFromRoles(scan.roles, { boldness: 1 }))), make("complement", "Complementary", passing(themeFromRoles(scan.roles, { complementary: true }))));
	const matches = [...library].map((t) => ({
		t,
		d: deltaE(t.tokens.primary, found.primary) + .25 * deltaE(t.tokens["primary-alt"], found["primary-alt"])
	})).sort((a, b) => a.d - b.d).slice(0, 4).map(({ t }, i) => ({
		id: `scan-${stamp}-match-${i}`,
		name: t.name,
		site: true,
		scanned: true,
		match: true,
		tokens: t.tokens
	}));
	return [...themes, ...matches];
}
//#endregion
//#region src/recolour.js
var ATTR = "data-cbm";
/** Elements the engine never touches: the switcher itself. */
var SKIP$1 = "colorsbymax-root";
/**
* How colorsbymax finds a site's logo, to keep it in its own colours: an explicit
* data-colorsbymax-logo, "logo" in a class, id or label (but not "logout"), or common brand classes.
*/
var LOGO_SELECTOR = [
	"[data-colorsbymax-logo]",
	"[class~=\"logo\" i]",
	"[class*=\"logo-\" i]:not([class*=\"logout\" i])",
	"[class*=\"-logo\" i]",
	"[class*=\"_logo\" i]",
	"[class*=\"Logo\"]:not([class*=\"Logout\"])",
	"[id*=\"logo\" i]:not([id*=\"logout\" i])",
	"[aria-label*=\"logo\" i]",
	".brand",
	".navbar-brand",
	".site-title",
	".site-brand"
].join(", ");
/** Below this HSL saturation a colour counts as a grey and follows the background→text scale. */
var NEUTRAL_SATURATION = .12;
/** Colours within this many degrees of a brand hue are shades of it and follow the theme's version. */
var FAMILY_HUE = 35;
/** Colours within this many degrees of a status hue (and not brand) keep that meaning. */
var STATUS = [
	"success",
	"warning",
	"danger",
	"info"
];
var STATUS_HUE = 25;
/** Everything else coloured (categories, illustrations) maps to the nearest of these. */
var CATEGORIES = [
	...STATUS,
	"data-1",
	"data-2",
	"data-3",
	"data-4",
	"data-5",
	"data-6",
	"data-7",
	"data-8"
];
var SIDES = [
	"top",
	"right",
	"bottom",
	"left"
];
/**
* Contrast a swapped pair aims for (WCAG AA): 4.5:1 for text, 3:1 for icons. Never more than the
* site's own original pair had, so deliberately soft text and icons stay soft.
*/
var MIN_TEXT_CONTRAST = 4.5;
var MIN_ICON_CONTRAST = 3;
/** Painted colours that sit on a background, so are checked against it. */
var FOREGROUND = /* @__PURE__ */ new Set([
	"color",
	"fill",
	"stroke"
]);
/** Whether a background-image has any colours in it (gradients), rather than just images. */
var HAS_COLOUR = new RegExp(COLOR_IN_GRADIENT.source, "i");
var clamp$1 = (n, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, n));
/** Whether an element has text of its own, rather than only icons or child elements. */
var hasOwnText = (el) => [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
/**
* Whether a background image covers the element, so it counts as what's behind the element's
* content. Decorative strips (e.g. an animated underline sized "0% 2px") don't.
*/
var fillsElement = (cs) => Boolean(cs.backgroundImage && cs.backgroundImage !== "none") && cs.backgroundSize.split(",").some((size) => /^(auto|cover|contain|100% 100%|auto auto|100%)$/.test(size.trim()));
var hueDist = (a, b) => Math.min(Math.abs(a - b), 360 - Math.abs(a - b));
/** How far hue `a` is from `b`, signed, in -180..180. */
var signedHue = (a, b) => (a - b + 540) % 360 - 180;
var hslOf$1 = (hex) => rgbToHsl(hexToRgb(hex));
/** True when the site defines colorsbymax's variables itself, so no re-colouring is needed. */
function usesColourTokens() {
	return withoutAppliedTheme(() => getComputedStyle(document.documentElement).getPropertyValue("--color-primary").trim() !== "");
}
function createParser() {
	const ctx = Object.assign(document.createElement("canvas"), {
		width: 1,
		height: 1
	}).getContext("2d", { willReadFrequently: true });
	const cache = /* @__PURE__ */ new Map();
	return (css) => {
		if (!css || css === "none" || css === "transparent") return null;
		if (cache.has(css)) return cache.get(css);
		ctx.clearRect(0, 0, 1, 1);
		ctx.fillStyle = "#000";
		ctx.fillStyle = css;
		ctx.fillRect(0, 0, 1, 1);
		const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
		const out = a === 0 ? null : {
			hex: rgbToHex([
				r,
				g,
				b
			]),
			alpha: Math.round(a / 255 * 100) / 100
		};
		cache.set(css, out);
		return out;
	};
}
/**
* Starts re-colouring the page. Returns the site's own colours as tokens (`site`), `apply(tokens)`
* to show a theme (null restores the original look) and `stop()`.
*/
function createRecolourer() {
	const parse = createParser();
	const sheet = document.createElement("style");
	sheet.dataset.colorsbymax = "recolour";
	document.head.append(sheet);
	const site = themeFromRoles(inferRoles(collectColors()).roles);
	const siteBgL = hslOf$1(site.background)[2];
	const siteInkL = hslOf$1(site.ink)[2];
	/** Each distinct painted value, keyed "prop|value", plus the background under text and icons. */
	const entries = /* @__PURE__ */ new Map();
	let theme = null;
	const idFor = (prop, value, kind, backdrop = null, role = null) => {
		const key = `${prop}|${value}|${backdrop ?? ""}|${role ?? ""}`;
		let entry = entries.get(key);
		if (!entry) {
			entry = {
				id: `c${entries.size.toString(36)}`,
				prop,
				value,
				kind,
				backdrop,
				role
			};
			entries.set(key, entry);
			if (theme) pendingRules += rule(entry);
		}
		return entry.id;
	};
	let backdrops = /* @__PURE__ */ new WeakMap();
	const backdropOf = (el) => {
		if (!el || el.nodeType !== 1) return "rgb(255, 255, 255)";
		if (backdrops.has(el)) return backdrops.get(el);
		const cs = getComputedStyle(el);
		const own = parse(cs.backgroundColor);
		let value;
		if (own && own.alpha >= .5) value = cs.backgroundColor;
		else if (fillsElement(cs) && HAS_COLOUR.test(cs.backgroundImage)) value = cs.backgroundImage.match(HAS_COLOUR)[0];
		else value = el === document.documentElement ? "rgb(255, 255, 255)" : backdropOf(el.parentElement);
		backdrops.set(el, value);
		return value;
	};
	const read = (el) => {
		const cs = getComputedStyle(el);
		const ids = [];
		const role = el instanceof SVGElement || !hasOwnText(el) ? "icon" : "text";
		const colour = (prop, css, kind) => {
			if (!parse(css)) return;
			ids.push(FOREGROUND.has(prop) ? idFor(prop, css, kind, backdropOf(el), prop === "color" ? role : "icon") : idFor(prop, css, kind));
		};
		colour("background-color", cs.backgroundColor, "bg");
		colour("color", cs.color, "text");
		const image = cs.backgroundImage;
		if (image && image !== "none" && HAS_COLOUR.test(image)) {
			const clipText = cs.backgroundClip === "text" || cs.webkitBackgroundClip === "text";
			ids.push(idFor("background-image", image, clipText ? "text" : "bg"));
		}
		for (const side of SIDES) if (parseFloat(cs.getPropertyValue(`border-${side}-width`)) > 0 && cs.getPropertyValue(`border-${side}-style`) !== "none") colour(`border-${side}-color`, cs.getPropertyValue(`border-${side}-color`), "border");
		if (el instanceof SVGElement) {
			colour("fill", cs.fill, "text");
			colour("stroke", cs.stroke, "text");
		}
		return ids;
	};
	/** Tags `elements` (and optionally their descendants) with the colours they paint. */
	let pendingRules = "";
	const tag = (roots, deep) => {
		backdrops = /* @__PURE__ */ new WeakMap();
		withoutAppliedTheme(() => {
			for (const root of roots) {
				if (!(root instanceof Element) || root.closest(skip)) continue;
				const all = deep ? [root, ...root.querySelectorAll("*")] : [root];
				for (const el of all) {
					if (el.localName === SKIP$1) continue;
					if (el.closest(skip)) {
						el.removeAttribute(ATTR);
						continue;
					}
					const ids = read(el);
					if (ids.length) el.setAttribute(ATTR, ids.join(" "));
					else el.removeAttribute(ATTR);
				}
			}
		});
		if (pendingRules) {
			sheet.textContent += pendingRules;
			pendingRules = "";
		}
	};
	const mapHex = (css, kind) => {
		const c = parse(css);
		if (!c) return null;
		const [, s, l] = hslOf$1(c.hex);
		let hex;
		if (s < NEUTRAL_SATURATION) {
			const span = siteInkL - siteBgL;
			const t = Math.abs(span) < .05 ? l > .5 ? 0 : 1 : clamp$1((l - siteBgL) / span);
			hex = mix(theme.ink, theme.background, t);
		} else {
			const hue = hslOf$1(c.hex)[0];
			const near = (token, within) => hueDist(hue, hslOf$1(site[token])[0]) <= within;
			let anchor = near("primary", FAMILY_HUE) ? "primary" : null;
			if (!anchor && s >= .25) anchor = STATUS.filter((token) => near(token, STATUS_HUE)).sort((a, b) => hueDist(hue, hslOf$1(site[a])[0]) - hueDist(hue, hslOf$1(site[b])[0]))[0] ?? null;
			if (!anchor && near("primary-alt", FAMILY_HUE)) anchor = "primary-alt";
			if (!anchor) {
				let bestD = Infinity;
				for (const token of CATEGORIES) {
					const d = deltaE(c.hex, site[token]);
					if (d < bestD) [anchor, bestD] = [token, d];
				}
			}
			const [sh, ss, sl] = hslOf$1(site[anchor]);
			const [th, ts, tl] = hslOf$1(theme[anchor]);
			const themeBgL = hslOf$1(theme.background)[2];
			const themeInkL = hslOf$1(theme.ink)[2];
			const toBg = sl - siteBgL;
			const toInk = siteInkL - sl;
			const u = Math.abs(toBg) < .05 ? null : (l - siteBgL) / toBg;
			let lightness;
			if (u === null) lightness = tl + (l - sl);
			else if (u <= 1) lightness = themeBgL + clamp$1(u, -.5, 1) * (tl - themeBgL);
			else lightness = tl + (Math.abs(toInk) < .05 ? 0 : clamp$1((l - sl) / toInk)) * (themeInkL - tl);
			const saturation = ts * (s / Math.max(ss, .05));
			hex = rgbToHex(hslToRgb([
				(th + signedHue(hue, sh) + 360) % 360,
				clamp$1(saturation),
				clamp$1(lightness)
			]));
		}
		return {
			hex,
			alpha: c.alpha
		};
	};
	const format = ({ hex, alpha }) => {
		if (alpha >= 1) return hex;
		const [r, g, b] = hexToRgb(hex);
		return `rgba(${r}, ${g}, ${b}, ${alpha})`;
	};
	const mapColour = (css, kind) => {
		const mapped = mapHex(css, kind);
		return mapped ? format(mapped) : css;
	};
	const readable = (fg, bg, target, lighter) => {
		const ratio = (c) => contrastRatio(c, bg);
		if (ratio(fg) >= target - .05) return fg;
		const pool = [
			fg,
			theme.background,
			theme.surface,
			theme.ink,
			theme["on-primary"],
			theme["on-secondary"],
			"#ffffff",
			"#000000"
		];
		const sameSide = pool.filter((c) => luminance(c) > luminance(bg) === lighter);
		const nearest = (list) => list.reduce((a, c) => deltaE(c, fg) < deltaE(a, fg) ? c : a);
		const strongest = (list) => list.reduce((a, c) => ratio(c) > ratio(a) ? c : a);
		const passing = sameSide.filter((c) => ratio(c) >= target);
		if (passing.length) return nearest(passing);
		if (sameSide.length && ratio(strongest(sameSide)) >= Math.min(target, MIN_ICON_CONTRAST)) return strongest(sameSide);
		const flipped = pool.filter((c) => ratio(c) >= target);
		return flipped.length ? nearest(flipped) : strongest(pool);
	};
	const rule = (entry) => {
		let value;
		if (entry.prop === "background-image") value = entry.value.replace(COLOR_IN_GRADIENT, (stop) => mapColour(stop, entry.kind));
		else if (entry.backdrop) {
			const fg = mapHex(entry.value, entry.kind);
			const bg = mapHex(entry.backdrop, "bg");
			const original = {
				fg: parse(entry.value)?.hex,
				bg: parse(entry.backdrop)?.hex
			};
			if (fg && bg && original.fg && original.bg) {
				const aim = entry.role === "text" ? MIN_TEXT_CONTRAST : MIN_ICON_CONTRAST;
				const target = Math.min(aim, contrastRatio(original.fg, original.bg));
				const lighter = luminance(original.fg) > luminance(original.bg);
				value = format({
					...fg,
					hex: readable(fg.hex, bg.hex, target, lighter)
				});
			} else value = mapColour(entry.value, entry.kind);
		} else value = mapColour(entry.value, entry.kind);
		return `[${ATTR}~="${entry.id}"]{${entry.prop}:${value}!important}`;
	};
	let skip = `${SKIP$1}, ${LOGO_SELECTOR}`;
	tag([document.body], true);
	const observer = new MutationObserver((records) => {
		const added = [];
		const changed = /* @__PURE__ */ new Set();
		for (const r of records) {
			if (r.type === "childList") {
				for (const n of r.addedNodes) if (n.nodeType === 1) added.push(n);
			}
			if (r.type === "attributes") changed.add(r.target);
		}
		if (added.length) tag(added, true);
		if (changed.size) tag([...changed], true);
	});
	observer.observe(document.body, {
		subtree: true,
		childList: true,
		attributes: true,
		attributeFilter: ["class", "style"]
	});
	return {
		site,
		/** Shows `tokens` in place of the site's colours; null brings back the original look. */
		apply(tokens) {
			theme = tokens;
			sheet.textContent = tokens ? [...entries.values()].map(rule).join("") : "";
		},
		/** Whether the logo is re-coloured with the rest (off keeps it in its own colours). */
		setLogoColouring(on) {
			const next = on ? SKIP$1 : `${SKIP$1}, ${LOGO_SELECTOR}`;
			if (next === skip) return;
			skip = next;
			tag([document.body], true);
		},
		stop() {
			observer.disconnect();
			sheet.remove();
			for (const el of document.querySelectorAll(`[${ATTR}]`)) el.removeAttribute(ATTR);
		}
	};
}
//#endregion
//#region src/storage.js
var DEFAULT_STORAGE_KEY = "colorsbymax";
var VERSION = 1;
/**
* @typedef {Object} ThemeState
* @property {string} activeId                         Theme id (site, pick, library or custom)
* @property {Partial<import('./tokens.js').ThemeTokens>} overrides
* @property {import('./tokens.js').Theme[]} customs
* @property {import('./tokens.js').Theme | null} snapshot  Copy of the active library theme, so it
*   resolves on load without downloading the whole library
* @property {{ at: number, palette: string[], themes: import('./tokens.js').Theme[] } | null} scanned
*   Result of the last site scan
*/
/** @returns {ThemeState} */
var initialState = (defaultId) => ({
	activeId: defaultId,
	overrides: {},
	customs: [],
	snapshot: null,
	scanned: null
});
/** Keeps only known token keys with valid hex values. */
function sanitizeTokens(input) {
	const out = {};
	if (!input || typeof input !== "object") return out;
	for (const key of TOKEN_KEYS) {
		const hex = normalizeHex(input[key]);
		if (hex) out[key] = hex;
	}
	return out;
}
/**
* @param {string} storageKey
* @param {import('./tokens.js').Theme} defaultTheme  fills missing tokens and is the fallback
* @returns {ThemeState}
*/
function loadState(storageKey, defaultTheme) {
	const fresh = initialState(defaultTheme.id);
	try {
		const raw = window.localStorage.getItem(storageKey);
		if (!raw) return fresh;
		const data = JSON.parse(raw);
		if (!data || data.v !== VERSION) return fresh;
		const complete = (tokens) => completeTokens(sanitizeTokens(tokens), defaultTheme.tokens);
		const customs = Array.isArray(data.customs) ? data.customs.filter((c) => c && typeof c.id === "string" && typeof c.name === "string").map((c) => ({
			id: c.id,
			name: c.name,
			custom: true,
			tokens: complete(c.tokens)
		})) : [];
		const snap = data.snapshot;
		const snapshot = snap && typeof snap.id === "string" && typeof snap.name === "string" ? {
			id: snap.id,
			name: snap.name,
			tokens: complete(snap.tokens)
		} : null;
		const sc = data.scanned;
		const scanned = sc && Array.isArray(sc.themes) ? {
			at: Number(sc.at) || 0,
			palette: Array.isArray(sc.palette) ? sc.palette.map(normalizeHex).filter(Boolean) : [],
			themes: sc.themes.filter((t) => t && typeof t.id === "string" && typeof t.name === "string").map((t) => ({
				id: t.id,
				name: t.name,
				site: true,
				scanned: true,
				match: Boolean(t.match),
				tokens: complete(t.tokens)
			}))
		} : null;
		return {
			activeId: typeof data.activeId === "string" ? data.activeId : defaultTheme.id,
			overrides: sanitizeTokens(data.overrides),
			customs,
			snapshot,
			scanned
		};
	} catch {
		return fresh;
	}
}
/**
* Persists state plus the fully resolved tokens, so the pre-paint script can apply
* them without knowing about presets.
*/
function saveState(storageKey, state, resolved) {
	try {
		window.localStorage.setItem(storageKey, JSON.stringify({
			v: VERSION,
			...state,
			resolved
		}));
	} catch {}
}
/**
* Where the visitor dragged the colour button, as fractions (0–1) of the space it can move in,
* so it keeps its relative spot when the window resizes. Null means the default corner.
* @returns {{ rx: number, ry: number } | null}
*/
function loadButtonPosition(storageKey) {
	try {
		const p = JSON.parse(window.localStorage.getItem(`${storageKey}:button`) || "null");
		const ok = (n) => typeof n === "number" && n >= 0 && n <= 1;
		return p && ok(p.rx) && ok(p.ry) ? {
			rx: p.rx,
			ry: p.ry
		} : null;
	} catch {
		return null;
	}
}
function saveButtonPosition(storageKey, position) {
	try {
		if (position) window.localStorage.setItem(`${storageKey}:button`, JSON.stringify(position));
		else window.localStorage.removeItem(`${storageKey}:button`);
	} catch {}
}
/**
* Inline script for the document <head> that applies the saved theme before first paint,
* avoiding a flash of the default. Embed it as a classic (non-module) <script>.
*/
function prePaintScript(storageKey = DEFAULT_STORAGE_KEY) {
	return `(function(){try{var s=JSON.parse(localStorage.getItem(${JSON.stringify(storageKey)})||'null');var t=s&&s.v===${VERSION}&&s.resolved;if(!t||typeof t!=='object')return;var d=document.documentElement.style;for(var k in t){var v=t[k];if(/^[a-z0-9-]+$/.test(k)&&/^#[0-9a-f]{6}$/i.test(v))d.setProperty('--color-'+k,v)}}catch(e){}})()`;
}
//#endregion
//#region src/ThemeProvider.jsx
var ThemeContext = createContext(null);
/** Writes each token to `--color-<key>` on <html>. Tailwind v4 utilities read these directly. */
function applyTokens(tokens) {
	const style = document.documentElement.style;
	for (const key of TOKEN_KEYS) style.setProperty(`--color-${key}`, tokens[key]);
}
/** Scrollbar thumb: the theme's primary, softened towards its page background. */
var SCROLLBAR_THUMB = "color-mix(in srgb, var(--color-primary) 55%, var(--color-background))";
var newId = () => `custom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
/**
* @typedef {Object} ColorsByMaxConfig
* @property {string} [siteName]      Shown as the first theme group, e.g. "Tsungi"
* @property {string} [storageKey]    localStorage key; must match the pre-paint script
* @property {{ name: string, tokens: Partial<import('./tokens.js').ThemeTokens> }} [defaultTheme]
*   The site's own shipped colours
* @property {{ id: string, name: string, tokens: Partial<import('./tokens.js').ThemeTokens> }[]} [themes]
*   Extra themes made for this site
* @property {Partial<Record<import('./tokens.js').TokenKey, string>>} [usage]
*   Where each token is used on this site, shown in the editors
* @property {boolean} [scrollbars]  Colour the page's scrollbars from the theme (default true)
* @property {() => Promise<any>} [pdf]  Enables PDF uploads: pass `loadPdf` from 'colorsbymax/pdf'
* @property {boolean} [intro]  Bring the colour button in with a short pop and burst of the theme's
*   colours, a moment after the page loads (default true). Reduced motion fades it in instead.
* @property {boolean} [hidden]  Hide the colour button and panel; the theme still applies. Use
*   `hidden: import.meta.env.PROD` to keep it out of production once the colours are chosen.
* @property {'bottom-right' | 'bottom-left' | 'top-left' | 'top-right'} [position]  Where the colour
*   button starts (default 'bottom-right'). 'top-right' sits under a floating nav bar.
* @property {boolean | 'auto'} [recolour]  Re-colour a site that doesn't paint with the --color-*
*   variables, by swapping the colours actually on the page. 'auto' (default) does it only when
*   the site doesn't define --color-primary itself.
*/
/**
* Resolves a config into the site theme group. The shipped default always comes first. Without
* one, a re-coloured site's own colours (read from the page) are its default.
*/
function resolveSite(config, pageColours) {
	const siteName = config.siteName || detectSiteName();
	const defaultTheme = {
		id: "site-default",
		name: config.defaultTheme?.name || `${siteName} ${pageColours ? "original" : "default"}`,
		site: true,
		tokens: config.defaultTheme ? completeTokens(sanitizeTokens(config.defaultTheme.tokens)) : pageColours ?? BASE_TOKENS
	};
	const extra = (config.themes ?? []).map((t) => ({
		id: `site-${t.id}`,
		name: t.name,
		site: true,
		tokens: completeTokens(sanitizeTokens(t.tokens), defaultTheme.tokens)
	}));
	const fixes = fixAll(defaultTheme.tokens);
	const accessible = Object.keys(fixes).length ? [{
		id: "site-accessible",
		name: `${defaultTheme.name} (accessible)`,
		site: true,
		tokens: {
			...defaultTheme.tokens,
			...fixes
		}
	}] : [];
	const pageOriginal = pageColours && config.defaultTheme ? [{
		id: "site-original",
		name: `${siteName} original`,
		site: true,
		tokens: pageColours
	}] : [];
	return {
		siteName,
		defaultTheme,
		siteThemes: [
			defaultTheme,
			...accessible,
			...pageOriginal,
			...extra
		]
	};
}
/** @param {{ config?: ColorsByMaxConfig, children: import('react').ReactNode }} props */
function ThemeProvider({ config = {}, children }) {
	const storageKey = config.storageKey || "colorsbymax";
	const [initialConfig] = useState(config);
	const [pageColours, setPageColours] = useState(null);
	const site = useMemo(() => resolveSite(initialConfig, pageColours), [initialConfig, pageColours]);
	const { siteName, defaultTheme } = site;
	const [state, setState] = useState(() => loadState(storageKey, defaultTheme));
	const siteThemes = useMemo(() => [...site.siteThemes, ...state.scanned?.themes ?? []], [site.siteThemes, state.scanned]);
	const allThemes = useMemo(() => [
		...siteThemes,
		...PRESETS,
		...state.customs
	], [siteThemes, state.customs]);
	const find = (id) => allThemes.find((t) => t.id === id);
	const lightOfTwin = state.activeId.endsWith("~dark") ? find(state.activeId.slice(0, -DARK_SUFFIX.length)) : null;
	const base = find(state.activeId) ?? (lightOfTwin ? toDark(lightOfTwin) : null) ?? (state.snapshot?.id === state.activeId ? state.snapshot : null) ?? defaultTheme;
	const tokens = useMemo(() => ({
		...base.tokens,
		...state.overrides
	}), [base, state.overrides]);
	const issues = useMemo(() => checkTheme(tokens), [tokens]);
	useLayoutEffect(() => {
		applyTokens(tokens);
		saveState(storageKey, {
			...state,
			activeId: base.id
		}, tokens);
	}, [
		tokens,
		state,
		base.id,
		storageKey
	]);
	const recolourMode = initialConfig.recolour ?? "auto";
	const recolourer = useRef(null);
	useLayoutEffect(() => {
		if (recolourMode === false || recolourMode === "auto" && usesColourTokens()) return;
		const engine = createRecolourer();
		recolourer.current = engine;
		setPageColours(engine.site);
		return () => {
			engine.stop();
			recolourer.current = null;
		};
	}, [recolourMode]);
	const [logoColouring, setLogoColouring] = useState(false);
	useLayoutEffect(() => {
		recolourer.current?.setLogoColouring(logoColouring);
	}, [logoColouring, pageColours]);
	useLayoutEffect(() => {
		if (logoColouring || pageColours) return;
		const style = document.createElement("style");
		style.dataset.colorsbymax = "logo";
		style.textContent = `:is(${LOGO_SELECTOR}){${TOKEN_KEYS.map((k) => `--color-${k}:${defaultTheme.tokens[k]}`).join(";")}}`;
		document.head.append(style);
		return () => style.remove();
	}, [
		logoColouring,
		pageColours,
		defaultTheme
	]);
	const original = (base.id === "site-original" || base.id === defaultTheme.id && !initialConfig.defaultTheme) && !Object.keys(state.overrides).length;
	useLayoutEffect(() => {
		recolourer.current?.apply(original ? null : tokens);
	}, [
		tokens,
		original,
		pageColours
	]);
	const themeScrollbars = config.scrollbars !== false;
	useLayoutEffect(() => {
		if (!themeScrollbars) return;
		const style = document.createElement("style");
		style.dataset.colorsbymax = "scrollbars";
		style.textContent = `:where(html){scrollbar-color:${SCROLLBAR_THUMB} var(--color-background)}`;
		document.head.append(style);
		return () => style.remove();
	}, [themeScrollbars]);
	const updateCustom = (id, fn) => (s) => ({
		...s,
		customs: s.customs.map((c) => c.id === id ? fn(c) : c)
	});
	/**
	* Sets one token wherever it currently comes from: an existing override, otherwise the
	* active custom palette, otherwise a new override on top of the active theme.
	*/
	const setToken = useCallback((key, value) => setState((s) => {
		const active = s.customs.find((c) => c.id === s.activeId);
		if (key in s.overrides || !active) return {
			...s,
			overrides: {
				...s.overrides,
				[key]: value
			}
		};
		return updateCustom(active.id, (c) => ({
			...c,
			tokens: {
				...c.tokens,
				[key]: value
			}
		}))(s);
	}), []);
	const api = {
		state,
		storageKey,
		siteName,
		usage: initialConfig.usage ?? {},
		loadPdf: initialConfig.pdf ?? null,
		position: initialConfig.position ?? "bottom-right",
		/** True when the config hides the switcher (e.g. in production); the theme still applies. */
		hidden: Boolean(initialConfig.hidden),
		/** Whether the colour button makes an entrance when it first appears. */
		intro: initialConfig.intro !== false,
		/** True when colorsbymax is swapping the page's own colours (the site isn't wired to tokens). */
		recolouring: Boolean(pageColours),
		/** Turns re-colouring of the site's logo on or off (the switcher's "Colour the logo" setting). */
		setLogoColouring,
		siteThemes,
		defaultTheme,
		presets: PRESETS,
		customs: state.customs,
		themes: allThemes,
		active: base,
		tokens,
		issues,
		/** Selects a theme by id; pass the theme itself for library themes and dark twins. */
		selectTheme: (id, theme) => setState((s) => ({
			...s,
			activeId: id,
			snapshot: theme?.library || theme?.derived ? {
				id: theme.id,
				name: theme.name,
				tokens: theme.tokens
			} : s.snapshot
		})),
		createCustom: (name) => {
			const id = newId();
			setState((s) => ({
				...s,
				activeId: id,
				overrides: {},
				customs: [...s.customs, {
					id,
					name: name.trim() || "My palette",
					custom: true,
					tokens: { ...tokens }
				}]
			}));
			return id;
		},
		updateCustomToken: (id, key, value) => setState(updateCustom(id, (c) => ({
			...c,
			tokens: {
				...c.tokens,
				[key]: value
			}
		}))),
		renameCustom: (id, name) => setState(updateCustom(id, (c) => ({
			...c,
			name
		}))),
		deleteCustom: (id) => setState((s) => ({
			...s,
			customs: s.customs.filter((c) => c.id !== id),
			activeId: s.activeId === id ? defaultTheme.id : s.activeId
		})),
		setOverride: (key, value) => setState((s) => ({
			...s,
			overrides: {
				...s.overrides,
				[key]: value
			}
		})),
		clearOverride: (key) => setState((s) => {
			const { [key]: _removed, ...rest } = s.overrides;
			return {
				...s,
				overrides: rest
			};
		}),
		clearOverrides: () => setState((s) => ({
			...s,
			overrides: {}
		})),
		resetToDefault: () => setState((s) => ({
			...s,
			activeId: defaultTheme.id,
			overrides: {}
		})),
		scanned: state.scanned,
		/**
		* Reads the colours painted on the page (ignoring the applied theme) and adds themes built
		* around them to the site group. Returns a short summary for the UI.
		*/
		runScan: async () => {
			const found = inferRoles(collectColors());
			let library = [];
			try {
				library = (await loadLibrary()).themes;
			} catch {}
			const themes = suggestThemes(found, siteName, library);
			setState((s) => ({
				...s,
				scanned: {
					at: Date.now(),
					palette: found.palette,
					themes
				}
			}));
			return {
				colours: found.palette.length,
				themes: themes.length
			};
		},
		clearScan: () => setState((s) => ({
			...s,
			scanned: null
		})),
		fixIssue: (issue) => {
			const fix = suggestFix(issue.pairing, tokens);
			if (fix) setToken(fix.key, fix.value);
			return Boolean(fix);
		},
		fixAllIssues: () => {
			for (const [key, value] of Object.entries(fixAll(tokens))) setToken(key, value);
		},
		exportTheme: () => JSON.stringify({
			name: base.name + (Object.keys(state.overrides).length ? " (edited)" : ""),
			tokens
		}, null, 2),
		/** Imports `{ name, tokens }` JSON as a new custom palette. Returns an error string or null. */
		importTheme: (json) => {
			let data;
			try {
				data = JSON.parse(json);
			} catch {
				return "That isn’t valid JSON.";
			}
			const clean = sanitizeTokens(data?.tokens);
			if (!Object.keys(clean).length) return "No recognised colour tokens found. Expected { \"name\": …, \"tokens\": { \"primary\": \"#…\" } }.";
			api.addPalette(typeof data.name === "string" ? data.name : "", clean);
			return null;
		},
		/** Adds tokens as a new custom palette (missing ones filled from the site) and applies it. */
		addPalette: (name, partialTokens) => {
			const id = newId();
			const clean = sanitizeTokens(partialTokens);
			setState((s) => ({
				...s,
				activeId: id,
				overrides: {},
				customs: [...s.customs, {
					id,
					name: name.trim().slice(0, 60) || "Imported palette",
					custom: true,
					tokens: completeTokens(clean, defaultTheme.tokens)
				}]
			}));
			return id;
		}
	};
	return /* @__PURE__ */ jsx(ThemeContext.Provider, {
		value: api,
		children
	});
}
function useTheme() {
	const ctx = useContext(ThemeContext);
	if (!ctx) throw new Error("useTheme must be used inside <ThemeProvider>");
	return ctx;
}
//#endregion
//#region src/icons.jsx
/** A Lucide-style icon: 24×24, drawn with currentColor strokes, sized by className. */
function icon(slug, shapes) {
	const Icon = ({ className = "", ...props }) => /* @__PURE__ */ jsx("svg", {
		xmlns: "http://www.w3.org/2000/svg",
		width: "24",
		height: "24",
		viewBox: "0 0 24 24",
		fill: "none",
		stroke: "currentColor",
		strokeWidth: "2",
		strokeLinecap: "round",
		strokeLinejoin: "round",
		className: `lucide lucide-${slug} ${className}`.trim(),
		...props,
		children: shapes.map(([tag, attrs], i) => createElement(tag, {
			key: i,
			...attrs
		}))
	});
	Icon.displayName = slug;
	return Icon;
}
var AlertTriangle = icon("triangle-alert", [
	["path", { "d": "m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" }],
	["path", { "d": "M12 9v4" }],
	["path", { "d": "M12 17h.01" }]
]);
var ArrowLeft = icon("arrow-left", [["path", { "d": "m12 19-7-7 7-7" }], ["path", { "d": "M19 12H5" }]]);
var Check = icon("check", [["path", { "d": "M20 6 9 17l-5-5" }]]);
var CheckCircle2 = icon("circle-check", [["circle", {
	"cx": "12",
	"cy": "12",
	"r": "10"
}], ["path", { "d": "m16 9-5.5 5.5L8 12" }]]);
var ChevronRight = icon("chevron-right", [["path", { "d": "m9 18 6-6-6-6" }]]);
var Copy = icon("copy", [["rect", {
	"width": "14",
	"height": "14",
	"x": "8",
	"y": "8",
	"rx": "2",
	"ry": "2"
}], ["path", { "d": "M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" }]]);
var Download = icon("download", [
	["path", { "d": "M12 15V3" }],
	["path", { "d": "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" }],
	["path", { "d": "m7 10 5 5 5-5" }]
]);
var Globe = icon("globe", [
	["circle", {
		"cx": "12",
		"cy": "12",
		"r": "10"
	}],
	["path", { "d": "M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" }],
	["path", { "d": "M2 12h20" }]
]);
var ImageUp = icon("image-up", [
	["path", { "d": "M10.3 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10l-3.1-3.1a2 2 0 0 0-2.814.014L6 21" }],
	["path", { "d": "m14 19.5 3-3 3 3" }],
	["path", { "d": "M17 22v-5.5" }],
	["circle", {
		"cx": "9",
		"cy": "9",
		"r": "2"
	}]
]);
var Loader2 = icon("loader-circle", [["path", { "d": "M21 12a9 9 0 1 1-6.219-8.56" }]]);
var Monitor = icon("monitor", [
	["rect", {
		"width": "20",
		"height": "14",
		"x": "2",
		"y": "3",
		"rx": "2"
	}],
	["line", {
		"x1": "8",
		"x2": "16",
		"y1": "21",
		"y2": "21"
	}],
	["line", {
		"x1": "12",
		"x2": "12",
		"y1": "17",
		"y2": "21"
	}]
]);
var Moon = icon("moon", [["path", { "d": "M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.46.402.803a6 6 0 0 0 8.268 8.268c.344-.215.825-.004.803.401" }]]);
var Paintbrush = icon("paintbrush", [
	["path", { "d": "m14.622 17.897-10.68-2.913" }],
	["path", { "d": "M18.376 2.622a1 1 0 1 1 3.002 3.002L17.36 9.643a.5.5 0 0 0 0 .707l.944.944a2.41 2.41 0 0 1 0 3.408l-.944.944a.5.5 0 0 1-.707 0L8.354 7.348a.5.5 0 0 1 0-.707l.944-.944a2.41 2.41 0 0 1 3.408 0l.944.944a.5.5 0 0 0 .707 0z" }],
	["path", { "d": "M9 8c-1.804 2.71-3.97 3.46-6.583 3.948a.507.507 0 0 0-.302.819l7.32 8.883a1 1 0 0 0 1.185.204C12.735 20.405 16 16.792 16 15" }]
]);
var Palette = icon("palette", [
	["path", { "d": "M12 22a1 1 0 0 1 0-20 10 9 0 0 1 10 9 5 5 0 0 1-5 5h-2.25a1.75 1.75 0 0 0-1.4 2.8l.3.4a1.75 1.75 0 0 1-1.4 2.8z" }],
	["circle", {
		"cx": "13.5",
		"cy": "6.5",
		"r": ".5",
		"fill": "currentColor"
	}],
	["circle", {
		"cx": "17.5",
		"cy": "10.5",
		"r": ".5",
		"fill": "currentColor"
	}],
	["circle", {
		"cx": "6.5",
		"cy": "12.5",
		"r": ".5",
		"fill": "currentColor"
	}],
	["circle", {
		"cx": "8.5",
		"cy": "7.5",
		"r": ".5",
		"fill": "currentColor"
	}]
]);
var RotateCcw = icon("rotate-ccw", [["path", { "d": "M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" }], ["path", { "d": "M3 3v5h5" }]]);
var ScanLine = icon("scan-line", [
	["path", { "d": "M3 7V5a2 2 0 0 1 2-2h2" }],
	["path", { "d": "M17 3h2a2 2 0 0 1 2 2v2" }],
	["path", { "d": "M21 17v2a2 2 0 0 1-2 2h-2" }],
	["path", { "d": "M7 21H5a2 2 0 0 1-2-2v-2" }],
	["path", { "d": "M7 12h10" }]
]);
var Settings = icon("settings", [["path", { "d": "M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915" }], ["circle", {
	"cx": "12",
	"cy": "12",
	"r": "3"
}]]);
var Shuffle = icon("shuffle", [
	["path", { "d": "m18 14 4 4-4 4" }],
	["path", { "d": "m18 2 4 4-4 4" }],
	["path", { "d": "M2 18h1.973a4 4 0 0 0 3.3-1.7l5.454-8.6a4 4 0 0 1 3.3-1.7H22" }],
	["path", { "d": "M2 6h1.972a4 4 0 0 1 3.6 2.2" }],
	["path", { "d": "M22 18h-6.041a4 4 0 0 1-3.3-1.8l-.359-.45" }]
]);
var Sun = icon("sun", [
	["circle", {
		"cx": "12",
		"cy": "12",
		"r": "4"
	}],
	["path", { "d": "M12 2v2" }],
	["path", { "d": "M12 20v2" }],
	["path", { "d": "m4.93 4.93 1.41 1.41" }],
	["path", { "d": "m17.66 17.66 1.41 1.41" }],
	["path", { "d": "M2 12h2" }],
	["path", { "d": "M20 12h2" }],
	["path", { "d": "m6.34 17.66-1.41 1.41" }],
	["path", { "d": "m19.07 4.93-1.41 1.41" }]
]);
var Trash2 = icon("trash", [
	["path", { "d": "M10 11v6" }],
	["path", { "d": "M14 11v6" }],
	["path", { "d": "M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" }],
	["path", { "d": "M3 6h18" }],
	["path", { "d": "M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" }]
]);
var Upload = icon("upload", [
	["path", { "d": "M12 3v12" }],
	["path", { "d": "m17 8-5-5-5 5" }],
	["path", { "d": "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" }]
]);
var UserRound = icon("user-round", [["circle", {
	"cx": "12",
	"cy": "8",
	"r": "5"
}], ["path", { "d": "M20 21a8 8 0 0 0-16 0" }]]);
var Wand2 = icon("wand-sparkles", [
	["path", { "d": "m21.64 3.64-1.28-1.28a1.21 1.21 0 0 0-1.72 0L2.36 18.64a1.21 1.21 0 0 0 0 1.72l1.28 1.28a1.2 1.2 0 0 0 1.72 0L21.64 5.36a1.2 1.2 0 0 0 0-1.72" }],
	["path", { "d": "m14 7 3 3" }],
	["path", { "d": "M5 6v4" }],
	["path", { "d": "M19 14v4" }],
	["path", { "d": "M10 2v2" }],
	["path", { "d": "M7 8H3" }],
	["path", { "d": "M21 16h-4" }],
	["path", { "d": "M11 3H9" }]
]);
var X = icon("x", [["path", { "d": "M18 6 6 18" }], ["path", { "d": "m6 6 12 12" }]]);
var ScanSearch = icon("scan-search", [
	["path", { "d": "M3 7V5a2 2 0 0 1 2-2h2" }],
	["path", { "d": "M17 3h2a2 2 0 0 1 2 2v2" }],
	["path", { "d": "M21 17v2a2 2 0 0 1-2 2h-2" }],
	["path", { "d": "M7 21H5a2 2 0 0 1-2-2v-2" }],
	["circle", {
		"cx": "12",
		"cy": "12",
		"r": "3"
	}],
	["path", { "d": "m16 16-1.9-1.9" }]
]);
var Contrast = icon("contrast", [["circle", {
	"cx": "12",
	"cy": "12",
	"r": "10"
}], ["path", { "d": "M12 18a6 6 0 0 0 0-12v12z" }]]);
var ClipboardPaste = icon("clipboard-paste", [
	["path", { "d": "M11 14h10" }],
	["path", { "d": "M16 4h2a2 2 0 0 1 2 2v1.344" }],
	["path", { "d": "m17 18 4-4-4-4" }],
	["path", { "d": "M8 4H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 1.793-1.113" }],
	["rect", {
		"x": "8",
		"y": "2",
		"width": "8",
		"height": "4",
		"rx": "1"
	}]
]);
/** Images are scaled down to at most this many pixels on their longest side before sampling. */
var SAMPLE_SIZE = 200;
/** PDF pages read, from the first. */
var MAX_PDF_PAGES = 3;
/** Colours closer than this (CIE76 ΔE) count as one. */
var MERGE_DELTA_E = 12;
/** Colours covering less than this share of the sampled pixels are ignored. */
var MIN_SHARE = .004;
/** How close (CIE76 ΔE) a colour must be to a mix of two others to count as their edge blend. */
var BLEND_DELTA_E = 6;
var HEX_IN_TEXT = /#([0-9a-f]{6}|[0-9a-f]{3})\b/gi;
var hslOf = (hex) => rgbToHsl(hexToRgb(hex));
/**
* The main colours in an image or PDF, most important first.
* @param {File} file
* @param {{ loadPdf?: (() => Promise<any>) | null }} [options]  PDF support, from 'colorsbymax/pdf'
* @returns {Promise<{ colours: string[], from: 'image' | 'pdf-text' | 'pdf' }>}
*/
async function coloursFromFile(file, { loadPdf = null } = {}) {
	if (file.size > 26214400) throw new Error("That file is over 25 MB. Try a smaller one.");
	if (file.type === "application/pdf" || /\.pdf$/i.test(file.name)) {
		if (!loadPdf) throw new Error("PDFs aren’t supported on this site. Try an image of the palette instead.");
		return coloursFromPdf(file, loadPdf);
	}
	if (!file.type.startsWith("image/")) throw new Error(`Choose an image (PNG, JPG, WebP, SVG…)${loadPdf ? " or a PDF" : ""}.`);
	const bitmap = await loadImage(file);
	return {
		colours: dominantColours([pixelsOf(bitmap, bitmap.width, bitmap.height)]),
		from: "image"
	};
}
function loadImage(file) {
	return new Promise((resolve, reject) => {
		const url = URL.createObjectURL(file);
		const img = new Image();
		img.onload = () => {
			URL.revokeObjectURL(url);
			resolve(img);
		};
		img.onerror = () => {
			URL.revokeObjectURL(url);
			reject(/* @__PURE__ */ new Error("Couldn’t read that image. Try a PNG or JPG."));
		};
		img.src = url;
	});
}
/** Draws a source scaled down to SAMPLE_SIZE and returns its RGBA pixels. */
function pixelsOf(source, width, height) {
	const scale = Math.min(1, SAMPLE_SIZE / Math.max(width, height));
	const canvas = document.createElement("canvas");
	canvas.width = Math.max(1, Math.round(width * scale));
	canvas.height = Math.max(1, Math.round(height * scale));
	const ctx = canvas.getContext("2d", { willReadFrequently: true });
	ctx.imageSmoothingEnabled = false;
	ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
	return ctx.getImageData(0, 0, canvas.width, canvas.height).data;
}
/**
* Buckets pixels into a coarse colour grid, then folds similar buckets together and keeps the
* ones covering a real share of the picture.
* @param {Uint8ClampedArray[]} pixelSets
*/
function dominantColours(pixelSets) {
	const buckets = /* @__PURE__ */ new Map();
	let total = 0;
	for (const data of pixelSets) for (let i = 0; i < data.length; i += 4) {
		if (data[i + 3] < 128) continue;
		const key = data[i] >> 3 << 10 | data[i + 1] >> 3 << 5 | data[i + 2] >> 3;
		let b = buckets.get(key);
		if (!b) buckets.set(key, b = {
			r: 0,
			g: 0,
			b: 0,
			n: 0
		});
		b.r += data[i];
		b.g += data[i + 1];
		b.b += data[i + 2];
		b.n++;
		total++;
	}
	const merged = [];
	for (const b of [...buckets.values()].sort((x, y) => y.n - x.n)) {
		const hex = rgbToHex([
			b.r / b.n,
			b.g / b.n,
			b.b / b.n
		].map(Math.round));
		const into = merged.find((m) => deltaE(m.hex, hex) < MERGE_DELTA_E);
		if (into) into.n += b.n;
		else merged.push({
			hex,
			n: b.n
		});
	}
	const kept = [];
	for (const m of merged.filter((m) => m.n / total >= MIN_SHARE).sort((a, b) => b.n - a.n)) if (!isEdgeBlend(m, kept)) kept.push(m);
	return kept.slice(0, 8).map((m) => m.hex);
}
/**
* True for a colour that is just the anti-aliased edge between two much more common ones:
* it sits on the line between them and covers far less of the picture.
*/
function isEdgeBlend(m, kept) {
	for (const a of kept) for (const b of kept) {
		if (a === b || m.n * 3 > Math.min(a.n, b.n)) continue;
		for (let t = .15; t <= .85; t += .05) if (deltaE(m.hex, mix(a.hex, b.hex, t)) < BLEND_DELTA_E) return true;
	}
	return false;
}
async function coloursFromPdf(file, loadPdf) {
	let pdfjs;
	try {
		pdfjs = await loadPdf();
	} catch {
		throw new Error("Couldn’t load the PDF reader. Check your connection and try again.");
	}
	const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
	let doc;
	try {
		doc = await task.promise;
	} catch {
		throw new Error("Couldn’t open that PDF. It may be damaged or password-protected.");
	}
	try {
		const written = [];
		const pixelSets = [];
		for (let n = 1; n <= Math.min(MAX_PDF_PAGES, doc.numPages); n++) {
			const page = await doc.getPage(n);
			const text = await page.getTextContent();
			for (const item of text.items) for (const m of (item.str ?? "").matchAll(HEX_IN_TEXT)) written.push(expandHex(m[1]));
			const base = page.getViewport({ scale: 1 });
			const viewport = page.getViewport({ scale: Math.min(2, 400 / Math.max(base.width, base.height)) });
			const canvas = document.createElement("canvas");
			canvas.width = Math.ceil(viewport.width);
			canvas.height = Math.ceil(viewport.height);
			await page.render({
				canvas,
				canvasContext: canvas.getContext("2d"),
				viewport
			}).promise;
			pixelSets.push(pixelsOf(canvas, canvas.width, canvas.height));
		}
		const distinct = [];
		for (const hex of written) if (!distinct.some((d) => deltaE(d, hex) < 2)) distinct.push(hex);
		if (distinct.length >= 2) return {
			colours: distinct.slice(0, 8),
			from: "pdf-text"
		};
		return {
			colours: dominantColours(pixelSets),
			from: "pdf"
		};
	} finally {
		task.destroy();
	}
}
var expandHex = (h) => `#${(h.length === 3 ? h.replace(/./g, (c) => c + c) : h).toLowerCase()}`;
/**
* Assigns a palette's colours to theme roles: the most vivid becomes primary, a very light one
* the page background, a very dark one the text, and every colour feeds the data set.
* @param {string[]} colours  most important first
*/
function rolesFromPalette(colours) {
	const info = colours.map((hex, i) => {
		const [h, s, l] = hslOf(hex);
		return {
			hex,
			h,
			s,
			l,
			score: s * (1 - Math.abs(l - .5) * 1.4) * (1 - i * .04)
		};
	});
	const accents = info.filter((c) => c.s >= .2 && c.l >= .15 && c.l <= .85).sort((a, b) => b.score - a.score);
	const byLight = [...info].sort((a, b) => b.l - a.l);
	const roles = {};
	const background = byLight.find((c) => c.l >= .93);
	if (background) roles.background = background.hex;
	const bg = roles.background ?? "#ffffff";
	const ink = [...byLight].reverse().find((c) => c.l <= .25 && contrastRatio(c.hex, bg) >= 7);
	if (ink) roles.ink = ink.hex;
	const primary = accents[0] ?? [...info].sort((a, b) => Math.abs(a.l - .45) - Math.abs(b.l - .45))[0];
	roles.primary = primary.hex;
	const hueDist = (a, b) => Math.min(Math.abs(a - b), 360 - Math.abs(a - b));
	const alt = accents.find((c) => c !== primary && hueDist(c.h, primary.h) >= 20) ?? accents.find((c) => c !== primary);
	if (alt) roles["primary-alt"] = alt.hex;
	const tint = info.find((c) => c.l >= .8 && c.l < .93 && c.s >= .1);
	if (tint) roles.secondary = tint.hex;
	[...accents, ...info.filter((c) => !accents.includes(c) && c !== background && c !== ink)].slice(0, 8).forEach((c, i) => roles[`data-${i + 1}`] = c.hex);
	return roles;
}
/** A complete theme built around a palette, adjusted to pass contrast. */
function themeFromPalette(colours) {
	const tokens = themeFromRoles(rolesFromPalette(colours));
	return {
		...tokens,
		...fixAll(tokens)
	};
}
//#endregion
//#region src/finish.js
/** The production check for Vite projects; other bundlers use NODE_ENV. */
var VITE_PROD = "import.meta.env.PROD";
var NODE_PROD = "process.env.NODE_ENV === 'production'";
var tokenLines = (tokens, indent) => TOKEN_KEYS.map((k) => `${indent}'${k}': '${tokens[k]}',`).join("\n");
/**
* Code that makes the chosen colours the site's default and hides the switcher in production.
* @param {'auto' | 'provider'} kind  the one-line setup (autoMount) or ThemeProvider
*/
function keepSnippet(kind, name, tokens, prod = VITE_PROD) {
	const theme = `defaultTheme: {\n    name: ${JSON.stringify(name)},\n    tokens: {\n${tokenLines(tokens, "      ")}\n    },\n  },\n  // Hides the colour button in production; set to false to bring it back.\n  hidden: ${prod},`;
	if (kind === "auto") return `// Replace \`import 'colorsbymax/auto'\` with:\nimport { autoMount } from 'colorsbymax/auto'\n\nautoMount({\n  ${theme}\n})`;
	return `// Add to the config you pass to <ThemeProvider>:\n<ThemeProvider config={{\n  ...config,\n  ${theme}\n}}>`;
}
/** The theme as `--color-*` variables on :root. */
var cssSnippet = (tokens) => `:root {\n${TOKEN_KEYS.map((k) => `  --color-${k}: ${tokens[k]};`).join("\n")}\n}`;
var keepPrompt = (name, tokens) => `Update my colorsbymax setup so the colours I chose become my site's default and the colour switcher is hidden in production. In the colorsbymax config (the autoMount({...}) call, or the config passed to <ThemeProvider>), set defaultTheme to { name: ${JSON.stringify(name)}, tokens: ${JSON.stringify(tokens)} } and set hidden: ${VITE_PROD} (use ${NODE_PROD} if this isn't a Vite project). If the site uses import 'colorsbymax/auto', replace it with import { autoMount } from 'colorsbymax/auto' and an autoMount({...}) call with that config. Don't change anything else.`;
/** @param {boolean} recolouring  true when colorsbymax was swapping the site's hard-coded colours */
var removePrompt = (tokens, recolouring) => recolouring ? `Remove colorsbymax from this project but keep the colours it currently shows. The site's CSS uses hard-coded colours that colorsbymax was swapping at runtime, so update the site's own CSS to use this palette instead (primary is the main brand colour, background the page, ink the text): ${JSON.stringify(tokens)}. Then uninstall the colorsbymax package and delete its import (import 'colorsbymax/auto', autoMount, ThemeProvider or ThemeSwitcher) and any colorsbymax pre-paint script in index.html.` : `Remove colorsbymax from this project but keep my colours: add these CSS variables to my global stylesheet, replacing any existing --color-* values: ${cssSnippet(tokens)} Then uninstall the colorsbymax package and delete its usage (ThemeProvider, ThemeSwitcher, autoMount or import 'colorsbymax/auto') and any colorsbymax pre-paint script in index.html. Keep colorsbymax/tokens.css only if nothing else needs it.`;
//#endregion
//#region src/settings.js
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
var DEFAULT_SETTINGS = {
	mode: "light",
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
	hideButton: false
};
/** Size presets offered in settings; dragging an edge gives a custom size instead. */
var PANEL_PRESETS = [
	{
		id: "compact",
		label: "Compact",
		width: 340,
		height: null
	},
	{
		id: "standard",
		label: "Standard",
		width: null,
		height: null
	},
	{
		id: "large",
		label: "Large",
		width: 560,
		height: "full"
	}
];
/** @returns {PanelSettings} */
function loadSettings(storageKey) {
	try {
		const saved = JSON.parse(window.localStorage.getItem(`${storageKey}:settings`) || "null");
		if (!saved || typeof saved !== "object") return DEFAULT_SETTINGS;
		const out = { ...DEFAULT_SETTINGS };
		for (const [key, fallback] of Object.entries(DEFAULT_SETTINGS)) if (typeof saved[key] === typeof fallback) out[key] = saved[key];
		if (![
			"light",
			"dark",
			"system"
		].includes(out.mode)) out.mode = DEFAULT_SETTINGS.mode;
		const size = (v) => typeof v === "number" && v > 0 && v < 1e4;
		out.panelWidth = size(saved.panelWidth) ? saved.panelWidth : null;
		out.panelHeight = size(saved.panelHeight) || saved.panelHeight === "full" ? saved.panelHeight : null;
		return out;
	} catch {
		return DEFAULT_SETTINGS;
	}
}
function saveSettings(storageKey, settings) {
	try {
		window.localStorage.setItem(`${storageKey}:settings`, JSON.stringify(settings));
	} catch {}
}
/** True while the device prefers dark colours. */
function usePrefersDark() {
	const query = "(prefers-color-scheme: dark)";
	const [dark, setDark] = useState(() => window.matchMedia(query).matches);
	useEffect(() => {
		const mq = window.matchMedia(query);
		const update = () => setDark(mq.matches);
		mq.addEventListener("change", update);
		return () => mq.removeEventListener("change", update);
	}, []);
	return dark;
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
var SettingsContext = createContext(null);
function useSettings() {
	const ctx = useContext(SettingsContext);
	if (!ctx) throw new Error("useSettings must be used inside the colorsbymax switcher");
	return ctx;
}
//#endregion
//#region src/ThemePanel.jsx
var SWATCH_KEYS = [
	"primary",
	"primary-alt",
	"primary-dark",
	"secondary",
	"background",
	"ink",
	"data-1",
	"data-2",
	"data-3",
	"data-4"
];
var btn = "inline-flex items-center justify-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-800 hover:bg-zinc-50 disabled:opacity-50 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-1";
var btnPrimary = "inline-flex items-center justify-center gap-1.5 rounded-lg bg-zinc-900 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-zinc-700 disabled:opacity-50 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2";
var field = "w-full rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5 text-sm text-zinc-900 placeholder:text-zinc-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900";
var ContrastNav = createContext(() => {});
/**
* Panel-wide helpers: `toast(text, action?)` confirms something happened, and
* `showGroup(id)` jumps to a theme group (e.g. "yours" after saving a palette).
*/
var PanelContext = createContext({
	toast: () => {},
	showGroup: () => {},
	reveal: null
});
var usePanel = () => useContext(PanelContext);
/** How long a toast stays up, unless hovered or focused. */
var TOAST_MS = 5e3;
var toastSeq = 0;
/** Toast for a palette that just landed in Yours, with a way to go and see it. */
function useSavedToYours() {
	const { toast, showGroup } = usePanel();
	const phrase = {
		Saved: "Saved “%” to Yours",
		Created: "Created “%” in Yours",
		Imported: "Imported “%” into Yours"
	};
	return (name, verb = "Saved") => {
		showGroup("yours", false);
		toast(`${phrase[verb].replace("%", () => name)} and applied it.`, {
			label: "Show",
			run: () => showGroup("yours")
		});
	};
}
function ThemePanel() {
	const theme = useTheme();
	const { settings, mode, audit } = useSettings();
	const overrideCount = Object.keys(theme.state.overrides).length;
	const [view, setView] = useState("main");
	const returnFocus = useRef(null);
	const rootRef = useRef(null);
	const [toasts, setToasts] = useState([]);
	const [reveal, setReveal] = useState(null);
	const toast = useCallback((text, action) => setToasts((list) => [...list.slice(-2), {
		id: ++toastSeq,
		text,
		action
	}]), []);
	const dismiss = useCallback((id) => setToasts((list) => list.filter((t) => t.id !== id)), []);
	const showGroup = useCallback((group, scroll = true) => {
		setView("main");
		setReveal({
			group,
			scroll,
			at: Date.now()
		});
	}, []);
	const panelApi = useMemo(() => ({
		toast,
		showGroup,
		reveal
	}), [
		toast,
		showGroup,
		reveal
	]);
	const showView = (next, from) => {
		returnFocus.current = from;
		setView(next);
	};
	useEffect(() => {
		if (view !== "main" || !returnFocus.current) return;
		(returnFocus.current.isConnected ? returnFocus.current : rootRef.current?.querySelector("[data-theme-grid] button[aria-pressed=\"true\"]"))?.focus();
		returnFocus.current = null;
	}, [view]);
	const resetToDefault = () => {
		theme.resetToDefault();
		const target = inMode(theme.defaultTheme, mode);
		if (mode === "dark") theme.selectTheme(target.id, target);
		toast(`Back to ${target.name}, with no overrides.`);
	};
	return /* @__PURE__ */ jsxs(PanelContext.Provider, {
		value: panelApi,
		children: [/* @__PURE__ */ jsxs("div", {
			ref: rootRef,
			className: "theme-scroll @container flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain rounded-[inherit]",
			children: [
				/* @__PURE__ */ jsxs("header", {
					className: "sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-zinc-200 bg-white px-4 py-3",
					children: [/* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsxs("h2", {
						id: "theme-panel-title",
						className: "text-base font-semibold tracking-tight",
						children: ["colorsbymax", /* @__PURE__ */ jsx("span", {
							className: "align-super text-[10px] font-medium",
							children: "™"
						})]
					}), /* @__PURE__ */ jsx("p", {
						className: "text-[11px] text-zinc-500",
						children: "by mrmaxdesigns"
					})] }), /* @__PURE__ */ jsxs("div", {
						className: "flex items-center gap-1",
						children: [/* @__PURE__ */ jsxs("button", {
							type: "button",
							onClick: audit.toggle,
							className: `${btn} px-2 ${audit.on ? "border-zinc-900 bg-zinc-100" : "border-transparent"}`,
							"aria-pressed": audit.on,
							"data-tip": "Audit the page: point out what won’t look right with these colours",
							children: [/* @__PURE__ */ jsx(ScanSearch, {
								className: "w-4 h-4",
								"aria-hidden": "true"
							}), "Audit"]
						}), /* @__PURE__ */ jsx("button", {
							type: "button",
							onClick: (e) => view === "settings" ? setView("main") : showView("settings", e.currentTarget),
							className: `${btn} px-1.5 ${view === "settings" ? "border-zinc-900 bg-zinc-100" : "border-transparent"}`,
							"aria-label": "Panel settings",
							"aria-pressed": view === "settings",
							"data-tip": "Panel settings",
							children: /* @__PURE__ */ jsx(Settings, {
								className: "w-4 h-4",
								"aria-hidden": "true"
							})
						})]
					})]
				}),
				view === "contrast" && /* @__PURE__ */ jsx(ContrastView, { onBack: () => setView("main") }),
				view === "settings" && /* @__PURE__ */ jsx(SettingsView, { onBack: () => setView("main") }),
				view === "finish" && /* @__PURE__ */ jsx(FinishView, { onBack: () => setView("main") }),
				/* @__PURE__ */ jsxs("div", {
					hidden: view !== "main",
					children: [/* @__PURE__ */ jsxs(ContrastNav.Provider, {
						value: (from) => showView("contrast", from),
						children: [
							/* @__PURE__ */ jsx(Section, {
								title: "Preset themes",
								defaultOpen: true,
								children: /* @__PURE__ */ jsx(PresetGrid, {})
							}),
							settings.showCustom && /* @__PURE__ */ jsx(Section, {
								title: "Custom palettes",
								children: /* @__PURE__ */ jsx(CustomPalettes, {})
							}),
							settings.showOverrides && /* @__PURE__ */ jsx(Section, {
								title: "Override a single colour",
								badge: overrideCount ? `${overrideCount} active` : null,
								children: /* @__PURE__ */ jsx(Overrides, {})
							}),
							settings.showImportExport && /* @__PURE__ */ jsx(Section, {
								title: "Import / export",
								children: /* @__PURE__ */ jsx(ImportExport, {})
							})
						]
					}), /* @__PURE__ */ jsx("footer", {
						className: "border-t border-zinc-200 px-4 py-3",
						children: /* @__PURE__ */ jsxs("div", {
							className: "flex gap-2",
							children: [/* @__PURE__ */ jsxs("button", {
								type: "button",
								className: `${btn} flex-1`,
								onClick: resetToDefault,
								children: [/* @__PURE__ */ jsx(RotateCcw, {
									className: "w-3.5 h-3.5",
									"aria-hidden": "true"
								}), "Reset to default"]
							}), /* @__PURE__ */ jsxs("button", {
								type: "button",
								className: `${btnPrimary} flex-1`,
								onClick: (e) => showView("finish", e.currentTarget),
								children: [/* @__PURE__ */ jsx(Check, {
									className: "w-3.5 h-3.5",
									"aria-hidden": "true"
								}), "I’m done"]
							})]
						})
					})]
				})
			]
		}), /* @__PURE__ */ jsx(Toasts, {
			items: toasts,
			onDismiss: dismiss
		})]
	});
}
function Toasts({ items, onDismiss }) {
	return /* @__PURE__ */ jsx("div", {
		role: "status",
		"aria-live": "polite",
		className: "pointer-events-none absolute inset-x-3 bottom-3 z-20 flex flex-col gap-2",
		children: items.map((t) => /* @__PURE__ */ jsx(Toast, {
			toast: t,
			onDismiss
		}, t.id))
	});
}
function Toast({ toast, onDismiss }) {
	const [paused, setPaused] = useState(false);
	useEffect(() => {
		if (paused) return;
		const timer = setTimeout(() => onDismiss(toast.id), TOAST_MS);
		return () => clearTimeout(timer);
	}, [
		paused,
		toast.id,
		onDismiss
	]);
	return /* @__PURE__ */ jsxs("div", {
		onPointerEnter: () => setPaused(true),
		onPointerLeave: () => setPaused(false),
		onFocus: () => setPaused(true),
		onBlur: () => setPaused(false),
		className: "theme-toast pointer-events-auto flex items-start gap-2 rounded-xl bg-zinc-900 px-3 py-2.5 text-xs text-white shadow-xl",
		children: [
			/* @__PURE__ */ jsx(CheckCircle2, {
				className: "mt-px w-4 h-4 shrink-0",
				"aria-hidden": "true"
			}),
			/* @__PURE__ */ jsx("p", {
				className: "min-w-0 flex-1 leading-snug",
				children: toast.text
			}),
			toast.action && /* @__PURE__ */ jsx("button", {
				type: "button",
				onClick: () => {
					toast.action.run();
					onDismiss(toast.id);
				},
				className: "shrink-0 rounded font-semibold underline underline-offset-2 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white",
				children: toast.action.label
			}),
			/* @__PURE__ */ jsx("button", {
				type: "button",
				onClick: () => onDismiss(toast.id),
				"aria-label": "Dismiss",
				className: "-mr-1 shrink-0 rounded opacity-70 hover:opacity-100 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white",
				children: /* @__PURE__ */ jsx(X, {
					className: "w-3.5 h-3.5",
					"aria-hidden": "true"
				})
			})
		]
	});
}
/** Shows code with a copy button. */
function CopyBlock({ label, text, copyLabel = "Copy" }) {
	const { toast } = usePanel();
	const id = useId();
	return /* @__PURE__ */ jsxs("div", {
		className: "space-y-1",
		children: [/* @__PURE__ */ jsxs("div", {
			className: "flex items-center justify-between gap-2",
			children: [/* @__PURE__ */ jsx("span", {
				id,
				className: "text-[11px] font-semibold text-zinc-700",
				children: label
			}), /* @__PURE__ */ jsxs("button", {
				type: "button",
				className: `${btn} px-2 py-1`,
				onClick: async () => {
					try {
						await navigator.clipboard.writeText(text);
						toast(`Copied: ${label.toLowerCase()}.`);
					} catch {
						toast("Couldn’t reach the clipboard. Select the text and copy it instead.");
					}
				},
				children: [
					/* @__PURE__ */ jsx(Copy, {
						className: "w-3.5 h-3.5",
						"aria-hidden": "true"
					}),
					" ",
					copyLabel
				]
			})]
		}), /* @__PURE__ */ jsx("pre", {
			"aria-labelledby": id,
			tabIndex: 0,
			className: "max-h-40 overflow-auto rounded-lg border border-zinc-200 bg-zinc-50 p-2.5 font-mono text-[11px] leading-snug text-zinc-800 whitespace-pre-wrap break-all",
			children: text
		})]
	});
}
var FINISH_OPTIONS = [
	{
		id: "keep",
		label: "Keep these colours and hide it in production",
		note: "Recommended. Everyone sees your colours; the button still shows while you develop."
	},
	{
		id: "local",
		label: "Hide it on this device only",
		note: "Quick and undoable. Nothing changes for anyone else."
	},
	{
		id: "remove",
		label: "Remove colorsbymax",
		note: "Uninstall it and keep the colours in your own CSS."
	}
];
/**
* After "I'm done": how to keep the chosen colours for every visitor and hide the switcher, hide it
* here only, or remove colorsbymax, each with code and a prompt for an AI editor. Cancel goes back.
*/
function FinishView({ onBack }) {
	const { tokens, active, recolouring } = useTheme();
	const { update } = useSettings();
	const [choice, setChoice] = useState("keep");
	const [kind, setKind] = useState(() => document.querySelector("[data-colorsbymax=\"auto\"]") ? "auto" : "provider");
	const headingRef = useRef(null);
	useEffect(() => headingRef.current?.focus(), []);
	const name = active.name.replace(/ \(dark\)$/, " dark");
	return /* @__PURE__ */ jsxs("div", {
		className: "px-4 py-3 space-y-4",
		children: [
			/* @__PURE__ */ jsxs("button", {
				type: "button",
				className: `${btn} border-transparent px-1.5`,
				onClick: onBack,
				children: [/* @__PURE__ */ jsx(ArrowLeft, {
					className: "w-3.5 h-3.5",
					"aria-hidden": "true"
				}), " Back"]
			}),
			/* @__PURE__ */ jsxs("div", {
				className: "space-y-1.5",
				children: [
					/* @__PURE__ */ jsx("h3", {
						ref: headingRef,
						tabIndex: -1,
						className: "text-sm font-semibold focus:outline-none",
						children: "Happy with your colours?"
					}),
					/* @__PURE__ */ jsxs("p", {
						className: "text-[11px] text-zinc-600",
						children: [
							"Your pick, ",
							/* @__PURE__ */ jsx("strong", {
								className: "font-semibold text-zinc-900",
								children: active.name
							}),
							", is only saved in this browser. To show it to every visitor and keep the button out of production, put it in your code:"
						]
					}),
					/* @__PURE__ */ jsx(Swatches, { tokens })
				]
			}),
			/* @__PURE__ */ jsx("div", {
				role: "radiogroup",
				"aria-label": "What to do",
				className: "space-y-1.5",
				children: FINISH_OPTIONS.map((o) => /* @__PURE__ */ jsxs("button", {
					type: "button",
					role: "radio",
					"aria-checked": choice === o.id,
					onClick: () => setChoice(o.id),
					className: `w-full rounded-xl border px-3 py-2 text-left cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 ${choice === o.id ? "border-zinc-900 bg-zinc-100" : "border-zinc-200 hover:bg-zinc-50"}`,
					children: [/* @__PURE__ */ jsx("span", {
						className: "block text-xs font-semibold text-zinc-900",
						children: o.label
					}), /* @__PURE__ */ jsx("span", {
						className: "block text-[11px] text-zinc-600",
						children: o.note
					})]
				}, o.id))
			}),
			choice === "keep" && /* @__PURE__ */ jsxs("div", {
				className: "space-y-3",
				children: [
					/* @__PURE__ */ jsx("div", {
						role: "radiogroup",
						"aria-label": "How colorsbymax is set up",
						className: "grid grid-cols-2 gap-2",
						children: [["auto", "One-line import"], ["provider", "ThemeProvider"]].map(([id, label]) => /* @__PURE__ */ jsx("button", {
							type: "button",
							role: "radio",
							"aria-checked": kind === id,
							onClick: () => setKind(id),
							className: `h-8 rounded-lg border px-2 text-xs font-medium cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 ${kind === id ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-50"}`,
							children: label
						}, id))
					}),
					/* @__PURE__ */ jsx(CopyBlock, {
						label: "Code for your site",
						text: keepSnippet(kind, name, tokens)
					}),
					/* @__PURE__ */ jsxs("p", {
						className: "text-[11px] text-zinc-600",
						children: [
							"Not using Vite? Use ",
							/* @__PURE__ */ jsx("code", {
								className: "font-mono",
								children: "process.env.NODE_ENV === 'production'"
							}),
							" instead of ",
							/* @__PURE__ */ jsx("code", {
								className: "font-mono",
								children: "import.meta.env.PROD"
							}),
							" (Next.js, webpack)."
						]
					}),
					/* @__PURE__ */ jsx(CopyBlock, {
						label: "Or ask Claude, Cursor or Copilot",
						text: keepPrompt(name, tokens),
						copyLabel: "Copy prompt"
					}),
					/* @__PURE__ */ jsxs("div", {
						className: "rounded-lg bg-zinc-100 p-2.5 text-[11px] text-zinc-700 space-y-1.5",
						children: [/* @__PURE__ */ jsxs("p", { children: [
							/* @__PURE__ */ jsx("strong", {
								className: "font-semibold text-zinc-900",
								children: "Bring it back later:"
							}),
							" it still shows when you run the site locally, so you can keep iterating. To show it in production too, set ",
							/* @__PURE__ */ jsx("code", {
								className: "font-mono",
								children: "hidden: false"
							}),
							"."
						] }), /* @__PURE__ */ jsx(CopyBlock, {
							label: "Prompt to bring it back",
							text: "Show the colorsbymax colour switcher again in production: in its config (the autoMount({...}) call or the config passed to <ThemeProvider>), set hidden to false or remove the hidden line. Don't change anything else.",
							copyLabel: "Copy prompt"
						})]
					})
				]
			}),
			choice === "local" && /* @__PURE__ */ jsxs("div", {
				className: "space-y-2",
				children: [
					/* @__PURE__ */ jsx("p", {
						className: "text-[11px] text-zinc-600",
						children: "Hides the colour button in this browser only, and keeps showing your current colours here. It doesn’t change your code or what anyone else sees."
					}),
					/* @__PURE__ */ jsxs("p", {
						className: "rounded-lg bg-zinc-100 p-2.5 text-[11px] text-zinc-700",
						children: [
							/* @__PURE__ */ jsx("strong", {
								className: "font-semibold text-zinc-900",
								children: "To bring it back:"
							}),
							" press ",
							/* @__PURE__ */ jsx("kbd", {
								className: "font-mono",
								children: "Alt"
							}),
							"+",
							/* @__PURE__ */ jsx("kbd", {
								className: "font-mono",
								children: "Shift"
							}),
							"+",
							/* @__PURE__ */ jsx("kbd", {
								className: "font-mono",
								children: "C"
							}),
							" on the page, or open it with ",
							/* @__PURE__ */ jsx("code", {
								className: "font-mono",
								children: "?colorsbymax"
							}),
							" at the end of the address."
						]
					}),
					/* @__PURE__ */ jsx("button", {
						type: "button",
						className: `${btnPrimary} w-full`,
						onClick: () => update({ hideButton: true }),
						children: "Hide the button here"
					})
				]
			}),
			choice === "remove" && /* @__PURE__ */ jsxs("div", {
				className: "space-y-3",
				children: [
					/* @__PURE__ */ jsxs("ol", {
						className: "list-decimal space-y-1 pl-4 text-[11px] text-zinc-700",
						children: [
							/* @__PURE__ */ jsxs("li", { children: ["Uninstall it: ", /* @__PURE__ */ jsx("code", {
								className: "font-mono",
								children: "npm uninstall colorsbymax"
							})] }),
							/* @__PURE__ */ jsxs("li", { children: [
								"Delete its import (",
								/* @__PURE__ */ jsx("code", {
									className: "font-mono",
									children: "import 'colorsbymax/auto'"
								}),
								", ",
								/* @__PURE__ */ jsx("code", {
									className: "font-mono",
									children: "autoMount"
								}),
								", or ",
								/* @__PURE__ */ jsx("code", {
									className: "font-mono",
									children: "ThemeProvider"
								}),
								" and ",
								/* @__PURE__ */ jsx("code", {
									className: "font-mono",
									children: "ThemeSwitcher"
								}),
								") and any colorsbymax pre-paint script."
							] }),
							/* @__PURE__ */ jsx("li", { children: recolouring ? "Keep the colours: your site’s CSS uses its own hard-coded colours, which colorsbymax was swapping as the page ran, so they need writing into your CSS. The prompt below asks your AI editor to do that." : "Keep the colours: paste these into your global stylesheet, replacing your current --color-* values." })
						]
					}),
					!recolouring && /* @__PURE__ */ jsx(CopyBlock, {
						label: "CSS for your colours",
						text: cssSnippet(tokens)
					}),
					/* @__PURE__ */ jsx(CopyBlock, {
						label: "Or ask Claude, Cursor or Copilot",
						text: removePrompt(tokens, recolouring),
						copyLabel: "Copy prompt"
					}),
					/* @__PURE__ */ jsx("p", {
						className: "text-[11px] text-zinc-600",
						children: "To bring it back later, install it again and follow the Quick start in the README."
					})
				]
			}),
			/* @__PURE__ */ jsx("button", {
				type: "button",
				className: `${btn} w-full`,
				onClick: onBack,
				children: "Cancel, keep using colorsbymax"
			})
		]
	});
}
var MODES = [
	{
		id: "light",
		label: "Light",
		Icon: Sun
	},
	{
		id: "dark",
		label: "Dark",
		Icon: Moon
	},
	{
		id: "system",
		label: "Auto",
		Icon: Monitor
	}
];
/** The visitor's preferences for the panel and colour button. */
function SettingsView({ onBack }) {
	const { settings, update, reset, resetButton } = useSettings();
	const { toast } = usePanel();
	const headingRef = useRef(null);
	useEffect(() => headingRef.current?.focus(), []);
	return /* @__PURE__ */ jsxs("div", {
		className: "px-4 py-3 space-y-4",
		children: [
			/* @__PURE__ */ jsxs("button", {
				type: "button",
				className: `${btn} border-transparent px-1.5`,
				onClick: onBack,
				children: [/* @__PURE__ */ jsx(ArrowLeft, {
					className: "w-3.5 h-3.5",
					"aria-hidden": "true"
				}), " Back"]
			}),
			/* @__PURE__ */ jsx("h3", {
				ref: headingRef,
				tabIndex: -1,
				className: "text-sm font-semibold focus:outline-none",
				children: "Settings"
			}),
			/* @__PURE__ */ jsxs("fieldset", {
				className: "space-y-1.5",
				children: [
					/* @__PURE__ */ jsx("legend", {
						className: "mb-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-600",
						children: "Theme mode"
					}),
					/* @__PURE__ */ jsx("div", {
						role: "radiogroup",
						"aria-label": "Theme mode",
						className: "grid grid-cols-3 gap-2",
						children: MODES.map(({ id, label, Icon }) => {
							const on = settings.mode === id;
							return /* @__PURE__ */ jsxs("button", {
								type: "button",
								role: "radio",
								"aria-checked": on,
								onClick: () => update({ mode: id }),
								className: `flex h-8 min-w-0 items-center justify-center gap-1.5 rounded-lg border px-2 text-xs font-medium cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-1 ${on ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-50"}`,
								children: [/* @__PURE__ */ jsx(Icon, {
									className: "w-3.5 h-3.5 shrink-0",
									"aria-hidden": "true"
								}), /* @__PURE__ */ jsx("span", {
									className: "truncate",
									children: label
								})]
							}, id);
						})
					}),
					/* @__PURE__ */ jsx("p", {
						className: "text-[11px] text-zinc-600",
						children: "Shows every theme in light or dark colours and switches the current one to match. Auto follows your device. The panel matches too, and your own palettes stay as you made them."
					})
				]
			}),
			/* @__PURE__ */ jsxs("fieldset", {
				className: "space-y-1.5",
				children: [
					/* @__PURE__ */ jsx("legend", {
						className: "mb-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-600",
						children: "Panel size"
					}),
					/* @__PURE__ */ jsx("div", {
						role: "radiogroup",
						"aria-label": "Panel size",
						className: "grid grid-cols-3 gap-2",
						children: PANEL_PRESETS.map((preset) => {
							const on = settings.panelWidth === preset.width && settings.panelHeight === preset.height;
							return /* @__PURE__ */ jsx("button", {
								type: "button",
								role: "radio",
								"aria-checked": on,
								onClick: () => update({
									panelWidth: preset.width,
									panelHeight: preset.height
								}),
								className: `flex h-8 min-w-0 items-center justify-center rounded-lg border px-2 text-xs font-medium cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-1 ${on ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-50"}`,
								children: /* @__PURE__ */ jsx("span", {
									className: "truncate",
									children: preset.label
								})
							}, preset.id);
						})
					}),
					/* @__PURE__ */ jsx("p", {
						className: "text-[11px] text-zinc-600",
						children: PANEL_PRESETS.some((pr) => pr.width === settings.panelWidth && pr.height === settings.panelHeight) ? "Or drag the panel’s edges or corner to any size. Double-click an edge to reset it." : "Custom size from dragging. Pick a size above to go back, or double-click an edge."
					})
				]
			}),
			/* @__PURE__ */ jsxs("fieldset", {
				className: "space-y-1",
				children: [
					/* @__PURE__ */ jsx("legend", {
						className: "mb-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-600",
						children: "Show"
					}),
					/* @__PURE__ */ jsx(Toggle, {
						checked: settings.showPicks,
						onChange: (v) => update({ showPicks: v }),
						label: "Max’s picks",
						note: "Hand-tuned colorsbymax themes"
					}),
					/* @__PURE__ */ jsx(Toggle, {
						checked: settings.showLibrary,
						onChange: (v) => update({ showLibrary: v }),
						label: "Theme library",
						note: "Hundreds of themes in categories, with search"
					}),
					/* @__PURE__ */ jsx(Toggle, {
						checked: settings.showCustom,
						onChange: (v) => update({ showCustom: v }),
						label: "Custom palettes"
					}),
					/* @__PURE__ */ jsx(Toggle, {
						checked: settings.showOverrides,
						onChange: (v) => update({ showOverrides: v }),
						label: "Override a single colour"
					}),
					/* @__PURE__ */ jsx(Toggle, {
						checked: settings.showImportExport,
						onChange: (v) => update({ showImportExport: v }),
						label: "Import / export"
					})
				]
			}),
			/* @__PURE__ */ jsxs("fieldset", {
				className: "space-y-1",
				children: [/* @__PURE__ */ jsx("legend", {
					className: "mb-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-600",
					children: "Page"
				}), /* @__PURE__ */ jsx(Toggle, {
					checked: settings.colourLogo,
					onChange: (v) => update({ colourLogo: v }),
					label: "Colour the logo too",
					note: "Off keeps the site’s logo in its own colours whatever the theme"
				})]
			}),
			/* @__PURE__ */ jsxs("fieldset", {
				className: "space-y-1",
				children: [
					/* @__PURE__ */ jsx("legend", {
						className: "mb-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-600",
						children: "Colour button"
					}),
					/* @__PURE__ */ jsx(Toggle, {
						checked: settings.draggable,
						onChange: (v) => update({ draggable: v }),
						label: "Drag to move",
						note: "Hold and drag the button anywhere on the screen"
					}),
					/* @__PURE__ */ jsx(Toggle, {
						checked: settings.animateDot,
						onChange: (v) => update({ animateDot: v }),
						label: "Cycle the dot’s colours",
						note: "Shows the current theme’s colours in turn"
					}),
					resetButton && /* @__PURE__ */ jsxs("button", {
						type: "button",
						className: `${btn} mt-1 w-full`,
						onClick: () => {
							resetButton();
							toast("Moved the colour button back to its corner.");
						},
						children: [/* @__PURE__ */ jsx(RotateCcw, {
							className: "w-3.5 h-3.5",
							"aria-hidden": "true"
						}), " Move the button back to the corner"]
					})
				]
			}),
			/* @__PURE__ */ jsx("button", {
				type: "button",
				className: "rounded text-[11px] font-medium text-zinc-600 underline underline-offset-2 hover:text-zinc-900 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900",
				onClick: () => {
					reset();
					toast("Settings are back to their defaults.");
				},
				children: "Restore default settings"
			})
		]
	});
}
function Toggle({ checked, onChange, label, note }) {
	const id = useId();
	return /* @__PURE__ */ jsxs("div", {
		className: "flex items-start gap-2.5 rounded-lg px-1.5 py-1.5 hover:bg-zinc-50",
		children: [/* @__PURE__ */ jsx("input", {
			id,
			type: "checkbox",
			checked,
			onChange: (e) => onChange(e.target.checked),
			className: "mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-1"
		}), /* @__PURE__ */ jsxs("label", {
			htmlFor: id,
			className: "min-w-0 flex-1 cursor-pointer",
			children: [/* @__PURE__ */ jsx("span", {
				className: "block text-xs font-medium text-zinc-900",
				children: label
			}), note && /* @__PURE__ */ jsx("span", {
				className: "block text-[11px] text-zinc-600",
				children: note
			})]
		})]
	});
}
function Section({ title, badge, defaultOpen = false, children }) {
	return /* @__PURE__ */ jsxs("details", {
		open: defaultOpen,
		className: "border-b border-zinc-200",
		children: [/* @__PURE__ */ jsxs("summary", {
			className: "flex cursor-pointer items-center gap-2 px-4 py-3 text-sm font-semibold hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-zinc-900",
			children: [
				/* @__PURE__ */ jsx(ChevronRight, {
					className: "theme-chevron w-4 h-4 text-zinc-500 transition-transform motion-reduce:transition-none",
					"aria-hidden": "true"
				}),
				/* @__PURE__ */ jsx("span", {
					className: "flex-1",
					children: title
				}),
				badge && /* @__PURE__ */ jsx("span", {
					className: "rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-700",
					children: badge
				})
			]
		}), /* @__PURE__ */ jsx("div", {
			className: "px-4 pb-4",
			children
		})]
	});
}
/** Full contrast breakdown for the active theme, opened from a warning badge or link. */
function ContrastView({ onBack }) {
	const { issues, fixIssue, fixAllIssues, active } = useTheme();
	const { toast } = usePanel();
	const headingRef = useRef(null);
	useEffect(() => headingRef.current?.focus(), []);
	return /* @__PURE__ */ jsxs("div", {
		className: "px-4 py-3 space-y-3",
		children: [
			/* @__PURE__ */ jsxs("button", {
				type: "button",
				className: `${btn} border-transparent px-1.5`,
				onClick: onBack,
				children: [/* @__PURE__ */ jsx(ArrowLeft, {
					className: "w-3.5 h-3.5",
					"aria-hidden": "true"
				}), " Back"]
			}),
			/* @__PURE__ */ jsxs("h3", {
				ref: headingRef,
				tabIndex: -1,
				className: "text-sm font-semibold focus:outline-none",
				children: ["Contrast check: ", active.name]
			}),
			/* @__PURE__ */ jsx("div", {
				"aria-live": "polite",
				children: issues.length === 0 ? /* @__PURE__ */ jsxs("p", {
					className: "flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-900",
					children: [/* @__PURE__ */ jsx(Check, {
						className: "w-4 h-4 shrink-0",
						"aria-hidden": "true"
					}), "Every colour pairing meets Web Content Accessibility Guidelines (WCAG) contrast."]
				}) : /* @__PURE__ */ jsxs("div", {
					className: "rounded-lg border border-amber-300 bg-amber-50 p-3 text-amber-950",
					children: [
						/* @__PURE__ */ jsxs("div", {
							className: "flex items-center justify-between gap-2",
							children: [/* @__PURE__ */ jsxs("p", {
								className: "flex items-center gap-2 text-xs font-semibold",
								children: [
									/* @__PURE__ */ jsx(AlertTriangle, {
										className: "w-4 h-4 shrink-0",
										"aria-hidden": "true"
									}),
									issues.length,
									" contrast ",
									issues.length === 1 ? "problem" : "problems"
								]
							}), /* @__PURE__ */ jsxs("button", {
								type: "button",
								className: btnPrimary,
								onClick: () => {
									fixAllIssues();
									toast(`Fixed ${issues.length} contrast ${issues.length === 1 ? "problem" : "problems"} by adjusting lightness.`);
								},
								children: [/* @__PURE__ */ jsx(Wand2, {
									className: "w-3.5 h-3.5",
									"aria-hidden": "true"
								}), "Fix all automatically"]
							})]
						}),
						/* @__PURE__ */ jsx("p", {
							className: "mt-2 text-[11px] text-amber-900",
							children: "Text should meet the Web Content Accessibility Guidelines (WCAG) minimum of 4.5:1 (3:1 for large headlines and icons). Fixing adjusts only the lightness of the colour involved."
						}),
						/* @__PURE__ */ jsx("ul", {
							className: "mt-2 space-y-1.5",
							children: issues.map((issue) => /* @__PURE__ */ jsxs("li", {
								className: "flex items-start justify-between gap-2 text-xs",
								children: [/* @__PURE__ */ jsx("span", { children: issue.message }), /* @__PURE__ */ jsx("button", {
									type: "button",
									className: `${btn} shrink-0 px-2 py-1`,
									onClick: () => fixIssue(issue),
									"aria-label": `Fix automatically: ${issue.pairing.label}`,
									children: "Fix"
								})]
							}, issue.pairing.id))
						})
					]
				})
			})
		]
	});
}
/** Small entry point to the breakdown, shown in the editing sections only when needed. */
function IssuesLink() {
	const { issues } = useTheme();
	const showContrast = useContext(ContrastNav);
	if (!issues.length) return null;
	return /* @__PURE__ */ jsxs("button", {
		type: "button",
		onClick: (e) => showContrast(e.currentTarget),
		className: "flex items-center gap-1.5 text-xs font-medium text-amber-800 underline underline-offset-2 hover:text-amber-950 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 rounded",
		children: [
			/* @__PURE__ */ jsx(AlertTriangle, {
				className: "w-3.5 h-3.5",
				"aria-hidden": "true"
			}),
			issues.length,
			" contrast ",
			issues.length === 1 ? "problem" : "problems",
			" in the current colours. Review"
		]
	});
}
function Swatches({ tokens }) {
	return /* @__PURE__ */ jsx("div", {
		className: "flex overflow-hidden rounded-md border border-zinc-200",
		"aria-hidden": "true",
		children: SWATCH_KEYS.map((key) => /* @__PURE__ */ jsx("span", {
			className: "h-5 flex-1",
			style: { background: tokens[key] }
		}, key))
	});
}
var PAGE_SIZE = 24;
var NO_THEMES = [];
function PresetGrid() {
	const { siteName, siteThemes, presets: allPresets, customs, active, selectTheme, state, clearOverrides } = useTheme();
	const { settings, mode, update } = useSettings();
	const categoriesId = useId();
	const [loaded, setLoaded] = useState(null);
	const [loadError, setLoadError] = useState(false);
	const [chosen, setCategory] = useState("site");
	const [query, setQuery] = useState("");
	const [limit, setLimit] = useState(PAGE_SIZE);
	const searchId = useId();
	const overrideCount = Object.keys(state.overrides).length;
	const { toast, reveal } = usePanel();
	const wrapRef = useRef(null);
	const pendingScroll = useRef(false);
	const themesRef = useRef(null);
	const scrollToThemes = useRef(false);
	useEffect(() => {
		if (!reveal) return;
		setCategory(reveal.group);
		setQuery("");
		setLimit(PAGE_SIZE);
		if (!reveal.scroll) return;
		const details = wrapRef.current?.closest("details");
		if (details) details.open = true;
		pendingScroll.current = true;
	}, [reveal]);
	useEffect(() => {
		if (scrollToThemes.current && themesRef.current) {
			scrollToThemes.current = false;
			const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
			themesRef.current.scrollIntoView({
				block: "start",
				behavior: still ? "auto" : "smooth"
			});
		}
		if (!pendingScroll.current) return;
		pendingScroll.current = false;
		const root = wrapRef.current;
		const target = root?.querySelector("[data-theme-grid] button[aria-pressed=\"true\"]") ?? root?.querySelector("[data-groups] [aria-pressed=\"true\"]");
		const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
		target?.scrollIntoView({
			block: "center",
			behavior: smooth ? "smooth" : "auto"
		});
		target?.focus({ preventScroll: true });
	});
	const presets = settings.showPicks ? allPresets : NO_THEMES;
	const library = settings.showLibrary ? loaded : null;
	useEffect(() => {
		if (settings.showLibrary) loadLibrary().then(setLoaded, () => setLoadError(true));
	}, [settings.showLibrary]);
	const groups = [
		{
			id: "site",
			label: siteName,
			Icon: Globe,
			count: siteThemes.length,
			description: `${siteName}'s own colours, and themes made for it`
		},
		...settings.showPicks ? [{
			id: "picks",
			label: "Max’s picks",
			Icon: Paintbrush,
			count: presets.length,
			description: "Hand-tuned colorsbymax themes that pass every contrast check"
		}] : [],
		{
			id: "yours",
			label: "Yours",
			Icon: UserRound,
			count: customs.length,
			description: "Palettes you create, import or build from an image"
		}
	];
	const categories = [...settings.showLibrary ? [{
		id: "all",
		label: "All",
		count: library ? library.themes.length : null,
		description: "Every library theme"
	}] : [], ...(library?.categories ?? []).filter((c) => c.count)];
	const chips = [...groups, ...categories];
	const loadingCategory = settings.showLibrary && !library && ![
		"site",
		"picks",
		"yours"
	].includes(chosen);
	const category = chips.some((c) => c.id === chosen) || loadingCategory ? chosen : "site";
	const q = query.trim().toLowerCase();
	const activeCategory = q ? null : categories.find((c) => c.id === category);
	const visible = useMemo(() => {
		let list;
		if (q) list = [
			...siteThemes,
			...presets,
			...customs,
			...library?.themes ?? []
		];
		else if (category === "site") list = siteThemes;
		else if (category === "picks") list = presets;
		else if (category === "yours") list = customs;
		else if (category === "all") list = library?.themes ?? [];
		else list = (library?.themes ?? []).filter((t) => t.tags.includes(category));
		if (q) {
			const labels = Object.fromEntries((library?.categories ?? []).map((c) => [c.id, c.label.toLowerCase()]));
			list = list.filter((t) => t.name.toLowerCase().includes(q) || t.tags?.some((tag) => labels[tag]?.includes(q)));
		}
		return list;
	}, [
		q,
		category,
		siteThemes,
		presets,
		customs,
		library
	]);
	const shown = visible.slice(0, limit).map((t) => inMode(t, mode));
	const needsLibrary = settings.showLibrary && (Boolean(q) || ![
		"site",
		"picks",
		"yours"
	].includes(category));
	const catInfo = library?.categories.find((c) => c.id === category);
	const choose = (id, { scroll = false } = {}) => {
		setCategory(id);
		setQuery("");
		setLimit(PAGE_SIZE);
		scrollToThemes.current = scroll;
	};
	const pick = (t) => selectTheme(t.id, t);
	const surprise = () => {
		const pool = visible.length ? visible : library?.themes ?? [...siteThemes, ...presets];
		pick(inMode(pool[Math.floor(Math.random() * pool.length)], mode));
	};
	return /* @__PURE__ */ jsxs("div", {
		ref: wrapRef,
		className: "space-y-3",
		children: [
			/* @__PURE__ */ jsx(ScanCard, {}),
			/* @__PURE__ */ jsxs("p", {
				className: "text-xs text-zinc-600",
				children: ["Current theme: ", /* @__PURE__ */ jsx("strong", {
					className: "font-semibold text-zinc-900",
					children: active.name
				})]
			}),
			overrideCount > 0 && /* @__PURE__ */ jsxs("p", {
				className: "flex items-center justify-between gap-2 rounded-lg bg-zinc-100 px-3 py-2 text-xs text-zinc-700",
				children: [
					overrideCount,
					" single-colour override",
					overrideCount > 1 ? "s are" : " is",
					" applied on top of any theme.",
					/* @__PURE__ */ jsx("button", {
						type: "button",
						className: btn,
						onClick: () => {
							clearOverrides();
							toast(`Cleared ${overrideCount} single-colour ${overrideCount === 1 ? "override" : "overrides"}.`);
						},
						children: "Clear"
					})
				]
			}),
			/* @__PURE__ */ jsxs("div", {
				className: "flex gap-2",
				children: [
					/* @__PURE__ */ jsx("label", {
						htmlFor: searchId,
						className: "sr-only",
						children: "Search themes"
					}),
					/* @__PURE__ */ jsx("input", {
						id: searchId,
						type: "search",
						className: field,
						placeholder: `Search ${(library?.themes.length ?? 0) + presets.length + siteThemes.length + customs.length} themes…`,
						value: query,
						onChange: (e) => {
							setQuery(e.target.value);
							setLimit(PAGE_SIZE);
						}
					}),
					/* @__PURE__ */ jsxs("button", {
						type: "button",
						className: `${btn} shrink-0`,
						onClick: surprise,
						disabled: !library && needsLibrary,
						children: [/* @__PURE__ */ jsx(Shuffle, {
							className: "w-3.5 h-3.5",
							"aria-hidden": "true"
						}), " Surprise me"]
					})
				]
			}),
			/* @__PURE__ */ jsx("div", {
				role: "group",
				"aria-label": "Your groups",
				"data-groups": true,
				className: "grid grid-cols-3 gap-2",
				children: groups.map((g) => {
					const on = !q && category === g.id;
					return /* @__PURE__ */ jsxs("button", {
						type: "button",
						"aria-pressed": on,
						"data-tip": `${g.description} (${g.count} ${g.count === 1 ? "theme" : "themes"})`,
						onClick: () => choose(g.id),
						className: `flex h-12 min-w-0 flex-col items-center justify-center gap-0.5 rounded-xl border px-2 text-xs font-semibold @min-[380px]:h-10 @min-[380px]:flex-row @min-[380px]:justify-start @min-[380px]:gap-1.5 @min-[440px]:px-2.5 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-1 ${on ? "border-zinc-900 bg-zinc-900 text-white shadow-sm" : "border-zinc-200 bg-zinc-100 text-zinc-900 hover:bg-zinc-200"}`,
						children: [
							/* @__PURE__ */ jsx(g.Icon, {
								className: "w-4 h-4 shrink-0",
								"aria-hidden": "true"
							}),
							/* @__PURE__ */ jsx("span", {
								className: "max-w-full truncate",
								children: g.label
							}),
							/* @__PURE__ */ jsx("span", {
								className: `ml-auto hidden pl-1 font-medium tabular-nums @min-[440px]:inline ${on ? "text-zinc-300" : "text-zinc-500"}`,
								children: g.count
							})
						]
					}, g.id);
				})
			}),
			categories.length > 0 && /* @__PURE__ */ jsxs(Fragment, { children: [/* @__PURE__ */ jsxs("button", {
				type: "button",
				"aria-expanded": !settings.libraryCollapsed,
				"aria-controls": categoriesId,
				onClick: () => update({ libraryCollapsed: !settings.libraryCollapsed }),
				className: "flex w-full items-center gap-1.5 rounded text-[11px] font-semibold uppercase tracking-wide text-zinc-500 hover:text-zinc-900 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900",
				children: [
					/* @__PURE__ */ jsx(ChevronRight, {
						className: `w-3.5 h-3.5 shrink-0 transition-transform motion-reduce:transition-none ${settings.libraryCollapsed ? "" : "rotate-90"}`,
						"aria-hidden": "true"
					}),
					"Library",
					settings.libraryCollapsed && activeCategory && /* @__PURE__ */ jsxs("span", {
						className: "normal-case tracking-normal text-zinc-700",
						children: ["· ", activeCategory.label]
					}),
					/* @__PURE__ */ jsx("span", { className: "h-px flex-1 bg-zinc-200" }),
					/* @__PURE__ */ jsx("span", {
						className: "normal-case tracking-normal font-medium",
						children: settings.libraryCollapsed ? "Show" : "Hide"
					})
				]
			}), /* @__PURE__ */ jsx("div", {
				id: categoriesId,
				hidden: settings.libraryCollapsed,
				role: "group",
				"aria-label": "Library categories",
				className: "grid grid-cols-2 @min-[380px]:grid-cols-3 gap-2",
				children: categories.map((c) => {
					const on = !q && category === c.id;
					return /* @__PURE__ */ jsxs("button", {
						type: "button",
						"aria-pressed": on,
						"data-tip": c.description,
						onClick: () => choose(c.id, { scroll: true }),
						className: `flex h-8 min-w-0 items-center gap-1 rounded-lg border px-2 text-xs font-medium cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-1 ${on ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-50"}`,
						children: [
							on && /* @__PURE__ */ jsx(Check, {
								className: "w-3 h-3 shrink-0",
								"aria-hidden": "true"
							}),
							/* @__PURE__ */ jsx("span", {
								className: "truncate",
								children: c.label
							}),
							c.count != null && /* @__PURE__ */ jsx("span", {
								className: `ml-auto pl-1 tabular-nums ${on ? "text-zinc-300" : "text-zinc-500"}`,
								children: c.count
							})
						]
					}, c.id);
				})
			})] }),
			/* @__PURE__ */ jsx("div", {
				ref: themesRef,
				className: "scroll-mt-3"
			}),
			!q && /* @__PURE__ */ jsx("p", {
				className: "text-xs text-zinc-600",
				children: (catInfo ?? chips.find((c) => c.id === category))?.description
			}),
			needsLibrary && !library ? /* @__PURE__ */ jsx("p", {
				className: "py-6 text-center text-xs text-zinc-600",
				role: "status",
				children: loadError ? "Couldn’t load the theme library. Check your connection and reopen the panel." : "Loading themes…"
			}) : visible.length === 0 && !q && category === "yours" ? /* @__PURE__ */ jsx("p", {
				className: "rounded-xl border border-dashed border-zinc-300 px-4 py-5 text-center text-xs text-zinc-600",
				children: "Nothing here yet. Palettes you create in Custom palettes, import, or build from a file in Import / export are saved here."
			}) : visible.length === 0 ? /* @__PURE__ */ jsxs("p", {
				className: "py-6 text-center text-xs text-zinc-600",
				role: "status",
				children: [
					"No themes match “",
					query,
					"”."
				]
			}) : /* @__PURE__ */ jsxs(Fragment, { children: [
				/* @__PURE__ */ jsxs("p", {
					className: "sr-only",
					role: "status",
					children: [visible.length, " themes"]
				}),
				/* @__PURE__ */ jsx("div", {
					"data-theme-grid": true,
					className: "grid grid-cols-2 @min-[520px]:grid-cols-3 gap-2",
					children: shown.map((t) => /* @__PURE__ */ jsx(ThemeCard, {
						theme: t,
						isActive: t.id === active.id,
						onSelect: () => pick(t)
					}, t.id))
				}),
				visible.length > limit && /* @__PURE__ */ jsxs("button", {
					type: "button",
					className: `${btn} w-full`,
					onClick: () => setLimit((n) => n + PAGE_SIZE),
					children: [
						"Show more (",
						visible.length - limit,
						" left)"
					]
				})
			] }),
			library && /* @__PURE__ */ jsx("p", {
				className: "text-[11px] text-zinc-500",
				children: "Library palettes: community favourites via nice-color-palettes (MIT), adjusted to pass contrast."
			})
		]
	});
}
/** User-triggered site scan: reads the page's colours and adds themes built around them. */
function ScanCard() {
	const { siteName, scanned, runScan, clearScan } = useTheme();
	const { toast, showGroup } = usePanel();
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState(null);
	const scan = async () => {
		setBusy(true);
		setError(null);
		try {
			const { colours, themes } = await runScan();
			showGroup("site", false);
			toast(`Found ${colours} colours and added ${themes} themes to the ${siteName} group.`, {
				label: "Show",
				run: () => showGroup("site")
			});
		} catch {
			setError("Couldn’t scan this page. Try again after it has finished loading.");
		} finally {
			setBusy(false);
		}
	};
	return /* @__PURE__ */ jsxs("div", {
		className: "rounded-xl border border-zinc-200 bg-zinc-50 p-3",
		children: [
			/* @__PURE__ */ jsxs("div", {
				className: "flex items-start justify-between gap-3",
				children: [/* @__PURE__ */ jsxs("div", {
					className: "min-w-0",
					children: [/* @__PURE__ */ jsx("p", {
						className: "text-xs font-semibold text-zinc-900",
						children: scanned ? `Personalised for ${siteName}` : `Personalise for ${siteName}`
					}), /* @__PURE__ */ jsx("p", {
						className: "mt-0.5 text-[11px] text-zinc-600",
						children: scanned ? "Themes built from this site’s colours are in its group below." : "Scan this page’s colours to get themes built around them."
					})]
				}), /* @__PURE__ */ jsxs("button", {
					type: "button",
					className: `${scanned ? btn : btnPrimary} shrink-0`,
					onClick: scan,
					disabled: busy,
					"aria-busy": busy,
					children: [busy ? /* @__PURE__ */ jsx(Loader2, {
						className: "w-3.5 h-3.5 animate-spin motion-reduce:animate-none",
						"aria-hidden": "true"
					}) : /* @__PURE__ */ jsx(ScanLine, {
						className: "w-3.5 h-3.5",
						"aria-hidden": "true"
					}), busy ? "Scanning…" : scanned ? "Rescan" : "Scan site"]
				})]
			}),
			scanned?.palette.length > 0 && /* @__PURE__ */ jsxs("div", {
				className: "mt-2.5 flex items-center gap-2",
				children: [
					/* @__PURE__ */ jsx("span", {
						className: "text-[11px] text-zinc-600",
						children: "Detected"
					}),
					/* @__PURE__ */ jsx("div", {
						className: "flex overflow-hidden rounded-md border border-zinc-200",
						"aria-hidden": "true",
						children: scanned.palette.map((hex) => /* @__PURE__ */ jsx("span", {
							className: "h-4 w-5",
							style: { background: hex },
							"data-tip": hex
						}, hex))
					}),
					/* @__PURE__ */ jsx("button", {
						type: "button",
						className: "ml-auto text-[11px] font-medium text-zinc-600 underline underline-offset-2 hover:text-zinc-900 cursor-pointer",
						onClick: () => {
							clearScan();
							toast(`Removed the scanned themes from ${siteName}.`);
						},
						children: "Remove scan"
					})
				]
			}),
			error && /* @__PURE__ */ jsx("p", {
				role: "alert",
				className: "mt-2 text-[11px] text-red-700",
				children: error
			})
		]
	});
}
function ThemeCard({ theme: t, isActive, onSelect }) {
	const { issues } = useTheme();
	const showContrast = useContext(ContrastNav);
	const stored = useMemo(() => t.library && !t.derived ? 0 : checkTheme(t.tokens).length, [t]);
	const count = isActive ? issues.length : stored;
	return /* @__PURE__ */ jsxs("div", {
		className: "relative",
		children: [/* @__PURE__ */ jsxs("button", {
			type: "button",
			"aria-pressed": isActive,
			onClick: onSelect,
			className: `flex w-full flex-col gap-2 rounded-xl border p-2.5 text-left cursor-pointer hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 ${isActive ? "border-zinc-900 ring-1 ring-zinc-900" : "border-zinc-200"} ${count ? "pr-12" : ""}`,
			children: [
				/* @__PURE__ */ jsx("span", {
					className: "truncate text-sm font-medium",
					children: t.name
				}),
				/* @__PURE__ */ jsx(Swatches, { tokens: t.tokens }),
				(isActive || t.custom || t.scanned) && /* @__PURE__ */ jsxs("span", {
					className: "flex items-center gap-1.5 text-[11px]",
					children: [
						isActive && /* @__PURE__ */ jsxs("span", {
							className: "flex items-center gap-0.5 font-semibold text-zinc-900",
							children: [/* @__PURE__ */ jsx(Check, {
								className: "w-3.5 h-3.5",
								"aria-hidden": "true"
							}), " Active"]
						}),
						t.custom && /* @__PURE__ */ jsx("span", {
							className: "rounded bg-zinc-100 px-1 font-medium text-zinc-700",
							children: "Custom"
						}),
						t.scanned && /* @__PURE__ */ jsx("span", {
							className: "rounded bg-sky-50 px-1 font-medium text-sky-900",
							children: t.match ? "Library match" : "From scan"
						})
					]
				})
			]
		}), count > 0 && /* @__PURE__ */ jsxs("button", {
			type: "button",
			onClick: (e) => {
				if (!isActive) onSelect();
				showContrast(e.currentTarget);
			},
			"aria-label": `${t.name} has ${count} contrast ${count === 1 ? "problem" : "problems"}. Review and fix`,
			"data-tip": "Contrast problems: review and fix",
			className: "absolute right-1.5 top-1.5 inline-flex items-center gap-0.5 rounded-full border border-amber-300 bg-amber-100 px-1.5 py-0.5 text-[11px] font-semibold text-amber-900 hover:bg-amber-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900",
			children: [/* @__PURE__ */ jsx(AlertTriangle, {
				className: "w-3 h-3",
				"aria-hidden": "true"
			}), count]
		})]
	});
}
function CustomPalettes() {
	const { customs, active, createCustom, renameCustom, deleteCustom, selectTheme, updateCustomToken, state } = useTheme();
	const { toast } = usePanel();
	const savedToYours = useSavedToYours();
	const [name, setName] = useState("");
	const nameId = useId();
	const activeCustom = customs.find((c) => c.id === active.id);
	return /* @__PURE__ */ jsxs("div", {
		className: "space-y-4",
		children: [
			/* @__PURE__ */ jsx(IssuesLink, {}),
			/* @__PURE__ */ jsxs("form", {
				className: "space-y-1.5",
				onSubmit: (e) => {
					e.preventDefault();
					createCustom(name);
					savedToYours(name.trim() || "My palette", "Created");
					setName("");
				},
				children: [
					/* @__PURE__ */ jsx("label", {
						htmlFor: nameId,
						className: "block text-xs font-medium text-zinc-700",
						children: "New palette name"
					}),
					/* @__PURE__ */ jsxs("div", {
						className: "flex gap-2",
						children: [/* @__PURE__ */ jsx("input", {
							id: nameId,
							className: field,
							value: name,
							onChange: (e) => setName(e.target.value),
							placeholder: "My palette",
							maxLength: 60
						}), /* @__PURE__ */ jsx("button", {
							type: "submit",
							className: `${btnPrimary} shrink-0`,
							children: "Create"
						})]
					}),
					/* @__PURE__ */ jsx("p", {
						className: "text-[11px] text-zinc-600",
						children: "Starts from the colours you see now. Edits apply live and save automatically."
					})
				]
			}),
			customs.length > 0 && /* @__PURE__ */ jsx("ul", {
				className: "space-y-2",
				children: customs.map((c) => /* @__PURE__ */ jsxs("li", {
					className: "flex items-center gap-2",
					children: [
						/* @__PURE__ */ jsx("input", {
							className: field,
							value: c.name,
							"aria-label": `Rename palette ${c.name}`,
							onChange: (e) => renameCustom(c.id, e.target.value),
							onBlur: (e) => !e.target.value.trim() && renameCustom(c.id, "Untitled palette"),
							maxLength: 60
						}),
						c.id === active.id ? /* @__PURE__ */ jsxs("span", {
							className: "flex w-16 shrink-0 items-center justify-center gap-0.5 text-[11px] font-semibold",
							children: [/* @__PURE__ */ jsx(Check, {
								className: "w-3.5 h-3.5",
								"aria-hidden": "true"
							}), " Editing"]
						}) : /* @__PURE__ */ jsx("button", {
							type: "button",
							className: `${btn} w-16 shrink-0`,
							onClick: () => selectTheme(c.id),
							children: "Edit"
						}),
						/* @__PURE__ */ jsx("button", {
							type: "button",
							className: `${btn} shrink-0 px-2`,
							"aria-label": `Delete palette ${c.name}`,
							onClick: () => {
								if (!window.confirm(`Delete “${c.name}”?`)) return;
								deleteCustom(c.id);
								toast(`Deleted “${c.name}” from Yours.`);
							},
							children: /* @__PURE__ */ jsx(Trash2, {
								className: "w-3.5 h-3.5",
								"aria-hidden": "true"
							})
						})
					]
				}, c.id))
			}),
			activeCustom ? /* @__PURE__ */ jsxs("div", {
				className: "space-y-2",
				children: [/* @__PURE__ */ jsxs("h3", {
					className: "text-xs font-semibold text-zinc-800",
					children: [
						"Editing “",
						activeCustom.name,
						"”"
					]
				}), /* @__PURE__ */ jsx(TokenEditor, {
					values: activeCustom.tokens,
					onChange: (key, value) => updateCustomToken(activeCustom.id, key, value),
					note: (key) => key in state.overrides ? "Hidden by an override" : null
				})]
			}) : /* @__PURE__ */ jsx("p", {
				className: "text-xs text-zinc-600",
				children: "Create a palette, or choose Edit on a saved one, to change its colours."
			})
		]
	});
}
function Overrides() {
	const { tokens, state, setOverride, clearOverride, clearOverrides, active } = useTheme();
	const { toast } = usePanel();
	const overridden = state.overrides;
	return /* @__PURE__ */ jsxs("div", {
		className: "space-y-3",
		children: [
			/* @__PURE__ */ jsx(IssuesLink, {}),
			/* @__PURE__ */ jsxs("p", {
				className: "text-xs text-zinc-600",
				children: [
					"Change individual colours on top of ",
					/* @__PURE__ */ jsx("strong", {
						className: "font-semibold text-zinc-800",
						children: active.name
					}),
					". Overrides stay when you switch themes."
				]
			}),
			Object.keys(overridden).length > 0 && /* @__PURE__ */ jsxs("div", {
				className: "rounded-lg bg-zinc-100 p-2.5 text-xs",
				children: [/* @__PURE__ */ jsxs("p", {
					className: "font-medium text-zinc-800",
					children: ["Overridden: ", Object.keys(overridden).map((k) => TOKEN_LABELS[k]).join(", ")]
				}), /* @__PURE__ */ jsxs("button", {
					type: "button",
					className: `${btn} mt-2`,
					onClick: () => {
						const n = Object.keys(overridden).length;
						clearOverrides();
						toast(`Cleared ${n} single-colour ${n === 1 ? "override" : "overrides"}.`);
					},
					children: [/* @__PURE__ */ jsx(RotateCcw, {
						className: "w-3.5 h-3.5",
						"aria-hidden": "true"
					}), " Reset all overrides"]
				})]
			}),
			/* @__PURE__ */ jsx(TokenEditor, {
				values: tokens,
				onChange: setOverride,
				overridden,
				onReset: clearOverride
			})
		]
	});
}
/** Picker + hex input for every token, grouped. Rows involved in a failing pairing get a warning. */
function TokenEditor({ values, onChange, overridden = {}, onReset, note }) {
	const { issues } = useTheme();
	const failing = useMemo(() => new Set(issues.flatMap((i) => i.pairing.fixable)), [issues]);
	return /* @__PURE__ */ jsx("div", {
		className: "space-y-3",
		children: TOKEN_GROUPS.map((g) => /* @__PURE__ */ jsxs("fieldset", {
			className: "min-w-0 space-y-1.5",
			children: [/* @__PURE__ */ jsx("legend", {
				className: "mb-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-600",
				children: g.group
			}), g.tokens.map((t) => /* @__PURE__ */ jsx(TokenRow, {
				token: t,
				value: values[t.key],
				onChange: (v) => onChange(t.key, v),
				isOverridden: t.key in overridden,
				onReset: onReset && (() => onReset(t.key)),
				warn: failing.has(t.key),
				note: note?.(t.key)
			}, t.key))]
		}, g.group))
	});
}
function TokenRow({ token, value, onChange, isOverridden, onReset, warn, note }) {
	const { usage } = useTheme();
	const id = useId();
	const [draft, setDraft] = useState(value);
	const focused = useRef(false);
	useEffect(() => {
		if (!focused.current) setDraft(value);
	}, [value]);
	const commit = (text) => {
		setDraft(text);
		const hex = normalizeHex(text);
		if (hex && /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.test(text.trim())) onChange(hex);
	};
	const invalid = !normalizeHex(draft);
	return /* @__PURE__ */ jsxs("div", {
		className: `flex items-center gap-2 rounded-lg px-1.5 py-1 ${isOverridden ? "bg-sky-50" : ""}`,
		children: [
			/* @__PURE__ */ jsx("input", {
				type: "color",
				value,
				onChange: (e) => onChange(e.target.value),
				"aria-label": `${token.label} colour picker`,
				className: "h-7 w-9 shrink-0 cursor-pointer rounded border border-zinc-300 bg-white p-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900"
			}),
			/* @__PURE__ */ jsxs("div", {
				className: "min-w-0 flex-1",
				children: [/* @__PURE__ */ jsxs("label", {
					htmlFor: id,
					className: "flex items-center gap-1 text-xs font-medium text-zinc-900",
					children: [
						/* @__PURE__ */ jsx("span", {
							className: "truncate",
							children: token.label
						}),
						warn && /* @__PURE__ */ jsxs("span", {
							className: "flex items-center text-amber-700",
							"data-tip": "Part of a failing contrast pairing",
							children: [/* @__PURE__ */ jsx(AlertTriangle, {
								className: "w-3 h-3",
								"aria-hidden": "true"
							}), /* @__PURE__ */ jsx("span", {
								className: "sr-only",
								children: "(contrast problem)"
							})]
						}),
						isOverridden && /* @__PURE__ */ jsx("span", {
							className: "rounded bg-sky-100 px-1 text-[10px] font-semibold text-sky-900",
							children: "Overridden"
						})
					]
				}), /* @__PURE__ */ jsx("p", {
					className: "truncate text-[11px] text-zinc-600",
					children: note ?? usage[token.key] ?? token.usage
				})]
			}),
			/* @__PURE__ */ jsx("input", {
				id,
				value: draft,
				onChange: (e) => commit(e.target.value),
				onFocus: () => focused.current = true,
				onBlur: () => {
					focused.current = false;
					setDraft(value);
				},
				spellCheck: false,
				"aria-invalid": invalid,
				className: `w-[5.5rem] shrink-0 rounded-md border px-2 py-1 font-mono text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 ${invalid ? "border-red-600" : "border-zinc-300"}`
			}),
			onReset && /* @__PURE__ */ jsx("button", {
				type: "button",
				onClick: onReset,
				disabled: !isOverridden,
				"aria-label": `Reset ${token.label} override`,
				className: `${btn} shrink-0 px-1.5 ${isOverridden ? "" : "invisible"}`,
				children: /* @__PURE__ */ jsx(RotateCcw, {
					className: "w-3.5 h-3.5",
					"aria-hidden": "true"
				})
			})
		]
	});
}
var FROM_NOTE = {
	image: "Picked from the picture’s main colours.",
	pdf: "Picked from the colours on the first pages.",
	"pdf-text": "Found colour codes written in the PDF."
};
var IS_MAC = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
/** The paste shortcut, as the visitor's keyboard shows it. */
var PASTE_KEYS = IS_MAC ? "⌘V" : "Ctrl+V";
var PASTED = "Pasted image";
/** The first image (or PDF) in a clipboard's files: a screenshot, or a copied picture. */
var fileFromClipboard = (data) => [...data?.files ?? []].find((f) => f.type.startsWith("image/") || f.type === "application/pdf");
/**
* Builds a custom palette from the colours in an image (uploaded, dropped or pasted from the
* clipboard), or a PDF where the site allows it.
*/
function PaletteFromFile() {
	const { addPalette, loadPdf } = useTheme();
	const kinds = loadPdf ? "image or PDF" : "image";
	const savedToYours = useSavedToYours();
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState(null);
	const [found, setFound] = useState(null);
	const [off, setOff] = useState(() => /* @__PURE__ */ new Set());
	const [name, setName] = useState("");
	const [dragOver, setDragOver] = useState(false);
	const [picture, setPicture] = useState(null);
	const [flash, setFlash] = useState(false);
	const fileRef = useRef(null);
	const zoneRef = useRef(null);
	const nameId = useId();
	const chosen = found ? found.colours.filter((c) => !off.has(c)) : [];
	const preview = useMemo(() => chosen.length ? themeFromPalette(chosen) : null, [chosen.join()]);
	useEffect(() => () => picture?.url && URL.revokeObjectURL(picture.url), [picture?.url]);
	useEffect(() => {
		if (!picture?.pasted) return;
		const still = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
		zoneRef.current?.scrollIntoView({
			block: "nearest",
			behavior: still ? "auto" : "smooth"
		});
	}, [picture?.url, picture?.pasted]);
	useEffect(() => {
		if (!flash) return;
		const t = setTimeout(() => setFlash(false), 1200);
		return () => clearTimeout(t);
	}, [flash]);
	/**
	* @param {string} [label]  what to call the file; pasted images have no useful name
	* @param {boolean} [pasted]
	*/
	const read = async (file, label = file?.name, pasted = false) => {
		if (!file) return;
		setBusy(true);
		setError(null);
		setFound(null);
		setPicture({
			url: file.type.startsWith("image/") ? URL.createObjectURL(file) : null,
			label,
			pasted
		});
		try {
			const { colours, from } = await coloursFromFile(file, { loadPdf });
			if (!colours.length) throw new Error("Couldn’t find any colours in that file.");
			setFound({
				fileName: label,
				colours,
				from
			});
			setOff(/* @__PURE__ */ new Set());
			setName(label.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim().slice(0, 60) || "Uploaded palette");
		} catch (e) {
			setPicture(null);
			setError(e.message || "Couldn’t read that file.");
		} finally {
			setBusy(false);
		}
	};
	const clear = () => {
		setFound(null);
		setPicture(null);
	};
	/** Reads a pasted image, opening Import / export first if it's collapsed, so the result shows. */
	const readPasted = (file) => {
		const section = zoneRef.current?.closest("details");
		if (section && !section.open) section.open = true;
		setFlash(true);
		read(file, PASTED, true);
	};
	const readPastedRef = useRef(readPasted);
	readPastedRef.current = readPasted;
	useEffect(() => {
		const root = zoneRef.current?.getRootNode();
		if (!root) return;
		const onPaste = (e) => {
			const file = fileFromClipboard(e.clipboardData);
			if (!file) return;
			const target = e.composedPath()[0];
			if (target instanceof HTMLElement && (target.isContentEditable || target.localName === "input" || target.localName === "textarea") && e.clipboardData.types.includes("text/plain")) return;
			e.preventDefault();
			readPastedRef.current(file);
		};
		root.addEventListener("paste", onPaste);
		return () => root.removeEventListener("paste", onPaste);
	}, []);
	const pasteFromClipboard = async () => {
		setError(null);
		if (!navigator.clipboard?.read) {
			setError(`This browser can’t paste from a button. Press ${PASTE_KEYS} instead.`);
			return;
		}
		try {
			for (const item of await navigator.clipboard.read()) {
				const type = item.types.find((t) => t.startsWith("image/"));
				if (type) return readPasted(new File([await item.getType(type)], PASTED, { type }));
			}
			setError("There’s no image on the clipboard. Take a screenshot or copy a picture, then paste.");
		} catch {
			setError(`Couldn’t read the clipboard. Press ${PASTE_KEYS} to paste instead.`);
		}
	};
	const create = () => {
		addPalette(name, preview);
		savedToYours(name.trim() || "Uploaded palette");
		clear();
	};
	return /* @__PURE__ */ jsxs("div", {
		className: "space-y-1.5",
		children: [
			/* @__PURE__ */ jsxs("p", {
				className: "text-xs font-medium text-zinc-700",
				children: ["Palette from an ", kinds]
			}),
			/* @__PURE__ */ jsxs("div", {
				ref: zoneRef,
				onDragOver: (e) => {
					e.preventDefault();
					setDragOver(true);
				},
				onDragLeave: () => setDragOver(false),
				onDrop: (e) => {
					e.preventDefault();
					setDragOver(false);
					read(e.dataTransfer.files?.[0]);
				},
				className: `rounded-xl border border-dashed p-3 text-center transition-shadow motion-reduce:transition-none ${dragOver || flash ? "border-zinc-900 bg-zinc-100" : "border-zinc-300 bg-zinc-50"} ${flash ? "ring-2 ring-zinc-900 ring-offset-1" : ""}`,
				children: [
					picture && /* @__PURE__ */ jsxs("figure", {
						className: "mb-2.5 flex items-center gap-3 rounded-lg border border-zinc-200 bg-white p-2 text-left",
						children: [
							picture.url ? /* @__PURE__ */ jsx("img", {
								src: picture.url,
								alt: picture.label,
								className: "h-16 w-24 shrink-0 rounded-md border border-zinc-200 bg-zinc-100 object-contain",
								onLoad: (e) => {
									const { naturalWidth: w, naturalHeight: h, src } = e.currentTarget;
									setPicture((p) => p && p.url === src ? {
										...p,
										size: `${w} × ${h}`
									} : p);
								}
							}) : /* @__PURE__ */ jsx("span", {
								className: "grid h-16 w-24 shrink-0 place-items-center rounded-md border border-zinc-200 bg-zinc-100 font-mono text-xs font-semibold text-zinc-600",
								"aria-hidden": "true",
								children: "PDF"
							}),
							/* @__PURE__ */ jsxs("figcaption", {
								role: "status",
								className: "min-w-0 flex-1 space-y-0.5 text-[11px] text-zinc-600",
								children: [
									/* @__PURE__ */ jsxs("span", {
										className: "flex items-center gap-1 font-medium text-zinc-900",
										children: [busy ? /* @__PURE__ */ jsx(Loader2, {
											className: "w-3.5 h-3.5 animate-spin motion-reduce:animate-none",
											"aria-hidden": "true"
										}) : /* @__PURE__ */ jsx(CheckCircle2, {
											className: "w-3.5 h-3.5 text-emerald-800",
											"aria-hidden": "true"
										}), picture.pasted ? "Image pasted" : picture.url ? "Image added" : "PDF added"]
									}),
									/* @__PURE__ */ jsxs("span", {
										className: "block truncate",
										children: [picture.label, picture.size ? ` · ${picture.size}` : ""]
									}),
									/* @__PURE__ */ jsx("span", {
										className: "block",
										children: busy ? "Reading its colours…" : "Its colours are below."
									})
								]
							}),
							/* @__PURE__ */ jsx("button", {
								type: "button",
								className: `${btn} shrink-0 border-transparent px-1.5`,
								onClick: clear,
								"aria-label": `Remove ${picture.label}`,
								"data-tip": "Remove",
								children: /* @__PURE__ */ jsx(X, {
									className: "w-3.5 h-3.5",
									"aria-hidden": "true"
								})
							})
						]
					}),
					/* @__PURE__ */ jsxs("button", {
						type: "button",
						className: btn,
						onClick: () => fileRef.current?.click(),
						disabled: busy,
						"aria-busy": busy,
						children: [busy ? /* @__PURE__ */ jsx(Loader2, {
							className: "w-3.5 h-3.5 animate-spin motion-reduce:animate-none",
							"aria-hidden": "true"
						}) : /* @__PURE__ */ jsx(ImageUp, {
							className: "w-3.5 h-3.5",
							"aria-hidden": "true"
						}), busy ? "Reading colours…" : picture ? "Choose another…" : `Choose ${kinds}…`]
					}),
					" ",
					/* @__PURE__ */ jsxs("button", {
						type: "button",
						className: btn,
						onClick: pasteFromClipboard,
						disabled: busy,
						"aria-keyshortcuts": IS_MAC ? "Meta+V" : "Control+V",
						children: [/* @__PURE__ */ jsx(ClipboardPaste, {
							className: "w-3.5 h-3.5",
							"aria-hidden": "true"
						}), picture ? "Paste another" : "Paste image"]
					}),
					!picture && /* @__PURE__ */ jsxs("p", {
						className: "mt-1.5 text-[11px] text-zinc-600",
						children: [
							"or drop one here, or press ",
							/* @__PURE__ */ jsx("kbd", {
								className: "font-mono",
								children: PASTE_KEYS
							}),
							" to paste a screenshot. A mood board, screenshot or photo",
							loadPdf ? ", or a brand guide PDF," : "",
							" works."
						]
					}),
					/* @__PURE__ */ jsx("input", {
						ref: fileRef,
						type: "file",
						accept: loadPdf ? "image/*,application/pdf,.pdf" : "image/*",
						className: "sr-only",
						tabIndex: -1,
						"aria-hidden": "true",
						onChange: (e) => {
							read(e.target.files?.[0]);
							e.target.value = "";
						}
					})
				]
			}),
			found && /* @__PURE__ */ jsxs("div", {
				className: "space-y-2 rounded-xl border border-zinc-200 p-3",
				children: [
					/* @__PURE__ */ jsxs("p", {
						className: "text-[11px] text-zinc-600",
						children: [
							/* @__PURE__ */ jsx("span", {
								className: "font-medium text-zinc-900",
								children: found.fileName
							}),
							": ",
							FROM_NOTE[found.from],
							" Select a colour to leave it out."
						]
					}),
					/* @__PURE__ */ jsx("div", {
						role: "group",
						"aria-label": "Colours found",
						className: "flex flex-wrap gap-1.5",
						children: found.colours.map((hex) => {
							const on = !off.has(hex);
							return /* @__PURE__ */ jsx("button", {
								type: "button",
								"aria-pressed": on,
								"aria-label": `${hex}${on ? "" : " (left out)"}`,
								"data-tip": hex,
								onClick: () => setOff((prev) => {
									const next = new Set(prev);
									if (next.has(hex)) next.delete(hex);
									else next.add(hex);
									return next;
								}),
								className: `h-7 w-7 rounded-md border cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-1 ${on ? "border-zinc-300" : "border-zinc-300 opacity-25"}`,
								style: { background: hex }
							}, hex);
						})
					}),
					preview ? /* @__PURE__ */ jsxs(Fragment, { children: [/* @__PURE__ */ jsx("p", {
						className: "text-[11px] text-zinc-600",
						children: "The palette it builds:"
					}), /* @__PURE__ */ jsx(Swatches, { tokens: preview })] }) : /* @__PURE__ */ jsx("p", {
						className: "text-[11px] text-zinc-600",
						children: "Keep at least one colour to build a palette."
					}),
					/* @__PURE__ */ jsx("label", {
						htmlFor: nameId,
						className: "block text-xs font-medium text-zinc-700",
						children: "Palette name"
					}),
					/* @__PURE__ */ jsx("input", {
						id: nameId,
						className: field,
						value: name,
						onChange: (e) => setName(e.target.value),
						maxLength: 60
					}),
					/* @__PURE__ */ jsxs("div", {
						className: "flex gap-2",
						children: [/* @__PURE__ */ jsx("button", {
							type: "button",
							className: btnPrimary,
							onClick: create,
							disabled: !preview,
							children: "Create palette"
						}), /* @__PURE__ */ jsx("button", {
							type: "button",
							className: btn,
							onClick: clear,
							children: "Discard"
						})]
					})
				]
			}),
			error && /* @__PURE__ */ jsx("p", {
				role: "alert",
				className: "text-xs text-red-700",
				children: error
			})
		]
	});
}
function ImportExport() {
	const { exportTheme, importTheme } = useTheme();
	const { toast } = usePanel();
	const savedToYours = useSavedToYours();
	const json = exportTheme();
	const [status, setStatus] = useState(null);
	const [input, setInput] = useState("");
	const exportId = useId();
	const importId = useId();
	const fileRef = useRef(null);
	const doImport = (text) => {
		const err = importTheme(text);
		setStatus(err ? {
			ok: false,
			text: err
		} : null);
		if (err) return;
		setInput("");
		let name = "Imported palette";
		try {
			name = JSON.parse(text).name?.trim() || name;
		} catch {}
		savedToYours(name, "Imported");
	};
	return /* @__PURE__ */ jsxs("div", {
		className: "space-y-4",
		children: [
			/* @__PURE__ */ jsx(PaletteFromFile, {}),
			/* @__PURE__ */ jsxs("div", {
				className: "space-y-1.5",
				children: [
					/* @__PURE__ */ jsx("label", {
						htmlFor: exportId,
						className: "block text-xs font-medium text-zinc-700",
						children: "Current theme as JSON"
					}),
					/* @__PURE__ */ jsx("textarea", {
						id: exportId,
						readOnly: true,
						value: json,
						rows: 5,
						className: `${field} font-mono text-[11px]`
					}),
					/* @__PURE__ */ jsxs("div", {
						className: "flex gap-2",
						children: [/* @__PURE__ */ jsxs("button", {
							type: "button",
							className: btn,
							onClick: async () => {
								try {
									await navigator.clipboard.writeText(json);
									setStatus(null);
									toast("Copied the theme JSON to your clipboard.");
								} catch {
									setStatus({
										ok: false,
										text: "Couldn’t access the clipboard; select the text and copy it instead."
									});
								}
							},
							children: [/* @__PURE__ */ jsx(Copy, {
								className: "w-3.5 h-3.5",
								"aria-hidden": "true"
							}), " Copy"]
						}), /* @__PURE__ */ jsxs("button", {
							type: "button",
							className: btn,
							onClick: () => {
								const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
								const a = document.createElement("a");
								a.href = url;
								a.download = `${JSON.parse(json).name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.theme.json`;
								a.click();
								toast(`Downloaded ${a.download}.`);
								URL.revokeObjectURL(url);
							},
							children: [/* @__PURE__ */ jsx(Download, {
								className: "w-3.5 h-3.5",
								"aria-hidden": "true"
							}), " Download"]
						})]
					})
				]
			}),
			/* @__PURE__ */ jsxs("div", {
				className: "space-y-1.5",
				children: [
					/* @__PURE__ */ jsx("label", {
						htmlFor: importId,
						className: "block text-xs font-medium text-zinc-700",
						children: "Paste a theme JSON to import"
					}),
					/* @__PURE__ */ jsx("textarea", {
						id: importId,
						value: input,
						onChange: (e) => setInput(e.target.value),
						rows: 4,
						placeholder: "{ \"name\": \"My theme\", \"tokens\": { \"primary\": \"#7fd4f5\" } }",
						className: `${field} font-mono text-[11px]`
					}),
					/* @__PURE__ */ jsxs("div", {
						className: "flex gap-2",
						children: [
							/* @__PURE__ */ jsx("button", {
								type: "button",
								className: btnPrimary,
								disabled: !input.trim(),
								onClick: () => doImport(input),
								children: "Import"
							}),
							/* @__PURE__ */ jsxs("button", {
								type: "button",
								className: btn,
								onClick: () => fileRef.current?.click(),
								children: [/* @__PURE__ */ jsx(Upload, {
									className: "w-3.5 h-3.5",
									"aria-hidden": "true"
								}), " From file…"]
							}),
							/* @__PURE__ */ jsx("input", {
								ref: fileRef,
								type: "file",
								accept: "application/json,.json",
								className: "sr-only",
								tabIndex: -1,
								"aria-hidden": "true",
								onChange: async (e) => {
									const file = e.target.files?.[0];
									if (file) doImport(await file.text());
									e.target.value = "";
								}
							})
						]
					})
				]
			}),
			status && /* @__PURE__ */ jsx("p", {
				role: "status",
				className: `text-xs ${status.ok ? "text-emerald-800" : "text-red-700"}`,
				children: status.text
			})
		]
	});
}
//#endregion
//#region src/audit.js
/** Elements read, at most, so audits stay quick on huge pages. */
var MAX_ELEMENTS = 3e3;
var SKIP = "colorsbymax-root";
var parser = () => {
	const ctx = Object.assign(document.createElement("canvas"), {
		width: 1,
		height: 1
	}).getContext("2d", { willReadFrequently: true });
	return (css) => {
		if (!css || css === "none" || css === "transparent") return null;
		ctx.clearRect(0, 0, 1, 1);
		ctx.fillStyle = "#000";
		ctx.fillStyle = css;
		ctx.fillRect(0, 0, 1, 1);
		const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
		return a < 128 ? null : rgbToHex([
			r,
			g,
			b
		]);
	};
};
var visible = (el) => {
	if (el.checkVisibility && !el.checkVisibility({
		opacityProperty: true,
		visibilityProperty: true
	})) return false;
	const r = el.getBoundingClientRect();
	return r.width > 2 && r.height > 2;
};
var ownText = (el) => [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
/** A short quote of an element's text for its note, cut at a word. */
var describe = (el) => {
	const text = (el.getAttribute("aria-label") || el.alt || el.textContent || "").trim().replace(/\s+/g, " ");
	if (text.length <= 48) return text;
	const cut = text.slice(0, 48);
	const space = cut.lastIndexOf(" ");
	return `${(space > 20 ? cut.slice(0, space) : cut).replace(/[,.;:]$/, "")}…`;
};
var fmt = (r) => `${(Math.floor(r * 10) / 10).toFixed(1)}:1`;
/**
* Samples an image's corners and middle (for a solid background and an overall colour). Returns
* null when the browser won't allow reading it (a cross-origin image without CORS).
*/
function sampleImage(img) {
	try {
		const w = 24;
		const h = Math.max(1, Math.round(img.naturalHeight / Math.max(1, img.naturalWidth) * w));
		const ctx = Object.assign(document.createElement("canvas"), {
			width: w,
			height: h
		}).getContext("2d", { willReadFrequently: true });
		ctx.drawImage(img, 0, 0, w, h);
		const data = ctx.getImageData(0, 0, w, h).data;
		const at = (x, y) => {
			const i = (y * w + x) * 4;
			return data[i + 3] < 200 ? null : rgbToHex([
				data[i],
				data[i + 1],
				data[i + 2]
			]);
		};
		const corners = [
			at(0, 0),
			at(23, 0),
			at(0, h - 1),
			at(23, h - 1)
		];
		let r = 0, g = 0, b = 0, n = 0;
		for (let i = 0; i < data.length; i += 4) {
			if (data[i + 3] < 128) continue;
			r += data[i];
			g += data[i + 1];
			b += data[i + 2];
			n++;
		}
		return {
			corners,
			average: n ? rgbToHex([
				r / n,
				g / n,
				b / n
			].map(Math.round)) : null,
			transparent: n < data.length / 4 * .9
		};
	} catch {
		return null;
	}
}
/**
* Audits the page as painted now.
* @param {{ logoColouring: boolean }} options
* @returns {{ id: string, el: Element, title: string, message: string, action?: 'colour-logo' | 'invert' }[]}
*/
function runAudit({ logoColouring }) {
	const parse = parser();
	const findings = [];
	const flagged = /* @__PURE__ */ new Set();
	const add = (el, finding) => {
		for (let n = el; n; n = n.parentElement) if (flagged.has(n)) return;
		flagged.add(el);
		findings.push({
			id: `${finding.kind}-${findings.length}`,
			el,
			...finding
		});
	};
	const cache = /* @__PURE__ */ new WeakMap();
	const behind = (el) => {
		if (!el || el.nodeType !== 1) return parse(getComputedStyle(document.documentElement).backgroundColor) ?? "#ffffff";
		if (cache.has(el)) return cache.get(el);
		const cs = getComputedStyle(el);
		let out;
		const own = parse(cs.backgroundColor);
		if (own) out = own;
		else if (/url\(/.test(cs.backgroundImage)) out = null;
		else out = el === document.body ? parse(getComputedStyle(document.documentElement).backgroundColor) ?? "#ffffff" : behind(el.parentElement);
		cache.set(el, out);
		return out;
	};
	const pageBg = behind(document.body) ?? "#ffffff";
	const darkPage = luminance(pageBg) < .2;
	for (const logo of document.querySelectorAll(LOGO_SELECTOR)) {
		if (logo.closest(SKIP) || !visible(logo)) continue;
		if (logo.parentElement?.closest(LOGO_SELECTOR)) continue;
		const bg = behind(logo.parentElement) ?? pageBg;
		const img = logo.localName === "img" ? logo : logo.querySelector("img");
		if (img && img.complete && img.naturalWidth) {
			const sample = sampleImage(img);
			const ratio = sample?.average ? contrastRatio(sample.average, bg) : null;
			if (ratio !== null && ratio < 3) add(img, {
				kind: "logo-image",
				title: "Logo is hard to see here",
				message: `Your logo is a picture, which colorsbymax can’t re-colour, and it reads at only ${fmt(ratio)} on this background. Use a transparent SVG (which colorsbymax can colour), or add a version made for ${darkPage ? "dark" : "light"} backgrounds.`,
				action: "invert"
			});
			else if (sample === null) add(img, {
				kind: "logo-image",
				title: "Check your logo here",
				message: `Your logo is a picture, which colorsbymax can’t re-colour. Check it still reads on this ${darkPage ? "dark" : "light"} background, or use a transparent SVG instead.`,
				action: "invert"
			});
			continue;
		}
		const painted = ownText(logo) ? logo : [...logo.querySelectorAll("*")].find((n) => ownText(n) || n instanceof SVGElement) ?? logo;
		const cs = getComputedStyle(painted);
		const fg = parse(painted instanceof SVGElement ? cs.fill !== "none" ? cs.fill : cs.stroke : cs.color);
		if (!fg) continue;
		const ratio = contrastRatio(fg, bg);
		if (ratio < 3) add(logo, {
			kind: "logo",
			title: "Logo is hard to see here",
			message: logoColouring ? `Your logo reads at only ${fmt(ratio)} on this background. Try another theme, or give the logo its own colour.` : `Your logo keeps its own colours, which read at only ${fmt(ratio)} on this background. Let colorsbymax colour it to match the theme, or pick a theme it suits.`,
			action: logoColouring ? void 0 : "colour-logo"
		});
	}
	for (const img of document.images) {
		if (img.closest(SKIP) || !img.complete || !img.naturalWidth || !visible(img)) continue;
		const rect = img.getBoundingClientRect();
		if (rect.width < 24 || rect.height < 24) continue;
		const sample = sampleImage(img);
		if (!sample || sample.transparent) continue;
		if (!sample.corners.every((c) => c && contrastRatio(c, sample.corners[0]) < 1.15)) continue;
		const bg = behind(img.parentElement) ?? pageBg;
		if (contrastRatio(sample.corners[0], bg) >= 1.6) {
			const light = luminance(sample.corners[0]) > luminance(bg);
			add(img, {
				kind: "image-box",
				title: `Picture shows as a ${light ? "light" : "dark"} box`,
				message: `This picture has a solid ${light ? "light" : "dark"} background that stands out against this ${luminance(bg) < .2 ? "dark" : "light"} page. A transparent PNG or an SVG would blend in with any theme.`,
				action: img.closest(LOGO_SELECTOR) ? "invert" : void 0
			});
		}
	}
	const elements = [...document.body.querySelectorAll("*")].slice(0, MAX_ELEMENTS);
	for (const el of elements) {
		if (el.closest(SKIP) || el.closest(LOGO_SELECTOR)) continue;
		const svg = el.localName === "svg";
		if (!svg && !ownText(el)) continue;
		if (!visible(el)) continue;
		const cs = getComputedStyle(el);
		if (cs.backgroundClip === "text" || cs.webkitBackgroundClip === "text") continue;
		const fg = parse(svg ? cs.stroke !== "none" ? cs.stroke : cs.fill : cs.color);
		const bg = behind(el);
		if (!fg || !bg) continue;
		const size = parseFloat(cs.fontSize);
		const large = size >= 24 || size >= 18.66 && Number(cs.fontWeight) >= 700;
		const needed = svg || large ? 3 : 4.5;
		const ratio = contrastRatio(fg, bg);
		if (ratio >= needed) continue;
		add(el, {
			kind: svg ? "icon" : "text",
			title: `${svg ? "Icon" : "Text"} is hard to read`,
			message: `${describe(el) ? `“${describe(el)}” ` : ""}reads at ${fmt(ratio)} here; ${svg ? "icons" : large ? "large text" : "text"} needs ${needed}:1. Try another theme, or adjust it under “Override a single colour”.`
		});
	}
	return findings;
}
//#endregion
//#region src/AuditLayer.jsx
var CARD_WIDTH = 264;
var GAP = 10;
var EDGE$1 = 12;
/** Space kept between two notes. */
var APART = 8;
/** A note's height before it has been measured. */
var GUESS_HEIGHT = 150;
/** Below this width, only one note is open at a time; the numbered badges pick which. */
var COMPACT_WIDTH = 640;
/**
* The audit on the page: each finding outlined where it is, with a numbered card pointing at it,
* kept in place as the page scrolls; and a bar by the colour button to re-check or close.
*/
function AuditLayer({ findings, anchor, themeIssues, onRecheck, onClose, onAction }) {
	const [rects, setRects] = useState([]);
	const [dismissed, setDismissed] = useState(() => /* @__PURE__ */ new Set());
	const [inverted, setInverted] = useState(() => /* @__PURE__ */ new Set());
	const [selected, setSelected] = useState(null);
	const [anchorRect, setAnchorRect] = useState(null);
	const pinned = findings.filter((f) => !dismissed.has(f.id)).slice(0, 8);
	const hiddenCount = findings.filter((f) => !dismissed.has(f.id)).length - pinned.length;
	useEffect(() => setDismissed(/* @__PURE__ */ new Set()), [findings]);
	useLayoutEffect(() => {
		let frame = 0;
		const measure = () => {
			frame = 0;
			setRects(pinned.map((f) => f.el.isConnected ? f.el.getBoundingClientRect() : null));
			setAnchorRect(anchor.current?.getBoundingClientRect() ?? null);
		};
		const schedule = () => {
			if (!frame) frame = requestAnimationFrame(measure);
		};
		measure();
		window.addEventListener("scroll", schedule, true);
		window.addEventListener("resize", schedule);
		const timer = setInterval(schedule, 500);
		return () => {
			cancelAnimationFrame(frame);
			clearInterval(timer);
			window.removeEventListener("scroll", schedule, true);
			window.removeEventListener("resize", schedule);
		};
	}, [findings, dismissed]);
	useEffect(() => {
		for (const f of findings) f.el.toggleAttribute("data-colorsbymax-invert", inverted.has(f.id));
		return () => {
			for (const f of findings) f.el.removeAttribute("data-colorsbymax-invert");
		};
	}, [inverted, findings]);
	useEffect(() => {
		const style = document.createElement("style");
		style.dataset.colorsbymax = "audit";
		style.textContent = "[data-colorsbymax-invert]{filter:invert(1) hue-rotate(180deg)!important}";
		document.head.append(style);
		return () => style.remove();
	}, []);
	const vw = document.documentElement.clientWidth;
	const vh = document.documentElement.clientHeight;
	const open = findings.filter((f) => !dismissed.has(f.id)).length;
	const heights = useRef({});
	const layerRef = useRef(null);
	useLayoutEffect(() => {
		for (const note of layerRef.current?.querySelectorAll("[data-note]") ?? []) heights.current[note.dataset.note] = note.offsetHeight;
	});
	const placed = [];
	const compact = vw < COMPACT_WIDTH;
	const openId = pinned.some((f) => f.id === selected) ? selected : pinned[0]?.id;
	const showsNote = (f) => !compact || f.id === openId;
	const placements = pinned.map((f, i) => {
		const r = rects[i];
		if (!r || r.bottom < 0 || r.top > vh || !showsNote(f)) return null;
		const h = heights.current[f.id] ?? GUESS_HEIGHT;
		const below = r.bottom + GAP + h < vh || r.top < h + GAP;
		let top = below ? r.bottom + GAP : r.top - GAP - h;
		let left = Math.min(Math.max(r.left + r.width / 2 - CARD_WIDTH / 2, EDGE$1), vw - CARD_WIDTH - EDGE$1);
		for (let tries = 0; tries < placed.length + 1; tries++) {
			const hit = placed.find((p) => left < p.left + CARD_WIDTH + APART && left + CARD_WIDTH + APART > p.left && top < p.top + p.h + APART && top + h + APART > p.top);
			if (!hit) break;
			if (hit.left + 2 * CARD_WIDTH + APART + EDGE$1 <= vw) left = hit.left + CARD_WIDTH + APART;
			else top = hit.top + hit.h + APART;
		}
		placed.push({
			left,
			top,
			h
		});
		const arrow = Math.min(Math.max(r.left + r.width / 2 - left, 16), 248);
		const pointing = below ? Math.abs(top - (r.bottom + GAP)) < 2 : Math.abs(top + h - (r.top - GAP)) < 2;
		return {
			left: Math.round(left),
			top: Math.round(top),
			below,
			arrow: Math.round(arrow),
			pointing
		};
	});
	return /* @__PURE__ */ jsxs("div", {
		ref: layerRef,
		children: [pinned.map((f, i) => {
			const r = rects[i];
			if (!r || r.bottom < 0 || r.top > vh) return null;
			const place = placements[i];
			return /* @__PURE__ */ jsxs("div", { children: [
				/* @__PURE__ */ jsx("div", {
					"aria-hidden": "true",
					className: "pointer-events-none fixed z-[55] rounded-md border-2 border-dashed border-amber-400",
					style: {
						left: r.left - 4,
						top: r.top - 4,
						width: r.width + 8,
						height: r.height + 8
					}
				}),
				compact ? /* @__PURE__ */ jsx("button", {
					type: "button",
					"aria-label": `Show audit finding ${i + 1}: ${f.title}`,
					"aria-pressed": f.id === openId,
					onClick: () => setSelected(f.id),
					className: `fixed z-[57] grid h-6 w-6 place-items-center rounded-full bg-amber-400 text-[11px] font-bold text-zinc-900 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 ${f.id === openId ? "ring-2 ring-white" : ""}`,
					style: {
						left: r.left - 14,
						top: r.top - 14
					},
					children: i + 1
				}) : /* @__PURE__ */ jsx("span", {
					"aria-hidden": "true",
					className: "pointer-events-none fixed z-[56] grid h-5 w-5 place-items-center rounded-full bg-amber-400 text-[11px] font-bold text-zinc-900",
					style: {
						left: r.left - 12,
						top: r.top - 12
					},
					children: i + 1
				}),
				place && /* @__PURE__ */ jsxs("div", {
					role: "note",
					"data-note": f.id,
					"aria-label": `Audit finding ${i + 1}: ${f.title}`,
					className: "theme-switcher theme-hint fixed z-[62] rounded-xl border border-zinc-200 bg-white p-3 text-zinc-900 shadow-xl",
					style: {
						left: place.left,
						top: place.top,
						width: CARD_WIDTH
					},
					children: [
						place.pointing && /* @__PURE__ */ jsx("span", {
							"aria-hidden": "true",
							className: `absolute h-2.5 w-2.5 rotate-45 border-zinc-200 bg-white ${place.below ? "-top-[6px] border-l border-t" : "-bottom-[6px] border-b border-r"}`,
							style: { left: place.arrow - 5 }
						}),
						/* @__PURE__ */ jsxs("p", {
							className: "flex items-start gap-1.5 text-xs font-semibold",
							children: [/* @__PURE__ */ jsx("span", {
								className: "grid h-4 w-4 shrink-0 place-items-center rounded-full bg-amber-400 text-[10px] font-bold text-zinc-900",
								children: i + 1
							}), f.title]
						}),
						/* @__PURE__ */ jsx("p", {
							className: "mt-1 text-[11px] leading-snug text-zinc-600",
							children: f.message
						}),
						/* @__PURE__ */ jsxs("div", {
							className: "mt-2 flex flex-wrap gap-1.5",
							children: [
								f.action === "colour-logo" && /* @__PURE__ */ jsx("button", {
									type: "button",
									className: "rounded-lg bg-zinc-900 px-2 py-1 text-[11px] font-medium text-white hover:bg-zinc-700 cursor-pointer",
									onClick: () => onAction("colour-logo"),
									children: "Colour the logo"
								}),
								f.action === "invert" && /* @__PURE__ */ jsxs("button", {
									type: "button",
									"aria-pressed": inverted.has(f.id),
									className: "inline-flex items-center gap-1 rounded-lg border border-zinc-300 bg-white px-2 py-1 text-[11px] font-medium text-zinc-800 hover:bg-zinc-50 cursor-pointer",
									onClick: () => setInverted((s) => {
										const next = new Set(s);
										if (next.has(f.id)) next.delete(f.id);
										else next.add(f.id);
										return next;
									}),
									children: [/* @__PURE__ */ jsx(Contrast, {
										className: "w-3 h-3",
										"aria-hidden": "true"
									}), inverted.has(f.id) ? "Undo preview" : "Preview inverted"]
								}),
								/* @__PURE__ */ jsx("button", {
									type: "button",
									className: "rounded-lg px-2 py-1 text-[11px] font-medium text-zinc-600 hover:bg-zinc-100 cursor-pointer",
									onClick: () => setDismissed((s) => new Set(s).add(f.id)),
									children: "Got it"
								})
							]
						})
					]
				})
			] }, f.id);
		}), /* @__PURE__ */ jsx(AuditBar, {
			anchorRect,
			open,
			hiddenCount,
			themeIssues,
			onRecheck,
			onClose
		})]
	});
}
/** The audit's summary, next to the colour button: what it found, Re-check and Close. */
function AuditBar({ anchorRect, open, hiddenCount, themeIssues, onRecheck, onClose }) {
	const ref = useRef(null);
	const [size, setSize] = useState({
		width: 0,
		height: 0
	});
	useLayoutEffect(() => {
		const r = ref.current?.getBoundingClientRect();
		if (r && (r.width !== size.width || r.height !== size.height)) setSize({
			width: r.width,
			height: r.height
		});
	});
	const vw = document.documentElement.clientWidth;
	const vh = document.documentElement.clientHeight;
	let style = {
		right: EDGE$1,
		bottom: EDGE$1
	};
	if (anchorRect) {
		const onRight = anchorRect.left + anchorRect.width / 2 > vw / 2;
		const top = anchorRect.top + anchorRect.height / 2 < vh / 2 ? Math.round(anchorRect.bottom + GAP) : Math.round(anchorRect.top - GAP - size.height);
		const left = onRight ? Math.round(anchorRect.right - size.width) : Math.round(anchorRect.left);
		style = {
			top,
			left: Math.min(Math.max(EDGE$1, left), vw - size.width - EDGE$1)
		};
	}
	return /* @__PURE__ */ jsxs("div", {
		ref,
		role: "status",
		"aria-live": "polite",
		className: "theme-switcher fixed z-[61] flex max-w-[calc(100vw-80px)] items-center gap-2 rounded-full border border-zinc-200 bg-white py-1.5 pl-3 pr-1.5 text-xs text-zinc-900 shadow-xl",
		style,
		children: [
			/* @__PURE__ */ jsx(ScanSearch, {
				className: "w-4 h-4 shrink-0",
				"aria-hidden": "true"
			}),
			/* @__PURE__ */ jsx("span", {
				className: "font-semibold",
				children: "Audit"
			}),
			open ? /* @__PURE__ */ jsxs("span", {
				className: "flex items-center gap-1 text-zinc-700",
				children: [
					/* @__PURE__ */ jsx(AlertTriangle, {
						className: "w-3.5 h-3.5 text-amber-700",
						"aria-hidden": "true"
					}),
					open,
					" to check",
					hiddenCount > 0 ? ` (${hiddenCount} more after these)` : ""
				]
			}) : /* @__PURE__ */ jsxs("span", {
				className: "flex items-center gap-1 text-zinc-700",
				children: [/* @__PURE__ */ jsx(CheckCircle2, {
					className: "w-3.5 h-3.5 text-emerald-800",
					"aria-hidden": "true"
				}), "Nothing to fix on the page"]
			}),
			themeIssues > 0 && /* @__PURE__ */ jsxs("span", {
				className: "hidden text-zinc-600 sm:inline",
				children: [
					"· theme has ",
					themeIssues,
					" contrast ",
					themeIssues === 1 ? "issue" : "issues",
					" (see the panel)"
				]
			}),
			/* @__PURE__ */ jsxs("button", {
				type: "button",
				onClick: onRecheck,
				className: "inline-flex items-center gap-1 rounded-full border border-zinc-300 px-2 py-1 text-[11px] font-medium hover:bg-zinc-50 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900",
				children: [/* @__PURE__ */ jsx(RotateCcw, {
					className: "w-3 h-3",
					"aria-hidden": "true"
				}), " Re-check"]
			}),
			/* @__PURE__ */ jsx("button", {
				type: "button",
				onClick: onClose,
				"aria-label": "Close the audit",
				className: "grid h-6 w-6 place-items-center rounded-full hover:bg-zinc-100 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900",
				children: /* @__PURE__ */ jsx(X, {
					className: "w-3.5 h-3.5",
					"aria-hidden": "true"
				})
			})
		]
	});
}
//#endregion
//#region src/panel-css.generated.js
var panel_css_generated_default = "/*! tailwindcss v4.3.3 | MIT License | https://tailwindcss.com */\n@layer properties{@supports (display:block){*,:before,:after,::backdrop{--tw-translate-x:0;--tw-translate-y:0;--tw-translate-z:0;--tw-scale-x:1;--tw-scale-y:1;--tw-scale-z:1;--tw-space-y-reverse:0;--tw-border-style:solid;--tw-leading:initial;--tw-font-weight:initial;--tw-tracking:initial;--tw-ordinal:initial;--tw-slashed-zero:initial;--tw-numeric-figure:initial;--tw-numeric-spacing:initial;--tw-numeric-fraction:initial;--tw-shadow:0 0 #0000;--tw-shadow-color:initial;--tw-shadow-alpha:100%;--tw-inset-shadow:0 0 #0000;--tw-inset-shadow-color:initial;--tw-inset-shadow-alpha:100%;--tw-ring-color:initial;--tw-ring-shadow:0 0 #0000;--tw-inset-ring-color:initial;--tw-inset-ring-shadow:0 0 #0000;--tw-ring-inset:initial;--tw-ring-offset-width:0px;--tw-ring-offset-color:#fff;--tw-ring-offset-shadow:0 0 #0000;--tw-blur:initial;--tw-brightness:initial;--tw-contrast:initial;--tw-grayscale:initial;--tw-hue-rotate:initial;--tw-invert:initial;--tw-opacity:initial;--tw-saturate:initial;--tw-sepia:initial;--tw-drop-shadow:initial;--tw-drop-shadow-color:initial;--tw-drop-shadow-alpha:100%;--tw-drop-shadow-size:initial;--tw-backdrop-blur:initial;--tw-backdrop-brightness:initial;--tw-backdrop-contrast:initial;--tw-backdrop-grayscale:initial;--tw-backdrop-hue-rotate:initial;--tw-backdrop-invert:initial;--tw-backdrop-opacity:initial;--tw-backdrop-saturate:initial;--tw-backdrop-sepia:initial;--tw-duration:initial;--tw-ease:initial}}}@layer theme{:root,:host{--font-sans:-apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, \"Helvetica Neue\", \"Noto Sans\", Arial, sans-serif, \"Apple Color Emoji\", \"Segoe UI Emoji\", \"Segoe UI Symbol\", \"Noto Color Emoji\";--font-mono:ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, \"Liberation Mono\", \"Courier New\", monospace;--color-red-600:oklch(57.7% .245 27.325);--color-red-700:oklch(50.5% .213 27.518);--color-amber-50:oklch(98.7% .022 95.277);--color-amber-100:oklch(96.2% .059 95.617);--color-amber-200:oklch(92.4% .12 95.746);--color-amber-300:oklch(87.9% .169 91.605);--color-amber-400:oklch(82.8% .189 84.429);--color-amber-700:oklch(55.5% .163 48.998);--color-amber-800:oklch(47.3% .137 46.201);--color-amber-900:oklch(41.4% .112 45.904);--color-amber-950:oklch(27.9% .077 45.635);--color-emerald-50:oklch(97.9% .021 166.113);--color-emerald-800:oklch(43.2% .095 166.913);--color-emerald-900:oklch(37.8% .077 168.94);--color-sky-50:oklch(97.7% .013 236.62);--color-sky-100:oklch(95.1% .026 236.824);--color-sky-900:oklch(39.1% .09 240.876);--color-zinc-50:oklch(98.5% 0 none);--color-zinc-100:oklch(96.7% .001 286.375);--color-zinc-200:oklch(92% .004 286.32);--color-zinc-300:oklch(87.1% .006 286.286);--color-zinc-400:oklch(70.5% .015 286.067);--color-zinc-500:oklch(55.2% .016 285.938);--color-zinc-600:oklch(44.2% .017 285.786);--color-zinc-700:oklch(37% .013 285.805);--color-zinc-800:oklch(27.4% .006 286.033);--color-zinc-900:oklch(21% .006 285.885);--color-white:#fff;--spacing:4px;--text-xs:12px;--text-xs--line-height:calc(1 / .75);--text-sm:14px;--text-sm--line-height:calc(1.25 / .875);--text-base:16px;--text-base--line-height:calc(1.5 / 1);--font-weight-medium:500;--font-weight-semibold:600;--font-weight-bold:700;--tracking-tight:-.025em;--tracking-normal:0em;--tracking-wide:.025em;--leading-snug:1.375;--radius-md:6px;--radius-lg:8px;--radius-xl:12px;--radius-2xl:16px;--ease-in-out:cubic-bezier(.4, 0, .2, 1);--animate-spin:spin 1s linear infinite;--default-transition-duration:.15s;--default-transition-timing-function:cubic-bezier(.4, 0, .2, 1);--default-font-family:var(--font-sans);--default-mono-font-family:var(--font-mono)}}@layer base{*,:after,:before,::backdrop{box-sizing:border-box;border:0 solid;margin:0;padding:0}::file-selector-button{box-sizing:border-box;border:0 solid;margin:0;padding:0}html,:host{-webkit-text-size-adjust:100%;tab-size:4;line-height:1.5;font-family:var(--default-font-family,-apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, \"Helvetica Neue\", \"Noto Sans\", Arial, sans-serif, \"Apple Color Emoji\", \"Segoe UI Emoji\", \"Segoe UI Symbol\", \"Noto Color Emoji\");font-feature-settings:var(--default-font-feature-settings,normal);font-variation-settings:var(--default-font-variation-settings,normal);-webkit-tap-highlight-color:transparent}hr{height:0;color:inherit;border-top-width:1px}abbr:where([title]){-webkit-text-decoration:underline dotted;text-decoration:underline dotted}h1,h2,h3,h4,h5,h6{font-size:inherit;font-weight:inherit}a{color:inherit;-webkit-text-decoration:inherit;-webkit-text-decoration:inherit;-webkit-text-decoration:inherit;text-decoration:inherit}b,strong{font-weight:bolder}code,kbd,samp,pre{font-family:var(--default-mono-font-family,ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, \"Liberation Mono\", \"Courier New\", monospace);font-feature-settings:var(--default-mono-font-feature-settings,normal);font-variation-settings:var(--default-mono-font-variation-settings,normal);font-size:1em}small{font-size:80%}sub,sup{vertical-align:baseline;font-size:75%;line-height:0;position:relative}sub{bottom:-.25em}sup{top:-.5em}table{text-indent:0;border-color:inherit;border-collapse:collapse}:-moz-focusring:where(:not(iframe)){outline:auto}progress{vertical-align:baseline}summary{display:list-item}ol,ul,menu{list-style:none}img,svg,video,canvas,audio,iframe,embed,object{vertical-align:middle;display:block}img,video{max-width:100%;height:auto}button,input,select,optgroup,textarea{font:inherit;font-feature-settings:inherit;font-variation-settings:inherit;letter-spacing:inherit;color:inherit;opacity:1;background-color:#0000;border-radius:0}::file-selector-button{font:inherit;font-feature-settings:inherit;font-variation-settings:inherit;letter-spacing:inherit;color:inherit;opacity:1;background-color:#0000;border-radius:0}:where(select:is([multiple],[size])) optgroup{font-weight:bolder}:where(select:is([multiple],[size])) optgroup option{padding-inline-start:20px}::file-selector-button{margin-inline-end:4px}::placeholder{opacity:1}@supports (not ((-webkit-appearance:-apple-pay-button))) or (contain-intrinsic-size:1px){::placeholder{color:currentColor}@supports (color:color-mix(in lab, red, red)){::placeholder{color:color-mix(in oklab, currentcolor 50%, transparent)}}}textarea{resize:vertical}::-webkit-search-decoration{-webkit-appearance:none}::-webkit-date-and-time-value{min-height:1lh;text-align:inherit}::-webkit-datetime-edit{display:inline-flex}::-webkit-datetime-edit-fields-wrapper{padding:0}::-webkit-datetime-edit{padding-block:0}::-webkit-datetime-edit-year-field{padding-block:0}::-webkit-datetime-edit-month-field{padding-block:0}::-webkit-datetime-edit-day-field{padding-block:0}::-webkit-datetime-edit-hour-field{padding-block:0}::-webkit-datetime-edit-minute-field{padding-block:0}::-webkit-datetime-edit-second-field{padding-block:0}::-webkit-datetime-edit-millisecond-field{padding-block:0}::-webkit-datetime-edit-meridiem-field{padding-block:0}::-webkit-calendar-picker-indicator{line-height:1}:-moz-ui-invalid{box-shadow:none}button,input:where([type=button],[type=reset],[type=submit]){appearance:button}::file-selector-button{appearance:button}::-webkit-inner-spin-button{height:auto}::-webkit-outer-spin-button{height:auto}[hidden]:where(:not([hidden=until-found])){display:none!important}.theme-switcher{letter-spacing:normal;color:var(--color-zinc-900);font-family:Inter,ui-sans-serif,system-ui,sans-serif;font-size:16px;line-height:1.5}}@layer components;@layer utilities{.\\@container{container-type:inline-size}.pointer-events-auto{pointer-events:auto}.pointer-events-none{pointer-events:none}.invisible{visibility:hidden}.visible{visibility:visible}.sr-only{clip-path:inset(50%);white-space:nowrap;border-width:0;width:1px;height:1px;margin:-1px;padding:0;position:absolute;overflow:hidden}.absolute{position:absolute}.fixed{position:fixed}.relative{position:relative}.sticky{position:sticky}.inset-0{inset:0}.inset-x-3{inset-inline:calc(var(--spacing) * 3)}.inset-x-5{inset-inline:calc(var(--spacing) * 5)}.inset-y-5{inset-block:calc(var(--spacing) * 5)}.-top-2{top:calc(var(--spacing) * -2)}.-top-\\[6px\\]{top:-6px}.top-0{top:0}.top-1\\.5{top:calc(var(--spacing) * 1.5)}.top-1\\/2{top:50%}.top-5{top:calc(var(--spacing) * 5)}.top-\\[84px\\]{top:84px}.-right-0\\.5{right:calc(var(--spacing) * -.5)}.-right-2{right:calc(var(--spacing) * -2)}.right-1\\.5{right:calc(var(--spacing) * 1.5)}.right-5{right:calc(var(--spacing) * 5)}.right-6{right:calc(var(--spacing) * 6)}.right-full{right:100%}.-bottom-0\\.5{bottom:calc(var(--spacing) * -.5)}.-bottom-2{bottom:calc(var(--spacing) * -2)}.-bottom-\\[6px\\]{bottom:-6px}.bottom-3{bottom:calc(var(--spacing) * 3)}.bottom-5{bottom:calc(var(--spacing) * 5)}.-left-2{left:calc(var(--spacing) * -2)}.left-5{left:calc(var(--spacing) * 5)}.left-full{left:100%}.z-10{z-index:10}.z-20{z-index:20}.z-30{z-index:30}.z-\\[55\\]{z-index:55}.z-\\[56\\]{z-index:56}.z-\\[57\\]{z-index:57}.z-\\[60\\]{z-index:60}.z-\\[61\\]{z-index:61}.z-\\[62\\]{z-index:62}.z-\\[70\\]{z-index:70}.container{width:100%}@media (min-width:640px){.container{max-width:640px}}@media (min-width:768px){.container{max-width:768px}}@media (min-width:1024px){.container{max-width:1024px}}@media (min-width:1280px){.container{max-width:1280px}}@media (min-width:1536px){.container{max-width:1536px}}.mt-0\\.5{margin-top:calc(var(--spacing) * .5)}.mt-1{margin-top:var(--spacing)}.mt-1\\.5{margin-top:calc(var(--spacing) * 1.5)}.mt-2{margin-top:calc(var(--spacing) * 2)}.mt-2\\.5{margin-top:calc(var(--spacing) * 2.5)}.mt-px{margin-top:1px}.-mr-1{margin-right:calc(var(--spacing) * -1)}.mr-2{margin-right:calc(var(--spacing) * 2)}.mb-1{margin-bottom:var(--spacing)}.mb-2\\.5{margin-bottom:calc(var(--spacing) * 2.5)}.ml-2{margin-left:calc(var(--spacing) * 2)}.ml-auto{margin-left:auto}.block{display:block}.flex{display:flex}.grid{display:grid}.hidden{display:none}.inline-flex{display:inline-flex}.h-2\\.5{height:calc(var(--spacing) * 2.5)}.h-3{height:calc(var(--spacing) * 3)}.h-3\\.5{height:calc(var(--spacing) * 3.5)}.h-4{height:calc(var(--spacing) * 4)}.h-5{height:calc(var(--spacing) * 5)}.h-6{height:calc(var(--spacing) * 6)}.h-7{height:calc(var(--spacing) * 7)}.h-8{height:calc(var(--spacing) * 8)}.h-9{height:calc(var(--spacing) * 9)}.h-12{height:calc(var(--spacing) * 12)}.h-16{height:calc(var(--spacing) * 16)}.h-px{height:1px}.max-h-40{max-height:calc(var(--spacing) * 40)}.min-h-0{min-height:0}.w-2\\.5{width:calc(var(--spacing) * 2.5)}.w-3{width:calc(var(--spacing) * 3)}.w-3\\.5{width:calc(var(--spacing) * 3.5)}.w-4{width:calc(var(--spacing) * 4)}.w-5{width:calc(var(--spacing) * 5)}.w-6{width:calc(var(--spacing) * 6)}.w-7{width:calc(var(--spacing) * 7)}.w-9{width:calc(var(--spacing) * 9)}.w-16{width:calc(var(--spacing) * 16)}.w-24{width:calc(var(--spacing) * 24)}.w-\\[5\\.5rem\\]{width:88px}.w-full{width:100%}.max-w-\\[240px\\]{max-width:240px}.max-w-\\[calc\\(100vw-80px\\)\\]{max-width:calc(100vw - 80px)}.max-w-full{max-width:100%}.min-w-0{min-width:0}.flex-1{flex:1}.shrink-0{flex-shrink:0}.-translate-y-1\\/2{--tw-translate-y:calc(calc(1 / 2 * 100%) * -1);translate:var(--tw-translate-x) var(--tw-translate-y)}.scale-110{--tw-scale-x:110%;--tw-scale-y:110%;--tw-scale-z:110%;scale:var(--tw-scale-x) var(--tw-scale-y)}.rotate-45{rotate:45deg}.rotate-90{rotate:90deg}.animate-spin{animation:var(--animate-spin)}.cursor-ew-resize{cursor:ew-resize}.cursor-grabbing{cursor:grabbing}.cursor-nesw-resize{cursor:nesw-resize}.cursor-ns-resize{cursor:ns-resize}.cursor-nwse-resize{cursor:nwse-resize}.cursor-pointer{cursor:pointer}.touch-none{touch-action:none}.resize{resize:both}.scroll-mt-3{scroll-margin-top:calc(var(--spacing) * 3)}.list-decimal{list-style-type:decimal}.grid-cols-2{grid-template-columns:repeat(2,minmax(0,1fr))}.grid-cols-3{grid-template-columns:repeat(3,minmax(0,1fr))}.flex-col{flex-direction:column}.flex-wrap{flex-wrap:wrap}.place-items-center{place-items:center}.items-center{align-items:center}.items-start{align-items:flex-start}.justify-between{justify-content:space-between}.justify-center{justify-content:center}.gap-0\\.5{gap:calc(var(--spacing) * .5)}.gap-1{gap:var(--spacing)}.gap-1\\.5{gap:calc(var(--spacing) * 1.5)}.gap-2{gap:calc(var(--spacing) * 2)}.gap-2\\.5{gap:calc(var(--spacing) * 2.5)}.gap-3{gap:calc(var(--spacing) * 3)}:where(.space-y-0\\.5>:not(:last-child)){--tw-space-y-reverse:0;margin-block-start:calc(calc(var(--spacing) * .5) * var(--tw-space-y-reverse));margin-block-end:calc(calc(var(--spacing) * .5) * calc(1 - var(--tw-space-y-reverse)))}:where(.space-y-1>:not(:last-child)){--tw-space-y-reverse:0;margin-block-start:calc(var(--spacing) * var(--tw-space-y-reverse));margin-block-end:calc(var(--spacing) * calc(1 - var(--tw-space-y-reverse)))}:where(.space-y-1\\.5>:not(:last-child)){--tw-space-y-reverse:0;margin-block-start:calc(calc(var(--spacing) * 1.5) * var(--tw-space-y-reverse));margin-block-end:calc(calc(var(--spacing) * 1.5) * calc(1 - var(--tw-space-y-reverse)))}:where(.space-y-2>:not(:last-child)){--tw-space-y-reverse:0;margin-block-start:calc(calc(var(--spacing) * 2) * var(--tw-space-y-reverse));margin-block-end:calc(calc(var(--spacing) * 2) * calc(1 - var(--tw-space-y-reverse)))}:where(.space-y-3>:not(:last-child)){--tw-space-y-reverse:0;margin-block-start:calc(calc(var(--spacing) * 3) * var(--tw-space-y-reverse));margin-block-end:calc(calc(var(--spacing) * 3) * calc(1 - var(--tw-space-y-reverse)))}:where(.space-y-4>:not(:last-child)){--tw-space-y-reverse:0;margin-block-start:calc(calc(var(--spacing) * 4) * var(--tw-space-y-reverse));margin-block-end:calc(calc(var(--spacing) * 4) * calc(1 - var(--tw-space-y-reverse)))}.truncate{text-overflow:ellipsis;white-space:nowrap;overflow:hidden}.overflow-auto{overflow:auto}.overflow-hidden{overflow:hidden}.overflow-y-auto{overflow-y:auto}.overscroll-contain{overscroll-behavior:contain}.rounded{border-radius:4px}.rounded-2xl{border-radius:var(--radius-2xl)}.rounded-\\[inherit\\]{border-radius:inherit}.rounded-full{border-radius:3.40282e38px}.rounded-lg{border-radius:var(--radius-lg)}.rounded-md{border-radius:var(--radius-md)}.rounded-xl{border-radius:var(--radius-xl)}.border{border-style:var(--tw-border-style);border-width:1px}.border-2{border-style:var(--tw-border-style);border-width:2px}.border-t{border-top-style:var(--tw-border-style);border-top-width:1px}.border-r{border-right-style:var(--tw-border-style);border-right-width:1px}.border-b{border-bottom-style:var(--tw-border-style);border-bottom-width:1px}.border-l{border-left-style:var(--tw-border-style);border-left-width:1px}.border-dashed{--tw-border-style:dashed;border-style:dashed}.border-amber-300{border-color:var(--color-amber-300)}.border-amber-400{border-color:var(--color-amber-400)}.border-red-600{border-color:var(--color-red-600)}.border-transparent{border-color:#0000}.border-white{border-color:var(--color-white)}.border-zinc-200{border-color:var(--color-zinc-200)}.border-zinc-300{border-color:var(--color-zinc-300)}.border-zinc-900{border-color:var(--color-zinc-900)}.bg-amber-50{background-color:var(--color-amber-50)}.bg-amber-100{background-color:var(--color-amber-100)}.bg-amber-400{background-color:var(--color-amber-400)}.bg-emerald-50{background-color:var(--color-emerald-50)}.bg-sky-50{background-color:var(--color-sky-50)}.bg-sky-100{background-color:var(--color-sky-100)}.bg-white{background-color:var(--color-white)}.bg-white\\/90{background-color:#ffffffe6}@supports (color:color-mix(in lab, red, red)){.bg-white\\/90{background-color:color-mix(in oklab, var(--color-white) 90%, transparent)}}.bg-zinc-50{background-color:var(--color-zinc-50)}.bg-zinc-100{background-color:var(--color-zinc-100)}.bg-zinc-200{background-color:var(--color-zinc-200)}.bg-zinc-900{background-color:var(--color-zinc-900)}.object-contain{object-fit:contain}.p-0\\.5{padding:calc(var(--spacing) * .5)}.p-2{padding:calc(var(--spacing) * 2)}.p-2\\.5{padding:calc(var(--spacing) * 2.5)}.p-3{padding:calc(var(--spacing) * 3)}.px-1{padding-inline:var(--spacing)}.px-1\\.5{padding-inline:calc(var(--spacing) * 1.5)}.px-2{padding-inline:calc(var(--spacing) * 2)}.px-2\\.5{padding-inline:calc(var(--spacing) * 2.5)}.px-3{padding-inline:calc(var(--spacing) * 3)}.px-4{padding-inline:calc(var(--spacing) * 4)}.py-0\\.5{padding-block:calc(var(--spacing) * .5)}.py-1{padding-block:var(--spacing)}.py-1\\.5{padding-block:calc(var(--spacing) * 1.5)}.py-2{padding-block:calc(var(--spacing) * 2)}.py-2\\.5{padding-block:calc(var(--spacing) * 2.5)}.py-3{padding-block:calc(var(--spacing) * 3)}.py-5{padding-block:calc(var(--spacing) * 5)}.py-6{padding-block:calc(var(--spacing) * 6)}.pr-1\\.5{padding-right:calc(var(--spacing) * 1.5)}.pr-12{padding-right:calc(var(--spacing) * 12)}.pb-4{padding-bottom:calc(var(--spacing) * 4)}.pl-1{padding-left:var(--spacing)}.pl-3{padding-left:calc(var(--spacing) * 3)}.pl-4{padding-left:calc(var(--spacing) * 4)}.text-center{text-align:center}.text-left{text-align:left}.align-super{vertical-align:super}.font-mono{font-family:var(--font-mono)}.text-base{font-size:var(--text-base);line-height:var(--tw-leading,var(--text-base--line-height))}.text-sm{font-size:var(--text-sm);line-height:var(--tw-leading,var(--text-sm--line-height))}.text-xs{font-size:var(--text-xs);line-height:var(--tw-leading,var(--text-xs--line-height))}.text-\\[10px\\]{font-size:10px}.text-\\[11px\\]{font-size:11px}.leading-snug{--tw-leading:var(--leading-snug);line-height:var(--leading-snug)}.font-bold{--tw-font-weight:var(--font-weight-bold);font-weight:var(--font-weight-bold)}.font-medium{--tw-font-weight:var(--font-weight-medium);font-weight:var(--font-weight-medium)}.font-semibold{--tw-font-weight:var(--font-weight-semibold);font-weight:var(--font-weight-semibold)}.tracking-normal{--tw-tracking:var(--tracking-normal);letter-spacing:var(--tracking-normal)}.tracking-tight{--tw-tracking:var(--tracking-tight);letter-spacing:var(--tracking-tight)}.tracking-wide{--tw-tracking:var(--tracking-wide);letter-spacing:var(--tracking-wide)}.break-all{word-break:break-all}.whitespace-nowrap{white-space:nowrap}.whitespace-pre-wrap{white-space:pre-wrap}.text-amber-700{color:var(--color-amber-700)}.text-amber-800{color:var(--color-amber-800)}.text-amber-900{color:var(--color-amber-900)}.text-amber-950{color:var(--color-amber-950)}.text-emerald-800{color:var(--color-emerald-800)}.text-emerald-900{color:var(--color-emerald-900)}.text-red-700{color:var(--color-red-700)}.text-sky-900{color:var(--color-sky-900)}.text-white{color:var(--color-white)}.text-zinc-300{color:var(--color-zinc-300)}.text-zinc-500{color:var(--color-zinc-500)}.text-zinc-600{color:var(--color-zinc-600)}.text-zinc-700{color:var(--color-zinc-700)}.text-zinc-800{color:var(--color-zinc-800)}.text-zinc-900{color:var(--color-zinc-900)}.normal-case{text-transform:none}.uppercase{text-transform:uppercase}.tabular-nums{--tw-numeric-spacing:tabular-nums;font-variant-numeric:var(--tw-ordinal,) var(--tw-slashed-zero,) var(--tw-numeric-figure,) var(--tw-numeric-spacing,) var(--tw-numeric-fraction,)}.underline{text-decoration-line:underline}.underline-offset-2{text-underline-offset:2px}.accent-zinc-900{accent-color:var(--color-zinc-900)}.opacity-25{opacity:.25}.opacity-70{opacity:.7}.shadow{--tw-shadow:0 1px 3px 0 var(--tw-shadow-color,#0000001a), 0 1px 2px -1px var(--tw-shadow-color,#0000001a);box-shadow:var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)}.shadow-2xl{--tw-shadow:0 25px 50px -12px var(--tw-shadow-color,#00000040);box-shadow:var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)}.shadow-lg{--tw-shadow:0 10px 15px -3px var(--tw-shadow-color,#0000001a), 0 4px 6px -4px var(--tw-shadow-color,#0000001a);box-shadow:var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)}.shadow-md{--tw-shadow:0 4px 6px -1px var(--tw-shadow-color,#0000001a), 0 2px 4px -2px var(--tw-shadow-color,#0000001a);box-shadow:var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)}.shadow-sm{--tw-shadow:0 1px 3px 0 var(--tw-shadow-color,#0000001a), 0 1px 2px -1px var(--tw-shadow-color,#0000001a);box-shadow:var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)}.shadow-xl{--tw-shadow:0 20px 25px -5px var(--tw-shadow-color,#0000001a), 0 8px 10px -6px var(--tw-shadow-color,#0000001a);box-shadow:var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)}.ring-1{--tw-ring-shadow:var(--tw-ring-inset,) 0 0 0 calc(1px + var(--tw-ring-offset-width)) var(--tw-ring-color,currentcolor);box-shadow:var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)}.ring-2{--tw-ring-shadow:var(--tw-ring-inset,) 0 0 0 calc(2px + var(--tw-ring-offset-width)) var(--tw-ring-color,currentcolor);box-shadow:var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)}.ring-white{--tw-ring-color:var(--color-white)}.ring-zinc-900{--tw-ring-color:var(--color-zinc-900)}.ring-offset-1{--tw-ring-offset-width:1px;--tw-ring-offset-shadow:var(--tw-ring-inset,) 0 0 0 var(--tw-ring-offset-width) var(--tw-ring-offset-color)}.invert{--tw-invert:invert(100%);filter:var(--tw-blur,) var(--tw-brightness,) var(--tw-contrast,) var(--tw-grayscale,) var(--tw-hue-rotate,) var(--tw-invert,) var(--tw-saturate,) var(--tw-sepia,) var(--tw-drop-shadow,)}.filter{filter:var(--tw-blur,) var(--tw-brightness,) var(--tw-contrast,) var(--tw-grayscale,) var(--tw-hue-rotate,) var(--tw-invert,) var(--tw-saturate,) var(--tw-sepia,) var(--tw-drop-shadow,)}.backdrop-blur{--tw-backdrop-blur:blur(8px);-webkit-backdrop-filter:var(--tw-backdrop-blur,) var(--tw-backdrop-brightness,) var(--tw-backdrop-contrast,) var(--tw-backdrop-grayscale,) var(--tw-backdrop-hue-rotate,) var(--tw-backdrop-invert,) var(--tw-backdrop-opacity,) var(--tw-backdrop-saturate,) var(--tw-backdrop-sepia,);backdrop-filter:var(--tw-backdrop-blur,) var(--tw-backdrop-brightness,) var(--tw-backdrop-contrast,) var(--tw-backdrop-grayscale,) var(--tw-backdrop-hue-rotate,) var(--tw-backdrop-invert,) var(--tw-backdrop-opacity,) var(--tw-backdrop-saturate,) var(--tw-backdrop-sepia,)}.transition-\\[color\\,background-color\\,box-shadow\\,scale\\]{transition-property:color,background-color,box-shadow,scale;transition-timing-function:var(--tw-ease,var(--default-transition-timing-function));transition-duration:var(--tw-duration,var(--default-transition-duration))}.transition-colors{transition-property:color,background-color,border-color,outline-color,text-decoration-color,fill,stroke,--tw-gradient-from,--tw-gradient-via,--tw-gradient-to;transition-timing-function:var(--tw-ease,var(--default-transition-timing-function));transition-duration:var(--tw-duration,var(--default-transition-duration))}.transition-shadow{transition-property:box-shadow;transition-timing-function:var(--tw-ease,var(--default-transition-timing-function));transition-duration:var(--tw-duration,var(--default-transition-duration))}.transition-transform{transition-property:transform,translate,scale,rotate;transition-timing-function:var(--tw-ease,var(--default-transition-timing-function));transition-duration:var(--tw-duration,var(--default-transition-duration))}.duration-700{--tw-duration:.7s;transition-duration:.7s}.ease-in-out{--tw-ease:var(--ease-in-out);transition-timing-function:var(--ease-in-out)}.select-none{-webkit-user-select:none;user-select:none}.placeholder\\:text-zinc-500::placeholder{color:var(--color-zinc-500)}@media (hover:hover){.hover\\:bg-amber-200:hover{background-color:var(--color-amber-200)}.hover\\:bg-white:hover{background-color:var(--color-white)}.hover\\:bg-zinc-50:hover{background-color:var(--color-zinc-50)}.hover\\:bg-zinc-100:hover{background-color:var(--color-zinc-100)}.hover\\:bg-zinc-200:hover{background-color:var(--color-zinc-200)}.hover\\:bg-zinc-400\\/30:hover{background-color:#9f9fa94d}@supports (color:color-mix(in lab, red, red)){.hover\\:bg-zinc-400\\/30:hover{background-color:color-mix(in oklab, var(--color-zinc-400) 30%, transparent)}}.hover\\:bg-zinc-700:hover{background-color:var(--color-zinc-700)}.hover\\:text-amber-950:hover{color:var(--color-amber-950)}.hover\\:text-zinc-900:hover{color:var(--color-zinc-900)}.hover\\:opacity-100:hover{opacity:1}}.focus\\:outline-none:focus{--tw-outline-style:none;outline-style:none}.focus-visible\\:ring-2:focus-visible{--tw-ring-shadow:var(--tw-ring-inset,) 0 0 0 calc(2px + var(--tw-ring-offset-width)) var(--tw-ring-color,currentcolor);box-shadow:var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)}.focus-visible\\:ring-white:focus-visible{--tw-ring-color:var(--color-white)}.focus-visible\\:ring-zinc-900:focus-visible{--tw-ring-color:var(--color-zinc-900)}.focus-visible\\:ring-offset-1:focus-visible{--tw-ring-offset-width:1px;--tw-ring-offset-shadow:var(--tw-ring-inset,) 0 0 0 var(--tw-ring-offset-width) var(--tw-ring-offset-color)}.focus-visible\\:ring-offset-2:focus-visible{--tw-ring-offset-width:2px;--tw-ring-offset-shadow:var(--tw-ring-inset,) 0 0 0 var(--tw-ring-offset-width) var(--tw-ring-offset-color)}.focus-visible\\:outline-none:focus-visible{--tw-outline-style:none;outline-style:none}.focus-visible\\:ring-inset:focus-visible{--tw-ring-inset:inset}.disabled\\:opacity-50:disabled{opacity:.5}@media (prefers-reduced-motion:reduce){.motion-reduce\\:animate-none{animation:none}.motion-reduce\\:transition-none{transition-property:none}}@media (min-width:1200px){.min-\\[1200px\\]\\:top-\\[27px\\]{top:27px}.min-\\[1200px\\]\\:right-4{right:calc(var(--spacing) * 4)}}@media (min-width:640px){.sm\\:inline{display:inline}}@container (min-width:380px){.\\@min-\\[380px\\]\\:h-10{height:calc(var(--spacing) * 10)}.\\@min-\\[380px\\]\\:grid-cols-3{grid-template-columns:repeat(3,minmax(0,1fr))}.\\@min-\\[380px\\]\\:flex-row{flex-direction:row}.\\@min-\\[380px\\]\\:justify-start{justify-content:flex-start}.\\@min-\\[380px\\]\\:gap-1\\.5{gap:calc(var(--spacing) * 1.5)}}@container (min-width:440px){.\\@min-\\[440px\\]\\:inline{display:inline}.\\@min-\\[440px\\]\\:px-2\\.5{padding-inline:calc(var(--spacing) * 2.5)}}@container (min-width:520px){.\\@min-\\[520px\\]\\:grid-cols-3{grid-template-columns:repeat(3,minmax(0,1fr))}}}:host{all:initial}.cbm-dark{color-scheme:dark;--color-white:oklch(21% .006 285.885);--color-zinc-50:oklch(24.5% .006 286);--color-zinc-100:oklch(27.4% .006 286.033);--color-zinc-200:oklch(33% .01 285.9);--color-zinc-300:oklch(42% .015 285.8);--color-zinc-400:oklch(52% .016 285.9);--color-zinc-500:oklch(68% .015 286.067);--color-zinc-600:oklch(74% .012 286);--color-zinc-700:oklch(82% .008 286.2);--color-zinc-800:oklch(88% .006 286.3);--color-zinc-900:oklch(96.7% .001 286.375);--color-zinc-950:oklch(98.5% 0 0);--color-amber-50:oklch(27.9% .077 45.635);--color-amber-100:oklch(33% .09 46);--color-amber-200:oklch(41.4% .112 45.904);--color-amber-300:oklch(55.5% .163 48.998);--color-amber-700:oklch(87.9% .169 91.605);--color-amber-800:oklch(92.4% .12 95.746);--color-amber-900:oklch(96.2% .059 95.617);--color-amber-950:oklch(98.7% .022 95.277);--color-emerald-50:oklch(26.2% .051 172.552);--color-emerald-800:oklch(90.5% .093 164.15);--color-emerald-900:oklch(95% .052 163.051);--color-sky-50:oklch(29.3% .066 243.157);--color-sky-100:oklch(39.1% .09 240.876);--color-sky-900:oklch(95.1% .026 236.824);--color-red-600:oklch(70.4% .191 22.216);--color-red-700:oklch(80.8% .114 19.571)}.cbm-dark *{--tw-ring-offset-color:oklch(21% .006 285.885)}.theme-scroll{--cbm-thumb:var(--color-primary,oklch(55.2% .016 285.938))}@supports (color:color-mix(in lab, red, red)){.theme-scroll{--cbm-thumb:color-mix(in srgb, var(--color-primary,var(--color-zinc-500)) 55%, var(--color-white))}}.theme-scroll{--cbm-thumb-hover:var(--color-primary,oklch(55.2% .016 285.938))}@supports (color:color-mix(in lab, red, red)){.theme-scroll{--cbm-thumb-hover:color-mix(in srgb, var(--color-primary,var(--color-zinc-500)) 80%, var(--color-white))}}.theme-scroll{scrollbar-width:thin;scrollbar-color:var(--cbm-thumb) transparent}.theme-scroll:hover{scrollbar-color:var(--cbm-thumb-hover) transparent}.theme-scroll::-webkit-scrollbar{width:6px}.theme-scroll::-webkit-scrollbar-track{background:0 0}.theme-scroll::-webkit-scrollbar-thumb{background:var(--cbm-thumb);border-radius:9999px}.theme-scroll:hover::-webkit-scrollbar-thumb{background:var(--cbm-thumb-hover)}.theme-panel{transform-origin:100% 0;animation:.16s ease-out theme-panel-in}@keyframes theme-panel-in{0%{opacity:0;transform:translateY(-6px)scale(.98)}}.theme-hint{animation:.12s ease-out theme-hint-in}.theme-toast{animation:.18s ease-out theme-toast-in}@keyframes theme-toast-in{0%{opacity:0;transform:translateY(8px)}}@keyframes theme-hint-in{0%{opacity:0}}.theme-arrive{animation:.62s cubic-bezier(.34,1.56,.64,1) both theme-arrive}@keyframes theme-arrive{0%{opacity:0;transform:scale(.2)rotate(-45deg)}60%{opacity:1;transform:scale(1.16)rotate(8deg)}to{transform:scale(1)rotate(0)}}.theme-burst-piece{line-height:0;animation:.95s cubic-bezier(.15,.75,.3,1) both theme-burst-piece;display:block;position:absolute;top:50%;left:50%}@keyframes theme-burst-piece{0%{opacity:0;transform:translate(-50%, -50%) rotate(var(--r)) scale(.3)}12%{opacity:1}65%{opacity:1}to{opacity:0;transform:translate(calc(-50% + var(--x)), calc(-50% + var(--y))) rotate(calc(var(--r) + 150deg)) scale(1)}}.theme-piece-dot{background:currentColor;border-radius:9999px;width:6px;height:6px}.theme-piece-dash{background:currentColor;border-radius:9999px;width:10px;height:3px}@media (prefers-reduced-motion:reduce){.theme-panel,.theme-hint,.theme-toast{animation:none}.theme-arrive{animation:.3s ease-out both theme-hint-in}.theme-burst{display:none}}.theme-panel summary{list-style:none}.theme-panel summary::-webkit-details-marker{display:none}.theme-panel details[open]>summary .theme-chevron{transform:rotate(90deg)}@keyframes spin{to{transform:rotate(360deg)}}";
//#endregion
//#region src/ThemeSwitcher.jsx
var CORNERS = {
	"bottom-right": "right-5 bottom-5",
	"bottom-left": "left-5 bottom-5",
	"top-left": "left-5 top-5",
	"top-right": "right-6 top-[84px] min-[1200px]:right-4 min-[1200px]:top-[27px]"
};
var CORNER_GAP = 20;
var BUTTON_SIZE = 36;
var EDGE = 12;
var PANEL_GAP = 8;
var PANEL_WIDTH = 420;
var MIN_PANEL_WIDTH = 320;
var MIN_PANEL_HEIGHT = 260;
var DRAG_THRESHOLD = 5;
var HINT_DELAY = 100;
var DOT_INTERVAL = 1500;
var INTRO_DELAY = 900;
var BURST_TIME = 1100;
var FOCUSABLE = "a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), summary, [tabindex]:not([tabindex=\"-1\"])";
/** Tag of the element that hosts the switcher's shadow root. The site scan skips it. */
var HOST_TAG = "colorsbymax-root";
/**
* Renders the switcher into a shadow root on <body> that carries its own stylesheet, so it
* needs nothing from the host site's CSS and the host's CSS can't restyle it.
*/
function ThemeSwitcher() {
	const { hidden } = useTheme();
	const [mount, setMount] = useState(null);
	useEffect(() => {
		if (hidden) return;
		const host = document.createElement(HOST_TAG);
		const shadow = host.attachShadow({ mode: "open" });
		const style = document.createElement("style");
		style.textContent = panel_css_generated_default;
		const container = document.createElement("div");
		shadow.append(style, container);
		document.body.append(host);
		setMount(container);
		return () => {
			host.remove();
			setMount(null);
		};
	}, [hidden]);
	return mount && createPortal(/* @__PURE__ */ jsx(Switcher, {}), mount);
}
function Switcher() {
	const { issues, storageKey, tokens, active, themes, selectTheme, position: requested, setLogoColouring, intro } = useTheme();
	const position = CORNERS[requested] ? requested : "bottom-right";
	const [open, setOpen] = useState(false);
	const [arrived, setArrived] = useState(!intro);
	const [entering, setEntering] = useState(false);
	const [burst, setBurst] = useState(0);
	const celebrate = () => setBurst((n) => n + 1);
	useEffect(() => {
		if (arrived) return;
		const timer = setTimeout(() => {
			setArrived(true);
			setEntering(true);
			celebrate();
		}, INTRO_DELAY);
		return () => clearTimeout(timer);
	}, []);
	const [bursting, setBursting] = useState(false);
	useEffect(() => {
		if (!burst) return;
		setBursting(true);
		const timer = setTimeout(() => {
			setBursting(false);
			setEntering(false);
		}, BURST_TIME);
		return () => clearTimeout(timer);
	}, [burst]);
	const [settings, setSettings] = useState(() => loadSettings(storageKey));
	useEffect(() => setLogoColouring(settings.colourLogo), [settings.colourLogo, setLogoColouring]);
	const [auditOn, setAuditOn] = useState(false);
	const [findings, setFindings] = useState([]);
	const recheck = useCallback(() => {
		requestAnimationFrame(() => setFindings(runAudit({ logoColouring: settingsRef.current.colourLogo })));
	}, []);
	const settingsRef = useRef(settings);
	settingsRef.current = settings;
	useEffect(() => {
		if (!auditOn) return;
		const timer = setTimeout(recheck, 150);
		return () => clearTimeout(timer);
	}, [
		auditOn,
		tokens,
		settings.colourLogo,
		recheck
	]);
	useEffect(() => {
		const setHidden = (hide) => setSettings((s) => s.hideButton === hide ? s : storeSettings({
			...s,
			hideButton: hide
		}));
		if (new URLSearchParams(window.location.search).has("colorsbymax")) setHidden(false);
		const onKey = (e) => {
			if (e.altKey && e.shiftKey && e.code === "KeyC") {
				e.preventDefault();
				setSettings((s) => storeSettings({
					...s,
					hideButton: !s.hideButton
				}));
			}
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, []);
	const prefersDark = usePrefersDark();
	const mode = settings.mode === "system" ? prefersDark ? "dark" : "light" : settings.mode;
	const buttonRef = useRef(null);
	const panelRef = useRef(null);
	const layerRef = useRef(null);
	const viewport = useViewport();
	const [saved, setSaved] = useState(() => loadButtonPosition(storageKey));
	const [dragPoint, setDragPoint] = useState(null);
	const drag = useRef(null);
	const justDragged = useRef(false);
	const [hint, setHint] = useState(false);
	const hintTimer = useRef(null);
	const placed = dragPoint ?? (saved && fromRatios(saved, viewport));
	const [liveSize, setLiveSize] = useState(null);
	const resize = useRef(null);
	const size = liveSize ?? {
		width: settings.panelWidth,
		height: settings.panelHeight
	};
	const layout = panelLayout(placed ?? (position === "top-right" ? null : cornerPoint(position, viewport)), viewport, size);
	const onResizeStart = (edges) => (e) => {
		if (e.button !== 0) return;
		e.preventDefault();
		const r = panelRef.current.getBoundingClientRect();
		resize.current = {
			id: e.pointerId,
			x: e.clientX,
			y: e.clientY,
			width: r.width,
			height: r.height,
			edges
		};
		e.currentTarget.setPointerCapture(e.pointerId);
	};
	const onResizeMove = (e) => {
		const d = resize.current;
		if (!d || d.id !== e.pointerId) return;
		const dx = e.clientX - d.x;
		const dy = e.clientY - d.y;
		setLiveSize({
			width: d.edges.left ? d.width - dx : d.edges.right ? d.width + dx : settings.panelWidth,
			height: d.edges.top ? d.height - dy : d.edges.bottom ? d.height + dy : settings.panelHeight
		});
	};
	const onResizeEnd = (e) => {
		const d = resize.current;
		if (!d || d.id !== e.pointerId) return;
		resize.current = null;
		const r = panelRef.current.getBoundingClientRect();
		const horizontal = d.edges.left || d.edges.right;
		const vertical = d.edges.top || d.edges.bottom;
		if (horizontal || vertical) settingsApi.update({
			...horizontal && { panelWidth: Math.round(r.width) },
			...vertical && { panelHeight: Math.round(r.height) }
		});
		setLiveSize(null);
	};
	/** Double-clicking an edge goes back to the standard size in that direction. */
	const onResizeReset = (edges) => () => settingsApi.update({
		...(edges.left || edges.right) && { panelWidth: null },
		...(edges.top || edges.bottom) && { panelHeight: null }
	});
	const hintOnLeft = placed ? placed.left + BUTTON_SIZE / 2 > viewport.width / 2 : position.endsWith("right");
	const hideHint = () => {
		clearTimeout(hintTimer.current);
		setHint(false);
	};
	useEffect(() => {
		const button = buttonRef.current;
		if (!button) return;
		const onEnter = (e) => {
			if (e.pointerType === "touch" || e.buttons || open || !settings.draggable) return;
			clearTimeout(hintTimer.current);
			hintTimer.current = setTimeout(() => setHint(true), HINT_DELAY);
		};
		const onLeave = () => {
			clearTimeout(hintTimer.current);
			setHint(false);
		};
		button.addEventListener("pointerenter", onEnter);
		button.addEventListener("pointerleave", onLeave);
		return () => {
			clearTimeout(hintTimer.current);
			button.removeEventListener("pointerenter", onEnter);
			button.removeEventListener("pointerleave", onLeave);
		};
	}, [
		open,
		settings.draggable,
		arrived,
		settings.hideButton
	]);
	const close = useCallback(() => {
		setOpen(false);
		buttonRef.current?.focus();
	}, []);
	const onDragStart = (e) => {
		justDragged.current = false;
		hideHint();
		if (e.button !== 0 || !settings.draggable) return;
		const r = e.currentTarget.getBoundingClientRect();
		drag.current = {
			id: e.pointerId,
			x: e.clientX,
			y: e.clientY,
			dx: e.clientX - r.left,
			dy: e.clientY - r.top,
			moved: false
		};
		e.currentTarget.setPointerCapture(e.pointerId);
	};
	const onDragMove = (e) => {
		const d = drag.current;
		if (!d || d.id !== e.pointerId) return;
		if (!(e.buttons & 1)) return onDragEnd(e);
		if (!d.moved && Math.hypot(e.clientX - d.x, e.clientY - d.y) < DRAG_THRESHOLD) return;
		d.moved = true;
		d.point = clampToViewport({
			left: e.clientX - d.dx,
			top: e.clientY - d.dy
		}, viewport);
		setDragPoint(d.point);
	};
	const onDragEnd = (e) => {
		const d = drag.current;
		if (!d || d.id !== e.pointerId) return;
		drag.current = null;
		if (!d.moved) return;
		justDragged.current = true;
		const ratios = toRatios(d.point, viewport);
		setSaved(ratios);
		saveButtonPosition(storageKey, ratios);
		setDragPoint(null);
	};
	const resetPosition = () => {
		setSaved(null);
		saveButtonPosition(storageKey, null);
	};
	const storeSettings = (next) => {
		saveSettings(storageKey, next);
		return next;
	};
	const settingsApi = {
		settings,
		mode,
		audit: {
			on: auditOn,
			toggle() {
				if (auditOn) {
					setAuditOn(false);
					setFindings([]);
				} else {
					setOpen(false);
					setAuditOn(true);
				}
			}
		},
		update: (patch) => setSettings((s) => storeSettings({
			...s,
			...patch
		})),
		reset: () => setSettings(storeSettings(DEFAULT_SETTINGS)),
		resetButton: saved ? resetPosition : null
	};
	const lastMode = useRef(mode);
	useEffect(() => {
		if (lastMode.current === mode) return;
		lastMode.current = mode;
		if (active.custom) return;
		if (mode === "dark" && !isDarkTheme(active.tokens)) {
			const twin = toDark(active);
			selectTheme(twin.id, twin);
		} else if (mode === "light" && active.id.endsWith("~dark")) {
			const lightId = active.id.slice(0, -DARK_SUFFIX.length);
			const local = themes.find((t) => t.id === lightId);
			if (local) selectTheme(local.id, local);
			else loadLibrary().then((lib) => {
				const t = lib.themes.find((x) => x.id === lightId);
				if (t) selectTheme(t.id, t);
			}, () => {});
		}
	}, [
		mode,
		active,
		themes,
		selectTheme
	]);
	useEffect(() => {
		if (!open) return;
		const panel = panelRef.current;
		const root = panel.getRootNode();
		const focused = () => root.activeElement ?? document.activeElement;
		const inside = (e, el) => e.composedPath().includes(el);
		panel.querySelector(FOCUSABLE)?.focus();
		const onKeyDown = (e) => {
			if (e.key === "Escape") {
				e.preventDefault();
				close();
				return;
			}
			if (e.key !== "Tab") return;
			const items = [...panel.querySelectorAll(FOCUSABLE)].filter((el) => el.offsetParent !== null);
			if (!items.length) return;
			const first = items[0];
			const last = items[items.length - 1];
			if (e.shiftKey && (focused() === first || !panel.contains(focused()))) {
				e.preventDefault();
				last.focus();
			} else if (!e.shiftKey && (focused() === last || !panel.contains(focused()))) {
				e.preventDefault();
				first.focus();
			}
		};
		const onPointerDown = (e) => {
			if (inside(e, panel) || inside(e, buttonRef.current)) return;
			setOpen(false);
			setTimeout(() => {
				if (document.activeElement === document.body || !document.activeElement) buttonRef.current?.focus();
			});
		};
		document.addEventListener("keydown", onKeyDown);
		document.addEventListener("pointerdown", onPointerDown);
		return () => {
			document.removeEventListener("keydown", onKeyDown);
			document.removeEventListener("pointerdown", onPointerDown);
		};
	}, [open, close]);
	if (settings.hideButton || !arrived) return null;
	return /* @__PURE__ */ jsx(SettingsContext.Provider, {
		value: settingsApi,
		children: /* @__PURE__ */ jsxs("div", {
			ref: layerRef,
			className: mode === "dark" ? "cbm-dark" : void 0,
			children: [
				/* @__PURE__ */ jsxs("button", {
					ref: buttonRef,
					type: "button",
					"aria-label": `colorsbymax theme settings${issues.length ? ` (${issues.length} contrast issues)` : ""}`,
					"aria-haspopup": "dialog",
					"aria-expanded": open,
					"aria-controls": "theme-panel",
					onClick: () => {
						if (justDragged.current) {
							justDragged.current = false;
							return;
						}
						hideHint();
						celebrate();
						if (open) close();
						else setOpen(true);
					},
					onPointerDown: onDragStart,
					onPointerMove: onDragMove,
					onPointerUp: onDragEnd,
					onPointerCancel: onDragEnd,
					onLostPointerCapture: onDragEnd,
					style: placed ?? void 0,
					className: `theme-switcher fixed z-[60] ${placed ? "" : CORNERS[position]} grid place-items-center w-9 h-9 rounded-full border border-zinc-200 bg-white/90 text-zinc-700 backdrop-blur hover:bg-white hover:text-zinc-900 transition-[color,background-color,box-shadow,scale] select-none ${settings.draggable ? "touch-none" : ""} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2 ${dragPoint ? "scale-110 shadow-xl cursor-grabbing" : "shadow-md cursor-pointer"} ${entering ? "theme-arrive" : ""}`,
					children: [
						/* @__PURE__ */ jsx(Palette, {
							className: "w-4 h-4",
							"aria-hidden": "true"
						}),
						/* @__PURE__ */ jsx(CyclingDot, {
							tokens,
							animate: settings.animateDot
						}),
						bursting && /* @__PURE__ */ jsx(Burst, { tokens }, burst),
						hint && !open && !dragPoint && /* @__PURE__ */ jsx("span", {
							"aria-hidden": "true",
							className: `theme-hint pointer-events-none absolute top-1/2 -translate-y-1/2 whitespace-nowrap rounded-md bg-zinc-900 px-2 py-1 text-[11px] font-medium text-white shadow-lg ${hintOnLeft ? "right-full mr-2" : "left-full ml-2"}`,
							children: "Hold and drag to move"
						})
					]
				}),
				open && /* @__PURE__ */ jsxs("div", {
					ref: panelRef,
					id: "theme-panel",
					role: "dialog",
					"aria-modal": "true",
					"aria-labelledby": "theme-panel-title",
					style: layout.style,
					className: "theme-switcher theme-panel fixed z-[60] flex flex-col rounded-2xl border border-zinc-200 bg-white text-zinc-900 shadow-2xl",
					children: [/* @__PURE__ */ jsx(ThemePanel, {}), /* @__PURE__ */ jsx(ResizeHandles, {
						free: layout.free,
						onStart: onResizeStart,
						onMove: onResizeMove,
						onEnd: onResizeEnd,
						onReset: onResizeReset,
						active: Boolean(liveSize)
					})]
				}),
				auditOn && /* @__PURE__ */ jsx(AuditLayer, {
					findings,
					anchor: buttonRef,
					themeIssues: issues.length,
					onRecheck: recheck,
					onClose: () => {
						setAuditOn(false);
						setFindings([]);
					},
					onAction: (action) => {
						if (action === "colour-logo") settingsApi.update({ colourLogo: true });
					}
				}),
				/* @__PURE__ */ jsx(TooltipLayer, { rootRef: layerRef })
			]
		})
	});
}
var DOT_KEYS = [
	"primary",
	"primary-alt",
	"primary-dark",
	"data-1",
	"data-2",
	"data-3",
	"data-4",
	"data-5",
	"data-6",
	"data-7",
	"data-8"
];
/**
* The dot on the colour button: drifts through the current theme's colours, overrides
* included, in random order. Held on the primary colour when animation is off or reduced.
*/
function CyclingDot({ tokens, animate }) {
	const reduceMotion = usePrefersReducedMotion();
	const colours = useMemo(() => [...new Set(DOT_KEYS.map((k) => tokens[k]).filter(Boolean))], [tokens]);
	const [index, setIndex] = useState(0);
	const still = reduceMotion || !animate || colours.length < 2;
	useEffect(() => {
		if (still) return;
		const id = setInterval(() => {
			setIndex((i) => (i + 1 + Math.floor(Math.random() * (colours.length - 1))) % colours.length);
		}, DOT_INTERVAL);
		return () => clearInterval(id);
	}, [still, colours.length]);
	return /* @__PURE__ */ jsx("span", {
		"aria-hidden": "true",
		className: "absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white shadow-sm transition-colors duration-700 ease-in-out",
		style: { backgroundColor: still ? tokens.primary : colours[index % colours.length] }
	});
}
var BURST_KEYS = [
	"primary",
	"primary-alt",
	"data-1",
	"data-2",
	"data-3",
	"data-4",
	"warning",
	"data-5"
];
var BURST_PIECES = Array.from({ length: 12 }, (_, i) => {
	const angle = (i * 30 + (i % 2 ? 9 : -6)) * (Math.PI / 180);
	const distance = 30 + i % 3 * 9;
	return {
		x: Math.round(Math.cos(angle) * distance),
		y: Math.round(Math.sin(angle) * distance),
		r: Math.round(angle * 180 / Math.PI),
		shape: [
			"squiggle",
			"dot",
			"dash"
		][i % 3],
		delay: i % 4 * 25
	};
});
function Burst({ tokens }) {
	return /* @__PURE__ */ jsx("span", {
		"aria-hidden": "true",
		className: "theme-burst pointer-events-none absolute inset-0",
		children: BURST_PIECES.map((p, i) => /* @__PURE__ */ jsx("span", {
			className: `theme-burst-piece ${p.shape === "squiggle" ? "" : `theme-piece-${p.shape}`}`,
			style: {
				"--x": `${p.x}px`,
				"--y": `${p.y}px`,
				"--r": `${p.r}deg`,
				color: tokens[BURST_KEYS[i % BURST_KEYS.length]],
				animationDelay: `${p.delay}ms`
			},
			children: p.shape === "squiggle" && /* @__PURE__ */ jsx("svg", {
				width: "16",
				height: "10",
				viewBox: "0 0 16 10",
				fill: "none",
				children: /* @__PURE__ */ jsx("path", {
					d: "M1 5c1.6-3.6 3.4-3.6 4.6 0s3 3.6 4.6 0 3-3.6 4.4 0",
					stroke: "currentColor",
					strokeWidth: "2.2",
					strokeLinecap: "round"
				})
			})
		}, i))
	});
}
function usePrefersReducedMotion() {
	const query = "(prefers-reduced-motion: reduce)";
	const [reduce, setReduce] = useState(() => window.matchMedia(query).matches);
	useEffect(() => {
		const mq = window.matchMedia(query);
		const update = () => setReduce(mq.matches);
		mq.addEventListener("change", update);
		return () => mq.removeEventListener("change", update);
	}, []);
	return reduce;
}
/**
* Themed tooltips for the panel: anything with `data-tip` gets one on hover, or on keyboard
* focus, drawn in the panel's own colours instead of the browser's plain tooltip. It sits
* above its element (below when there's no room) and stays on screen.
*/
function TooltipLayer({ rootRef }) {
	const [tip, setTip] = useState(null);
	const [pos, setPos] = useState(null);
	const tipRef = useRef(null);
	const timer = useRef(null);
	useEffect(() => {
		const root = rootRef.current;
		const target = (e) => e.target.closest?.("[data-tip]");
		const show = (el) => {
			clearTimeout(timer.current);
			timer.current = setTimeout(() => setTip({
				text: el.dataset.tip,
				rect: el.getBoundingClientRect()
			}), HINT_DELAY);
		};
		const hide = () => {
			clearTimeout(timer.current);
			setTip(null);
		};
		const onOver = (e) => {
			const el = target(e);
			if (el && e.pointerType !== "touch") show(el);
		};
		const onOut = (e) => {
			const el = target(e);
			if (el && !el.contains(e.relatedTarget)) hide();
		};
		const onFocus = (e) => {
			const el = target(e);
			if (el?.matches(":focus-visible")) show(el);
		};
		root.addEventListener("pointerover", onOver);
		root.addEventListener("pointerout", onOut);
		root.addEventListener("focusin", onFocus);
		root.addEventListener("focusout", hide);
		root.addEventListener("pointerdown", hide);
		root.addEventListener("scroll", hide, true);
		window.addEventListener("scroll", hide, true);
		return () => {
			clearTimeout(timer.current);
			root.removeEventListener("pointerover", onOver);
			root.removeEventListener("pointerout", onOut);
			root.removeEventListener("focusin", onFocus);
			root.removeEventListener("focusout", hide);
			root.removeEventListener("pointerdown", hide);
			root.removeEventListener("scroll", hide, true);
			window.removeEventListener("scroll", hide, true);
		};
	}, [rootRef]);
	useLayoutEffect(() => {
		if (!tip || !tipRef.current) return setPos(null);
		const { width, height } = tipRef.current.getBoundingClientRect();
		const r = tip.rect;
		const vw = document.documentElement.clientWidth;
		const above = r.top - height - PANEL_GAP;
		setPos({
			top: Math.round(above >= EDGE ? above : r.bottom + PANEL_GAP),
			left: Math.round(clamp(r.left + r.width / 2 - width / 2, EDGE, vw - width - EDGE))
		});
	}, [tip]);
	if (!tip) return null;
	return /* @__PURE__ */ jsx("span", {
		ref: tipRef,
		"aria-hidden": "true",
		className: "theme-switcher theme-hint pointer-events-none fixed z-[70] max-w-[240px] rounded-md bg-zinc-900 px-2 py-1 text-[11px] font-medium leading-snug text-white shadow-lg",
		style: pos ?? {
			top: -9999,
			left: -9999
		},
		children: tip.text
	});
}
/** Viewport size without scrollbars: the area fixed elements are placed in. */
function useViewport() {
	const read = () => ({
		width: document.documentElement.clientWidth,
		height: document.documentElement.clientHeight
	});
	const [size, setSize] = useState(read);
	useLayoutEffect(() => {
		const update = () => setSize((s) => {
			const n = read();
			return n.width === s.width && n.height === s.height ? s : n;
		});
		update();
		window.addEventListener("resize", update);
		return () => window.removeEventListener("resize", update);
	}, []);
	return size;
}
var clamp = (n, min, max) => Math.min(Math.max(n, min), Math.max(min, max));
function clampToViewport({ left, top }, { width, height }) {
	return {
		left: Math.round(clamp(left, EDGE, width - BUTTON_SIZE - EDGE)),
		top: Math.round(clamp(top, EDGE, height - BUTTON_SIZE - EDGE))
	};
}
/** Saved as fractions of the space the button can move in, so resizing keeps its relative spot. */
function toRatios({ left, top }, { width, height }) {
	const ratio = (n, span) => span > 0 ? clamp((n - EDGE) / span, 0, 1) : 0;
	return {
		rx: ratio(left, width - BUTTON_SIZE - 24),
		ry: ratio(top, height - BUTTON_SIZE - 24)
	};
}
function fromRatios({ rx, ry }, viewport) {
	const { width, height } = viewport;
	return clampToViewport({
		left: EDGE + rx * (width - BUTTON_SIZE - 24),
		top: EDGE + ry * (height - BUTTON_SIZE - 24)
	}, viewport);
}
/** Pixel position of the button in a plain corner. */
function cornerPoint(position, { width, height }) {
	return {
		left: position.endsWith("left") ? CORNER_GAP : width - CORNER_GAP - BUTTON_SIZE,
		top: position.startsWith("top") ? CORNER_GAP : height - CORNER_GAP - BUTTON_SIZE
	};
}
/**
* Where the panel goes and how big it is. In its default corner it sits under the site's nav
* (the 'top-right' position). Next to a moved button it opens below the button in the top half
* of the screen and above it otherwise, lined up with the button's inward side. Its edges away
* from the button (`free`) can be dragged to resize it; the edge at the button stays put.
* @param {{ left: number, top: number } | null} button
* @param {{ width: number | null, height: number | 'full' | null }} size
*/
function panelLayout(button, { width: vw, height: vh }, size) {
	const narrow = vw < 640;
	const style = {};
	const free = {
		left: false,
		right: false,
		top: false,
		bottom: false
	};
	let maxWidth;
	let maxHeight;
	if (!button) {
		const wide = vw >= 1200;
		style.top = wide ? 72 : 128;
		style.right = narrow ? EDGE : wide ? 16 : 24;
		maxHeight = vh - style.top - EDGE;
		free.bottom = true;
		style.transformOrigin = "top right";
	} else {
		const onRight = button.left + BUTTON_SIZE / 2 > vw / 2;
		const below = button.top + BUTTON_SIZE / 2 < vh / 2;
		if (onRight) style.right = clamp(vw - button.left - BUTTON_SIZE, EDGE, vw - EDGE - MIN_PANEL_WIDTH);
		else style.left = clamp(button.left, EDGE, vw - EDGE - MIN_PANEL_WIDTH);
		free[onRight ? "left" : "right"] = !narrow;
		if (below) {
			style.top = button.top + BUTTON_SIZE + PANEL_GAP;
			maxHeight = vh - style.top - EDGE;
			free.bottom = true;
		} else {
			style.bottom = vh - button.top + PANEL_GAP;
			maxHeight = button.top - PANEL_GAP - EDGE;
			free.top = true;
		}
		style.transformOrigin = `${below ? "top" : "bottom"} ${onRight ? "right" : "left"}`;
	}
	if (narrow) {
		style.left = EDGE;
		style.right = EDGE;
	} else {
		free.left ||= !button;
		maxWidth = vw - EDGE - (style.right ?? style.left);
		style.width = Math.round(clamp(size.width ?? PANEL_WIDTH, MIN_PANEL_WIDTH, maxWidth));
	}
	style.maxHeight = maxHeight;
	if (size.height === "full") style.height = maxHeight;
	else if (size.height) style.height = Math.round(clamp(size.height, MIN_PANEL_HEIGHT, maxHeight));
	return {
		style,
		free
	};
}
/**
* Invisible grab strips along the panel's free edges, plus the corner where two meet. They sit
* mostly outside the panel, so they're easy to catch and never cover its scrollbar.
*/
function ResizeHandles({ free, onStart, onMove, onEnd, onReset, active }) {
	const strips = [
		free.left && {
			edges: { left: true },
			className: "inset-y-5 -left-2 w-3 cursor-ew-resize"
		},
		free.right && {
			edges: { right: true },
			className: "inset-y-5 -right-2 w-3 cursor-ew-resize"
		},
		free.top && {
			edges: { top: true },
			className: "inset-x-5 -top-2 h-3 cursor-ns-resize"
		},
		free.bottom && {
			edges: { bottom: true },
			className: "inset-x-5 -bottom-2 h-3 cursor-ns-resize"
		}
	];
	for (const v of ["top", "bottom"]) for (const h of ["left", "right"]) if (free[v] && free[h]) {
		const diagonal = v === "top" === (h === "left") ? "cursor-nwse-resize" : "cursor-nesw-resize";
		strips.push({
			edges: {
				[v]: true,
				[h]: true
			},
			className: `-${v}-2 -${h}-2 h-5 w-5 ${diagonal}`,
			corner: true
		});
	}
	return strips.filter(Boolean).map(({ edges, className, corner }) => /* @__PURE__ */ jsx("div", {
		"aria-hidden": "true",
		"data-tip": active ? void 0 : "Drag to resize, double-click to reset",
		onPointerDown: onStart(edges),
		onPointerMove: onMove,
		onPointerUp: onEnd,
		onPointerCancel: onEnd,
		onLostPointerCapture: onEnd,
		onDoubleClick: onReset(edges),
		className: `theme-resize absolute z-30 touch-none select-none ${corner ? "" : "rounded-full hover:bg-zinc-400/30"} ${className}`
	}, Object.keys(edges).join("-")));
}
//#endregion
export { PAIRINGS as A, TOKEN_KEYS as C, MIN_CONTRAST_NON_TEXT as D, MIN_CONTRAST_LARGE_TEXT as E, contrastRatio as F, normalizeHex as I, checkTheme as M, fixAll as N, MIN_CONTRAST_TEXT as O, suggestFix as P, TOKEN_GROUPS as S, deriveAppTokens as T, darkTokens as _, rolesFromPalette as a, BASE_TOKENS as b, applyTokens as c, prePaintScript as d, collectColors as f, themeFromRoles as g, suggestThemes as h, dominantColours as i, checkRamp as j, MIN_RAMP_STEP_DELTA_E as k, useTheme as l, inferRoles as m, DEFAULT_SETTINGS as n, themeFromPalette as o, detectSiteName as p, coloursFromFile as r, ThemeProvider as s, ThemeSwitcher as t, DEFAULT_STORAGE_KEY as u, isDarkTheme as v, completeTokens as w, PRESETS as x, toDark as y };
