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
var hslOf$4 = (hex) => rgbToHsl(hexToRgb(hex));
var hsl$1 = (h, s, l) => rgbToHex(hslToRgb([
	h,
	Math.min(1, Math.max(0, s)),
	Math.min(1, Math.max(0, l))
]));
/** Same hue, saturation capped at `maxS`, lightness set to `l`. */
var tone = (hex, l, maxS = 1) => {
	const [h, s] = hslOf$4(hex);
	return hsl$1(h, Math.min(s, maxS), l);
};
/** Keeps hue and saturation, lifting lightness into [min, max] so it reads on a dark page. */
var lift = (hex, min, max = .78) => {
	const [h, s, l] = hslOf$4(hex);
	return hsl$1(h, s, Math.min(max, Math.max(min, l)));
};
/**
* Lightens a colour, keeping its hue and saturation, until it reaches `ratio` against `bg`.
* Lightness alone doesn't guarantee that: a vivid blue or violet at 60% lightness still reads dark.
*/
var readOn = (hex, bg, ratio) => {
	const [h, s, l] = hslOf$4(hex);
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
/** What Subtle keeps from the site: its backgrounds, cards, text, borders and status colours. */
var SITE_KEYS = [
	"background",
	"surface",
	"border",
	"shadow",
	"ink",
	"ink-secondary",
	"ink-muted",
	"success",
	"warning",
	"danger",
	"info",
	"app-background",
	"app-input",
	"app-border",
	"app-shadow-dark",
	"app-shadow-light",
	"app-ink",
	"app-ink-muted"
];
/** The soft tints a page is coloured with (badges, icon tiles, bands): Subtle keeps them quiet. */
var TINT_KEYS = ["secondary", "accent"];
/**
* Subtle: the site's own backgrounds, cards and text stay (in the current mode). The theme's brand
* colour comes in on buttons, links and highlights, and the soft tints (badges, icon tiles, bands)
* take only a quiet, greyed hint of the theme, so the page keeps its own feel. Balanced shows those
* tints in full. Every pairing is then checked, and anything hard to read nudged until it reads.
* @param {import('./tokens.js').ThemeTokens} theme
* @param {import('./tokens.js').ThemeTokens} site  the site's own colours, in the same mode
*/
function accentTokens(theme, site) {
	const out = { ...theme };
	for (const key of SITE_KEYS) if (site[key]) out[key] = site[key];
	for (const key of TINT_KEYS) {
		if (!theme[key] || !site.background) continue;
		const [h, sat] = hslOf$4(theme[key]);
		const [, , bgL] = hslOf$4(site.background);
		const l = bgL > .5 ? Math.max(.86, bgL - .06) : Math.min(.22, bgL + .07);
		out[key] = hsl$1(h, sat * .22, l);
	}
	return {
		...out,
		...fixAll(out)
	};
}
var tintTowards = (colour, base, amount) => {
	const [r, g, b] = hexToRgb(colour);
	const [br, bg, bb] = hexToRgb(base);
	return rgbToHex([
		r * amount + br * (1 - amount),
		g * amount + bg * (1 - amount),
		b * amount + bb * (1 - amount)
	]);
};
/**
* Colourful: an overhaul. The page and its cards take a clear tint of the brand colours (soft in
* light mode, deeper in dark), borders and tints lean towards them, and colorsbymax paints the
* page's parts by role on top (see vivid.js). Text is checked against every new background.
*/
function vividTokens(t, { strength = .5, tint = null } = {}) {
	const k = Math.min(1, Math.max(0, strength));
	const lerp = (a, b) => a + (b - a) * k;
	const dark = isDarkTheme(t);
	const wash = tint ?? t.primary;
	const deep = t["primary-dark"];
	const out = {
		...t,
		background: tintTowards(wash, t.background, dark ? lerp(.11, .24) : lerp(.09, .19)),
		surface: tintTowards(wash, t.surface, dark ? lerp(.07, .18) : lerp(.045, .11)),
		border: tintTowards(wash, t.border, lerp(.15, .45)),
		secondary: tintTowards(wash, t.secondary, lerp(.12, .4)),
		"app-background": tintTowards(wash, t["app-background"] ?? t.background, dark ? lerp(.11, .24) : lerp(.09, .19)),
		ink: tintTowards(deep, t.ink, lerp(.08, .4)),
		"ink-secondary": tintTowards(deep, t["ink-secondary"], lerp(.08, .35)),
		shadow: tintTowards(t.primary, t.shadow, lerp(.1, .35))
	};
	return {
		...out,
		...fixAll(out)
	};
}
/**
* Balanced: the theme in every role, with a soft wash of it on the page, cards and borders, so it
* shows on the page even where the theme's own backgrounds are nearly white (or nearly black).
* Gentler than Colourful at its lightest; text keeps the theme's own colours.
*/
function balancedTokens(t) {
	const dark = isDarkTheme(t);
	const out = {
		...t,
		background: tintTowards(t.primary, t.background, dark ? .065 : .05),
		surface: tintTowards(t["primary-alt"], t.surface, dark ? .04 : .02),
		border: tintTowards(t.primary, t.border, .2),
		"app-background": tintTowards(t.primary, t["app-background"] ?? t.background, dark ? .065 : .05)
	};
	return {
		...out,
		...fixAll(out)
	};
}
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
	const applied = [...document.querySelectorAll("style[data-colorsbymax=\"recolour\"], style[data-colorsbymax=\"vivid\"], style[data-colorsbymax=\"guard\"]")];
	for (const sheet of applied) sheet.disabled = true;
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
		for (const sheet of applied) sheet.disabled = false;
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
/** A path as colorsbymax compares it: no query or hash, no trailing slash (but "/" for the home page). */
function normalPath(input) {
	if (typeof input !== "string") return null;
	let p = input.trim().split(/[?#]/)[0];
	if (!p) return null;
	try {
		if (/^https?:\/\//i.test(p)) {
			const url = new URL(p);
			if (url.origin !== location.origin) return null;
			p = url.pathname;
		}
	} catch {
		return null;
	}
	if (!p.startsWith("/")) p = `/${p}`;
	const section = p.endsWith("/*");
	p = p.replace(/\/\*$/, "").replace(/\/+/g, "/").replace(/\/$/, "");
	if (!/^[\w\-./~%@+:]*$/.test(p) || p.length > 200) return null;
	return section ? `${p}/*` : p || "/";
}
/** A clean list of pages: valid, without duplicates, at most MAX_PAGES. */
var cleanPages = (list) => [...new Set((Array.isArray(list) ? list : []).map(normalPath).filter(Boolean))].slice(0, 50);
/**
* The scope a visitor chose, or null for none (the site's `pages` config, else the whole site).
* @returns {{ mode: 'all' | 'pages', pages: string[] } | null}
*/
function cleanScope(input) {
	if (!input || typeof input !== "object") return null;
	return {
		mode: input.mode === "pages" ? "pages" : "all",
		pages: cleanPages(input.pages)
	};
}
/** Whether a page gets the colours. */
var pageMatches = (page, path) => page.endsWith("/*") ? path === page.slice(0, -2) || path.startsWith(page.slice(0, -1)) : path === page;
var inScope = (scope, path) => !scope || scope.mode !== "pages" || scope.pages.some((p) => pageMatches(p, path));
var NAVIGATE = "colorsbymax:navigate";
var WATCHED = Symbol.for("colorsbymax.history");
function watchHistory() {
	if (history[WATCHED]) return;
	history[WATCHED] = true;
	for (const method of ["pushState", "replaceState"]) {
		const original = history[method];
		history[method] = function(...args) {
			const result = original.apply(this, args);
			window.dispatchEvent(new Event(NAVIGATE));
			return result;
		};
	}
}
/** The current page's path, following a single-page app's navigation too. */
function usePathname() {
	const [path, setPath] = useState(() => normalPath(location.pathname) ?? "/");
	useEffect(() => {
		watchHistory();
		const update = () => setPath(normalPath(location.pathname) ?? "/");
		window.addEventListener(NAVIGATE, update);
		window.addEventListener("popstate", update);
		update();
		return () => {
			window.removeEventListener(NAVIGATE, update);
			window.removeEventListener("popstate", update);
		};
	}, []);
	return path;
}
var FILE = /\.(?!html?$)[a-z0-9]{2,5}$/i;
/** The site's pages this page links to (its nav, footer and so on), for Studio to offer. */
function linkedPages(max = 30) {
	const found = /* @__PURE__ */ new Set();
	for (const a of document.querySelectorAll("a[href]")) {
		if (a.closest("colorsbymax-root, [data-colorsbymax]")) continue;
		const href = a.getAttribute("href");
		if (!href || /^(mailto|tel|javascript):/i.test(href) || href.startsWith("#")) continue;
		let url;
		try {
			url = new URL(href, location.href);
		} catch {
			continue;
		}
		if (url.origin !== location.origin || FILE.test(url.pathname)) continue;
		const path = normalPath(url.pathname);
		if (path) found.add(path);
		if (found.size >= max) break;
	}
	return [...found];
}
/** The config line that gives every visitor these pages. */
var pagesSnippet = (pages) => `// Add to your colorsbymax config (the autoMount({...}) call, or the config passed to <ThemeProvider>):\npages: ${JSON.stringify(pages, null, 2)},`;
var pagesPrompt = (pages) => `In my colorsbymax config (the autoMount({...}) call, or the config passed to <ThemeProvider>), set pages: ${JSON.stringify(pages)} so the theme only colours those pages and every other page keeps its own colours. A path ending in /* covers that section and every page under it. If the site uses import 'colorsbymax/auto', replace it with import { autoMount } from 'colorsbymax/auto' and an autoMount({ pages: [...] }) call. Don't change anything else.`;
//#endregion
//#region src/underlay.js
var MAX_SIBLINGS = 40;
var POSITIONED = /* @__PURE__ */ new Set(["absolute", "fixed"]);
var alphaOf = (colour) => {
	const m = colour.match(/rgba?\([^)]*[,/]\s*([\d.]+%?)\s*\)$/);
	if (!m) return colour === "transparent" ? 0 : 1;
	return m[1].endsWith("%") ? parseFloat(m[1]) / 100 : Number(m[1]);
};
/**
* The positioned sibling painted under the middle of `el`, with a background of its own, or null.
* It counts when it comes before `el` (painted first) or sits behind it (a negative z-index); one
* after it at the same level would be on top, like a tooltip, and doesn't count.
*/
function underlayOf(el) {
	const parent = el.parentElement;
	if (!parent || parent.children.length > MAX_SIBLINGS) return null;
	const r = el.getBoundingClientRect();
	if (!r.width || !r.height) return null;
	const x = r.left + r.width / 2;
	const y = r.top + r.height / 2;
	let before = true;
	for (const sib of parent.children) {
		if (sib === el) {
			before = false;
			continue;
		}
		const cs = getComputedStyle(sib);
		if (!POSITIONED.has(cs.position)) continue;
		if (!before && !(parseInt(cs.zIndex, 10) < 0)) continue;
		if (alphaOf(cs.backgroundColor) < .5 && !/gradient/.test(cs.backgroundImage)) continue;
		const s = sib.getBoundingClientRect();
		if (x >= s.left && x <= s.right && y >= s.top && y <= s.bottom) return sib;
	}
	return null;
}
/** The theme colours offered as swatches, in order. */
var SWATCH_TOKENS = [
	"primary",
	"primary-alt",
	"primary-dark",
	"secondary",
	"accent",
	"on-primary",
	"background",
	"surface",
	"ink",
	"ink-muted",
	"data-1",
	"data-2",
	"data-3"
];
var PROPS = [
	{
		key: "background",
		label: "Background"
	},
	{
		key: "text",
		label: "Text"
	},
	{
		key: "border",
		label: "Border"
	}
];
var SKIP$3 = "colorsbymax-root, [data-colorsbymax], script, style, noscript, template, head";
var CONTROLS = "a, button, [role=\"button\"], input, select, textarea, label, summary";
/** The part of the page a pointer event is over: the control it's in, or the element itself. */
function pickTarget(e) {
	if (e.composedPath?.().some((n) => n.localName === "colorsbymax-root")) return null;
	let el = e.target;
	if (!(el instanceof Element)) return null;
	el = el.closest("svg") ?? el;
	if (el === document.documentElement || el === document.body || el.closest(SKIP$3)) return null;
	return el.closest(CONTROLS) ?? el;
}
/** The element around this one, skipping wrappers exactly its size; null at the top. */
function parentOf(el) {
	const r = el.getBoundingClientRect();
	let p = el.parentElement;
	while (p && p !== document.body) {
		const q = p.getBoundingClientRect();
		if (Math.abs(q.width - r.width) > 2 || Math.abs(q.height - r.height) > 2) return p;
		p = p.parentElement;
	}
	return null;
}
var shown = (el) => {
	if (el.closest(SKIP$3)) return false;
	const r = el.getBoundingClientRect();
	return r.width > 1 && r.height > 1;
};
var sameSize = (a, b) => {
	const r = a.getBoundingClientRect();
	const q = b.getBoundingClientRect();
	return Math.abs(q.width - r.width) <= 2 && Math.abs(q.height - r.height) <= 2;
};
/**
* The first part inside this one (the first holding words, else the first shown), past wrappers
* exactly its size; null when it holds only its own words, so it is the text itself.
*/
function childOf(el) {
	let node = el;
	for (let depth = 0; depth < 10; depth++) {
		const kids = [...node.children].filter(shown);
		if (!kids.length) return node === el ? null : node;
		const next = kids.find((k) => k.innerText?.trim()) ?? kids[0];
		if (!sameSize(next, el)) return next.closest("svg") ?? next;
		node = next;
	}
	return null;
}
var validId = (id) => /^[A-Za-z][\w-]*$/.test(id) && !/\d{4,}|^(radix|headlessui|react|:r)/i.test(id);
/** A selector for exactly this element: its place under the nearest element with a steady id. */
function selectorFor(el) {
	const parts = [];
	let node = el;
	while (node && node.nodeType === 1) {
		if (node === document.body) {
			parts.unshift("body");
			break;
		}
		if (node.id && validId(node.id) && document.querySelectorAll(`#${CSS.escape(node.id)}`).length === 1) {
			parts.unshift(`#${CSS.escape(node.id)}`);
			break;
		}
		const tag = node.localName;
		const parent = node.parentElement;
		if (!parent) break;
		const same = [...parent.children].filter((c) => c.localName === tag);
		parts.unshift(same.length > 1 ? `${tag}:nth-of-type(${same.indexOf(node) + 1})` : tag);
		node = parent;
	}
	return parts.join(" > ");
}
/** A selector for every part like this one: the same tag and classes, or its siblings of that tag. */
function similarSelector(el) {
	const classes = [...el.classList].filter((c) => !/^(cbm|colorsbymax)/.test(c)).slice(0, 8);
	if (classes.length) return `${el.localName}${classes.map((c) => `.${CSS.escape(c)}`).join("")}`;
	const path = selectorFor(el).split(" > ");
	path[path.length - 1] = el.localName;
	return path.join(" > ");
}
var count = (selector) => {
	try {
		return document.querySelectorAll(selector).length;
	} catch {
		return 0;
	}
};
var TEXT_TAGS = /* @__PURE__ */ new Set([
	"p",
	"span",
	"li",
	"small",
	"strong",
	"em",
	"b",
	"i",
	"label",
	"blockquote",
	"figcaption",
	"dd",
	"dt",
	"td",
	"th",
	"code",
	"time"
]);
var LANDMARKS = {
	header: "Header",
	nav: "Navigation",
	footer: "Footer",
	aside: "Sidebar",
	main: "Main area",
	section: "Section",
	form: "Form"
};
function looksLikeButton(el) {
	const cs = getComputedStyle(el);
	const filled = toHex(cs.backgroundColor) !== null;
	const bordered = parseFloat(cs.borderTopWidth) > 0;
	return (filled || bordered) && parseFloat(cs.paddingLeft) >= 6 && cs.display !== "inline";
}
/** What kind of part it is, in plain words: Button, Link, Heading, Card and so on. */
function kindOf(el) {
	const tag = el.localName;
	if (tag === "button" || el.getAttribute("role") === "button" || tag === "input" && [
		"button",
		"submit",
		"reset"
	].includes(el.type)) return "Button";
	if (tag === "a") return looksLikeButton(el) ? "Button" : "Link";
	if (/^h[1-6]$/.test(tag)) return "Heading";
	if ([
		"img",
		"svg",
		"picture",
		"video",
		"canvas"
	].includes(tag)) return tag === "svg" ? "Icon" : "Image";
	if ([
		"input",
		"select",
		"textarea"
	].includes(tag)) return "Field";
	if (LANDMARKS[tag]) return LANDMARKS[tag];
	if (TEXT_TAGS.has(tag)) return "Text";
	const cs = getComputedStyle(el);
	const r = el.getBoundingClientRect();
	if (r.width > window.innerWidth * .85 && r.height > 160) return "Section";
	if ((parseFloat(cs.borderTopWidth) > 0 || cs.boxShadow !== "none" || parseFloat(cs.borderTopLeftRadius) >= 6) && el.children.length) return "Card";
	if (!el.children.length && el.textContent.trim()) return "Text";
	return "Box";
}
var trimText = (s, max = 48) => {
	const t = (s ?? "").replace(/\s+/g, " ").trim();
	return t.length > max ? `${t.slice(0, max - 1)}…` : t;
};
/** Its words (or a picture's description), to recognise it by. */
var textOf = (el) => trimText(el.getAttribute("aria-label") || el.getAttribute("alt") || el.innerText || el.getAttribute("title") || "");
function* ancestors(el) {
	for (let node = el.parentElement; node && node !== document.body; node = node.parentElement) yield node;
}
/** The words to know a part by: a card or section by its heading, anything else by its own text. */
function nameText(el, kind) {
	if ([
		"Card",
		"Section",
		"Box",
		"Header",
		"Footer",
		"Sidebar",
		"Main area",
		"Form",
		"Navigation"
	].includes(kind)) {
		const heading = el.querySelector("h1, h2, h3, h4, h5, h6");
		if (heading) return trimText(heading.innerText);
	}
	return textOf(el);
}
/** Where it is on the page: "in the header", "in the “Pricing” section". */
function whereOf(el) {
	const landmark = [...ancestors(el)].find((a) => [
		"footer",
		"nav",
		"aside"
	].includes(a.localName) || a.localName === "header" && a.getBoundingClientRect().height < 220);
	if (landmark) return {
		header: "in the header",
		footer: "in the footer",
		nav: "in the navigation",
		aside: "in the sidebar"
	}[landmark.localName];
	const section = el.parentElement?.closest("section, article, header, [id]:not(body):not(#root):not(#app):not(#__next)");
	if (section) {
		const heading = section.querySelector("h1, h2, h3");
		if (heading && heading !== el && trimText(heading.innerText, 40)) return `in the “${trimText(heading.innerText, 40)}” section`;
		return "in a section";
	}
	return "";
}
/** Everything Studio needs about a picked element. */
function describe$1(el) {
	const one = selectorFor(el);
	const similar = similarSelector(el);
	const likeIt = count(similar);
	const cs = getComputedStyle(el);
	const kind = kindOf(el);
	return {
		el,
		one,
		similar: likeIt > 1 && similar !== one ? similar : null,
		likeIt,
		kind,
		text: nameText(el, kind),
		where: whereOf(el),
		hasBorder: parseFloat(cs.borderTopWidth) > 0
	};
}
var canvas = null;
var rgbaCache = /* @__PURE__ */ new Map();
/**
* Any CSS colour the browser understands (rgb, hex, oklch, color(srgb …), color-mix and the rest)
* as [r, g, b, alpha], read back from a pixel so every format comes out the same way.
*/
function rgbaOf(colour) {
	if (!colour || colour === "transparent") return [
		0,
		0,
		0,
		0
	];
	const cached = rgbaCache.get(colour);
	if (cached) return cached;
	let out = [
		0,
		0,
		0,
		0
	];
	const m = colour.match(/^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.]+%?))?\s*\)$/);
	if (m) {
		const alpha = m[4] == null ? 1 : m[4].endsWith("%") ? parseFloat(m[4]) / 100 : Number(m[4]);
		out = [
			Number(m[1]),
			Number(m[2]),
			Number(m[3]),
			alpha
		];
	} else try {
		canvas ??= Object.assign(document.createElement("canvas"), {
			width: 1,
			height: 1
		}).getContext("2d", { willReadFrequently: true });
		canvas.clearRect(0, 0, 1, 1);
		canvas.fillStyle = colour;
		canvas.fillRect(0, 0, 1, 1);
		const [r, g, b, a] = canvas.getImageData(0, 0, 1, 1).data;
		out = [
			r,
			g,
			b,
			a / 255
		];
	} catch {
		out = [
			0,
			0,
			0,
			0
		];
	}
	if (rgbaCache.size > 500) rgbaCache.clear();
	rgbaCache.set(colour, out);
	return out;
}
var hexOfRgb = (rgb) => `#${rgb.map((n) => Math.round(Math.min(255, Math.max(0, n))).toString(16).padStart(2, "0")).join("")}`;
/** `top` (with its alpha) laid over the solid colour `under`. */
var over$1 = ([r, g, b, a], under) => under.map((u, i) => [
	r,
	g,
	b
][i] * a + u * (1 - a));
/** Any CSS colour as #rrggbb, or null when it's mostly see-through. */
function toHex(colour) {
	const [r, g, b, a] = rgbaOf(colour);
	return a < .5 ? null : hexOfRgb([
		r,
		g,
		b
	]);
}
/** The page's own backdrop: the root's or body's background, else white. */
function pageBackdrop() {
	for (const node of [document.body, document.documentElement]) {
		const [r, g, b, a] = rgbaOf(getComputedStyle(node).backgroundColor);
		if (a > .5) return [
			r,
			g,
			b
		];
	}
	return [
		255,
		255,
		255
	];
}
/**
* The solid colour an element's text sits on: its own background and every see-through one
* behind it, laid over each other down to the first solid one (or the page). Background
* pictures and gradients aren't counted.
*/
function backgroundRgb(el) {
	const layers = [];
	for (let node = el; node && node.nodeType === 1;) {
		const rgba = rgbaOf(getComputedStyle(node).backgroundColor);
		if (rgba[3] > .01) layers.push(rgba);
		if (rgba[3] > .99) break;
		node = underlayOf(node) ?? node.parentElement;
	}
	let colour = layers.at(-1)?.[3] > .99 ? layers.pop().slice(0, 3) : pageBackdrop();
	for (const layer of layers.reverse()) colour = over$1(layer, colour);
	return colour;
}
/** An element's text colour as it shows: faded by its own alpha and any see-through parents. */
function textRgb(el, background = backgroundRgb(el)) {
	let [r, g, b, a] = rgbaOf(getComputedStyle(el).color);
	for (let node = el; node && node.nodeType === 1; node = node.parentElement) a *= Number(getComputedStyle(node).opacity) || 0;
	return over$1([
		r,
		g,
		b,
		a
	], background);
}
/** Text against its background right now: the ratio, both colours, and what it needs to pass. */
function readability(el) {
	const bg = backgroundRgb(el);
	const text = hexOfRgb(textRgb(el, bg));
	const background = hexOfRgb(bg);
	const cs = getComputedStyle(el);
	const size = parseFloat(cs.fontSize);
	const large = size >= 24 || size >= 18.6 && Number(cs.fontWeight) >= 700;
	return {
		ratio: contrastRatio(text, background),
		text,
		background,
		need: large ? 3 : 4.5
	};
}
/** Elements under `root` (itself included) that hold their own words. */
function textHolders(root, max) {
	const out = [];
	const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: (n) => n.nodeValue.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT });
	const seen = /* @__PURE__ */ new Set();
	for (let n = walker.nextNode(); n && out.length < max; n = walker.nextNode()) {
		const el = n.parentElement;
		if (!el || seen.has(el) || el.closest(SKIP$3)) continue;
		seen.add(el);
		const r = el.getBoundingClientRect();
		if (r.width < 1 || r.height < 1 || getComputedStyle(el).visibility === "hidden") continue;
		out.push(el);
	}
	return out;
}
/**
* How readable the text in a part is: every piece of text in it (and in every part like it, when
* they change together), with the ones that are hard to read.
*/
function checkText(roots, max = 60) {
	const results = roots.flatMap((root) => textHolders(root, max)).slice(0, max).map((el) => ({
		el,
		...readability(el)
	}));
	return {
		checked: results.length,
		failing: results.filter((r) => r.ratio < r.need),
		worst: results.reduce((w, r) => !w || r.ratio / r.need < w.ratio / w.need ? r : w, null)
	};
}
/**
* The best text colour for a background: the theme colour that reads best, or black or white
* when no theme colour is readable enough.
*/
function bestText(background, tokens, need = 4.5) {
	const seen = /* @__PURE__ */ new Set();
	const best = TOKEN_KEYS.filter((token) => !token.startsWith("app-") && tokens[token] && !seen.has(tokens[token]) && seen.add(tokens[token])).map((token) => ({
		token,
		hex: tokens[token],
		ratio: contrastRatio(tokens[token], background)
	})).sort((a, b) => b.ratio - a.ratio)[0];
	if (best && best.ratio >= need) return best;
	const black = contrastRatio("#000000", background);
	const white = contrastRatio("#ffffff", background);
	return black >= white ? {
		hex: "#000000",
		ratio: black
	} : {
		hex: "#ffffff",
		ratio: white
	};
}
var cleanColour = (v) => {
	if (!v || typeof v !== "object") return null;
	const hex = normalizeHex(v.hex);
	if (TOKEN_KEYS.includes(v.token)) return {
		token: v.token,
		...hex ? { hex } : {}
	};
	return hex ? { hex } : null;
};
var cleanSelector = (s) => typeof s === "string" && s.length <= 600 && !/[{}<;]/.test(s) ? s : null;
var cleanString = (s, max) => typeof s === "string" ? s.slice(0, max) : "";
/** Keeps only well-formed paints (they come back from storage). */
function cleanPaints(list) {
	if (!Array.isArray(list)) return [];
	const out = [];
	for (const p of list) {
		if (!p || typeof p !== "object" || typeof p.id !== "string") continue;
		const page = normalPath(p.page);
		const one = cleanSelector(p.one);
		if (!page || !one) continue;
		const props = Object.fromEntries(PROPS.map(({ key }) => [key, cleanColour(p.props?.[key])]).filter(([, v]) => v));
		out.push({
			id: p.id.slice(0, 40),
			page,
			one,
			similar: cleanSelector(p.similar),
			all: Boolean(p.all && cleanSelector(p.similar)),
			everywhere: Boolean(p.everywhere && cleanSelector(p.similar)),
			likeIt: Number.isInteger(p.likeIt) ? p.likeIt : 1,
			kind: cleanString(p.kind, 30) || "Part",
			text: cleanString(p.text, 60),
			where: cleanString(p.where, 80),
			hasBorder: Boolean(p.hasBorder),
			props
		});
		if (out.length >= 80) break;
	}
	return out;
}
var selectorOf = (paint) => (paint.all || paint.everywhere) && paint.similar ? paint.similar : paint.one;
/** The page a paint is drawn on, or '*' for one that goes on every page. */
var pageOf = (paint) => paint.everywhere ? "*" : paint.page;
/** A colour for the stylesheet: the theme's variable where it follows the theme, else its hex. */
var cssValue = (v, themed) => v.token && themed ? `var(--color-${v.token}${v.hex ? `, ${v.hex}` : ""})` : v.hex ?? `var(--color-${v.token})`;
/** The stylesheet for some paints. `themed`: the page takes the theme, so swatches follow it. */
function paintCss(paints, themed = true) {
	return paints.map((p) => {
		const sel = `html ${selectorOf(p)}`;
		const rules = [];
		const { background, text, border } = p.props;
		if (background) rules.push(`${sel}{background:${cssValue(background, themed)}!important}`);
		if (text) rules.push(`${sel},${sel} *{color:${cssValue(text, themed)}!important}`);
		if (border) rules.push(`${sel}{border-color:${cssValue(border, themed)}!important${p.hasBorder ? "" : ";border-width:1px!important;border-style:solid!important"}}`);
		return rules.join("");
	}).join("");
}
var hexOf = (v, tokens) => v.token ? tokens[v.token] : v.hex;
var nameOf = (v, tokens) => v.token ? `${hexOf(v, tokens)} (the theme's ${TOKEN_LABELS[v.token]?.toLowerCase() ?? v.token} colour, var(--color-${v.token}))` : v.hex;
var partName = (p) => {
	const kind = p.kind.toLowerCase();
	return [p.text ? `the ${kind} “${p.text}”` : `${[
		"header",
		"footer",
		"navigation",
		"sidebar",
		"main area"
	].includes(kind) ? "the" : "a"} ${kind}`, p.where].filter(Boolean).join(" ");
};
var groupByPage = (paints) => paints.reduce((m, p) => m.set(pageOf(p), [...m.get(pageOf(p)) ?? [], p]), /* @__PURE__ */ new Map());
var onPage = (page) => page === "*" ? "On every page of the site" : `On the page ${page}`;
/** A prompt for Claude, Cursor or Copilot that makes the changes in the site's code. */
function paintsPrompt(paints, tokens) {
	return `Make these colour changes in my site's code. I picked them in colorsbymax Studio by clicking on the page. Find each part in the code from its description and words (the CSS selector is only a hint), and change only what's listed; keep everything else the same. Where the site already has a colour variable or theme setting for a colour, use that instead of hard-coding the hex.\n\n${[...groupByPage(paints)].map(([page, list]) => {
		const lines = list.map((p, i) => {
			const who = p.everywhere ? `${partName(p)}, and every ${p.kind.toLowerCase()} like it on every page (it's a shared component, so change it where it's defined)` : p.all && p.similar ? `${partName(p)}, and every ${p.kind.toLowerCase()} like it (${p.likeIt} on the page)` : partName(p);
			const changes = PROPS.filter(({ key }) => p.props[key]).map(({ key, label }) => `${label.toLowerCase()} ${nameOf(p.props[key], tokens)}`);
			return `${i + 1}. ${who[0].toUpperCase()}${who.slice(1)} (CSS selector: ${selectorOf(p)}): ${changes.join("; ")}.`;
		});
		return `${onPage(page)}:\n${lines.join("\n")}`;
	}).join("\n\n")}`;
}
/** The changes as plain CSS, with the theme's colours as hex. */
function paintsCssExport(paints, tokens) {
	return [...groupByPage(paints)].map(([page, list]) => {
		const rules = list.flatMap((p) => {
			const sel = selectorOf(p);
			const { background, text, border } = p.props;
			return [
				`/* ${partName(p)} */`,
				...background ? [`${sel} { background: ${hexOf(background, tokens)}; }`] : [],
				...text ? [`${sel}, ${sel} * { color: ${hexOf(text, tokens)}; }`] : [],
				...border ? [`${sel} { ${p.hasBorder ? "border-color:" : "border: 1px solid"} ${hexOf(border, tokens)}; }`] : []
			];
		});
		return `/* colorsbymax Studio, ${page === "*" ? "on every page" : `on ${page}`} */\n${rules.join("\n")}`;
	}).join("\n\n");
}
//#endregion
//#region src/guard.js
var FIX = "data-cbm-fix";
var FILL = "data-cbm-fill";
var SKIP$2 = "colorsbymax-root, [data-colorsbymax], [data-colorsbymax-contrast=\"keep\"], script, style, noscript, template, head, [aria-hidden=\"true\"], :disabled";
var MAX_CHECKED = 1500;
var WAIT = 150;
var hex = (rgb) => `#${rgb.map((n) => Math.round(Math.min(255, Math.max(0, n))).toString(16).padStart(2, "0")).join("")}`;
var over = ([r, g, b, a], under) => under.map((u, i) => [
	r,
	g,
	b
][i] * a + u * (1 - a));
var hasGradient = (cs) => cs.backgroundImage && cs.backgroundImage !== "none" && /gradient/.test(cs.backgroundImage);
/** Elements that hold words of their own, and icons drawn in the text colour. */
function holders() {
	const out = [];
	const seen = /* @__PURE__ */ new Set();
	const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, { acceptNode: (n) => n.nodeValue.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT });
	for (let n = walker.nextNode(); n && out.length < MAX_CHECKED; n = walker.nextNode()) {
		const el = n.parentElement;
		if (!el || seen.has(el)) continue;
		seen.add(el);
		out.push(el);
	}
	for (const svg of document.querySelectorAll("svg")) {
		if (out.length >= MAX_CHECKED) break;
		const cs = getComputedStyle(svg);
		if ([cs.fill, cs.stroke].some((v) => v && v !== "none") && !seen.has(svg)) out.push(svg);
	}
	return out.filter((el) => {
		if (el.closest(SKIP$2)) return false;
		const r = el.getBoundingClientRect();
		return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== "hidden";
	});
}
/**
* The solid colours an element's text could sit on: its background with every see-through one
* behind it laid over each other, or each colour of a gradient behind it.
*/
function backgroundsOf(el, cache) {
	if (cache.has(el)) return cache.get(el);
	const cs = getComputedStyle(el);
	let result;
	if (hasGradient(cs)) {
		const stops = (cs.backgroundImage.match(COLOR_IN_GRADIENT) ?? []).map(rgbaOf).filter((c) => c[3] > .05);
		const under = behind(el, cache);
		result = stops.length ? stops.flatMap((stop) => under.map((u) => over(stop, u))) : under;
	} else {
		const own = rgbaOf(cs.backgroundColor);
		if (own[3] > .99) result = [own.slice(0, 3)];
		else {
			const under = behind(el, cache);
			result = own[3] > .01 ? under.map((u) => over(own, u)) : under;
		}
	}
	cache.set(el, result);
	return result;
}
/** What's painted under an element: a positioned sibling under it (a sliding pill), else its parent. */
function behind(el, cache) {
	if (el === document.documentElement || !el.parentElement) return [[
		255,
		255,
		255
	]];
	return backgroundsOf(underlayOf(el) ?? el.parentElement, cache);
}
/**
* The element whose solid fill a piece of text sits on (a button, a pill), or null when it's on the
* page itself, a gradient or see-through layers. Light text on such a fill is kept light, and the
* fill deepened, rather than the text turned dark: what a designer would do, and what the
* re-colouring engine does with any other theme.
*/
function fillOwner(el) {
	for (let node = el; node && node !== document.body && node !== document.documentElement;) {
		const cs = getComputedStyle(node);
		if (hasGradient(cs)) return null;
		const own = rgbaOf(cs.backgroundColor);
		if (own[3] > .99) {
			const r = node.getBoundingClientRect();
			return r.width * r.height <= window.innerWidth * window.innerHeight * .25 ? node : null;
		}
		if (own[3] > .01) return null;
		node = underlayOf(node) ?? node.parentElement;
	}
	return null;
}
/** How readable each element is right now: its worst ratio, what it needs, its colour and backgrounds. */
function readAll(elements) {
	const cache = /* @__PURE__ */ new Map();
	const out = /* @__PURE__ */ new Map();
	for (const el of elements) {
		const cs = getComputedStyle(el);
		const bgs = backgroundsOf(el, cache).slice(0, 6);
		const colour = rgbaOf(cs.color);
		if (colour[3] < .05) continue;
		const texts = bgs.map((bg) => hex(over(colour, bg)));
		const ratio = Math.min(...bgs.map((bg, i) => contrastRatio(texts[i], hex(bg))));
		const size = parseFloat(cs.fontSize);
		const large = el.localName === "svg" || size >= 24 || size >= 18.6 && Number(cs.fontWeight) >= 700;
		out.set(el, {
			ratio,
			need: large ? 3 : 4.5,
			text: texts[0],
			bgs: bgs.map(hex)
		});
	}
	return out;
}
/** Reads with transitions held, so colours that animate report where they're going. */
function steady(fn) {
	const freeze = document.createElement("style");
	freeze.textContent = "*,*::before,*::after{transition:none!important}";
	document.head.append(freeze);
	try {
		return fn();
	} finally {
		freeze.remove();
	}
}
/**
* The colour a hard-to-read element should take. Its own colour first, made lighter or darker
* until it reads, so a green "Paid" stays green and a red "Failed" red; else the theme's nearest
* colour that reads, else the strongest.
*/
function fixFor({ text, bgs }, target, tokens) {
	const worstOf = (c) => Math.min(...bgs.map((bg) => contrastRatio(c, bg)));
	const start = lightness(text);
	const found = [-1, 1].map((dir) => {
		for (let l = start; l >= 0 && l <= 1; l += dir * .02) if (worstOf(withLightness(text, l)) >= target) return {
			l,
			c: withLightness(text, l)
		};
		return null;
	}).filter(Boolean).sort((a, b) => Math.abs(a.l - start) - Math.abs(b.l - start))[0];
	if (found) return found.c;
	const pool = [
		...new Set([
			"ink",
			"ink-secondary",
			"on-primary",
			"on-secondary",
			"on-accent",
			"background",
			"surface",
			"primary",
			"primary-dark"
		].map((k) => tokens[k]).filter(Boolean)),
		"#ffffff",
		"#000000"
	];
	const worst = (c) => Math.min(...bgs.map((bg) => contrastRatio(c, bg)));
	const passing = pool.filter((c) => worst(c) >= target);
	if (passing.length) return passing.reduce((a, c) => deltaE(c, text) < deltaE(a, text) ? c : a);
	return pool.reduce((a, c) => worst(c) > worst(a) ? c : a);
}
/** Starts the guard. `check(tokens)` asks for a check soon; `stop()` takes its fixes away. */
function createGuard() {
	const sheet = document.createElement("style");
	sheet.dataset.colorsbymax = "guard";
	document.head.append(sheet);
	let tokens = null;
	let timer = 0;
	const run = () => {
		timer = 0;
		if (!tokens || !document.body) return;
		sheet.textContent = "";
		for (const el of document.querySelectorAll(`[${FIX}], [${FILL}]`)) {
			el.removeAttribute(FIX);
			el.removeAttribute(FILL);
		}
		const elements = holders();
		const { now, ownerOf } = steady(() => {
			const now = readAll(elements);
			return {
				now,
				ownerOf: new Map([...now.keys()].map((el) => [el, fillOwner(el)]))
			};
		});
		const rules = [];
		let n = 0;
		const deepened = /* @__PURE__ */ new Set();
		const owners = /* @__PURE__ */ new Map();
		for (const [el, reading] of now) {
			if (reading.ratio >= reading.need - .05 || reading.bgs.length !== 1 || lightness(reading.text) <= lightness(reading.bgs[0])) continue;
			const owner = ownerOf.get(el);
			if (owner) owners.set(owner, [...owners.get(owner) ?? [], [el, reading]]);
		}
		for (const [owner, failing] of owners) {
			const light = [...now].filter(([el]) => ownerOf.get(el) === owner).map(([, r]) => r).filter((r) => lightness(r.text) > lightness(r.bgs[0]));
			const fill = light[0].bgs[0];
			const reads = (c) => light.every((r) => contrastRatio(r.text, c) >= r.need);
			let l = lightness(fill);
			let colour = fill;
			while (l > .04 && !reads(colour)) {
				l -= .02;
				colour = withLightness(fill, l);
			}
			if (!reads(colour)) continue;
			const id = `f${(n++).toString(36)}`;
			owner.setAttribute(FILL, id);
			rules.push(`[${FILL}="${id}"]{background-color:${colour}!important}`);
			for (const [el] of failing) deepened.add(el);
		}
		for (const [el, reading] of now) {
			const target = reading.need;
			if (reading.ratio >= target - .05 || deepened.has(el)) continue;
			const id = `g${(n++).toString(36)}`;
			el.setAttribute(FIX, id);
			const colour = fixFor(reading, target, tokens);
			rules.push(`[${FIX}="${id}"]{color:${colour}!important${el.localName === "svg" ? `;fill:${getComputedStyle(el).fill === "none" ? "none" : colour}!important` : ""}}`);
		}
		sheet.textContent = rules.join("");
	};
	const schedule = (wait = WAIT) => {
		clearTimeout(timer);
		timer = setTimeout(() => window.requestIdleCallback ? requestIdleCallback(run, { timeout: 300 }) : run(), wait);
	};
	const afterClick = (e) => {
		if (!e.composedPath?.().some((n) => n.localName === "colorsbymax-root")) schedule(600);
	};
	document.addEventListener("click", afterClick, true);
	const isOurs = (node) => node.closest?.("colorsbymax-root, [data-colorsbymax]");
	const observer = new MutationObserver((records) => {
		const colourVars = (style) => (style ?? "").includes("--color-");
		if (records.some((r) => {
			if (r.type === "childList") return [...r.addedNodes].some((node) => node.nodeType === 1 && !isOurs(node));
			const style = r.target.getAttribute("style");
			return style !== r.oldValue && (colourVars(style) || colourVars(r.oldValue));
		})) schedule();
	});
	observer.observe(document.body, {
		subtree: true,
		childList: true,
		attributes: true,
		attributeFilter: ["style"],
		attributeOldValue: true
	});
	window.addEventListener("load", schedule);
	return {
		/** Checks the page soon against these colours (the ones the page now shows). */
		check(next) {
			tokens = next;
			schedule();
		},
		stop() {
			clearTimeout(timer);
			observer.disconnect();
			window.removeEventListener("load", schedule);
			document.removeEventListener("click", afterClick, true);
			sheet.remove();
			for (const el of document.querySelectorAll(`[${FIX}], [${FILL}]`)) {
				el.removeAttribute(FIX);
				el.removeAttribute(FILL);
			}
		}
	};
}
//#endregion
//#region src/updates.js
/** This copy's version, built in when the package is built. */
var VERSION$1 = "0.5.1";
var LATEST = "https://registry.npmjs.org/colorsbymax/latest";
var NOTICES = "https://www.mrmaxdesigns.com/colorsbymax/api/notices";
var CHANGELOG_SOURCE = "https://raw.githubusercontent.com/MaxMuyalwa/colorsbymax/main/CHANGELOG.md";
var CHANGELOG_PAGE = "https://www.mrmaxdesigns.com/colorsbymax/docs#changelog";
var UPDATE_COMMAND = "npm install colorsbymax@latest";
var updatePrompt = (latest) => `Update colorsbymax in this project to the latest version${latest ? ` (${latest})` : ""}: run ${UPDATE_COMMAND}, then read the changelog at ${CHANGELOG_PAGE} for every version since the one installed, and make any changes its "Upgrading" notes ask for. If the site has a colorsbymax pre-paint script copied into its HTML, replace it with the current prePaintScript() output. Don't change anything else.`;
var DAY = 864e5;
var MAX_NOTES = 6;
/** Whether this page is on a development address: localhost, a .local or .test name, a private network. */
function isDevAddress(host = location.hostname) {
	return [
		"localhost",
		"127.0.0.1",
		"0.0.0.0",
		"::1",
		"[::1]"
	].includes(host) || /\.(localhost|local|test)$/.test(host) || /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host);
}
/** True when version `a` is newer than `b` ("0.5.0" > "0.4.1"). */
function isNewer(a, b) {
	if (!a || !b) return false;
	const parts = (v) => String(v).split(/[.-]/).slice(0, 3).map((n) => parseInt(n, 10) || 0);
	const [x, y] = [parts(a), parts(b)];
	for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] > y[i];
	return false;
}
async function fetchWithin(url, as = "json", ms = 6e3) {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), ms);
	try {
		const res = await fetch(url, {
			signal: controller.signal,
			credentials: "omit"
		});
		if (!res.ok) throw new Error(String(res.status));
		return as === "json" ? await res.json() : await res.text();
	} finally {
		clearTimeout(timer);
	}
}
/** The headline of each change in a version's changelog section: its bold lead, or its start. */
function notesFor(changelog, version) {
	const start = changelog.indexOf(`## ${version}`);
	if (start < 0) return [];
	const rest = changelog.slice(start).split("\n").slice(1);
	const end = rest.findIndex((line) => line.startsWith("## "));
	return rest.slice(0, end < 0 ? void 0 : end).filter((line) => line.startsWith("- ")).map((line) => {
		const tidy = (line.match(/\*\*(.+?)\*\*/)?.[1] ?? line.slice(2)).replace(/[*`]/g, "").replace(/\[([^\]]+)\]\([^)]*\)/g, "$1").trim().replace(/[,;:]$/, "");
		return tidy.length > 140 ? `${tidy.slice(0, 139)}…` : tidy;
	}).filter((note) => !/^upgrading/i.test(note)).slice(0, MAX_NOTES);
}
var read = (key) => {
	try {
		return JSON.parse(localStorage.getItem(key) || "null");
	} catch {
		return null;
	}
};
var write = (key, value) => {
	try {
		localStorage.setItem(key, JSON.stringify(value));
	} catch {}
};
var cleanNotices = (list) => (Array.isArray(list) ? list : []).filter((n) => n && typeof n.id === "string" && typeof n.title === "string").map((n) => ({
	id: n.id.slice(0, 40),
	title: n.title.slice(0, 80),
	text: String(n.text ?? "").slice(0, 400),
	link: /^https:\/\//.test(n.link ?? "") ? n.link : /^\//.test(n.link ?? "") ? `https://www.mrmaxdesigns.com${n.link}` : "",
	label: String(n.label ?? "").slice(0, 40),
	date: String(n.date ?? "").slice(0, 10)
})).slice(0, 10);
/** The latest version, its changelog headlines and Max's messages: from today's check, or a new one. */
async function check(storageKey) {
	const key = `${storageKey}:updates`;
	const cached = read(key);
	if (cached && Date.now() - cached.at < DAY) return cached;
	const [latest, notices] = await Promise.allSettled([fetchWithin(LATEST), fetchWithin(NOTICES)]);
	const version = latest.status === "fulfilled" && typeof latest.value?.version === "string" ? latest.value.version : cached?.latest ?? null;
	let notes = cached?.latest === version ? cached?.notes ?? [] : [];
	if (version && isNewer(version, "0.5.1") && !notes.length) try {
		notes = notesFor(await fetchWithin(CHANGELOG_SOURCE, "text"), version);
	} catch {}
	const result = {
		at: Date.now(),
		latest: version,
		notes,
		notices: notices.status === "fulfilled" ? cleanNotices(notices.value?.notices) : cached?.notices ?? []
	};
	write(key, result);
	return result;
}
/**
* What the bell shows: whether a newer version is out (with its headlines), Max's messages, and
* whether any of it is new since the owner last looked. `markSeen()` clears the dot.
*/
function useUpdates(storageKey, enabled) {
	const [data, setData] = useState(null);
	const [seen, setSeen] = useState(() => read(`${storageKey}:updates-seen`) ?? {
		version: null,
		notices: []
	});
	useEffect(() => {
		if (!enabled) return;
		let live = true;
		const timer = setTimeout(() => check(storageKey).then((d) => live && setData(d), () => {}), 3e3);
		return () => {
			live = false;
			clearTimeout(timer);
		};
	}, [storageKey, enabled]);
	const update = Boolean(data?.latest && isNewer(data.latest, "0.5.1"));
	const notices = data?.notices ?? [];
	const unseen = enabled && (update && seen.version !== data.latest || notices.some((n) => !seen.notices.includes(n.id)));
	const markSeen = useCallback(() => {
		if (!data) return;
		const next = {
			version: data.latest,
			notices: (data.notices ?? []).map((n) => n.id)
		};
		setSeen(next);
		write(`${storageKey}:updates-seen`, next);
	}, [data, storageKey]);
	return {
		enabled,
		current: VERSION$1,
		latest: data?.latest ?? null,
		update,
		notes: data?.notes ?? [],
		notices,
		unseen,
		markSeen,
		checked: Boolean(data)
	};
}
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
var hslOf$3 = (hex) => rgbToHsl(hexToRgb(hex));
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
		colours: dominantColours([pixelsOf$1(bitmap, bitmap.width, bitmap.height)]),
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
function pixelsOf$1(source, width, height) {
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
			pixelSets.push(pixelsOf$1(canvas, canvas.width, canvas.height));
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
		const [h, s, l] = hslOf$3(hex);
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
//#region src/vivid.js
var ZONE = "data-cbm-z";
var ROLE = "data-cbm-v";
var MIN_TEXT = 4.5;
var MIN_LARGE = 3;
var IGNORE = /* @__PURE__ */ new Set([
	"script",
	"style",
	"noscript",
	"template",
	"link",
	"meta",
	"colorsbymax-root"
]);
var BUTTON_INPUTS = /* @__PURE__ */ new Set([
	"button",
	"submit",
	"reset"
]);
var FIELD_SKIP = /* @__PURE__ */ new Set([
	"checkbox",
	"radio",
	"range",
	"color",
	"file",
	"hidden",
	"image",
	...BUTTON_INPUTS
]);
var WRAPPERS = /* @__PURE__ */ new Set([
	"div",
	"main",
	"section",
	"article"
]);
var visibleBlocks = (el) => [...el.children].filter((c) => {
	if (IGNORE.has(c.localName) || c.dataset?.colorsbymax !== void 0) return false;
	return c.getBoundingClientRect().height > 8 && getComputedStyle(c).display !== "none";
});
var pageHeight = () => Math.max(document.documentElement.scrollHeight, 1);
var isTag = (el, ...tags) => tags.includes(el.localName);
/**
* The page's top-level parts, top to bottom: past any single wrapper (an app's root div), with a
* <main>, or a wrapper holding most of the page, opened up into its sections.
*/
function pageParts() {
	let container = document.body;
	for (let i = 0; i < 6; i++) {
		const kids = visibleBlocks(container);
		if (kids.length !== 1) break;
		container = kids[0];
	}
	const parts = [];
	for (const kid of visibleBlocks(container)) {
		const r = kid.getBoundingClientRect();
		if (kid.localName === "main" || kid.getAttribute("role") === "main" || WRAPPERS.has(kid.localName) && r.height > pageHeight() * .5 && visibleBlocks(kid).length > 1) parts.push(...visibleBlocks(kid));
		else parts.push(kid);
	}
	return parts.filter((p) => p.getBoundingClientRect().height > 30);
}
var hasButton = (el) => el.querySelector("button, [role=\"button\"], input[type=\"submit\"], a[class*=\"btn\" i], a[class*=\"button\" i]");
var PRICE = /(^|[\s(])([$€£¥₹]|USD|EUR|GBP|ZMW|K|R)\s?\d[\d,.]*|\d[\d,.]*\s?(\/\s?(mo|month|yr|year|user)\b|per (month|year|user|seat)\b)/i;
var QUOTE_HINT = /testimonial|review|quote|customer-stor/i;
var ownText$1 = (el) => [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join(" ").trim();
var area = (el) => {
	const r = el.getBoundingClientRect();
	return r.width * r.height;
};
/**
* What a section of the page is, beyond its place: a pricing table (two or more prices), testimonials
* (quotes, or named that way), an image-led section (pictures fill much of it) or a form. Null for
* an ordinary section.
*/
function sectionKind(part) {
	let prices = 0;
	for (const el of part.querySelectorAll("*")) {
		if (el.children.length > 3) continue;
		if (PRICE.test(ownText$1(el)) && ++prices >= 2) return "pricing";
	}
	const named = `${part.id} ${part.className?.baseVal ?? part.className ?? ""}`;
	const quotes = part.querySelectorAll("blockquote, q, [class*=\"testimonial\" i], [class*=\"review\" i]").length;
	const quoted = [...part.querySelectorAll("p")].filter((p) => /^["“”«]/.test(p.textContent.trim())).length;
	if (QUOTE_HINT.test(named) || quotes >= 1 || quoted >= 2) return "quotes";
	const fields = part.querySelectorAll("input:not([type=hidden]):not([type=checkbox]):not([type=radio]), textarea, select").length;
	if (part.querySelector("form") && fields >= 2) return "form";
	const pictures = [...part.querySelectorAll("img, picture, video, svg[width], [style*=\"background-image\"]")].filter((m) => area(m) > 19200);
	if (pictures.length && pictures.reduce((sum, m) => sum + area(m), 0) >= area(part) * .22) return "media";
	return null;
}
/** Marks the page's header, hero, sections, closing call to action and footer. */
function markZones() {
	for (const el of document.querySelectorAll(`[${ZONE}]`)) el.removeAttribute(ZONE);
	const parts = pageParts();
	if (parts.length < 2) return;
	let header = parts.find((p) => isTag(p, "header") || p.getAttribute("role") === "banner");
	if (!header && parts[0].getBoundingClientRect().height < 200 && parts[0].querySelector("nav, a")) header = parts[0];
	const last = parts[parts.length - 1];
	const footer = parts.find((p) => isTag(p, "footer") || p.getAttribute("role") === "contentinfo") ?? (isTag(last, "footer") ? last : null);
	const body = parts.filter((p) => p !== header && p !== footer);
	const hero = body.find((p) => p.querySelector("h1")) ?? body[0];
	const end = body[body.length - 1];
	const cta = end && end !== hero && end.querySelector("h1, h2, h3") && hasButton(end) && end.textContent.trim().length < 400 ? end : null;
	if (header) header.setAttribute(ZONE, "header");
	if (footer) footer.setAttribute(ZONE, "footer");
	if (hero) hero.setAttribute(ZONE, "hero");
	if (cta) cta.setAttribute(ZONE, "cta");
	const plain = [];
	for (const p of body) {
		if (p === hero || p === cta) continue;
		const kind = sectionKind(p);
		if (kind) p.setAttribute(ZONE, kind);
		else plain.push(p);
	}
	plain.forEach((p, i) => i % 2 === 0 && p.setAttribute("data-cbm-z", "tint"));
}
/** What an element paints over: 'primary' (a brand-coloured band), 'secondary' (the footer), or 'page'. */
var zoneOf = (el) => {
	const z = el.closest(`[${ZONE}]`)?.getAttribute(ZONE);
	return z === "cta" ? "primary" : z === "footer" ? "secondary" : "page";
};
var px = (v) => parseFloat(v) || 0;
var allBorders = (cs) => [
	"top",
	"right",
	"bottom",
	"left"
].every((s) => px(cs.getPropertyValue(`border-${s}-width`)) > 0 && cs.getPropertyValue(`border-${s}-style`) !== "none");
/**
* The roles an element plays, from its original look. `ownFill` is its own background (a hex, or
* null if it has none worth counting) and `under` the hex of what it sits on.
*/
function rolesOf(el, cs, ownFill, under) {
	const roles = [];
	const name = el.localName;
	const zoneRole = el.getAttribute(ZONE);
	const zone = zoneOf(el);
	if (zoneRole) roles.push(`z-${zoneRole}`);
	const inButton = el.parentElement?.closest(`[${ROLE}~="btn"], [${ROLE}~="btn2"], [${ROLE}~="btn-inv"]`);
	if (inButton) {
		const kind = inButton.getAttribute(ROLE).match(/\b(btn-inv|btn2|btn)\b/)[1];
		roles.push(`${kind}-in`);
		return roles;
	}
	if (zone === "primary") roles.push("on1");
	else if (zone === "secondary") roles.push("on2");
	const type = (el.getAttribute("type") || "").toLowerCase();
	const radius = px(cs.borderTopLeftRadius);
	const filled = Boolean(ownFill) && deltaE(ownFill, under) > 12;
	if (name === "button" || el.getAttribute("role") === "button" || name === "input" && BUTTON_INPUTS.has(type) || (name === "a" || name === "label") && (filled || allBorders(cs)) && px(cs.paddingLeft) >= 6 && cs.display !== "inline") {
		if (!filled && !allBorders(cs)) return roles;
		roles.push(zone === "primary" ? "btn-inv" : filled ? "btn" : "btn2");
		return roles;
	}
	if (name === "a") {
		const inNav = el.closest(`nav, [${ZONE}="header"]`);
		roles.push(inNav ? "navlink" : zone === "page" ? "link" : "link-on");
		if (inNav && (el.getAttribute("aria-current") || /\b(active|current|is-active|selected)\b/.test(el.className?.baseVal ?? el.className ?? ""))) roles.push("navlink-on");
		return roles;
	}
	if (/^h[1-3]$/.test(name) && zone === "page") roles.push("head");
	if (zone === "page" && [
		"em",
		"strong",
		"b",
		"i",
		"span",
		"mark"
	].includes(name) && el.parentElement?.localName === "h1") roles.push("hl");
	if (name === "input" && !FIELD_SKIP.has(type)) roles.push("field");
	else if (name === "textarea" || name === "select") roles.push("field");
	if (zone !== "page") return roles;
	if (name === "th") roles.push("th");
	else if (name === "blockquote") roles.push("quote");
	else if (name === "pre" || name === "code" && el.parentElement?.localName !== "pre" && !allBorders(getComputedStyle(el.parentElement))) roles.push("code");
	else if (name === "hr") roles.push("rule");
	else if (name === "mark") roles.push("mark");
	const blockish = [
		"block",
		"flex",
		"grid",
		"flow-root",
		"list-item"
	].includes(cs.display);
	if (blockish && !zoneRole && radius >= 6 && (allBorders(cs) || cs.boxShadow !== "none" || filled) && ![
		"input",
		"textarea",
		"select",
		"img"
	].includes(name)) {
		const r = el.getBoundingClientRect();
		const parent = el.parentElement?.getBoundingClientRect();
		if (r.height >= 56 && parent && r.width <= parent.width * .96 && el.textContent.trim()) {
			roles.push("card");
			const section = el.closest(`[${ZONE}]`)?.getAttribute(ZONE);
			const words = el.innerText || el.textContent;
			if (section === "pricing" && PRICE.test(words)) {
				roles.push("plan");
				if (/most popular|popular|recommended|best value|best deal|our pick/i.test(words) || filled && deltaE(ownFill, under) > 20) roles.push("plan-top");
			}
			if (section === "quotes") roles.push("quote-card");
		}
	}
	const section = el.closest(`[${ZONE}]`)?.getAttribute(ZONE);
	if (section === "media" && [
		"img",
		"picture",
		"video"
	].includes(name)) {
		const r = el.getBoundingClientRect();
		if (r.width * r.height > 19200) roles.push("media");
	}
	if (section === "form" && name === "form" && !roles.includes("card")) roles.push("form-box");
	if (name === "label" && !roles.includes("btn") && !roles.includes("btn2")) roles.push("label");
	const tinted = Boolean(ownFill) && deltaE(ownFill, under) > 2;
	const words = el.textContent.trim().length;
	if (!blockish && tinted && radius >= 6 && words > 0 && words <= 30 && !el.querySelector("div, p")) roles.push("badge");
	return roles;
}
var readsOn = (fg, bgs, min) => bgs.every((bg) => contrastRatio(fg, bg) >= min);
/** The first colour that reads on every background, else the theme's plain text colour. */
var firstReadable = (candidates, bgs, min) => candidates.find((c) => c && readsOn(c, bgs, min)) ?? candidates[candidates.length - 1];
/** Roles Subtle paints: the accents only (buttons, links, badges, highlights), never backgrounds. */
var ACCENT_ROLES = /* @__PURE__ */ new Set([
	"link",
	"hl",
	"badge",
	"mark",
	"btn",
	"btn-in",
	"btn2",
	"btn2-in"
]);
/**
* The stylesheet that paints the page by role for a theme's tokens. `accents` keeps to the
* accents (Subtle): no zones, backgrounds, cards or headings, and a button on a brand band is an
* ordinary button, since the band isn't painted.
*/
function vividCss(t, { accents = false, strength = .5, tint: imageTint = null } = {}) {
	const k = Math.min(1, Math.max(0, strength));
	const lerp = (a, b) => a + (b - a) * k;
	const bg = t.background;
	const tint = imageTint ? mix(imageTint, bg, lerp(.07, .26)) : mix(t.secondary, bg, lerp(.3, .85));
	const glow = mix(imageTint ?? t.primary, bg, lerp(.07, .3));
	const glowAlt = mix(t["primary-alt"], bg, lerp(.05, .22));
	const quotesBg = mix(imageTint ?? t["primary-alt"], bg, lerp(.05, .18));
	const pageBgs = [
		bg,
		t.surface,
		tint,
		glow,
		quotesBg
	];
	const ink = firstReadable([t.ink], pageBgs, MIN_TEXT);
	const head = k < .2 ? ink : firstReadable([t["primary-dark"], ink], pageBgs, MIN_LARGE);
	const link = firstReadable([
		t.primary,
		t["primary-dark"],
		ink
	], pageBgs, MIN_TEXT);
	const linkHover = firstReadable([t["primary-dark"], ink], pageBgs, MIN_TEXT);
	const navHover = firstReadable([
		t.primary,
		t["primary-dark"],
		ink
	], [t.surface, bg], MIN_TEXT);
	const bandEnd = mix(t["primary-alt"], t.primary, .45);
	const onPrimary = firstReadable([
		t["on-primary"],
		"#ffffff",
		"#000000"
	], [t.primary], MIN_TEXT);
	const band = readsOn(onPrimary, [t.primary, bandEnd], MIN_TEXT) ? `linear-gradient(135deg,${t.primary},${bandEnd})` : t.primary;
	const footerBg = k < .3 ? tint : k > .75 ? mix(t.primary, bg, .72) : t.secondary;
	const onSecondary = firstReadable([
		t["on-secondary"],
		ink,
		"#ffffff",
		"#000000"
	], [footerBg], MIN_TEXT);
	const btnHover = mix(t["primary-dark"], t.primary, .22);
	const onBtnHover = firstReadable([
		onPrimary,
		"#ffffff",
		"#000000"
	], [btnHover], MIN_TEXT);
	const quiet = firstReadable([t["on-secondary"], ink], [t.secondary], MIN_TEXT);
	const badgeBg = mix(t.primary, t.surface, lerp(.12, .32));
	const badgeInk = firstReadable([
		t["primary-dark"],
		t["on-secondary"],
		ink
	], [badgeBg], MIN_TEXT);
	const hlGradient = readsOn(t.primary, [bg, glow], MIN_LARGE) && readsOn(t["primary-alt"], [bg, glow], MIN_LARGE);
	const shadow = `0 18px 40px -22px ${t.shadow}`;
	const move = "transition:background-color .25s,color .25s,border-color .25s,box-shadow .25s,transform .25s!important";
	const sel = (role) => accents && role === "btn" ? `[${ROLE}~="btn"],[${ROLE}~="btn-inv"]` : accents && role === "btn-in" ? `[${ROLE}~="btn-in"],[${ROLE}~="btn-inv-in"]` : `[${ROLE}~="${role}"]`;
	const r = (role, css) => accents && !ACCENT_ROLES.has(role) ? "" : `${sel(role)}{${css}}`;
	const imp = (decls) => decls.map((d) => `${d}!important`).join(";");
	return [
		`html{accent-color:${t.primary}}`,
		`::selection{background:${mix(t.primary, bg, .28)}}`,
		`[${ROLE}] li::marker,li[${ROLE}]::marker{color:${t.primary}}`,
		r("z-header", imp([`background-color:${k > .75 ? mix(t.primary, t.surface, .12) : t.surface}`, `border-bottom-color:${t.border}`])),
		r("z-hero", imp([`background-color:${bg}`, `background-image:radial-gradient(120% 85% at 50% -10%,${glow} 0%,transparent 62%),radial-gradient(60% 60% at 100% 100%,${glowAlt} 0%,transparent 70%)`])),
		r("z-tint", imp([`background-color:${tint}`])),
		r("z-pricing", imp([`background-color:${bg}`, `background-image:radial-gradient(90% 70% at 50% 0%,${glow} 0%,transparent 70%)`])),
		r("z-quotes", imp([`background-color:${quotesBg}`])),
		r("z-media", imp([`background-color:${bg}`])),
		r("z-form", imp([`background-color:${tint}`])),
		r("z-cta", imp([
			`background-color:${t.primary}`,
			`background-image:${band}`,
			`color:${onPrimary}`
		])),
		r("z-footer", imp([
			`background-color:${footerBg}`,
			`border-top-color:transparent`,
			`color:${onSecondary}`
		])),
		r("on1", imp([`color:${onPrimary}`])),
		r("on2", imp([`color:${onSecondary}`])),
		r("head", imp([`color:${head}`])),
		r("hl", hlGradient ? imp([
			`background-image:linear-gradient(100deg,${t.primary},${t["primary-alt"]})`,
			"background-color:transparent",
			"-webkit-background-clip:text",
			"background-clip:text",
			"color:transparent",
			"-webkit-text-fill-color:transparent"
		]) : imp([`color:${t.primary}`])),
		r("link", imp([
			`color:${link}`,
			`text-decoration-color:${mix(link, bg, .45)}`,
			move
		])),
		`[${ROLE}~="link"]:hover{${imp([`color:${linkHover}`, `text-decoration-color:${linkHover}`])}}`,
		r("link-on", imp(["color:inherit", "text-decoration-color:currentColor"])),
		r("navlink", imp([`color:${firstReadable([t["ink-secondary"], ink], [t.surface, bg], MIN_TEXT)}`, move])),
		!accents && `[data-cbm-v~="navlink"]:hover{${imp([`color:${navHover}`])}}`,
		r("navlink-on", imp([`color:${navHover}`, `box-shadow:inset 0 -2px 0 ${t.primary}`])),
		r("card", imp([
			`background-color:${t.surface}`,
			`border-color:${t.border}`,
			move
		])),
		!accents && `[data-cbm-v~="card"]:hover{${imp([
			`border-color:${t.primary}`,
			`box-shadow:${shadow}`,
			"transform:translateY(-2px)"
		])}}`,
		r("plan", imp([`background-color:${t.surface}`, `border-color:${t.border}`])),
		r("plan-top", imp([`border-color:${t.primary}`, `box-shadow:0 0 0 2px ${t.primary},${shadow}`])),
		r("quote-card", imp([`background-color:${t.surface}`, `box-shadow:inset 4px 0 0 ${t.primary},${shadow}`])),
		r("media", imp([`box-shadow:0 22px 50px -28px ${t.shadow}`])),
		r("form-box", imp([
			`background-color:${t.surface}`,
			`border-color:${t.border}`,
			`box-shadow:${shadow}`
		])),
		r("label", imp([`color:${firstReadable([t["ink-secondary"], ink], [
			t.surface,
			tint,
			bg
		], MIN_TEXT)}`])),
		r("badge", imp([
			`background-color:${badgeBg}`,
			`color:${badgeInk}`,
			`border-color:transparent`
		])),
		r("field", imp([
			`background-color:${t.surface}`,
			`border-color:${t.border}`,
			`color:${ink}`,
			move
		])),
		!accents && `[data-cbm-v~="field"]:focus{${imp([
			`border-color:${t.primary}`,
			`outline:2px solid ${mix(t.primary, bg, .35)}`,
			"outline-offset:1px"
		])}}`,
		r("th", imp([`background-color:${tint}`, `color:${head}`])),
		r("quote", imp([
			`border-left-color:${t.primary}`,
			`background-color:${t.surface}`,
			"border-radius:0 12px 12px 0"
		])),
		r("code", imp([`background-color:${t.secondary}`, `color:${quiet}`])),
		r("rule", imp([`border-color:${t.border}`])),
		r("mark", imp([`background-color:${mix(t["primary-alt"], bg, .3)}`, `color:${ink}`])),
		r("btn", imp([
			`background-color:${t.primary}`,
			"background-image:none",
			`color:${onPrimary}`,
			`border-color:${t.primary}`,
			`box-shadow:0 8px 20px -10px ${t.primary}`,
			move
		])),
		`${accents ? `[${ROLE}~="btn"]:hover,[${ROLE}~="btn-inv"]:hover` : `[${ROLE}~="btn"]:hover`}{${imp([
			`background-color:${btnHover}`,
			`border-color:${btnHover}`,
			`color:${onBtnHover}`,
			"transform:translateY(-1px)"
		])}}`,
		r("btn-in", imp([`color:${onPrimary}`])),
		`[${ROLE}~="btn"]:hover [${ROLE}~="btn-in"]{${imp([`color:${onBtnHover}`])}}`,
		r("btn2", imp([
			`background-color:${t.secondary}`,
			"background-image:none",
			`color:${quiet}`,
			`border-color:${t.border}`,
			move
		])),
		`[${ROLE}~="btn2"]:hover{${imp([`border-color:${t.primary}`, "transform:translateY(-1px)"])}}`,
		r("btn2-in", imp([`color:${quiet}`])),
		r("btn-inv", imp([
			`background-color:${onPrimary}`,
			"background-image:none",
			`color:${firstReadable([
				t.primary,
				t["primary-dark"],
				ink
			], [onPrimary], MIN_TEXT)}`,
			`border-color:${onPrimary}`,
			move
		])),
		!accents && `[data-cbm-v~="btn-inv"]:hover{${imp(["transform:translateY(-1px)", `box-shadow:0 10px 24px -12px ${t.shadow}`])}}`,
		r("btn-inv-in", imp([`color:${firstReadable([
			t.primary,
			t["primary-dark"],
			ink
		], [onPrimary], MIN_TEXT)}`]))
	].filter(Boolean).join("\n");
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
var hslOf$2 = (hex) => rgbToHsl(hexToRgb(hex));
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
function createRecolourer({ colourful = false } = {}) {
	const parse = createParser();
	const sheet = document.createElement("style");
	sheet.dataset.colorsbymax = "recolour";
	document.head.append(sheet);
	const vividSheet = document.createElement("style");
	vividSheet.dataset.colorsbymax = "vivid";
	document.head.append(vividSheet);
	let vivid = colourful;
	let vividOpts = {};
	const { roles } = inferRoles(collectColors());
	const site = themeFromRoles(roles);
	const plain = !roles.primary;
	const siteBgL = hslOf$2(site.background)[2];
	const siteInkL = hslOf$2(site.ink)[2];
	const lightTextOn = /* @__PURE__ */ new Set();
	/** Each distinct painted value, keyed "prop|value", plus the background under text and icons. */
	const entries = /* @__PURE__ */ new Map();
	let theme = null;
	const idFor = (prop, value, kind, backdrop = null, role = null, accent = false) => {
		const key = `${prop}|${value}|${backdrop ?? ""}|${role ?? ""}|${accent ? "a" : ""}`;
		let entry = entries.get(key);
		if (!entry) {
			entry = {
				id: `c${entries.size.toString(36)}`,
				prop,
				value,
				kind,
				backdrop,
				role,
				accent
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
		else if (el === document.documentElement) value = "rgb(255, 255, 255)";
		else value = backdropOf(underlayOf(el) ?? el.parentElement);
		backdrops.set(el, value);
		return value;
	};
	const read = (el) => {
		const cs = getComputedStyle(el);
		const ids = [];
		const role = el instanceof SVGElement || !hasOwnText(el) ? "icon" : "text";
		const ownFill = (parse(cs.backgroundColor)?.alpha ?? 0) >= .5;
		const accent = plain && !ownFill && (role === "icon" || el.localName === "a");
		if (role === "text") {
			const fg = parse(cs.color);
			const under = backdropOf(el);
			const bg = parse(under);
			if (fg && bg && luminance(fg.hex) > luminance(bg.hex) && contrastRatio(fg.hex, bg.hex) >= 3) lightTextOn.add(under);
		}
		const colour = (prop, css, kind) => {
			if (!parse(css)) return;
			ids.push(FOREGROUND.has(prop) ? idFor(prop, css, kind, backdropOf(el), prop === "color" ? role : "icon", accent) : idFor(prop, css, kind));
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
						el.removeAttribute(ROLE);
						continue;
					}
					const ids = read(el);
					if (ids.length) el.setAttribute(ATTR, ids.join(" "));
					else el.removeAttribute(ATTR);
					const cs = getComputedStyle(el);
					const own = parse(cs.backgroundColor);
					const under = parse(backdropOf(el.parentElement))?.hex ?? "#ffffff";
					const roles = rolesOf(el, cs, own && own.alpha >= .5 ? own.hex : null, under);
					if (roles.length) el.setAttribute(ROLE, roles.join(" "));
					else el.removeAttribute(ROLE);
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
		const [, s, l] = hslOf$2(c.hex);
		let hex;
		if (s < NEUTRAL_SATURATION) {
			const span = siteInkL - siteBgL;
			const t = Math.abs(span) < .05 ? l > .5 ? 0 : 1 : clamp$1((l - siteBgL) / span);
			hex = mix(theme.ink, theme.background, t);
		} else {
			const hue = hslOf$2(c.hex)[0];
			const near = (token, within) => hueDist(hue, hslOf$2(site[token])[0]) <= within;
			let anchor = near("primary", FAMILY_HUE) ? "primary" : null;
			if (!anchor && s >= .25) anchor = STATUS.filter((token) => near(token, STATUS_HUE)).sort((a, b) => hueDist(hue, hslOf$2(site[a])[0]) - hueDist(hue, hslOf$2(site[b])[0]))[0] ?? null;
			if (!anchor && near("primary-alt", FAMILY_HUE)) anchor = "primary-alt";
			if (!anchor) {
				let bestD = Infinity;
				for (const token of CATEGORIES) {
					const d = deltaE(c.hex, site[token]);
					if (d < bestD) [anchor, bestD] = [token, d];
				}
			}
			const [sh, ss, sl] = hslOf$2(site[anchor]);
			const [th, ts, tl] = hslOf$2(theme[anchor]);
			const themeBgL = hslOf$2(theme.background)[2];
			const themeInkL = hslOf$2(theme.ink)[2];
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
	const mapBg = (css) => {
		const mapped = mapHex(css, "bg");
		if (!mapped || !lightTextOn.has(css) || contrastRatio("#ffffff", mapped.hex) >= MIN_TEXT_CONTRAST) return mapped;
		let [h, s, l] = hslOf$2(mapped.hex);
		let hex = mapped.hex;
		while (l > .05 && contrastRatio("#ffffff", hex) < MIN_TEXT_CONTRAST) {
			l -= .02;
			hex = rgbToHex(hslToRgb([
				h,
				s,
				l
			]));
		}
		return {
			...mapped,
			hex
		};
	};
	const mapColour = (css, kind) => {
		const mapped = kind === "bg" ? mapBg(css) : mapHex(css, kind);
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
			const own = parse(entry.value);
			const brand = entry.accent && own && hslOf$2(own.hex)[1] < NEUTRAL_SATURATION;
			const fg = brand ? {
				hex: theme.primary,
				alpha: own.alpha
			} : mapHex(entry.value, entry.kind);
			const bg = mapBg(entry.backdrop);
			const original = {
				fg: parse(entry.value)?.hex,
				bg: parse(entry.backdrop)?.hex
			};
			if (fg && bg && original.fg && original.bg) {
				const aim = entry.role === "text" ? MIN_TEXT_CONTRAST : MIN_ICON_CONTRAST;
				const target = brand ? aim : Math.min(aim, contrastRatio(original.fg, original.bg));
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
	withoutAppliedTheme(markZones);
	tag([document.body], true);
	const LOGO_ATTR = "data-cbm-logo";
	const logos = withoutAppliedTheme(() => [...document.querySelectorAll(LOGO_SELECTOR)].filter((el) => !el.parentElement?.closest(LOGO_SELECTOR) && !el.closest(SKIP$1)).map((el) => ({
		el,
		color: getComputedStyle(el).color
	})));
	const logoRules = () => {
		if (!theme || !skip.includes(LOGO_SELECTOR)) return "";
		return logos.map(({ el, color }, i) => {
			const own = parse(color);
			if (!own || hslOf$2(own.hex)[1] >= NEUTRAL_SATURATION || !el.isConnected) return "";
			el.setAttribute(LOGO_ATTR, i);
			return `[${LOGO_ATTR}="${i}"]{color:${mapColour(color, "text")}!important}`;
		}).join("");
	};
	let settle = /* @__PURE__ */ new Set();
	let settleTimer = 0;
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
		if (changed.size) {
			tag([...changed], true);
			for (const el of changed) settle.add(el.parentElement ?? el);
			clearTimeout(settleTimer);
			settleTimer = setTimeout(() => {
				const roots = [...settle].filter((el) => el.isConnected);
				settle = /* @__PURE__ */ new Set();
				if (roots.length) {
					tag(roots, true);
					if (theme) sheet.textContent = [...entries.values()].map(rule).join("") + logoRules();
				}
			}, 450);
		}
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
			sheet.textContent = tokens ? [...entries.values()].map(rule).join("") + logoRules() : "";
			vividSheet.textContent = tokens && vivid ? vividCss(tokens, {
				...vividOpts,
				accents: vivid === "accents"
			}) : "";
		},
		/**
		* How the page's parts are painted by role on top of the swaps: true (Colourful) all of them,
		* 'accents' (Subtle) only buttons, links, badges and highlights, false (Balanced) none.
		*/
		setColourful(on, opts = {}) {
			vivid = on;
			vividOpts = opts;
			vividSheet.textContent = theme && vivid ? vividCss(theme, {
				...vividOpts,
				accents: vivid === "accents"
			}) : "";
		},
		/** Whether the logo is re-coloured with the rest (off keeps it in its own colours). */
		setLogoColouring(on) {
			const next = on ? SKIP$1 : `${SKIP$1}, ${LOGO_SELECTOR}`;
			if (next === skip) return;
			skip = next;
			tag([document.body], true);
			if (theme) sheet.textContent = [...entries.values()].map(rule).join("") + logoRules();
		},
		stop() {
			clearTimeout(settleTimer);
			observer.disconnect();
			sheet.remove();
			vividSheet.remove();
			for (const el of document.querySelectorAll(`[${ATTR}], [${ROLE}], [${ZONE}], [${LOGO_ATTR}]`)) {
				el.removeAttribute(LOGO_ATTR);
				el.removeAttribute(ATTR);
				el.removeAttribute(ROLE);
				el.removeAttribute(ZONE);
			}
		}
	};
}
//#endregion
//#region src/images.js
var SAMPLE = 48;
var MAX_PICTURES = 8;
var shownArea = (img) => {
	const r = img.getBoundingClientRect();
	return r.width > 0 && r.height > 0 ? r.width * r.height : 0;
};
/** A picture's pixels, scaled down; null when it can't be read (another site's, not loaded). */
function pixelsOf(img) {
	try {
		const w = img.naturalWidth;
		const h = img.naturalHeight;
		const scale = Math.min(1, SAMPLE / Math.max(w, h));
		const canvas = document.createElement("canvas");
		canvas.width = Math.max(1, Math.round(w * scale));
		canvas.height = Math.max(1, Math.round(h * scale));
		const ctx = canvas.getContext("2d", { willReadFrequently: true });
		ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
		return ctx.getImageData(0, 0, canvas.width, canvas.height).data;
	} catch {
		return null;
	}
}
/** The main colours in the site's logo and biggest pictures, most used first. */
function imageColours() {
	const pictures = [...document.images].filter((img) => img.complete && img.naturalWidth >= 24 && shownArea(img) && !img.closest("colorsbymax-root, [data-colorsbymax]"));
	const logos = pictures.filter((img) => img.closest(LOGO_SELECTOR));
	const photos = pictures.filter((img) => !logos.includes(img)).sort((a, b) => shownArea(b) - shownArea(a)).slice(0, MAX_PICTURES);
	const sets = [...logos.slice(0, 2), ...photos].map(pixelsOf).filter(Boolean);
	return sets.length ? dominantColours(sets) : [];
}
/** The picture colour to tint with: the most used one with real colour in it (no greys, black or white). */
function tintOf(colours) {
	return colours.find((hex) => {
		const [, s, l] = rgbToHsl(hexToRgb(hex));
		return s >= .22 && l > .18 && l < .85;
	}) ?? null;
}
/** The ten, in the order a card shows them. */
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
var CHART = [
	"data-1",
	"data-2",
	"data-3",
	"data-4"
];
var HIDDEN_CHART = [
	"data-5",
	"data-6",
	"data-7",
	"data-8"
];
var hslOf$1 = (hex) => rgbToHsl(hexToRgb(hex));
var hueGap$1 = (a, b) => {
	const d = Math.abs(a - b);
	return Math.min(d, 360 - d);
};
var clampColours = (n) => Math.min(10, Math.max(5, Math.round(Number(n) || 10)));
/** How far a colour's hue is from the theme's brand colours (0 = one of them); greys fit anything. */
function misfit(tokens, key) {
	const [h, s] = hslOf$1(tokens[key]);
	if (s < .15) return 0;
	const brand = ["primary", "primary-alt"].map((k) => hslOf$1(tokens[k])).filter(([, bs]) => bs >= .15);
	if (!brand.length) return 90;
	return Math.min(...brand.map(([bh]) => hueGap$1(h, bh)));
}
/** The swatch keys a theme keeps at `count` colours, in card order. */
function paletteKeys(tokens, count = 10) {
	const n = clampColours(count);
	if (n >= 10) return SWATCH_KEYS;
	const extras = ["secondary", ...[...CHART].sort((a, b) => misfit(tokens, a) - misfit(tokens, b))];
	const kept = /* @__PURE__ */ new Set([
		"primary",
		"primary-alt",
		"primary-dark",
		"background",
		"ink",
		...extras.slice(0, n - 5)
	]);
	return SWATCH_KEYS.filter((k) => kept.has(k));
}
/** Same hue and saturation as `hex`, at lightness `l`. */
var atLightness = (hex, l) => {
	const [h, s] = hslOf$1(hex);
	return rgbToHex(hslToRgb([
		h,
		s,
		l
	]));
};
/**
* A theme's tokens using only `count` of its colours. Chart colours that go are painted with
* the ones that stay (brand colours first), at their own lightness so charts keep their
* contrast; a soft tint that goes becomes a tint of the brand colour. The colours it replaces are
* then run through the contrast fixes (lightness only), so a smaller palette still reads.
*/
function reducePalette(tokens, count = 10) {
	const n = clampColours(count);
	if (n >= 10) return tokens;
	const kept = new Set(paletteKeys(tokens, n));
	const out = { ...tokens };
	const replaced = /* @__PURE__ */ new Set();
	const pool = [
		"primary",
		"primary-alt",
		...CHART.filter((k) => kept.has(k))
	].map((k) => tokens[k]);
	[...CHART.filter((k) => !kept.has(k)), ...HIDDEN_CHART].forEach((key, i) => {
		if (!tokens[key]) return;
		out[key] = atLightness(pool[i % pool.length], hslOf$1(tokens[key])[2]);
		replaced.add(key);
	});
	if (!kept.has("secondary")) {
		out.secondary = mix(tokens.primary, tokens.background, .14);
		out["on-secondary"] = [
			tokens["on-secondary"],
			tokens["primary-dark"],
			tokens.ink
		].find((c) => c && contrastRatio(c, out.secondary) >= 4.5) ?? tokens.ink;
		replaced.add("secondary").add("on-secondary");
	}
	for (const [key, value] of Object.entries(fixAll(out))) if (replaced.has(key)) out[key] = value;
	return out;
}
/** A theme's saved colour count: its own, or the visitor's default for every theme. */
var coloursFor = (sizes, themeId, fallback = 10) => clampColours(sizes?.[baseId(themeId)] ?? fallback);
/** Light and dark versions of a theme share one count. */
var baseId = (id) => String(id).replace(/~dark$/, "");
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
* @property {number} paletteSize  How many of a theme's ten colours every theme uses (5 to 10; 5 to start, the core ones)
* @property {'subtle' | 'balanced' | 'colourful'} colourStyle  How boldly the site takes a theme: 'subtle'
*   keeps its own backgrounds and text, 'balanced' is the theme as designed, 'colourful' an overhaul
* @property {number} colourStrength  How strongly Colourful paints, 0 (a light wash) to 100 (bold)
* @property {boolean} imageTints  Whether Colourful tints the page with colours from the site's own pictures
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
	colourStyle: "colourful",
	paletteSize: 5,
	colourStrength: 50,
	imageTints: true,
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
/**
* @param {string} storageKey
* @param {PanelSettings} [defaults]  the site's starting settings (see the config's colourLogo)
* @returns {PanelSettings}
*/
function loadSettings(storageKey, defaults = DEFAULT_SETTINGS) {
	try {
		const saved = JSON.parse(window.localStorage.getItem(`${storageKey}:settings`) || "null");
		if (!saved || typeof saved !== "object") return defaults;
		const out = { ...defaults };
		for (const [key, fallback] of Object.entries(defaults)) if (typeof saved[key] === typeof fallback) out[key] = saved[key];
		if (![
			"light",
			"dark",
			"system"
		].includes(out.mode)) out.mode = defaults.mode;
		if (![
			"subtle",
			"balanced",
			"colourful"
		].includes(out.colourStyle)) out.colourStyle = defaults.colourStyle;
		if (!Number.isFinite(out.colourStrength) || out.colourStrength < 0 || out.colourStrength > 100) out.colourStrength = defaults.colourStrength;
		if (typeof out.imageTints !== "boolean") out.imageTints = defaults.imageTints;
		if (!Number.isInteger(out.paletteSize) || out.paletteSize < 5 || out.paletteSize > 10) out.paletteSize = defaults.paletteSize;
		const size = (v) => typeof v === "number" && v > 0 && v < 1e4;
		out.panelWidth = size(saved.panelWidth) ? saved.panelWidth : null;
		out.panelHeight = size(saved.panelHeight) || saved.panelHeight === "full" ? saved.panelHeight : null;
		return out;
	} catch {
		return defaults;
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
* @property {{ mode: 'all' | 'pages', pages: string[] } | null} scope  Where the colours go, chosen in
*   Studio (null: the site's `pages` config, else the whole site)
* @property {string[]} seen  Pages of the site this visitor has opened, newest first, for Studio
* @property {object[]} paints  Parts of pages coloured by pointing and clicking in Studio
*/
/** @returns {ThemeState} */
var initialState = (defaultId) => ({
	activeId: defaultId,
	overrides: {},
	customs: [],
	snapshot: null,
	scanned: null,
	paletteSizes: {},
	scope: null,
	seen: [],
	paints: []
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
			scanned,
			paletteSizes: Object.fromEntries(Object.entries(data.paletteSizes && typeof data.paletteSizes === "object" ? data.paletteSizes : {}).filter(([id, n]) => typeof id === "string" && Number.isInteger(n) && n >= 5 && n <= 10)),
			scope: cleanScope(data.scope),
			seen: cleanPages(data.seen).filter((p) => !p.endsWith("/*")).slice(0, 30),
			paints: cleanPaints(data.paints)
		};
	} catch {
		return fresh;
	}
}
/**
* Persists state plus the fully resolved tokens, so the pre-paint script can apply
* them without knowing about presets, and the pages they go on (`where`, from Studio or the
* site's `pages` config), so it leaves the other pages alone; and Studio's stylesheet for each
* page with parts coloured by pointing and clicking (`paintCss`), so those show at once too.
*/
function saveState(storageKey, state, resolved, where = null, paintCss = null) {
	try {
		window.localStorage.setItem(storageKey, JSON.stringify({
			v: VERSION,
			...state,
			resolved,
			where: where?.mode === "pages" ? where : null,
			paintCss
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
	return `(function(){try{var s=JSON.parse(localStorage.getItem(${JSON.stringify(storageKey)})||'null');if(!s||s.v!==${VERSION})return;var p=location.pathname.replace(/\\/+$/,'')||'/';var pc=s.paintCss||{},c=(typeof pc['*']==='string'?pc['*']:'')+(typeof pc[p]==='string'?pc[p]:'');if(c){var e=document.createElement('style');e.setAttribute('data-colorsbymax','studio-early');e.textContent=c;(document.head||document.documentElement).appendChild(e)}var t=s.resolved;if(!t||typeof t!=='object')return;var w=s.where;if(w&&Object.prototype.toString.call(w.pages)==='[object Array]'){var ok=false;for(var i=0;i<w.pages.length;i++){var g=String(w.pages[i]);if(g.slice(-2)==='/*'?(p===g.slice(0,-2)||p.indexOf(g.slice(0,-1))===0):p===g){ok=true;break}}if(!ok)return}var d=document.documentElement.style;for(var k in t){var v=t[k];if(/^[a-z0-9-]+$/.test(k)&&/^#[0-9a-f]{6}$/i.test(v))d.setProperty('--color-'+k,v)}}catch(e){}})()`;
}
//#endregion
//#region src/ThemeProvider.jsx
var ThemeContext = createContext(null);
/** Writes each token to `--color-<key>` on <html>. Tailwind v4 utilities read these directly. */
function applyTokens(tokens) {
	const style = document.documentElement.style;
	for (const key of TOKEN_KEYS) style.setProperty(`--color-${key}`, tokens[key]);
}
/** Takes the tokens off <html> again, so the site's own stylesheet colours show. */
var removeTokens = () => {
	const style = document.documentElement.style;
	for (const key of TOKEN_KEYS) style.removeProperty(`--color-${key}`);
};
/** Scrollbar thumb: the theme's primary, softened towards its page background. */
var SCROLLBAR_THUMB = "color-mix(in srgb, var(--color-primary) 55%, var(--color-background))";
var newId$1 = () => `custom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
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
* @property {'light' | 'dark' | 'system'} [defaultMode]  The mode a first-time visitor starts in
*   (default 'light'; 'system' follows their device). Visitors can still change it.
* @property {boolean} [colourLogo]  Whether themes colour the site's logo for a first-time visitor
*   (default false: the logo keeps its own colours). Visitors can still change it in settings.
* @property {boolean} [intro]  Bring the colour button in with a short pop and burst of the theme's
*   colours, a moment after the page loads (default true). Reduced motion fades it in instead.
* @property {boolean} [hidden]  Hide the colour button and panel; the theme still applies. Use
*   `hidden: import.meta.env.PROD` to keep it out of production once the colours are chosen.
* @property {'bottom-right' | 'bottom-left' | 'top-left' | 'top-right'} [position]  Where the colour
*   button starts (default 'bottom-right'). 'top-right' sits under a floating nav bar.
* @property {'subtle' | 'balanced' | 'colourful'} [colourStyle]  How boldly the site takes a theme, for a
*   first-time visitor. 'subtle' keeps the site's own backgrounds, cards and text and brings the theme
*   in on buttons, links and highlights. 'balanced' is the theme as designed, every colour in its role
*   (the default on a site painted with the --color-* variables). 'colourful' is an overhaul: tinted
*   backgrounds, and the page's parts painted by role as a designer would (header, hero, sections,
*   headings, cards, buttons, links and footer; the default on a site colorsbymax re-colours).
*   Visitors can switch in the panel.
* @property {boolean | 'dev'} [updates]  The bell in the panel: when a newer colorsbymax is out it says
*   so, with how to update, alongside news from mrmaxdesigns. 'dev' (default) shows it only on
*   development addresses (localhost and the like), never to a live site's visitors; true shows it
*   everywhere, false never. It checks once a day at most.
* @property {number} [colourStrength]  How strongly Colourful paints for a first-time visitor, 0 (a light
*   wash) to 100 (bold); default 50. Visitors can change it in the panel.
* @property {Partial<Record<keyof typeof FEATURES, boolean>>} [features]  Parts of the panel to switch off
*   for everyone, e.g. { scan: false, audit: false } (all on by default). Unlike the rest of the
*   config it's read live, so a site can change it after loading (from its own settings).
* @property {string[]} [pages]  Only colour these pages, e.g. ['/', '/pricing', '/blog/*'] (a path ending in
*   /* is that section and every page under it); every other page keeps its own colours. Default:
*   the whole site. A visitor can choose differently in Studio, on their own device.
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
/** Parts of the panel a site can switch off for everyone (config `features`). All on by default. */
/** How boldly a site can take a theme, from least to most. */
var COLOUR_STYLES$1 = [
	"subtle",
	"balanced",
	"colourful"
];
var FEATURES = {
	picks: true,
	library: true,
	search: true,
	surprise: true,
	scan: true,
	custom: true,
	overrides: true,
	importExport: true,
	audit: true,
	addToSite: true,
	colourStyle: true,
	colourCount: true,
	studio: true
};
function ThemeProvider({ config = {}, children }) {
	const storageKey = config.storageKey || "colorsbymax";
	const [initialConfig] = useState(config);
	const features = useMemo(() => ({
		...FEATURES,
		...Object.fromEntries(Object.entries(config.features ?? {}).filter(([k, v]) => k in FEATURES && typeof v === "boolean"))
	}), [config.features]);
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
	const [paletteDefault, setPaletteDefault] = useState(() => loadSettings(storageKey, DEFAULT_SETTINGS).paletteSize);
	const coloursOf = useCallback((id) => coloursFor(state.paletteSizes, id, paletteDefault), [state.paletteSizes, paletteDefault]);
	const colourCount = coloursOf(base.id);
	const tokens = useMemo(() => ({
		...reducePalette(base.tokens, colourCount),
		...state.overrides
	}), [
		base,
		colourCount,
		state.overrides
	]);
	const issues = useMemo(() => checkTheme(tokens), [tokens]);
	const configPages = useMemo(() => Array.isArray(initialConfig.pages) ? cleanPages(initialConfig.pages) : null, [initialConfig]);
	const scope = useMemo(() => state.scope ?? (configPages ? {
		mode: "pages",
		pages: configPages
	} : {
		mode: "all",
		pages: []
	}), [state.scope, configPages]);
	const pathname = usePathname();
	const here = inScope(scope, pathname);
	useEffect(() => {
		setState((s) => s.seen[0] === pathname ? s : {
			...s,
			seen: [pathname, ...s.seen.filter((p) => p !== pathname)].slice(0, 30)
		});
	}, [pathname]);
	const paints = features.studio ? state.paints : [];
	const pagePaintCss = useMemo(() => {
		const byPage = {};
		for (const p of paints) (byPage[pageOf(p)] ??= []).push(p);
		const css = Object.fromEntries(Object.entries(byPage).map(([page, list]) => [page, paintCss(list, page === "*" || inScope(scope, page))]));
		return Object.keys(css).length ? css : null;
	}, [paints, scope]);
	useLayoutEffect(() => {
		document.querySelectorAll("style[data-colorsbymax=\"studio-early\"]").forEach((el) => el.remove());
		const css = (pagePaintCss?.["*"] ?? "") + (pagePaintCss?.[pathname] ?? "");
		if (!css) return;
		const style = document.createElement("style");
		style.dataset.colorsbymax = "studio";
		style.textContent = css;
		document.head.append(style);
		return () => style.remove();
	}, [pagePaintCss, pathname]);
	const recolourMode = initialConfig.recolour ?? "auto";
	const [recolours] = useState(() => recolourMode === true || recolourMode === "auto" && !usesColourTokens());
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
	const settingDefaults = useMemo(() => ({
		...DEFAULT_SETTINGS,
		colourLogo: Boolean(initialConfig.colourLogo),
		colourStrength: Number.isFinite(initialConfig.colourStrength) ? Math.min(100, Math.max(0, initialConfig.colourStrength)) : DEFAULT_SETTINGS.colourStrength,
		colourStyle: COLOUR_STYLES$1.includes(initialConfig.colourStyle) ? initialConfig.colourStyle : recolours ? "colourful" : "balanced",
		mode: [
			"light",
			"dark",
			"system"
		].includes(initialConfig.defaultMode) ? initialConfig.defaultMode : DEFAULT_SETTINGS.mode
	}), [initialConfig, recolours]);
	const [logoColouring, setLogoColouring] = useState(() => loadSettings(storageKey, settingDefaults).colourLogo);
	useLayoutEffect(() => {
		recolourer.current?.setLogoColouring(logoColouring);
	}, [logoColouring, pageColours]);
	const [colourStyle, setColourStyle] = useState(() => loadSettings(storageKey, settingDefaults).colourStyle);
	const [colourStrength, setColourStrength] = useState(() => loadSettings(storageKey, settingDefaults).colourStrength);
	const [imageTints, setImageTints] = useState(() => loadSettings(storageKey, settingDefaults).imageTints);
	const [pictureColours, setPictureColours] = useState([]);
	const vividOpts = useMemo(() => ({
		strength: colourStrength / 100,
		tint: imageTints ? tintOf(pictureColours) : null
	}), [
		colourStrength,
		imageTints,
		pictureColours
	]);
	useLayoutEffect(() => {
		recolourer.current?.setColourful(colourStyle === "colourful" ? true : colourStyle === "subtle" ? "accents" : false, vividOpts);
	}, [
		colourStyle,
		pageColours,
		vividOpts
	]);
	useLayoutEffect(() => {
		if (logoColouring || pageColours || !here) return;
		const style = document.createElement("style");
		style.dataset.colorsbymax = "logo";
		style.textContent = `:is(${LOGO_SELECTOR}){${TOKEN_KEYS.map((k) => `--color-${k}:${defaultTheme.tokens[k]}`).join(";")}}`;
		document.head.append(style);
		return () => style.remove();
	}, [
		logoColouring,
		pageColours,
		defaultTheme,
		here
	]);
	const original = (base.id === "site-original" || base.id === defaultTheme.id && !initialConfig.defaultTheme) && !Object.keys(state.overrides).length;
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
	/** Selects a theme by id; pass the theme itself for library themes and dark twins. */
	const selectTheme = useCallback((id, theme) => setState((s) => ({
		...s,
		activeId: id,
		snapshot: theme?.library || theme?.derived ? {
			id: theme.id,
			name: theme.name,
			tokens: theme.tokens
		} : s.snapshot
	})), []);
	const [modeSetting, setModeSetting] = useState(() => loadSettings(storageKey, settingDefaults).mode);
	const prefersDark = usePrefersDark();
	const mode = modeSetting === "system" ? prefersDark ? "dark" : "light" : modeSetting;
	const modeRef = useRef(mode);
	modeRef.current = mode;
	const siteTokens = useMemo(() => inMode(defaultTheme, mode).tokens, [defaultTheme, mode]);
	const ownLook = (base.id === defaultTheme.id || base.id === inMode(defaultTheme, "dark").id) && !Object.keys(state.overrides).length;
	const applied = useMemo(() => colourStyle === "subtle" ? accentTokens(tokens, siteTokens) : colourStyle === "colourful" ? vividTokens(tokens, vividOpts) : ownLook ? tokens : balancedTokens(tokens), [
		tokens,
		siteTokens,
		colourStyle,
		vividOpts,
		ownLook
	]);
	useEffect(() => {
		if (colourStyle !== "colourful" || !imageTints) return;
		const read = () => setPictureColours((old) => {
			const next = imageColours();
			return next.join() === old.join() ? old : next;
		});
		const timer = setTimeout(read, 400);
		window.addEventListener("load", read);
		return () => {
			clearTimeout(timer);
			window.removeEventListener("load", read);
		};
	}, [
		colourStyle,
		imageTints,
		pathname
	]);
	useLayoutEffect(() => {
		if (here) applyTokens(applied);
		else removeTokens();
		saveState(storageKey, {
			...state,
			activeId: base.id
		}, applied, scope, pagePaintCss);
	}, [
		applied,
		state,
		base.id,
		storageKey,
		here,
		scope,
		pagePaintCss
	]);
	useLayoutEffect(() => {
		recolourer.current?.apply(original || !here ? null : applied);
	}, [
		applied,
		original,
		pageColours,
		here
	]);
	const guard = useRef(null);
	useEffect(() => {
		const g = createGuard();
		guard.current = g;
		return () => {
			g.stop();
			guard.current = null;
		};
	}, []);
	useEffect(() => {
		guard.current?.check(here ? applied : null);
	}, [
		applied,
		here,
		pathname,
		colourStyle,
		pageColours,
		logoColouring,
		pagePaintCss
	]);
	const setMode = useCallback((next) => {
		if (![
			"light",
			"dark",
			"system"
		].includes(next)) return;
		setModeSetting(next);
		saveSettings(storageKey, {
			...loadSettings(storageKey, settingDefaults),
			mode: next
		});
	}, [storageKey, settingDefaults]);
	useLayoutEffect(() => {
		if (base.custom) return;
		if (mode === "dark" && !isDarkTheme(base.tokens)) {
			const twin = toDark(base);
			selectTheme(twin.id, twin);
		} else if (mode === "light" && base.id.endsWith("~dark")) {
			const lightId = base.id.slice(0, -DARK_SUFFIX.length);
			const local = allThemes.find((t) => t.id === lightId);
			if (local) selectTheme(local.id, local);
			else loadLibrary().then((lib) => {
				const t = lib.themes.find((x) => x.id === lightId);
				if (t) selectTheme(t.id, t);
			}, () => {});
		}
	}, [
		mode,
		base,
		allThemes,
		selectTheme
	]);
	useLayoutEffect(() => {
		const html = document.documentElement;
		if (here) {
			html.dataset.colorsbymaxScheme = mode;
			html.style.colorScheme = mode;
		} else {
			delete html.dataset.colorsbymaxScheme;
			html.style.removeProperty("color-scheme");
		}
		for (const el of document.querySelectorAll("[data-colorsbymax-mode]")) {
			const want = el.getAttribute("data-colorsbymax-mode");
			el.setAttribute("aria-pressed", String(want === "toggle" ? mode === "dark" : want === modeSetting));
		}
	}, [
		mode,
		modeSetting,
		here
	]);
	useEffect(() => {
		const onClick = (e) => {
			const el = e.target.closest?.("[data-colorsbymax-mode]");
			if (!el) return;
			const want = el.getAttribute("data-colorsbymax-mode");
			setMode(want === "toggle" ? modeRef.current === "dark" ? "light" : "dark" : want);
		};
		document.addEventListener("click", onClick);
		return () => document.removeEventListener("click", onClick);
	}, [setMode]);
	const api = {
		state,
		/** The switcher's starting settings for this site. */
		settingDefaults,
		/** The mode in effect ('light' or 'dark'), the visitor's setting ('system' follows the device), and a setter. */
		mode,
		modeSetting,
		setMode,
		storageKey,
		siteName,
		usage: initialConfig.usage ?? {},
		loadPdf: initialConfig.pdf ?? null,
		position: initialConfig.position ?? "bottom-right",
		/** Whether the panel's bell checks for updates and news here (config `updates`). */
		updatesOn: initialConfig.updates === true || initialConfig.updates !== false && isDevAddress(),
		/** True when the config hides the switcher (e.g. in production); the theme still applies. */
		hidden: Boolean(initialConfig.hidden),
		/** Whether the colour button makes an entrance when it first appears. */
		intro: initialConfig.intro !== false,
		/** True when colorsbymax is swapping the page's own colours (the site isn't wired to tokens). */
		recolouring: Boolean(pageColours),
		/** Turns re-colouring of the site's logo on or off (the switcher's "Colour the logo" setting). */
		setLogoColouring,
		/** Sets how boldly the site takes the theme: 'subtle', 'balanced' or 'colourful'. */
		setColourStyle,
		colourStyle,
		/** Colourful's strength (0 to 100) and image tints, set from the switcher's settings. */
		setColourStrength,
		setImageTints,
		/** The main colours of the site's logo and pictures, and the one Colourful tints with (or null). */
		pictureColours,
		pictureTint: imageTints ? tintOf(pictureColours) : null,
		/** The colours as the page shows them, in the visitor's colour style. */
		appliedTokens: applied,
		/** Which parts of the panel are on (config `features`). */
		features,
		/** Where the colours go: { mode: 'all' | 'pages', pages }, and whether this page gets them. */
		scope,
		inScope: here,
		pathname,
		/** The site's own `pages` config, or null; `scopeChosen` is true once the visitor picks their own. */
		configPages,
		scopeChosen: Boolean(state.scope),
		/** Sets where the colours go (Studio), on this device; null goes back to the site's setting. */
		setScope: (next) => setState((s) => ({
			...s,
			scope: next === null ? null : cleanScope(next)
		})),
		/** Pages of the site this visitor has opened, newest first. */
		seenPages: state.seen,
		/** Parts of pages coloured in Studio by pointing and clicking. */
		paints: state.paints,
		/** Adds a paint, or updates the one with its id; one with no colours left is removed. */
		savePaint: (paint) => setState((s) => {
			const [clean] = cleanPaints([paint]);
			const rest = s.paints.filter((p) => p.id !== paint.id);
			if (!clean || !Object.keys(clean.props).length) return {
				...s,
				paints: rest
			};
			const paints = s.paints.findIndex((p) => p.id === paint.id) < 0 ? [...rest, clean].slice(-80) : s.paints.map((p) => p.id === paint.id ? clean : p);
			return {
				...s,
				paints
			};
		}),
		removePaint: (id) => setState((s) => ({
			...s,
			paints: s.paints.filter((p) => p.id !== id)
		})),
		/** Clears Studio's colours, on one page or everywhere. */
		clearPaints: (page = null) => setState((s) => ({
			...s,
			paints: page ? s.paints.filter((p) => p.page !== page) : []
		})),
		/** How many colours a theme uses (5 to 10): its own count, or the visitor's default. */
		coloursOf,
		/** Sets one theme's colour count (light and dark share it). */
		setThemeColours: (id, n) => setState((s) => ({
			...s,
			paletteSizes: {
				...s.paletteSizes,
				[baseId(id)]: clampColours(n)
			}
		})),
		/** The default count for every theme (the panel's settings); themes given their own count keep it. */
		setPaletteDefault,
		siteThemes,
		defaultTheme,
		presets: PRESETS,
		customs: state.customs,
		themes: allThemes,
		active: base,
		tokens,
		issues,
		selectTheme,
		createCustom: (name) => {
			const id = newId$1();
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
			const id = newId$1();
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
var ToggleRight = icon("toggle-right", [["circle", {
	"cx": "15",
	"cy": "12",
	"r": "3"
}], ["rect", {
	"width": "20",
	"height": "14",
	"x": "2",
	"y": "5",
	"rx": "7"
}]]);
var LibraryBig = icon("library-big", [
	["rect", {
		"width": "8",
		"height": "18",
		"x": "3",
		"y": "3",
		"rx": "1"
	}],
	["path", { "d": "M7 3v18" }],
	["path", { "d": "M20.4 18.9c.2.5-.1 1.1-.6 1.3l-1.9.7c-.5.2-1.1-.1-1.3-.6L11.1 5.1c-.2-.5.1-1.1.6-1.3l1.9-.7c.5-.2 1.1.1 1.3.6Z" }]
]);
var Minus = icon("minus", [["path", { "d": "M5 12h14" }]]);
var Plus = icon("plus", [["path", { "d": "M5 12h14" }], ["path", { "d": "M12 5v14" }]]);
var MousePointerClick = icon("mouse-pointer-click", [
	["path", { "d": "M14 4.1 12 6" }],
	["path", { "d": "m5.1 8-2.9-.8" }],
	["path", { "d": "m6 12-1.9 2" }],
	["path", { "d": "M7.2 2.2 8 5.1" }],
	["path", { "d": "M9.037 9.69a.498.498 0 0 1 .653-.653l11 4.5a.5.5 0 0 1-.074.949l-4.349 1.041a1 1 0 0 0-.74.739l-1.04 4.35a.5.5 0 0 1-.95.074z" }]
]);
var ArrowUpLeft = icon("arrow-up-left", [["path", { "d": "M7 17V7h10" }], ["path", { "d": "M17 17 7 7" }]]);
var ArrowDownRight = icon("arrow-down-right", [["path", { "d": "m7 7 10 10" }], ["path", { "d": "M17 7v10H7" }]]);
var Bell = icon("bell", [["path", { "d": "M10.268 21a2 2 0 0 0 3.464 0" }], ["path", { "d": "M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326" }]]);
var ExternalLink = icon("external-link", [
	["path", { "d": "M15 3h6v6" }],
	["path", { "d": "M10 14 21 3" }],
	["path", { "d": "M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" }]
]);
//#endregion
//#region src/burst.jsx
/** The mark for something new in the bell: a small red plus, outlined so it shows on any colour. */
function NewMark({ className = "" }) {
	return /* @__PURE__ */ jsxs("svg", {
		viewBox: "0 0 12 12",
		"aria-hidden": "true",
		className: `theme-new-mark pointer-events-none absolute h-3 w-3 ${className}`,
		children: [/* @__PURE__ */ jsx("path", {
			d: "M6 1.5v9M1.5 6h9",
			stroke: "#ffffff",
			strokeWidth: "4.5",
			strokeLinecap: "round"
		}), /* @__PURE__ */ jsx("path", {
			d: "M6 1.5v9M1.5 6h9",
			stroke: "#dc2626",
			strokeWidth: "2.4",
			strokeLinecap: "round"
		})]
	});
}
var BURST_TIME = 1100;
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
/** `spread` scales how far the pieces fly, for something wider than the colour button. */
function Burst({ tokens, spread = 1 }) {
	return /* @__PURE__ */ jsx("span", {
		"aria-hidden": "true",
		className: "theme-burst pointer-events-none absolute inset-0",
		children: BURST_PIECES.map((p, i) => /* @__PURE__ */ jsx("span", {
			className: `theme-burst-piece ${p.shape === "squiggle" ? "" : `theme-piece-${p.shape}`}`,
			style: {
				"--x": `${Math.round(p.x * spread)}px`,
				"--y": `${Math.round(p.y * spread)}px`,
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
/**
* A burst to show on demand: `celebrate()` starts one (restarting it if one is running), and
* `burst` is the key to render `<Burst key={burst} />` with while `bursting`.
*/
function useBurst() {
	const [burst, setBurst] = useState(0);
	const [bursting, setBursting] = useState(false);
	useEffect(() => {
		if (!burst) return;
		setBursting(true);
		const id = setTimeout(() => setBursting(false), BURST_TIME);
		return () => clearTimeout(id);
	}, [burst]);
	return {
		burst,
		bursting,
		celebrate: () => setBurst((n) => n + 1)
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
* @param {'subtle' | 'balanced' | 'colourful'} [style]  the colour style to keep with them
*/
function keepSnippet(kind, name, tokens, prod = VITE_PROD, style = null) {
	const styleLine = style ? `\n  // How boldly the colours paint the site: 'subtle', 'balanced' or 'colourful'.\n  colourStyle: '${style}',` : "";
	const theme = `defaultTheme: {\n    name: ${JSON.stringify(name)},\n    tokens: {\n${tokenLines(tokens, "      ")}\n    },\n  },${styleLine}\n  // Hides the colour button in production; set to false to bring it back.\n  hidden: ${prod},`;
	if (kind === "auto") return `// Replace \`import 'colorsbymax/auto'\` with:\nimport { autoMount } from 'colorsbymax/auto'\n\nautoMount({\n  ${theme}\n})`;
	return `// Add to the config you pass to <ThemeProvider>:\n<ThemeProvider config={{\n  ...config,\n  ${theme}\n}}>`;
}
/** The theme as `--color-*` variables on :root. */
var cssSnippet = (tokens) => `:root {\n${TOKEN_KEYS.map((k) => `  --color-${k}: ${tokens[k]};`).join("\n")}\n}`;
var keepPrompt = (name, tokens, style = null) => `Update my colorsbymax setup so the colours I chose become my site's default and the colour switcher is hidden in production. In the colorsbymax config (the autoMount({...}) call, or the config passed to <ThemeProvider>), set defaultTheme to { name: ${JSON.stringify(name)}, tokens: ${JSON.stringify(tokens)} }${style ? `, set colourStyle: '${style}'` : ""} and set hidden: ${VITE_PROD} (use ${NODE_PROD} if this isn't a Vite project). If the site uses import 'colorsbymax/auto', replace it with import { autoMount } from 'colorsbymax/auto' and an autoMount({...}) call with that config. Don't change anything else.`;
/** @param {boolean} recolouring  true when colorsbymax was swapping the site's hard-coded colours */
var removePrompt = (tokens, recolouring) => recolouring ? `Remove colorsbymax from this project but keep the colours it currently shows. The site's CSS uses hard-coded colours that colorsbymax was swapping at runtime, so update the site's own CSS to use this palette instead (primary is the main brand colour, background the page, ink the text): ${JSON.stringify(tokens)}. Then uninstall the colorsbymax package and delete its import (import 'colorsbymax/auto', autoMount, ThemeProvider or ThemeSwitcher) and any colorsbymax pre-paint script in index.html.` : `Remove colorsbymax from this project but keep my colours: add these CSS variables to my global stylesheet, replacing any existing --color-* values: ${cssSnippet(tokens)} Then uninstall the colorsbymax package and delete its usage (ThemeProvider, ThemeSwitcher, autoMount or import 'colorsbymax/auto') and any colorsbymax pre-paint script in index.html. Keep colorsbymax/tokens.css only if nothing else needs it.`;
/** The switch's markup: a sun in light mode, a moon in dark. */
var TOGGLE_HTML = `<button type="button" class="cbm-mode-toggle" data-colorsbymax-mode="toggle" aria-label="Switch between light and dark mode">
  <svg class="cbm-mode-sun" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>
  <svg class="cbm-mode-moon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>
</button>`;
/** Its styles. It takes the colour of the text around it, so it suits any top bar. */
var TOGGLE_CSS = `.cbm-mode-toggle {
  display: inline-grid;
  place-items: center;
  width: 2.25rem;
  height: 2.25rem;
  border: 1px solid currentColor;
  border-radius: 9999px;
  background: transparent;
  color: inherit;
  opacity: 0.85;
  cursor: pointer;
}
.cbm-mode-toggle:hover { opacity: 1; }
.cbm-mode-toggle .cbm-mode-moon,
html[data-colorsbymax-scheme="dark"] .cbm-mode-toggle .cbm-mode-sun { display: none; }
html[data-colorsbymax-scheme="dark"] .cbm-mode-toggle .cbm-mode-moon { display: block; }`;
/** The same switch as a React component. */
var TOGGLE_REACT = `// ModeToggle.jsx: put <ModeToggle /> in your top bar. colorsbymax makes it work.
export function ModeToggle() {
  return (
    <button type="button" className="cbm-mode-toggle" data-colorsbymax-mode="toggle" aria-label="Switch between light and dark mode">
      <svg className="cbm-mode-sun" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
      </svg>
      <svg className="cbm-mode-moon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
      </svg>
    </button>
  )
}`;
/** A prompt for Claude, Cursor or Copilot that adds the switch to the site's top bar. */
var TOGGLE_PROMPT = `Add a light and dark mode switch to my site's top navigation bar, next to its other links or buttons. The site uses colorsbymax, which makes the switch work: any element with data-colorsbymax-mode="toggle" switches the whole site between light and dark and remembers the visitor's choice. Use this button (as a React component if the nav is React):

${TOGGLE_HTML}

and add these styles to the global stylesheet, adjusting size and spacing to match the nav:

${TOGGLE_CSS}

Don't change anything else.`;
var PREVIEW = "data-colorsbymax-preview";
/** Where a switch would go: the page's top bar, or null if it has none. */
function topBar() {
	for (const selector of [
		"header nav",
		"nav",
		"[role=\"navigation\"]",
		"header",
		"[role=\"banner\"]"
	]) for (const el of document.querySelectorAll(selector)) {
		if (el.closest("colorsbymax-root")) continue;
		const r = el.getBoundingClientRect();
		if (r.width > 200 && r.height > 12 && r.top < window.innerHeight / 2) return el;
	}
	return null;
}
/** Whether a preview switch is on the page. */
var isPreviewing = () => Boolean(document.querySelector(`[${PREVIEW}]`));
/**
* Puts a switch in the page's top bar (or the top-left corner if it has none) until the next
* reload. Returns where it went: 'nav' or 'corner'.
*/
function previewToggle() {
	removePreview();
	const style = document.createElement("style");
	style.setAttribute(PREVIEW, "");
	style.textContent = TOGGLE_CSS;
	document.head.append(style);
	const holder = document.createElement("span");
	holder.innerHTML = TOGGLE_HTML;
	const button = holder.firstElementChild;
	button.setAttribute(PREVIEW, "");
	button.setAttribute("aria-pressed", String(document.documentElement.dataset.colorsbymaxScheme === "dark"));
	const bar = topBar();
	if (bar) {
		button.style.marginInline = "0.5rem";
		bar.append(button);
	} else {
		Object.assign(button.style, {
			position: "fixed",
			top: "16px",
			left: "16px",
			zIndex: "59",
			background: "Canvas"
		});
		document.body.append(button);
	}
	button.animate?.([
		{
			transform: "scale(0.4)",
			opacity: 0
		},
		{ transform: "scale(1.15)" },
		{
			transform: "scale(1)",
			opacity: 1
		}
	], {
		duration: 450,
		easing: "ease-out"
	});
	return bar ? "nav" : "corner";
}
function removePreview() {
	for (const el of document.querySelectorAll(`[${PREVIEW}]`)) el.remove();
}
//#endregion
//#region src/logoMark.jsx
var BARS = [
	"M57.13,163.05H0C28.34,108.7,56.67,54.35,85.01,0h55.44c-27.77,54.35-55.55,108.7-83.32,163.05Z",
	"M134.89,163.05h-57.13C106.1,108.7,134.43,54.35,162.77,0h55.44c-27.77,54.35-55.55,108.7-83.32,163.05Z",
	"M212.65,163.05h-57.13C183.86,108.7,212.19,54.35,240.53,0h55.44c-27.77,54.35-55.55,108.7-83.32,163.05Z"
];
var MIN_CONTRAST = 3;
var hue = (hex) => rgbToHsl(hexToRgb(hex))[0];
var hueGap = (a, b) => {
	const d = Math.abs(hue(a) - hue(b));
	return Math.min(d, 360 - d);
};
/** The three bars' colours for a theme. */
function logoColours(tokens) {
	const [a, b] = [tokens["primary-alt"], tokens.primary];
	const apart = (x) => Math.min(hueGap(x, a), hueGap(x, b));
	let c = tokens["data-3"];
	for (let n = 1; n <= 8; n++) if (apart(tokens[`data-${n}`]) > apart(c)) c = tokens[`data-${n}`];
	return [
		a,
		b,
		c
	];
}
/** Moves a colour towards black (on light) or white (on dark) until it reads on `background`. */
function standOut(hex, background) {
	const target = contrastRatio(background, "#000000") > contrastRatio(background, "#ffffff") ? "#000000" : "#ffffff";
	for (let t = 0; t <= 1; t += .05) {
		const out = mix(target, hex, t);
		if (contrastRatio(out, background) >= MIN_CONTRAST) return out;
	}
	return target;
}
/** @param {{ tokens: Record<string, string>, background: string, className?: string }} props */
function LogoMark({ tokens, background, className = "" }) {
	const colours = logoColours(tokens).map((c) => standOut(c, background));
	return /* @__PURE__ */ jsx("svg", {
		viewBox: "0 0 296 163.05",
		className,
		"aria-hidden": "true",
		children: BARS.map((d, i) => /* @__PURE__ */ jsx("path", {
			d,
			fill: colours[i]
		}, i))
	});
}
//#endregion
//#region src/colourWords.js
var inHue = (h, from, to) => from <= to ? h >= from && h <= to : h >= from || h <= to;
/** [word, other words for it, test on [hue 0-360, saturation 0-1, lightness 0-1]] */
var COLOURS = [
	[
		"red",
		["crimson", "scarlet"],
		([h, s, l]) => inHue(h, 345, 12) && s >= .35 && l >= .2 && l <= .7
	],
	[
		"orange",
		["tangerine"],
		([h, s, l]) => inHue(h, 13, 38) && s >= .45 && l >= .35
	],
	[
		"coral",
		["salmon", "peach"],
		([h, s, l]) => inHue(h, 0, 25) && s >= .45 && l >= .55
	],
	[
		"yellow",
		["lemon"],
		([h, s, l]) => inHue(h, 45, 64) && s >= .45 && l >= .45
	],
	[
		"gold",
		["mustard", "amber"],
		([h, s, l]) => inHue(h, 36, 52) && s >= .4 && l >= .3 && l <= .65
	],
	[
		"lime",
		["chartreuse"],
		([h, s, l]) => inHue(h, 65, 95) && s >= .45 && l >= .35
	],
	[
		"green",
		[
			"emerald",
			"olive",
			"forest",
			"sage",
			"mint"
		],
		([h, s]) => inHue(h, 75, 160) && s >= .2
	],
	[
		"teal",
		["turquoise"],
		([h, s]) => inHue(h, 160, 195) && s >= .25
	],
	[
		"cyan",
		["aqua"],
		([h, s, l]) => inHue(h, 180, 200) && s >= .45 && l >= .4
	],
	[
		"blue",
		[
			"sky",
			"cobalt",
			"azure"
		],
		([h, s]) => inHue(h, 196, 250) && s >= .25
	],
	[
		"navy",
		["indigo"],
		([h, s, l]) => inHue(h, 205, 255) && s >= .2 && l <= .35
	],
	[
		"purple",
		[
			"violet",
			"plum",
			"lavender",
			"lilac"
		],
		([h, s]) => inHue(h, 251, 295) && s >= .2
	],
	[
		"pink",
		[
			"rose",
			"blush",
			"fuchsia",
			"magenta",
			"berry"
		],
		([h, s, l]) => inHue(h, 296, 344) && s >= .3 && l >= .3
	],
	[
		"brown",
		[
			"chocolate",
			"coffee",
			"camel",
			"rust",
			"terracotta"
		],
		([h, s, l]) => inHue(h, 10, 45) && s >= .2 && l <= .45
	],
	[
		"beige",
		[
			"cream",
			"sand",
			"tan",
			"ivory"
		],
		([h, s, l]) => inHue(h, 25, 60) && s >= .1 && l >= .6
	],
	[
		"grey",
		[
			"gray",
			"slate",
			"silver",
			"charcoal",
			"monochrome"
		],
		([, s]) => s < .14
	],
	[
		"black",
		["dark"],
		([, , l]) => l <= .18
	],
	[
		"white",
		["light"],
		([, , l]) => l >= .9
	]
];
var WORDS = [...COLOURS.map(([word]) => word), ...COLOURS.flatMap(([, aliases]) => aliases)];
var hslOf = (hex) => rgbToHsl(hexToRgb(hex));
/**
* The colour test for a search, or null if it isn't a colour word. "reds" and "Red" count too.
* @returns {((tokens: Record<string, string>) => boolean) | null}
*/
function colourMatcher(query) {
	const q = query.trim().toLowerCase().replace(/s$/, "");
	const found = COLOURS.find(([word, aliases]) => word === q || aliases.includes(q));
	if (!found) return null;
	const [, , test] = found;
	const keys = ["black", "white"].includes(found[0]) ? [
		"primary",
		"primary-dark",
		"background"
	] : ["primary", "primary-alt"];
	return (tokens) => keys.some((k) => tokens[k] && test(hslOf(tokens[k])));
}
/** Words that finish what's being typed (at most `max`), colours first, then `extra` (e.g. moods). */
function suggestWords(query, extra = [], max = 6) {
	const q = query.trim().toLowerCase();
	if (!q) return [];
	const starts = [...WORDS, ...extra.map((w) => w.toLowerCase())].filter((w) => w.startsWith(q) && w !== q);
	return [...new Set(starts)].slice(0, max);
}
//#endregion
//#region src/ThemePanel.jsx
var PANEL_DARK = "#18181b";
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
	reveal: null,
	confirmTheme: (run) => run()
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
/**
* The panel's contents. It stays mounted while the panel is closed (see ThemeSwitcher), so closing
* it is like minimising: the chosen group or mood, a search, open sections and the view all stay.
* `open` brings the scroll position back, since a hidden panel can't keep its own.
*/
function ThemePanel({ open = true }) {
	const theme = useTheme();
	const { settings, mode, audit, update } = useSettings();
	const overrideCount = Object.keys(theme.state.overrides).length;
	const { updates } = useSettings();
	const [view, setView] = useState("main");
	const [toggleFrom, setToggleFrom] = useState("main");
	const openToggle = (from) => {
		setToggleFrom(from);
		setView("mode-toggle");
	};
	const returnFocus = useRef(null);
	const rootRef = useRef(null);
	const [toasts, setToasts] = useState([]);
	const [reveal, setReveal] = useState(null);
	const scrollTop = useRef(0);
	useLayoutEffect(() => {
		const el = rootRef.current;
		if (open && el) el.scrollTop = scrollTop.current;
	}, [open]);
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
	const [themeAsk, setThemeAsk] = useState(null);
	const askedRef = useRef(false);
	const paintCount = theme.paints.length;
	const confirmTheme = useCallback((run) => {
		if (!paintCount || askedRef.current) return run();
		setView("main");
		setThemeAsk({ run });
	}, [paintCount]);
	const panelApi = useMemo(() => ({
		toast,
		showGroup,
		reveal,
		confirmTheme
	}), [
		toast,
		showGroup,
		reveal,
		confirmTheme
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
	const resetToDefault = () => confirmTheme(() => {
		theme.resetToDefault();
		const target = inMode(theme.defaultTheme, mode);
		if (mode === "dark") theme.selectTheme(target.id, target);
		toast(`Back to ${target.name}, with no overrides.`);
	});
	return /* @__PURE__ */ jsxs(PanelContext.Provider, {
		value: panelApi,
		children: [
			/* @__PURE__ */ jsxs("div", {
				ref: rootRef,
				onScroll: (e) => {
					if (open) scrollTop.current = e.currentTarget.scrollTop;
				},
				className: "theme-scroll @container flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain rounded-[inherit]",
				children: [
					/* @__PURE__ */ jsxs("header", {
						className: "sticky top-0 z-10 flex flex-wrap items-center justify-between gap-x-3 gap-y-3.5 border-b border-zinc-200 bg-white px-4 py-3",
						children: [/* @__PURE__ */ jsxs("div", {
							className: "flex w-full shrink-0 items-center justify-center gap-2 @min-[520px]:w-auto @min-[520px]:justify-start",
							children: [/* @__PURE__ */ jsx(LogoMark, {
								tokens: theme.tokens,
								background: mode === "dark" ? PANEL_DARK : "#ffffff",
								className: "h-7 w-auto shrink-0"
							}), /* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("h2", {
								id: "theme-panel-title",
								className: "text-base font-semibold tracking-tight",
								children: "colorsbymax"
							}), /* @__PURE__ */ jsx("p", {
								className: "text-[11px] text-zinc-500",
								children: "by mrmaxdesigns"
							})] })]
						}), /* @__PURE__ */ jsxs("div", {
							className: "flex w-full items-center justify-center gap-1 @min-[520px]:ml-auto @min-[520px]:w-auto",
							children: [
								/* @__PURE__ */ jsx("div", {
									role: "radiogroup",
									"aria-label": "Theme mode",
									className: "flex items-center rounded-lg border border-zinc-200 p-0.5",
									children: MODES.map(({ id, label, Icon }) => {
										const on = settings.mode === id;
										return /* @__PURE__ */ jsx("button", {
											type: "button",
											role: "radio",
											"aria-checked": on,
											"aria-label": label,
											"data-tip": id === "system" ? "Auto: follow this device" : label,
											onClick: () => update({ mode: id }),
											className: `grid h-7 w-7 place-items-center rounded-md cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 ${on ? "bg-zinc-900 text-white" : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"}`,
											children: /* @__PURE__ */ jsx(Icon, {
												className: "w-3.5 h-3.5",
												"aria-hidden": "true"
											})
										}, id);
									})
								}),
								theme.features.studio && /* @__PURE__ */ jsxs("button", {
									type: "button",
									onClick: (e) => view === "studio" ? setView("main") : showView("studio", e.currentTarget),
									className: `${btn} shrink-0 whitespace-nowrap px-2 ${view === "studio" ? "border-zinc-900 bg-zinc-100" : "border-transparent"}`,
									"aria-pressed": view === "studio",
									"aria-label": "Studio",
									"data-tip": "Studio: go deeper and choose exactly where your colours go",
									children: [/* @__PURE__ */ jsx(StudioMark, { className: "w-4 h-4" }), "Studio"]
								}),
								updates.enabled && /* @__PURE__ */ jsxs("button", {
									type: "button",
									onClick: (e) => view === "updates" ? setView("main") : showView("updates", e.currentTarget),
									className: `${btn} relative px-1.5 ${view === "updates" ? "border-zinc-900 bg-zinc-100" : "border-transparent"}`,
									"aria-label": updates.unseen ? "What’s new (something new)" : "What’s new",
									"aria-pressed": view === "updates",
									"data-tip": updates.update ? `colorsbymax ${updates.latest} is out` : "What’s new",
									children: [/* @__PURE__ */ jsx(Bell, {
										className: "w-4 h-4",
										"aria-hidden": "true"
									}), updates.unseen && /* @__PURE__ */ jsx(NewMark, { className: "top-0 right-0" })]
								}),
								theme.features.audit && !theme.features.studio && /* @__PURE__ */ jsxs("button", {
									type: "button",
									onClick: audit.toggle,
									className: `${btn} px-2 ${audit.on ? "border-zinc-900 bg-zinc-100" : "border-transparent"}`,
									"aria-pressed": audit.on,
									"data-tip": "Audit the page: point out what won’t look right with these colours",
									children: [/* @__PURE__ */ jsx(ScanSearch, {
										className: "w-4 h-4",
										"aria-hidden": "true"
									}), "Audit"]
								}),
								/* @__PURE__ */ jsx("button", {
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
								})
							]
						})]
					}),
					view === "contrast" && /* @__PURE__ */ jsx(ContrastView, { onBack: () => setView("main") }),
					view === "settings" && /* @__PURE__ */ jsx(SettingsView, {
						onBack: () => setView("main"),
						onAddToSite: () => openToggle("settings")
					}),
					view === "finish" && /* @__PURE__ */ jsx(FinishView, {
						onBack: () => setView("main"),
						onAddToSite: () => openToggle("finish")
					}),
					view === "mode-toggle" && /* @__PURE__ */ jsx(ModeToggleView, { onBack: () => setView(toggleFrom) }),
					view === "studio" && /* @__PURE__ */ jsx(StudioView, { onBack: () => setView("main") }),
					view === "updates" && /* @__PURE__ */ jsx(UpdatesView, {
						updates,
						onBack: () => setView("main")
					}),
					/* @__PURE__ */ jsxs("div", {
						hidden: view !== "main",
						children: [
							!theme.inScope && /* @__PURE__ */ jsxs("div", {
								className: "mx-4 mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900",
								children: [/* @__PURE__ */ jsxs("p", { children: [
									/* @__PURE__ */ jsx("strong", {
										className: "font-semibold",
										children: "This page keeps its own colours."
									}),
									" The theme only goes on",
									" ",
									theme.scope.pages.length === 1 ? "one page" : `${theme.scope.pages.length} pages`,
									" of your site."
								] }), /* @__PURE__ */ jsxs("div", {
									className: "mt-2 flex flex-wrap gap-2",
									children: [/* @__PURE__ */ jsx("button", {
										type: "button",
										className: btnPrimary,
										onClick: () => theme.setScope({
											mode: "pages",
											pages: [...theme.scope.pages, theme.pathname]
										}),
										children: "Colour this page too"
									}), theme.features.studio && /* @__PURE__ */ jsxs("button", {
										type: "button",
										className: btn,
										onClick: (e) => showView("studio", e.currentTarget),
										children: [/* @__PURE__ */ jsx(StudioMark, { className: "w-3.5 h-3.5" }), " Open Studio"]
									})]
								})]
							}),
							/* @__PURE__ */ jsxs(ContrastNav.Provider, {
								value: (from) => showView("contrast", from),
								children: [
									(theme.features.colourStyle || theme.features.scan) && /* @__PURE__ */ jsx(Section, {
										title: theme.features.colourStyle ? "Colour style" : "Scan site",
										badge: theme.features.colourStyle ? COLOUR_STYLES.find((c) => c.id === settings.colourStyle)?.label : null,
										children: /* @__PURE__ */ jsx(StyleAndScan, {})
									}),
									/* @__PURE__ */ jsx(Section, {
										title: "Preset themes",
										badge: theme.active.name,
										wideBadge: true,
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
							}),
							/* @__PURE__ */ jsx("footer", {
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
							})
						]
					})
				]
			}),
			/* @__PURE__ */ jsx(Toasts, {
				items: toasts,
				onDismiss: dismiss
			}),
			themeAsk && /* @__PURE__ */ jsx(StudioChangesAsk, {
				count: paintCount,
				onKeep: (always) => {
					askedRef.current = always;
					themeAsk.run();
					setThemeAsk(null);
					toast(`Kept your ${paintCount} Studio ${paintCount === 1 ? "change" : "changes"}. Theme colours in them follow the new theme.`);
				},
				onClear: (always) => {
					askedRef.current = always;
					theme.clearPaints();
					themeAsk.run();
					setThemeAsk(null);
					toast("Cleared your Studio changes. The new theme shows as it is.");
				},
				onCancel: () => setThemeAsk(null)
			})
		]
	});
}
/**
* Asked before another theme replaces the one Studio changes were made on: keep them (their theme
* colours follow the new theme; colours picked by hand stay as they are) or clear them.
*/
function StudioChangesAsk({ count, onKeep, onClear, onCancel }) {
	const [always, setAlways] = useState(false);
	const headingId = useId();
	const ref = useRef(null);
	useEffect(() => ref.current?.querySelector("button")?.focus(), []);
	return /* @__PURE__ */ jsx("div", {
		className: "absolute inset-0 z-30 grid place-items-center rounded-[inherit] bg-zinc-900/40 p-4",
		onKeyDown: (e) => e.key === "Escape" && (e.stopPropagation(), onCancel()),
		children: /* @__PURE__ */ jsxs("div", {
			ref,
			role: "alertdialog",
			"aria-modal": "true",
			"aria-labelledby": headingId,
			className: "w-full max-w-[320px] space-y-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-2xl",
			children: [
				/* @__PURE__ */ jsxs("div", {
					className: "flex items-center gap-2",
					children: [/* @__PURE__ */ jsx(StudioMark, { className: "h-6 w-6" }), /* @__PURE__ */ jsxs("h3", {
						id: headingId,
						className: "text-sm font-semibold text-zinc-900",
						children: [
							"You have ",
							count,
							" Studio ",
							count === 1 ? "change" : "changes"
						]
					})]
				}),
				/* @__PURE__ */ jsx("p", {
					className: "text-xs leading-snug text-zinc-600",
					children: "Keep them on the new theme, or clear them and see the theme as it is? Kept changes that use theme colours take the new theme’s colours; ones you picked by hand stay exactly as they are."
				}),
				/* @__PURE__ */ jsxs("div", {
					className: "grid gap-2",
					children: [
						/* @__PURE__ */ jsx("button", {
							type: "button",
							className: `${btnPrimary} py-2`,
							onClick: () => onKeep(always),
							children: "Keep my changes"
						}),
						/* @__PURE__ */ jsx("button", {
							type: "button",
							className: `${btn} py-2`,
							onClick: () => onClear(always),
							children: "Clear them and use the theme"
						}),
						/* @__PURE__ */ jsx("button", {
							type: "button",
							className: `${btn} border-transparent py-1.5`,
							onClick: onCancel,
							children: "Cancel"
						})
					]
				}),
				/* @__PURE__ */ jsxs("label", {
					className: "flex items-center gap-2 text-[11px] text-zinc-700",
					children: [/* @__PURE__ */ jsx("input", {
						type: "checkbox",
						checked: always,
						onChange: (e) => setAlways(e.target.checked),
						className: "h-3.5 w-3.5 accent-zinc-900"
					}), "Don’t ask again until I reload the page"]
				})
			]
		})
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
/**
* "Add to site": a light and dark switch for the site itself. Every theme has a dark version, so any
* site can switch; this shows the switch, previews it in the page's top bar, and gives the code and
* an AI-editor prompt to add it for good.
*/
function ModeToggleView({ onBack }) {
	const { settings, update } = useSettings();
	const { toast } = usePanel();
	const headingRef = useRef(null);
	const [previewing, setPreviewing] = useState(isPreviewing);
	const [tab, setTab] = useState("html");
	useEffect(() => headingRef.current?.focus(), []);
	const preview = () => {
		const where = previewToggle();
		setPreviewing(true);
		toast(where === "nav" ? "The switch is in your top bar. Try it; it’s gone when you reload." : "No top bar found, so the switch is in the top-left corner. It’s gone when you reload.");
	};
	const stop = () => {
		removePreview();
		setPreviewing(false);
	};
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
				children: "Add a light and dark switch to your site"
			}),
			/* @__PURE__ */ jsx("p", {
				className: "text-xs text-zinc-600",
				children: "Every theme has a dark version, so your whole site can switch, even if it never had a dark mode. Put a switch in your top bar and visitors can choose; colorsbymax does the rest and remembers their choice. It keeps working when the colour button is hidden."
			}),
			/* @__PURE__ */ jsxs("div", {
				className: "flex items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-3",
				children: [/* @__PURE__ */ jsxs("div", {
					className: "text-xs text-zinc-700",
					children: [/* @__PURE__ */ jsx("p", {
						className: "font-semibold text-zinc-900",
						children: "Try it here first"
					}), /* @__PURE__ */ jsx("p", { children: previewing ? "The switch is on this page. It’s gone when you reload." : "Puts a working switch in this page’s top bar." })]
				}), previewing ? /* @__PURE__ */ jsx("button", {
					type: "button",
					className: btn,
					onClick: stop,
					children: "Remove"
				}) : /* @__PURE__ */ jsxs("button", {
					type: "button",
					className: btnPrimary,
					onClick: preview,
					children: [/* @__PURE__ */ jsx(ToggleRight, {
						className: "w-3.5 h-3.5",
						"aria-hidden": "true"
					}), " Preview it"]
				})]
			}),
			/* @__PURE__ */ jsx("div", {
				role: "radiogroup",
				"aria-label": "Mode",
				className: "grid grid-cols-3 gap-2",
				children: MODES.map(({ id, label, Icon }) => /* @__PURE__ */ jsxs("button", {
					type: "button",
					role: "radio",
					"aria-checked": settings.mode === id,
					onClick: () => update({ mode: id }),
					className: `flex h-8 items-center justify-center gap-1.5 rounded-lg border text-xs font-medium cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 ${settings.mode === id ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-50"}`,
					children: [
						/* @__PURE__ */ jsx(Icon, {
							className: "w-3.5 h-3.5",
							"aria-hidden": "true"
						}),
						" ",
						label
					]
				}, id))
			}),
			/* @__PURE__ */ jsxs("div", {
				className: "space-y-2",
				children: [
					/* @__PURE__ */ jsx("p", {
						className: "text-xs font-semibold text-zinc-900",
						children: "Add it for good"
					}),
					/* @__PURE__ */ jsx("div", {
						role: "tablist",
						"aria-label": "Code for",
						className: "flex gap-1",
						children: [["html", "HTML"], ["react", "React"]].map(([id, label]) => /* @__PURE__ */ jsx("button", {
							type: "button",
							role: "tab",
							"aria-selected": tab === id,
							onClick: () => setTab(id),
							className: `rounded-md px-2 py-1 text-[11px] font-semibold cursor-pointer ${tab === id ? "bg-zinc-900 text-white" : "text-zinc-600 hover:bg-zinc-100"}`,
							children: label
						}, id))
					}),
					/* @__PURE__ */ jsx(CopyBlock, {
						label: tab === "html" ? "In your top bar" : "ModeToggle.jsx",
						text: tab === "html" ? TOGGLE_HTML : TOGGLE_REACT
					}),
					/* @__PURE__ */ jsx(CopyBlock, {
						label: "In your global stylesheet",
						text: TOGGLE_CSS
					}),
					/* @__PURE__ */ jsx(CopyBlock, {
						label: "Or ask Claude, Cursor or Copilot",
						text: TOGGLE_PROMPT,
						copyLabel: "Copy prompt"
					})
				]
			}),
			/* @__PURE__ */ jsxs("p", {
				className: "rounded-lg bg-zinc-100 p-2.5 text-[11px] text-zinc-700",
				children: [/* @__PURE__ */ jsx("strong", {
					className: "font-semibold text-zinc-900",
					children: "Already have a dark mode?"
				}), " You don’t need this. The theme you pick colours your site well in light and dark, with contrast checked in both."]
			})
		]
	});
}
/** Studio's mark: the parts of a page (header, hero, cards), each in its own colour, cycling. */
function StudioMark({ className = "" }) {
	return /* @__PURE__ */ jsxs("svg", {
		viewBox: "0 0 24 24",
		className: `theme-studio-mark shrink-0 ${className}`,
		"aria-hidden": "true",
		children: [
			/* @__PURE__ */ jsx("rect", {
				x: "2",
				y: "2",
				width: "12.5",
				height: "8.5",
				rx: "2.5",
				fill: "#f43f5e"
			}),
			/* @__PURE__ */ jsx("rect", {
				x: "16.5",
				y: "2",
				width: "5.5",
				height: "8.5",
				rx: "2.5",
				fill: "#f59e0b"
			}),
			/* @__PURE__ */ jsx("rect", {
				x: "2",
				y: "12.5",
				width: "5.5",
				height: "9.5",
				rx: "2.5",
				fill: "#10b981"
			}),
			/* @__PURE__ */ jsx("rect", {
				x: "9.5",
				y: "12.5",
				width: "12.5",
				height: "9.5",
				rx: "2.5",
				fill: "#6366f1"
			})
		]
	});
}
var WHERE = [{
	id: "all",
	label: "Whole site",
	note: "Every page takes the theme."
}, {
	id: "pages",
	label: "Only some pages",
	note: "The rest keep their own colours."
}];
/**
* Studio: going deeper than a theme. Point and click any part of the page to give it its own
* colours, and choose where the theme goes: the whole site or only some of its pages, read from
* the site itself (the pages this one links to, and the ones the visitor has opened). Choices live
* on this device; the prompt, CSS and config make them everyone's.
*/
function StudioView({ onBack }) {
	const { scope, setScope, inScope: here, pathname, configPages, scopeChosen, seenPages, features } = useTheme();
	const { studio, audit } = useSettings();
	const { toast } = usePanel();
	const headingRef = useRef(null);
	const inputId = useId();
	const [draft, setDraft] = useState("");
	const [error, setError] = useState(null);
	const [linked, setLinked] = useState(() => linkedPages());
	useEffect(() => setLinked(linkedPages()), [pathname]);
	useEffect(() => headingRef.current?.focus(), []);
	const pages = scope.pages;
	const onlySome = scope.mode === "pages";
	const setPages = (list) => setScope({
		mode: "pages",
		pages: list
	});
	const choose = (mode) => setScope({
		mode,
		pages: mode === "pages" && !pages.length ? [pathname] : pages
	});
	const add = (page) => {
		if (pages.includes(page)) return;
		setPages([...pages, page]);
		toast(`${page} now gets the colours.`);
	};
	const remove = (page) => setPages(pages.filter((p) => p !== page));
	const covering = pages.find((p) => p !== pathname && pageMatches(p, pathname));
	const suggestions = [.../* @__PURE__ */ new Set([
		pathname,
		...seenPages,
		...linked
	])].filter((p) => !pages.includes(p)).slice(0, 14);
	const addDraft = (e) => {
		e.preventDefault();
		const page = normalPath(draft);
		if (!page) return setError("That doesn’t look like a page on this site. Try /pricing, or /blog/* for a whole section.");
		setError(null);
		setDraft("");
		add(page);
	};
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
				}), " Back to the switcher"]
			}),
			/* @__PURE__ */ jsxs("div", {
				className: "flex items-center gap-3",
				children: [/* @__PURE__ */ jsx(StudioMark, { className: "h-9 w-9" }), /* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("h3", {
					ref: headingRef,
					tabIndex: -1,
					className: "text-base font-semibold tracking-tight focus:outline-none",
					children: "Studio"
				}), /* @__PURE__ */ jsx("p", {
					className: "text-xs text-zinc-600",
					children: "Go deeper than a theme: colour any part of your site, and choose exactly where your colours go."
				})] })]
			}),
			/* @__PURE__ */ jsxs("section", {
				className: "space-y-2.5 rounded-xl border border-zinc-200 p-3",
				children: [/* @__PURE__ */ jsxs("div", {
					className: "flex items-start gap-2.5",
					children: [/* @__PURE__ */ jsx("span", {
						className: "grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-zinc-100 text-zinc-800",
						children: /* @__PURE__ */ jsx(MousePointerClick, {
							className: "w-4 h-4",
							"aria-hidden": "true"
						})
					}), /* @__PURE__ */ jsxs("div", {
						className: "min-w-0",
						children: [/* @__PURE__ */ jsx("h4", {
							className: "text-xs font-semibold text-zinc-900",
							children: "Colour any part of the page"
						}), /* @__PURE__ */ jsx("p", {
							className: "text-[11px] leading-snug text-zinc-600",
							children: "Point and click a button, a card, a heading, the footer, anything, and give it its own background, text and border. Every part like it can change at once."
						})]
					})]
				}), /* @__PURE__ */ jsxs("button", {
					type: "button",
					className: `${btnPrimary} w-full py-2`,
					onClick: studio.start,
					children: [/* @__PURE__ */ jsx(MousePointerClick, {
						className: "w-3.5 h-3.5",
						"aria-hidden": "true"
					}), " Point and click"]
				})]
			}),
			features.audit && /* @__PURE__ */ jsxs("section", {
				className: "space-y-2.5 rounded-xl border border-zinc-200 p-3",
				children: [/* @__PURE__ */ jsxs("div", {
					className: "flex items-start gap-2.5",
					children: [/* @__PURE__ */ jsx("span", {
						className: "grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-zinc-100 text-zinc-800",
						children: /* @__PURE__ */ jsx(ScanSearch, {
							className: "w-4 h-4",
							"aria-hidden": "true"
						})
					}), /* @__PURE__ */ jsxs("div", {
						className: "min-w-0",
						children: [/* @__PURE__ */ jsx("h4", {
							className: "text-xs font-semibold text-zinc-900",
							children: "Check the page"
						}), /* @__PURE__ */ jsx("p", {
							className: "text-[11px] leading-snug text-zinc-600",
							children: "Audit points out what won’t look right in these colours: a logo that disappears, a picture whose background shows as a box, text too faint to read. The notes stay on the page until you close them."
						})]
					})]
				}), /* @__PURE__ */ jsxs("button", {
					type: "button",
					className: `${btn} w-full py-2 ${audit.on ? "border-zinc-900 bg-zinc-100" : ""}`,
					onClick: audit.toggle,
					"aria-pressed": audit.on,
					children: [
						/* @__PURE__ */ jsx(ScanSearch, {
							className: "w-3.5 h-3.5",
							"aria-hidden": "true"
						}),
						" ",
						audit.on ? "Stop the audit" : "Audit this page"
					]
				})]
			}),
			/* @__PURE__ */ jsx(StudioChanges, {}),
			/* @__PURE__ */ jsxs("section", {
				"aria-labelledby": `${inputId}-where`,
				className: "space-y-3 rounded-xl border border-zinc-200 p-3",
				children: [
					/* @__PURE__ */ jsx("h4", {
						id: `${inputId}-where`,
						className: "text-xs font-semibold text-zinc-900",
						children: "Where the colours go"
					}),
					/* @__PURE__ */ jsx("div", {
						role: "radiogroup",
						"aria-labelledby": `${inputId}-where`,
						className: "grid grid-cols-2 gap-2",
						children: WHERE.map((w) => {
							const on = scope.mode === w.id;
							return /* @__PURE__ */ jsxs("button", {
								type: "button",
								role: "radio",
								"aria-checked": on,
								onClick: () => choose(w.id),
								className: `rounded-lg border p-2 text-left cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 ${on ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-50"}`,
								children: [/* @__PURE__ */ jsx("span", {
									className: "block text-xs font-semibold",
									children: w.label
								}), /* @__PURE__ */ jsx("span", {
									className: `block text-[11px] leading-snug ${on ? "text-white/80" : "text-zinc-600"}`,
									children: w.note
								})]
							}, w.id);
						})
					}),
					/* @__PURE__ */ jsxs("div", {
						className: "flex flex-wrap items-center justify-between gap-2 rounded-lg bg-zinc-50 p-2.5",
						children: [
							/* @__PURE__ */ jsxs("div", {
								className: "min-w-0 text-xs",
								children: [/* @__PURE__ */ jsx("p", {
									className: "text-zinc-600",
									children: "This page"
								}), /* @__PURE__ */ jsx("p", {
									className: "truncate font-mono text-[11px] font-semibold text-zinc-900",
									children: pathname
								})]
							}),
							/* @__PURE__ */ jsx("span", {
								className: `rounded-full px-2 py-0.5 text-[11px] font-semibold ${here ? "bg-emerald-50 text-emerald-900" : "bg-amber-50 text-amber-900"}`,
								children: here ? "Gets the colours" : "Keeps its own colours"
							}),
							onlySome && /* @__PURE__ */ jsx("div", {
								className: "w-full",
								children: covering ? /* @__PURE__ */ jsxs("p", {
									className: "text-[11px] text-zinc-600",
									children: [
										"Part of ",
										/* @__PURE__ */ jsx("code", {
											className: "font-mono",
											children: covering
										}),
										"."
									]
								}) : pages.includes(pathname) ? /* @__PURE__ */ jsx("button", {
									type: "button",
									className: `${btn} w-full`,
									onClick: () => remove(pathname),
									children: "Leave this page alone"
								}) : /* @__PURE__ */ jsx("button", {
									type: "button",
									className: `${btnPrimary} w-full`,
									onClick: () => add(pathname),
									children: "Colour this page"
								})
							})
						]
					}),
					onlySome && /* @__PURE__ */ jsxs(Fragment, { children: [
						/* @__PURE__ */ jsxs("div", {
							className: "space-y-1.5",
							children: [/* @__PURE__ */ jsx("p", {
								className: "text-[11px] font-semibold text-zinc-700",
								children: "Pages that get the colours"
							}), pages.length ? /* @__PURE__ */ jsx("ul", {
								className: "space-y-1",
								children: pages.map((p) => /* @__PURE__ */ jsxs("li", {
									className: "flex items-center justify-between gap-2 rounded-lg border border-zinc-200 px-2.5 py-1.5",
									children: [/* @__PURE__ */ jsxs("span", {
										className: "min-w-0 truncate font-mono text-[11px] text-zinc-900",
										children: [p, p.endsWith("/*") && /* @__PURE__ */ jsx("span", {
											className: "ml-1.5 font-sans text-zinc-500",
											children: "and every page under it"
										})]
									}), /* @__PURE__ */ jsx("button", {
										type: "button",
										onClick: () => remove(p),
										"aria-label": `Remove ${p}`,
										className: "grid h-6 w-6 shrink-0 place-items-center rounded-md text-zinc-600 cursor-pointer hover:bg-zinc-100 hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900",
										children: /* @__PURE__ */ jsx(X, {
											className: "w-3.5 h-3.5",
											"aria-hidden": "true"
										})
									})]
								}, p))
							}) : /* @__PURE__ */ jsx("p", {
								className: "rounded-lg bg-amber-50 p-2.5 text-[11px] text-amber-900",
								children: "No pages yet, so the colours show nowhere. Add one below."
							})]
						}),
						/* @__PURE__ */ jsxs("form", {
							onSubmit: addDraft,
							className: "space-y-1.5",
							children: [
								/* @__PURE__ */ jsx("label", {
									htmlFor: inputId,
									className: "block text-[11px] font-semibold text-zinc-700",
									children: "Add a page"
								}),
								/* @__PURE__ */ jsxs("div", {
									className: "flex gap-2",
									children: [/* @__PURE__ */ jsx("input", {
										id: inputId,
										value: draft,
										onChange: (e) => setDraft(e.target.value),
										placeholder: "/pricing or /blog/*",
										className: `${field} font-mono text-xs`,
										"aria-describedby": `${inputId}-hint`,
										"aria-invalid": Boolean(error)
									}), /* @__PURE__ */ jsxs("button", {
										type: "submit",
										className: `${btn} shrink-0`,
										disabled: !draft.trim(),
										children: [/* @__PURE__ */ jsx(Plus, {
											className: "w-3.5 h-3.5",
											"aria-hidden": "true"
										}), " Add"]
									})]
								}),
								/* @__PURE__ */ jsx("p", {
									id: `${inputId}-hint`,
									className: `text-[11px] ${error ? "text-red-700" : "text-zinc-600"}`,
									role: error ? "alert" : void 0,
									children: error ?? "End with /* for a whole section: /blog/* is /blog and every page under it."
								})
							]
						}),
						suggestions.length > 0 && /* @__PURE__ */ jsxs("div", {
							className: "space-y-1.5",
							children: [
								/* @__PURE__ */ jsx("p", {
									className: "text-[11px] font-semibold text-zinc-700",
									children: "Found on your site"
								}),
								/* @__PURE__ */ jsx("div", {
									className: "flex flex-wrap gap-1.5",
									children: suggestions.map((p) => /* @__PURE__ */ jsxs("button", {
										type: "button",
										onClick: () => add(p),
										className: "inline-flex max-w-full items-center gap-1 rounded-full border border-zinc-300 px-2 py-0.5 font-mono text-[11px] text-zinc-800 cursor-pointer hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900",
										children: [/* @__PURE__ */ jsx(Plus, {
											className: "w-3 h-3 shrink-0",
											"aria-hidden": "true"
										}), /* @__PURE__ */ jsx("span", {
											className: "truncate",
											children: p
										})]
									}, p))
								}),
								/* @__PURE__ */ jsx("p", {
									className: "text-[11px] text-zinc-600",
									children: "Pages this one links to, and pages you’ve opened. Open more of your site and they show up here."
								})
							]
						})
					] }),
					configPages && /* @__PURE__ */ jsxs("p", {
						className: "rounded-lg bg-sky-50 p-2.5 text-[11px] text-sky-900",
						children: [
							"Your site’s config colours ",
							configPages.length === 1 ? "one page" : `${configPages.length} pages`,
							": ",
							configPages.join(", "),
							".",
							scopeChosen && /* @__PURE__ */ jsxs(Fragment, { children: [" ", /* @__PURE__ */ jsx("button", {
								type: "button",
								onClick: () => setScope(null),
								className: "font-semibold underline underline-offset-2 cursor-pointer",
								children: "Go back to it"
							})] })
						]
					})
				]
			}),
			onlySome && pages.length > 0 && /* @__PURE__ */ jsxs("section", {
				className: "space-y-2",
				children: [
					/* @__PURE__ */ jsx("p", {
						className: "text-xs font-semibold text-zinc-900",
						children: "Make it the same for every visitor"
					}),
					/* @__PURE__ */ jsx("p", {
						className: "text-[11px] text-zinc-600",
						children: "What you choose here is saved on this device. Add this to your colorsbymax config and everyone gets it."
					}),
					/* @__PURE__ */ jsx(CopyBlock, {
						label: "Your config",
						text: pagesSnippet(pages)
					}),
					/* @__PURE__ */ jsx(CopyBlock, {
						label: "Or ask Claude, Cursor or Copilot",
						text: pagesPrompt(pages),
						copyLabel: "Copy prompt"
					})
				]
			}),
			/* @__PURE__ */ jsxs("section", {
				className: "rounded-xl border border-dashed border-zinc-300 p-3",
				children: [/* @__PURE__ */ jsx("p", {
					className: "text-xs font-semibold text-zinc-900",
					children: "Coming to Studio"
				}), /* @__PURE__ */ jsx("ul", {
					className: "mt-1.5 list-disc space-y-1 pl-4 text-[11px] text-zinc-600",
					children: /* @__PURE__ */ jsx("li", { children: "A map of your whole site: every page and its parts, in one place." })
				})]
			})
		]
	});
}
/** What's been coloured by pointing and clicking, page by page, and how to keep it for good. */
function StudioChanges() {
	const { paints, removePaint, clearPaints, pathname, tokens } = useTheme();
	const { studio } = useSettings();
	const [format, setFormat] = useState("prompt");
	if (!paints.length) return null;
	const pages = [...new Set(paints.map(pageOf))].sort((a, b) => a === "*" ? -1 : b === "*" ? 1 : 0);
	const colourOf = (v) => v.token ? tokens[v.token] : v.hex;
	return /* @__PURE__ */ jsxs("section", {
		className: "space-y-3 rounded-xl border border-zinc-200 p-3",
		children: [
			/* @__PURE__ */ jsxs("div", {
				className: "flex items-center justify-between gap-2",
				children: [/* @__PURE__ */ jsxs("h4", {
					className: "text-xs font-semibold text-zinc-900",
					children: ["Your changes ", /* @__PURE__ */ jsxs("span", {
						className: "font-normal text-zinc-600",
						children: [
							"(",
							paints.length,
							")"
						]
					})]
				}), /* @__PURE__ */ jsx("button", {
					type: "button",
					onClick: () => clearPaints(),
					className: "text-[11px] font-medium text-zinc-600 underline underline-offset-2 cursor-pointer hover:text-zinc-900",
					children: "Clear all"
				})]
			}),
			pages.map((page) => /* @__PURE__ */ jsxs("div", {
				className: "space-y-1",
				children: [/* @__PURE__ */ jsxs("p", {
					className: `text-[11px] font-semibold text-zinc-700 ${page === "*" ? "" : "font-mono"}`,
					children: [page === "*" ? "On every page" : page, page === pathname && /* @__PURE__ */ jsx("span", {
						className: "ml-1.5 font-sans font-normal text-zinc-500",
						children: "(this page)"
					})]
				}), /* @__PURE__ */ jsx("ul", {
					className: "space-y-1",
					children: paints.filter((p) => pageOf(p) === page).map((p) => /* @__PURE__ */ jsxs("li", {
						className: "flex items-center gap-2 rounded-lg border border-zinc-200 px-2.5 py-1.5",
						children: [
							/* @__PURE__ */ jsx("span", {
								className: "flex shrink-0 -space-x-1",
								children: PROPS.filter(({ key }) => p.props[key]).map(({ key, label }) => /* @__PURE__ */ jsx("span", {
									title: label,
									className: "h-4 w-4 rounded-full border-2 border-white",
									style: { background: colourOf(p.props[key]) }
								}, key))
							}),
							/* @__PURE__ */ jsxs("span", {
								className: "min-w-0 flex-1 text-[11px] leading-snug text-zinc-800",
								children: [
									/* @__PURE__ */ jsx("span", {
										className: "font-semibold",
										children: p.kind
									}),
									p.text && /* @__PURE__ */ jsxs("span", {
										className: "text-zinc-600",
										children: [
											" “",
											p.text,
											"”"
										]
									}),
									p.everywhere ? /* @__PURE__ */ jsx("span", {
										className: "text-zinc-600",
										children: " and every one like it"
									}) : p.all && p.similar && /* @__PURE__ */ jsxs("span", {
										className: "text-zinc-600",
										children: [
											" and ",
											p.likeIt - 1,
											" like it"
										]
									})
								]
							}),
							/* @__PURE__ */ jsx("button", {
								type: "button",
								onClick: () => removePaint(p.id),
								"aria-label": `Undo the change to ${p.kind.toLowerCase()} ${p.text}`,
								className: "grid h-6 w-6 shrink-0 place-items-center rounded-md text-zinc-600 cursor-pointer hover:bg-zinc-100 hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900",
								children: /* @__PURE__ */ jsx(X, {
									className: "w-3.5 h-3.5",
									"aria-hidden": "true"
								})
							})
						]
					}, p.id))
				})]
			}, page)),
			/* @__PURE__ */ jsxs("button", {
				type: "button",
				className: `${btn} w-full`,
				onClick: studio.start,
				children: [/* @__PURE__ */ jsx(MousePointerClick, {
					className: "w-3.5 h-3.5",
					"aria-hidden": "true"
				}), " Colour more"]
			}),
			/* @__PURE__ */ jsxs("div", {
				className: "space-y-2 border-t border-zinc-200 pt-3",
				children: [
					/* @__PURE__ */ jsxs("div", {
						className: "flex items-center justify-between gap-2",
						children: [/* @__PURE__ */ jsx("p", {
							className: "text-xs font-semibold text-zinc-900",
							children: "Keep them for good"
						}), /* @__PURE__ */ jsx("div", {
							role: "radiogroup",
							"aria-label": "Save as",
							className: "flex shrink-0 items-center rounded-lg border border-zinc-200 p-0.5",
							children: [["prompt", "Prompt"], ["css", "CSS"]].map(([id, label]) => /* @__PURE__ */ jsx("button", {
								type: "button",
								role: "radio",
								"aria-checked": format === id,
								onClick: () => setFormat(id),
								className: `h-6 rounded-md px-2 text-[11px] font-semibold cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 ${format === id ? "bg-zinc-900 text-white" : "text-zinc-700 hover:bg-zinc-100"}`,
								children: label
							}, id))
						})]
					}),
					/* @__PURE__ */ jsx("p", {
						className: "text-[11px] text-zinc-600",
						children: format === "prompt" ? "Recommended. Paste it into Claude, Cursor or Copilot and it makes these changes in your site’s code, using your own colour settings where you have them." : "Plain CSS for your stylesheet. The selectors come from the page as it is now, so they can break if its layout changes; the prompt holds up better."
					}),
					format === "prompt" ? /* @__PURE__ */ jsx(CopyBlock, {
						label: "Prompt for your AI editor",
						text: paintsPrompt(paints, tokens),
						copyLabel: "Copy prompt"
					}) : /* @__PURE__ */ jsx(CopyBlock, {
						label: "CSS",
						text: paintsCssExport(paints, tokens)
					}),
					/* @__PURE__ */ jsx("p", {
						className: "text-[11px] text-zinc-600",
						children: "Until then, your changes are saved on this device only."
					})
				]
			})
		]
	});
}
/** A way into "Add to site": a light and dark switch for the visitor's own site. */
function AddToSiteLink({ onOpen }) {
	const { features } = useTheme();
	if (!features.addToSite) return null;
	return /* @__PURE__ */ jsxs("button", {
		type: "button",
		onClick: onOpen,
		className: "flex w-full items-center gap-2.5 rounded-xl border border-zinc-200 p-2.5 text-left cursor-pointer hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900",
		children: [
			/* @__PURE__ */ jsx("span", {
				className: "grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-zinc-100 text-zinc-800",
				children: /* @__PURE__ */ jsx(ToggleRight, {
					className: "w-4 h-4",
					"aria-hidden": "true"
				})
			}),
			/* @__PURE__ */ jsxs("span", {
				className: "min-w-0 flex-1",
				children: [/* @__PURE__ */ jsx("span", {
					className: "block text-xs font-semibold text-zinc-900",
					children: "Add a light and dark switch to your site"
				}), /* @__PURE__ */ jsx("span", {
					className: "block text-[11px] leading-snug text-zinc-600",
					children: "Let your visitors choose, even if your site never had a dark mode."
				})]
			}),
			/* @__PURE__ */ jsx(ChevronRight, {
				className: "w-4 h-4 shrink-0 text-zinc-500",
				"aria-hidden": "true"
			})
		]
	});
}
/**
* The bell: a newer colorsbymax, with what changed and how to update (a command, or a prompt for an
* AI editor), and Max's news. Opening it marks everything as seen.
*/
function UpdatesView({ updates, onBack }) {
	const { current, latest, update, notes, notices, checked, markSeen } = updates;
	const headingRef = useRef(null);
	useEffect(() => headingRef.current?.focus(), []);
	useEffect(() => markSeen(), [markSeen]);
	const link = "inline-flex items-center gap-1 text-xs font-semibold text-zinc-900 underline underline-offset-2 hover:no-underline";
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
				children: "What’s new"
			}),
			update ? /* @__PURE__ */ jsxs("section", {
				className: "space-y-3 rounded-xl border border-zinc-900 p-3",
				children: [
					/* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsxs("p", {
						className: "text-sm font-semibold text-zinc-900",
						children: [
							"colorsbymax ",
							latest,
							" is out"
						]
					}), /* @__PURE__ */ jsxs("p", {
						className: "text-[11px] text-zinc-600",
						children: [
							"This site has ",
							current ?? "an older version",
							"."
						]
					})] }),
					notes.length > 0 && /* @__PURE__ */ jsx("ul", {
						className: "list-disc space-y-1 pl-4 text-[11px] leading-snug text-zinc-700",
						children: notes.map((note) => /* @__PURE__ */ jsx("li", { children: note }, note))
					}),
					/* @__PURE__ */ jsx(CopyBlock, {
						label: "Update it",
						text: UPDATE_COMMAND
					}),
					/* @__PURE__ */ jsx(CopyBlock, {
						label: "Or ask Claude, Cursor or Copilot",
						text: updatePrompt(latest),
						copyLabel: "Copy prompt"
					}),
					/* @__PURE__ */ jsxs("a", {
						href: CHANGELOG_PAGE,
						target: "_blank",
						rel: "noopener",
						className: link,
						children: [
							"Everything in ",
							latest,
							", and what to change ",
							/* @__PURE__ */ jsx(ExternalLink, {
								className: "w-3 h-3",
								"aria-hidden": "true"
							})
						]
					})
				]
			}) : /* @__PURE__ */ jsxs("p", {
				className: "flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-xs text-emerald-900",
				children: [/* @__PURE__ */ jsx(CheckCircle2, {
					className: "w-4 h-4 shrink-0",
					"aria-hidden": "true"
				}), !checked ? "Checking for updates…" : current ? `You’re on the latest colorsbymax, ${current}.` : "You’re on the latest colorsbymax."]
			}),
			notices.length > 0 && /* @__PURE__ */ jsxs("section", {
				className: "space-y-2",
				children: [/* @__PURE__ */ jsx("h4", {
					className: "text-[11px] font-semibold uppercase tracking-wide text-zinc-600",
					children: "From mrmaxdesigns"
				}), /* @__PURE__ */ jsx("ul", {
					className: "space-y-2",
					children: notices.map((n) => /* @__PURE__ */ jsxs("li", {
						className: "rounded-xl border border-zinc-200 p-3",
						children: [
							/* @__PURE__ */ jsx("p", {
								className: "text-xs font-semibold text-zinc-900",
								children: n.title
							}),
							n.date && /* @__PURE__ */ jsx("p", {
								className: "text-[10px] text-zinc-500",
								children: n.date
							}),
							n.text && /* @__PURE__ */ jsx("p", {
								className: "mt-1 text-[11px] leading-snug whitespace-pre-line text-zinc-700",
								children: n.text
							}),
							n.link && /* @__PURE__ */ jsxs("a", {
								href: n.link,
								target: "_blank",
								rel: "noopener",
								className: `mt-1.5 ${link}`,
								children: [
									n.label || "Read more",
									" ",
									/* @__PURE__ */ jsx(ExternalLink, {
										className: "w-3 h-3",
										"aria-hidden": "true"
									})
								]
							})
						]
					}, n.id))
				})]
			}),
			/* @__PURE__ */ jsx("p", {
				className: "text-[11px] text-zinc-500",
				children: "colorsbymax checks once a day, and only shows this where you work on your site, not to its visitors."
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
function FinishView({ onBack, onAddToSite }) {
	const { tokens: themeTokens, appliedTokens, colourStyle, active, recolouring } = useTheme();
	const { settings, update } = useSettings();
	const tokens = colourStyle === "colourful" ? themeTokens : appliedTokens;
	const style = colourStyle === "colourful" ? "colourful" : "balanced";
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
						text: keepSnippet(kind, name, tokens, "import.meta.env.PROD", style)
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
						text: keepPrompt(name, tokens, style),
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
						text: cssSnippet(appliedTokens)
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
			choice !== "remove" && /* @__PURE__ */ jsx(AddToSiteLink, { onOpen: onAddToSite }),
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
function SettingsView({ onBack, onAddToSite }) {
	const { settings, update, reset, resetButton } = useSettings();
	const { active, features } = useTheme();
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
					}),
					/* @__PURE__ */ jsx(AddToSiteLink, { onOpen: onAddToSite })
				]
			}),
			features.colourCount && /* @__PURE__ */ jsxs("fieldset", {
				className: "space-y-1.5",
				children: [
					/* @__PURE__ */ jsx("legend", {
						className: "mb-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-600",
						children: "Colours per theme"
					}),
					/* @__PURE__ */ jsxs("div", {
						className: "flex items-center gap-3 rounded-xl border border-zinc-200 p-2.5",
						children: [/* @__PURE__ */ jsx("div", {
							className: "min-w-0 flex-1",
							children: /* @__PURE__ */ jsx(Swatches, {
								tokens: active.tokens,
								count: settings.paletteSize
							})
						}), /* @__PURE__ */ jsx(ColourStepper, {
							value: settings.paletteSize,
							onChange: (n) => update({ paletteSize: n }),
							label: "Colours every theme uses",
							size: "md"
						})]
					}),
					/* @__PURE__ */ jsxs("p", {
						className: "text-[11px] text-zinc-600",
						children: [
							"How many colours every theme uses, from ",
							5,
							" to ",
							10,
							". Fewer keeps a site calmer, with only a theme’s main colours; the ones that fit it best stay. You can still change it on any theme with − and + on its card."
						]
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
					features.picks && /* @__PURE__ */ jsx(Toggle, {
						checked: settings.showPicks,
						onChange: (v) => update({ showPicks: v }),
						label: "Max’s picks",
						note: "Hand-tuned colorsbymax themes"
					}),
					features.library && /* @__PURE__ */ jsx(Toggle, {
						checked: settings.showLibrary,
						onChange: (v) => update({ showLibrary: v }),
						label: "Theme library",
						note: "Hundreds of themes in categories, with search"
					}),
					features.custom && /* @__PURE__ */ jsx(Toggle, {
						checked: settings.showCustom,
						onChange: (v) => update({ showCustom: v }),
						label: "Custom palettes"
					}),
					features.overrides && /* @__PURE__ */ jsx(Toggle, {
						checked: settings.showOverrides,
						onChange: (v) => update({ showOverrides: v }),
						label: "Override a single colour"
					}),
					features.importExport && /* @__PURE__ */ jsx(Toggle, {
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
function Section({ title, badge, wideBadge = false, defaultOpen = false, children }) {
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
					className: `rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-700 ${wideBadge ? "max-w-[50%] truncate" : ""}`,
					title: wideBadge ? badge : void 0,
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
/** A theme's colours as a strip: the `count` it uses (5 to 10), its most fitting ones. */
function Swatches({ tokens, count = 10 }) {
	return /* @__PURE__ */ jsx("div", {
		className: "flex overflow-hidden rounded-md border border-zinc-200",
		"aria-hidden": "true",
		children: paletteKeys(tokens, count).map((key) => /* @__PURE__ */ jsx("span", {
			className: "h-5 flex-1",
			style: { background: tokens[key] }
		}, key))
	});
}
/**
* − n + for how many colours a theme uses. Each end dims when it's as far as it goes.
* @param {{ value: number, onChange: (n: number) => void, label: string, size?: 'sm' | 'md' }} props
*/
function ColourStepper({ value, onChange, label, size = "sm" }) {
	const box = size === "sm" ? "h-6 w-6" : "h-8 w-8";
	const step = (d) => (e) => {
		e.stopPropagation();
		onChange(value + d);
	};
	return /* @__PURE__ */ jsxs("span", {
		role: "group",
		"aria-label": label,
		className: "inline-flex items-center gap-1",
		children: [
			/* @__PURE__ */ jsx("button", {
				type: "button",
				onClick: step(-1),
				disabled: value <= 5,
				"aria-label": `Fewer colours (${value} now)`,
				"data-tip": value <= 5 ? `5 is the fewest` : "Use fewer colours",
				className: `${box} grid place-items-center rounded-full border border-zinc-300 bg-white text-zinc-800 cursor-pointer hover:border-zinc-900 disabled:cursor-default disabled:opacity-35 disabled:hover:border-zinc-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900`,
				children: /* @__PURE__ */ jsx(Minus, {
					className: "w-3.5 h-3.5",
					"aria-hidden": "true"
				})
			}),
			/* @__PURE__ */ jsx("span", {
				className: "min-w-[1.25rem] text-center text-xs font-semibold tabular-nums text-zinc-900",
				"aria-live": "polite",
				children: value
			}),
			/* @__PURE__ */ jsx("button", {
				type: "button",
				onClick: step(1),
				disabled: value >= 10,
				"aria-label": `More colours (${value} now)`,
				"data-tip": value >= 10 ? `10 is every colour` : "Use more colours",
				className: `${box} grid place-items-center rounded-full border border-zinc-300 bg-white text-zinc-800 cursor-pointer hover:border-zinc-900 disabled:cursor-default disabled:opacity-35 disabled:hover:border-zinc-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900`,
				children: /* @__PURE__ */ jsx(Plus, {
					className: "w-3.5 h-3.5",
					"aria-hidden": "true"
				})
			})
		]
	});
}
var PAGE_SIZE = 24;
var NO_THEMES = [];
var COLOUR_STYLES = [
	{
		id: "subtle",
		label: "Subtle",
		Icon: Contrast
	},
	{
		id: "balanced",
		label: "Balanced",
		Icon: Palette
	},
	{
		id: "colourful",
		label: "Colourful",
		Icon: Paintbrush
	}
];
var STYLE_NOTES = {
	subtle: "Subtle: your site keeps its own backgrounds, cards and text. The theme’s colour comes in on buttons, links and highlights, with only a quiet hint of it on badges and tints.",
	balanced: "Balanced: the theme in every role, with a soft wash of it across the page, cards and borders.",
	colourful: "Colourful: an overhaul. Tinted backgrounds, and the theme paints your header, hero, sections, headings, cards, buttons and footer, like a designer would. Text is still checked for contrast."
};
function PresetGrid() {
	const { siteName, siteThemes, presets: allPresets, customs, active, selectTheme, state, clearOverrides, tokens, recolouring, features } = useTheme();
	const surpriseBurst = useBurst();
	const { settings, mode, update } = useSettings();
	const { confirmTheme } = usePanel();
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
			const header = themesRef.current.closest(".theme-scroll")?.querySelector("header");
			themesRef.current.style.scrollMarginTop = `${(header?.offsetHeight ?? 0) + 12}px`;
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
			const byName = (t) => t.name.toLowerCase().includes(q) || t.tags?.some((tag) => labels[tag]?.includes(q));
			const byColour = colourMatcher(q);
			list = [...list.filter(byName), ...byColour ? list.filter((t) => !byName(t) && byColour(t.tokens)) : []];
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
	const pick = (t) => confirmTheme(() => selectTheme(t.id, t));
	const surprise = () => {
		const everything = library?.themes ?? [...siteThemes, ...presets];
		const pool = (visible.length > 1 ? visible : everything).filter((t) => t.id !== active.id && inMode(t, mode).id !== active.id);
		if (!pool.length) return;
		pick(inMode(pool[Math.floor(Math.random() * pool.length)], mode));
		surpriseBurst.celebrate();
	};
	const suggestions = suggestWords(query, categories.map((c) => c.label));
	const themeCount = (library?.themes.length ?? 0) + presets.length + siteThemes.length + customs.length;
	const roughCount = themeCount >= 100 ? `${Math.floor(themeCount / 100) * 100}+` : themeCount;
	return /* @__PURE__ */ jsxs("div", {
		ref: wrapRef,
		className: "space-y-3",
		children: [
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
			(features.search || features.surprise) && /* @__PURE__ */ jsxs("div", {
				className: "flex gap-2",
				children: [features.search && /* @__PURE__ */ jsxs(Fragment, { children: [/* @__PURE__ */ jsx("label", {
					htmlFor: searchId,
					className: "sr-only",
					children: "Search themes"
				}), /* @__PURE__ */ jsx("input", {
					id: searchId,
					type: "search",
					className: field,
					placeholder: `Search ${roughCount} themes…`,
					value: query,
					onChange: (e) => {
						setQuery(e.target.value);
						setLimit(PAGE_SIZE);
					}
				})] }), features.surprise && /* @__PURE__ */ jsxs("button", {
					type: "button",
					className: `${btn} relative shrink-0 ${features.search ? "" : "flex-1"}`,
					onClick: surprise,
					disabled: !library && needsLibrary,
					children: [
						/* @__PURE__ */ jsx(Shuffle, {
							className: "w-3.5 h-3.5",
							"aria-hidden": "true"
						}),
						/* @__PURE__ */ jsxs("span", { children: ["Surprise", /* @__PURE__ */ jsx("span", {
							className: "hidden @min-[400px]:inline",
							children: " me"
						})] }),
						surpriseBurst.bursting && /* @__PURE__ */ jsx(Burst, {
							tokens,
							spread: 1.7
						}, surpriseBurst.burst)
					]
				})]
			}),
			suggestions.length > 0 && /* @__PURE__ */ jsxs("div", {
				role: "group",
				"aria-label": "Suggestions",
				className: "-mt-1 flex flex-wrap items-center gap-1.5",
				children: [/* @__PURE__ */ jsx("span", {
					className: "text-[11px] text-zinc-500",
					children: "Try"
				}), suggestions.map((w) => /* @__PURE__ */ jsx("button", {
					type: "button",
					onClick: () => {
						setQuery(w);
						setLimit(PAGE_SIZE);
					},
					className: "rounded-full border border-zinc-300 bg-white px-2.5 py-0.5 text-xs font-medium text-zinc-800 capitalize hover:border-zinc-900 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900",
					children: w
				}, w))]
			}),
			q && /* @__PURE__ */ jsxs("div", {
				className: "flex items-center justify-between gap-2",
				children: [/* @__PURE__ */ jsxs("p", {
					className: "text-xs text-zinc-600",
					role: "status",
					children: [
						visible.length,
						" ",
						visible.length === 1 ? "theme" : "themes",
						" for “",
						query.trim(),
						"”"
					]
				}), /* @__PURE__ */ jsx("div", {
					role: "radiogroup",
					"aria-label": "Show them in",
					className: "flex shrink-0 items-center rounded-lg border border-zinc-200 p-0.5",
					children: MODES.filter((m) => m.id !== "system").map(({ id, label, Icon }) => {
						const on = mode === id;
						return /* @__PURE__ */ jsxs("button", {
							type: "button",
							role: "radio",
							"aria-checked": on,
							onClick: () => update({ mode: id }),
							className: `inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs font-semibold cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 ${on ? "bg-zinc-900 text-white" : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"}`,
							children: [/* @__PURE__ */ jsx(Icon, {
								className: "w-3.5 h-3.5",
								"aria-hidden": "true"
							}), label]
						}, id);
					})
				})]
			}),
			!q && /* @__PURE__ */ jsxs(Fragment, { children: [/* @__PURE__ */ jsx("div", {
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
						onClick: () => choose(g.id, { scroll: true }),
						className: `flex min-h-12 min-w-0 flex-col items-center justify-center gap-1 rounded-xl border px-1.5 py-2 text-[11px] leading-tight font-semibold @min-[460px]:h-10 @min-[460px]:min-h-0 @min-[460px]:flex-row @min-[460px]:justify-start @min-[460px]:gap-1.5 @min-[460px]:px-2.5 @min-[460px]:py-0 @min-[460px]:text-xs cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-1 ${on ? "border-zinc-900 bg-zinc-900 text-white shadow-sm" : "border-zinc-200 bg-zinc-100 text-zinc-900 hover:bg-zinc-200"}`,
						children: [
							/* @__PURE__ */ jsx(g.Icon, {
								className: "w-4 h-4 shrink-0",
								"aria-hidden": "true"
							}),
							/* @__PURE__ */ jsx("span", {
								className: "max-w-full text-center break-words @min-[460px]:truncate @min-[460px]:text-left",
								children: g.label
							}),
							/* @__PURE__ */ jsx("span", {
								className: `ml-auto hidden pl-1 font-medium tabular-nums @min-[460px]:inline ${on ? "text-zinc-300" : "text-zinc-500"}`,
								children: g.count
							})
						]
					}, g.id);
				})
			}), categories.length > 0 && /* @__PURE__ */ jsxs("section", {
				"aria-label": "Theme library",
				className: "rounded-xl border border-zinc-200 bg-zinc-50 p-2.5",
				children: [/* @__PURE__ */ jsxs("button", {
					type: "button",
					"aria-expanded": !settings.libraryCollapsed,
					"aria-controls": categoriesId,
					onClick: () => update({ libraryCollapsed: !settings.libraryCollapsed }),
					className: "flex w-full items-center gap-2.5 rounded-lg px-1 py-0.5 text-left cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900",
					children: [
						/* @__PURE__ */ jsx(LibraryBig, {
							className: "h-5 w-5 shrink-0 text-zinc-700",
							"aria-hidden": "true"
						}),
						/* @__PURE__ */ jsxs("span", {
							className: "min-w-0 flex-1",
							children: [/* @__PURE__ */ jsx("span", {
								className: "block text-sm font-semibold text-zinc-900",
								children: "Library"
							}), /* @__PURE__ */ jsx("span", {
								className: "block text-[11px] leading-snug text-zinc-600",
								children: settings.libraryCollapsed && activeCategory ? `Showing ${activeCategory.label}` : `${library ? `${library.themes.length} palettes` : "Palettes"} sorted by mood. Pick one to see its themes.`
							})]
						}),
						/* @__PURE__ */ jsxs("span", {
							className: "flex shrink-0 items-center gap-1 text-[11px] font-medium text-zinc-600",
							children: [settings.libraryCollapsed ? "Show" : "Hide", /* @__PURE__ */ jsx(ChevronRight, {
								className: `w-3.5 h-3.5 transition-transform motion-reduce:transition-none ${settings.libraryCollapsed ? "" : "rotate-90"}`,
								"aria-hidden": "true"
							})]
						})
					]
				}), /* @__PURE__ */ jsx("div", {
					id: categoriesId,
					hidden: settings.libraryCollapsed,
					role: "group",
					"aria-label": "Library moods",
					className: "mt-2.5 grid grid-cols-2 @min-[380px]:grid-cols-3 gap-2",
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
				})]
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
				!q && /* @__PURE__ */ jsxs("p", {
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
/**
* Above the themes: how boldly the site takes whichever theme is on (Subtle or Colourful), and the
* scan that builds themes from the site's own colours.
*/
function StyleAndScan() {
	const { features, recolouring } = useTheme();
	const { settings, update } = useSettings();
	return /* @__PURE__ */ jsxs("div", {
		className: "space-y-3",
		children: [features.colourStyle && /* @__PURE__ */ jsxs("div", {
			className: "rounded-xl border border-zinc-200 p-2.5",
			children: [
				/* @__PURE__ */ jsx("div", {
					role: "radiogroup",
					"aria-label": "Colour style",
					className: "grid grid-cols-3 gap-1 rounded-lg bg-zinc-100 p-1",
					children: COLOUR_STYLES.map(({ id, label, Icon }) => {
						const on = settings.colourStyle === id;
						return /* @__PURE__ */ jsxs("button", {
							type: "button",
							role: "radio",
							"aria-checked": on,
							onClick: () => update({ colourStyle: id }),
							className: `inline-flex h-8 cursor-pointer items-center justify-center gap-1.5 rounded-md text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 ${on ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-600 hover:text-zinc-900"}`,
							children: [/* @__PURE__ */ jsx(Icon, {
								className: "w-3.5 h-3.5",
								"aria-hidden": "true"
							}), label]
						}, id);
					})
				}),
				/* @__PURE__ */ jsx("p", {
					className: "mt-2 px-0.5 text-[11px] leading-snug text-zinc-600",
					children: settings.colourStyle === "balanced" && recolouring ? "Balanced: every colour on your site swapped for its match in the theme." : settings.colourStyle === "colourful" && !recolouring ? "Colourful: an overhaul. Your page, cards and borders take a clear tint of the theme, and text a hint of it, wherever your design already uses colour. Text is still checked for contrast." : STYLE_NOTES[settings.colourStyle] ?? STYLE_NOTES.balanced
				}),
				settings.colourStyle === "colourful" && /* @__PURE__ */ jsx(ColourfulControls, {})
			]
		}), features.scan && /* @__PURE__ */ jsx(ScanCard, {})]
	});
}
/** Colourful's strength, from a light wash to bold, and tints from the site's own pictures. */
function ColourfulControls() {
	const { pictureColours, pictureTint } = useTheme();
	const { settings, update } = useSettings();
	const id = useId();
	const strength = settings.colourStrength;
	const word = strength < 25 ? "A light wash" : strength < 50 ? "Soft" : strength < 75 ? "Lively" : "Bold";
	return /* @__PURE__ */ jsxs("div", {
		className: "mt-3 space-y-3 border-t border-zinc-200 pt-3",
		children: [/* @__PURE__ */ jsxs("div", { children: [
			/* @__PURE__ */ jsxs("div", {
				className: "mb-1 flex items-center justify-between",
				children: [/* @__PURE__ */ jsx("label", {
					htmlFor: id,
					className: "text-[11px] font-semibold text-zinc-700",
					children: "Strength"
				}), /* @__PURE__ */ jsx("span", {
					className: "text-[11px] font-medium text-zinc-600",
					children: word
				})]
			}),
			/* @__PURE__ */ jsx("input", {
				id,
				type: "range",
				min: "0",
				max: "100",
				step: "5",
				value: strength,
				onChange: (e) => update({ colourStrength: Number(e.target.value) }),
				"aria-valuetext": word,
				className: "w-full cursor-pointer accent-zinc-900"
			}),
			/* @__PURE__ */ jsxs("div", {
				className: "flex justify-between text-[10px] text-zinc-500",
				"aria-hidden": "true",
				children: [/* @__PURE__ */ jsx("span", { children: "Light wash" }), /* @__PURE__ */ jsx("span", { children: "Bold" })]
			})
		] }), /* @__PURE__ */ jsxs("label", {
			className: "flex cursor-pointer items-start gap-2",
			children: [/* @__PURE__ */ jsx("input", {
				type: "checkbox",
				checked: settings.imageTints,
				onChange: (e) => update({ imageTints: e.target.checked }),
				className: "mt-0.5 h-3.5 w-3.5 shrink-0 accent-zinc-900"
			}), /* @__PURE__ */ jsxs("span", {
				className: "min-w-0 text-[11px] leading-snug text-zinc-700",
				children: [
					/* @__PURE__ */ jsx("span", {
						className: "font-semibold text-zinc-900",
						children: "Tint with my pictures’ colours"
					}),
					/* @__PURE__ */ jsx("span", {
						className: "block text-zinc-600",
						children: !settings.imageTints ? "The washes use the theme’s own colours." : pictureTint ? "The washes take a colour from your logo and photos, so they feel made for your site. Buttons and links keep the theme’s." : pictureColours.length ? "Your pictures are mostly greys, so the washes use the theme’s colours." : "No pictures colorsbymax can read on this page, so the washes use the theme’s colours."
					}),
					settings.imageTints && pictureColours.length > 0 && /* @__PURE__ */ jsx("span", {
						className: "mt-1.5 flex items-center gap-1",
						"aria-hidden": "true",
						children: pictureColours.slice(0, 8).map((hex) => /* @__PURE__ */ jsx("span", {
							"data-tip": hex,
							className: `h-4 w-4 rounded border ${hex === pictureTint ? "border-zinc-900 ring-2 ring-zinc-900 ring-offset-1" : "border-black/15"}`,
							style: { background: hex }
						}, hex))
					})
				]
			})]
		})]
	});
}
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
						children: scanned ? "Themes built from this site’s colours are in its group in Preset themes." : "Scan this page’s colours to get themes built around them."
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
	const { issues, coloursOf, setThemeColours, features } = useTheme();
	const colours = coloursOf(t.id);
	const showContrast = useContext(ContrastNav);
	const stored = useMemo(() => t.library && !t.derived ? 0 : checkTheme(t.tokens).length, [t]);
	const count = isActive ? issues.length : stored;
	return /* @__PURE__ */ jsxs("div", {
		className: "relative",
		children: [
			/* @__PURE__ */ jsxs("button", {
				type: "button",
				"aria-pressed": isActive,
				onClick: onSelect,
				className: `flex w-full flex-col gap-2 rounded-xl border p-2.5 text-left cursor-pointer hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 ${isActive ? "border-zinc-900 ring-1 ring-zinc-900" : "border-zinc-200"} ${count ? "pr-12" : ""}`,
				children: [
					/* @__PURE__ */ jsx("span", {
						className: "truncate text-sm font-medium",
						children: t.name
					}),
					/* @__PURE__ */ jsx(Swatches, {
						tokens: t.tokens,
						count: colours
					}),
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
			}),
			count > 0 && /* @__PURE__ */ jsxs("button", {
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
			}),
			isActive && features.colourCount && /* @__PURE__ */ jsx("span", {
				className: "absolute right-2 bottom-2",
				children: /* @__PURE__ */ jsx(ColourStepper, {
					value: colours,
					onChange: (n) => setThemeColours(t.id, n),
					label: `Colours ${t.name} uses`
				})
			})
		]
	});
}
function CustomPalettes() {
	const { customs, active, createCustom, renameCustom, deleteCustom, selectTheme, updateCustomToken, state } = useTheme();
	const { toast, confirmTheme } = usePanel();
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
							onClick: () => confirmTheme(() => selectTheme(c.id)),
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
var EXPORT_FORMATS = [{
	id: "json",
	label: "JSON",
	type: "application/json",
	ext: "theme.json",
	what: "theme JSON"
}, {
	id: "css",
	label: "CSS",
	type: "text/css",
	ext: "theme.css",
	what: "theme CSS"
}];
function ImportExport() {
	const { exportTheme, importTheme, tokens } = useTheme();
	const { toast } = usePanel();
	const savedToYours = useSavedToYours();
	const json = exportTheme();
	const themeName = JSON.parse(json).name;
	const [format, setFormat] = useState("json");
	const out = EXPORT_FORMATS.find((f) => f.id === format);
	const text = format === "css" ? `/* ${themeName.replace(/\*\//g, "")}, from colorsbymax */\n${cssSnippet(tokens)}\n` : json;
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
					/* @__PURE__ */ jsxs("div", {
						className: "flex items-center justify-between gap-2",
						children: [/* @__PURE__ */ jsxs("label", {
							htmlFor: exportId,
							className: "block text-xs font-medium text-zinc-700",
							children: ["Current theme as ", out.label]
						}), /* @__PURE__ */ jsx("div", {
							role: "radiogroup",
							"aria-label": "Export as",
							className: "flex shrink-0 items-center rounded-lg border border-zinc-200 p-0.5",
							children: EXPORT_FORMATS.map((f) => /* @__PURE__ */ jsx("button", {
								type: "button",
								role: "radio",
								"aria-checked": format === f.id,
								onClick: () => setFormat(f.id),
								className: `h-6 rounded-md px-2 text-[11px] font-semibold cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 ${format === f.id ? "bg-zinc-900 text-white" : "text-zinc-700 hover:bg-zinc-100"}`,
								children: f.label
							}, f.id))
						})]
					}),
					/* @__PURE__ */ jsx("textarea", {
						id: exportId,
						readOnly: true,
						value: text,
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
									await navigator.clipboard.writeText(text);
									setStatus(null);
									toast(`Copied the ${out.what} to your clipboard.`);
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
								const url = URL.createObjectURL(new Blob([text], { type: out.type }));
								const a = document.createElement("a");
								a.href = url;
								a.download = `${themeName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.${out.ext}`;
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
var CARD_WIDTH$1 = 264;
var GAP$1 = 10;
var EDGE$2 = 12;
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
		const below = r.bottom + GAP$1 + h < vh || r.top < h + GAP$1;
		let top = below ? r.bottom + GAP$1 : r.top - GAP$1 - h;
		let left = Math.min(Math.max(r.left + r.width / 2 - CARD_WIDTH$1 / 2, EDGE$2), vw - CARD_WIDTH$1 - EDGE$2);
		for (let tries = 0; tries < placed.length + 1; tries++) {
			const hit = placed.find((p) => left < p.left + CARD_WIDTH$1 + APART && left + CARD_WIDTH$1 + APART > p.left && top < p.top + p.h + APART && top + h + APART > p.top);
			if (!hit) break;
			if (hit.left + 2 * CARD_WIDTH$1 + APART + EDGE$2 <= vw) left = hit.left + CARD_WIDTH$1 + APART;
			else top = hit.top + hit.h + APART;
		}
		placed.push({
			left,
			top,
			h
		});
		const arrow = Math.min(Math.max(r.left + r.width / 2 - left, 16), 248);
		const pointing = below ? Math.abs(top - (r.bottom + GAP$1)) < 2 : Math.abs(top + h - (r.top - GAP$1)) < 2;
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
						width: CARD_WIDTH$1
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
		right: EDGE$2,
		bottom: EDGE$2
	};
	if (anchorRect) {
		const onRight = anchorRect.left + anchorRect.width / 2 > vw / 2;
		const top = anchorRect.top + anchorRect.height / 2 < vh / 2 ? Math.round(anchorRect.bottom + GAP$1) : Math.round(anchorRect.top - GAP$1 - size.height);
		const left = onRight ? Math.round(anchorRect.right - size.width) : Math.round(anchorRect.left);
		style = {
			top,
			left: Math.min(Math.max(EDGE$2, left), vw - size.width - EDGE$2)
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
//#region src/StudioLayer.jsx
var CARD_WIDTH = 300;
var EDGE$1 = 12;
var GAP = 10;
var OUTLINE = "#6366f1";
var stepButton = "inline-flex items-center gap-1 rounded-lg border border-zinc-300 px-2 py-1 text-[11px] font-medium text-zinc-800 cursor-pointer hover:bg-zinc-50 disabled:cursor-default disabled:opacity-45 disabled:hover:bg-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900";
var newId = () => `paint-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
/** Follows an element's box on screen as the page scrolls, resizes or shifts. */
function useRect(el) {
	const [rect, setRect] = useState(null);
	useLayoutEffect(() => {
		if (!el) return setRect(null);
		let frame = 0;
		const measure = () => {
			frame = 0;
			setRect(el.isConnected ? el.getBoundingClientRect() : null);
		};
		const schedule = () => {
			if (!frame) frame = requestAnimationFrame(measure);
		};
		measure();
		window.addEventListener("scroll", schedule, true);
		window.addEventListener("resize", schedule);
		const timer = setInterval(schedule, 400);
		return () => {
			cancelAnimationFrame(frame);
			clearInterval(timer);
			window.removeEventListener("scroll", schedule, true);
			window.removeEventListener("resize", schedule);
		};
	}, [el]);
	return rect;
}
function Outline({ rect, label, solid }) {
	if (!rect) return null;
	const above = rect.top > 26;
	return /* @__PURE__ */ jsx("div", {
		"aria-hidden": "true",
		className: "pointer-events-none fixed z-[65] rounded-md",
		style: {
			left: rect.left - 3,
			top: rect.top - 3,
			width: rect.width + 6,
			height: rect.height + 6,
			outline: `2px ${solid ? "solid" : "dashed"} ${OUTLINE}`,
			background: solid ? "transparent" : "rgb(99 102 241 / 0.08)"
		},
		children: /* @__PURE__ */ jsx("span", {
			className: "absolute left-0 whitespace-nowrap rounded px-1.5 py-0.5 text-[11px] font-semibold text-white",
			style: {
				background: OUTLINE,
				...above ? {
					bottom: "100%",
					marginBottom: 4
				} : {
					top: "100%",
					marginTop: 4
				}
			},
			children: label
		})
	});
}
function StudioLayer({ onDone }) {
	const theme = useTheme();
	const pathname = usePathname();
	const [hover, setHover] = useState(null);
	const [picked, setPicked] = useState(null);
	const hoverRect = useRect(hover?.el ?? null);
	const pickedRect = useRect(picked?.el ?? null);
	const latest = useRef({});
	const coarse = typeof matchMedia === "function" && matchMedia("(hover: none)").matches;
	useEffect(() => {
		const onMove = (e) => {
			if (e.pointerType === "touch") return;
			const el = pickTarget(e);
			setHover((h) => h?.el === el ? h : el ? {
				el,
				kind: kindOf(el)
			} : null);
		};
		const block = (e) => {
			if (!pickTarget(e)) return;
			e.preventDefault();
			e.stopPropagation();
			e.stopImmediatePropagation();
		};
		const onClick = (e) => {
			const el = pickTarget(e);
			if (!el) return;
			block(e);
			setHover(null);
			latest.current.pick(el);
		};
		const onKey = (e) => {
			if (e.key !== "Escape") return;
			e.preventDefault();
			if (latest.current.picked) setPicked(null);
			else latest.current.onDone();
		};
		document.addEventListener("pointermove", onMove, true);
		for (const type of [
			"pointerdown",
			"mousedown",
			"mouseup",
			"pointerup",
			"submit",
			"dblclick"
		]) document.addEventListener(type, block, true);
		document.addEventListener("click", onClick, true);
		document.addEventListener("keydown", onKey, true);
		document.documentElement.style.setProperty("cursor", "crosshair");
		return () => {
			document.removeEventListener("pointermove", onMove, true);
			for (const type of [
				"pointerdown",
				"mousedown",
				"mouseup",
				"pointerup",
				"submit",
				"dblclick"
			]) document.removeEventListener(type, block, true);
			document.removeEventListener("click", onClick, true);
			document.removeEventListener("keydown", onKey, true);
			document.documentElement.style.removeProperty("cursor");
		};
	}, []);
	useEffect(() => {
		setPicked(null);
		setHover(null);
	}, [pathname]);
	const trail = useRef([]);
	const pick = (el, { stepping = false } = {}) => {
		if (!stepping) trail.current = [];
		const info = describe$1(el);
		const existing = theme.paints.find((p) => p.everywhere && info.similar && p.similar === info.similar || p.page === pathname && (p.one === info.one || p.all && p.similar === info.similar));
		setPicked({
			...info,
			paint: existing ?? {
				id: newId(),
				page: pathname,
				one: info.one,
				similar: info.similar,
				likeIt: info.likeIt,
				all: false,
				kind: info.kind,
				text: info.text,
				where: info.where,
				hasBorder: info.hasBorder,
				props: {}
			}
		});
	};
	latest.current = {
		pick,
		picked,
		onDone
	};
	return /* @__PURE__ */ jsxs("div", {
		className: "theme-switcher",
		children: [
			/* @__PURE__ */ jsx(Outline, {
				rect: hoverRect,
				label: hover?.kind
			}),
			/* @__PURE__ */ jsx(Outline, {
				rect: pickedRect,
				label: picked?.kind,
				solid: true
			}),
			/* @__PURE__ */ jsx("div", {
				className: "pointer-events-none fixed inset-x-0 bottom-4 z-[70] flex justify-center px-3",
				children: /* @__PURE__ */ jsxs("div", {
					className: "pointer-events-auto flex max-w-full items-center gap-3 rounded-full border border-zinc-200 bg-white py-1.5 pr-1.5 pl-4 text-xs text-zinc-800 shadow-xl",
					role: "status",
					children: [/* @__PURE__ */ jsxs("span", {
						className: "min-w-0",
						children: [
							/* @__PURE__ */ jsx("strong", {
								className: "font-semibold text-zinc-900",
								children: "Studio:"
							}),
							" ",
							coarse ? "tap" : "click",
							" any part of the page to colour it"
						]
					}), /* @__PURE__ */ jsx("button", {
						type: "button",
						onClick: onDone,
						className: "shrink-0 rounded-full bg-zinc-900 px-3 py-1 text-xs font-semibold text-white cursor-pointer hover:bg-zinc-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2",
						children: "Done"
					})]
				})
			}),
			picked && pickedRect && /* @__PURE__ */ jsx(Editor, {
				picked,
				rect: pickedRect,
				canPickParent: Boolean(parentOf(picked.el)),
				onPickParent: () => {
					const parent = parentOf(picked.el);
					if (!parent) return;
					trail.current.push(picked.el);
					pick(parent, { stepping: true });
				},
				canPickChild: Boolean(childOf(picked.el)),
				onPickChild: () => {
					const back = trail.current.pop();
					const inner = back && back.isConnected && picked.el.contains(back) ? back : childOf(picked.el);
					if (inner) pick(inner, { stepping: true });
				},
				onClose: () => setPicked(null)
			}, picked.paint.id)
		]
	});
}
/** Where the card goes: beside the part if there's room, else below or above it, on screen. */
function place(rect, height) {
	const vw = window.innerWidth;
	const vh = window.innerHeight;
	const width = Math.min(CARD_WIDTH, vw - 24);
	if (vw >= 700) {
		const right = rect.right + GAP;
		const left = rect.left - GAP - width;
		const x = right + width <= vw - EDGE$1 ? right : left >= EDGE$1 ? left : null;
		if (x !== null) return {
			left: x,
			top: Math.min(Math.max(EDGE$1, rect.top), vh - height - EDGE$1),
			width
		};
	}
	const x = Math.min(Math.max(EDGE$1, rect.left), vw - width - EDGE$1);
	const below = rect.bottom + GAP;
	const top = below + height <= vh - EDGE$1 ? below : rect.top - GAP - height >= EDGE$1 ? rect.top - GAP - height : vh - height - EDGE$1;
	return {
		left: x,
		top: Math.max(EDGE$1, top),
		width
	};
}
function Editor({ picked, rect, onPickParent, canPickParent, onPickChild, canPickChild, onClose }) {
	const { tokens, savePaint, removePaint, paints, inScope } = useTheme();
	const [paint, setPaint] = useState(picked.paint);
	const [height, setHeight] = useState(320);
	const [check, setCheck] = useState(null);
	const [fixTried, setFixTried] = useState(false);
	const cardRef = useRef(null);
	const headingId = useId();
	const saved = paints.some((p) => p.id === paint.id);
	useLayoutEffect(() => {
		if (cardRef.current) setHeight(cardRef.current.offsetHeight);
	});
	useEffect(() => cardRef.current?.querySelector("button")?.focus({ preventScroll: true }), []);
	const roots = () => {
		if (!paint.all || !paint.similar) return [picked.el];
		try {
			return [...document.querySelectorAll(selectorOf(paint))];
		} catch {
			return [picked.el];
		}
	};
	useEffect(() => {
		const measure = () => {
			if (!picked.el.isConnected) return setCheck(null);
			const result = checkText(roots());
			setCheck(result.checked ? result : null);
		};
		const frame = requestAnimationFrame(measure);
		const settled = setTimeout(measure, 450);
		picked.el.addEventListener("transitionend", measure);
		return () => {
			cancelAnimationFrame(frame);
			clearTimeout(settled);
			picked.el.removeEventListener("transitionend", measure);
		};
	}, [
		paint,
		tokens,
		picked.el
	]);
	const update = (next) => {
		setPaint(next);
		savePaint(next);
	};
	const setColour = (key, value, fromFix = false) => {
		setFixTried(fromFix);
		const props = { ...paint.props };
		if (value) props[key] = value;
		else delete props[key];
		update({
			...paint,
			props
		});
	};
	const fixText = () => {
		const failing = check?.failing ?? [];
		if (!failing.length) return;
		const need = Math.max(...failing.map((f) => f.need));
		const backgrounds = [...new Set(failing.map((f) => f.background))];
		const score = (hex) => Math.min(...backgrounds.map((bg) => contrastRatio(hex, bg)));
		const themeBest = backgrounds.map((bg) => bestText(bg, tokens, need)).filter((c) => c.token).sort((a, b) => score(b.hex) - score(a.hex))[0];
		const fallback = score("#000000") >= score("#ffffff") ? { hex: "#000000" } : { hex: "#ffffff" };
		const choice = themeBest && score(themeBest.hex) >= need ? {
			token: themeBest.token,
			hex: themeBest.hex
		} : fallback;
		setColour("text", choice, true);
	};
	const main = check?.worst ?? null;
	const pos = place(rect, height);
	const swatches = [...new Map(SWATCH_TOKENS.map((t) => [tokens[t], t])).entries()].map(([hex, token]) => ({
		hex,
		token
	}));
	return /* @__PURE__ */ jsxs("div", {
		ref: cardRef,
		role: "dialog",
		"aria-labelledby": headingId,
		className: "theme-scroll fixed z-[70] overflow-y-auto overscroll-contain rounded-2xl border border-zinc-200 bg-white p-3 text-zinc-900 shadow-2xl",
		style: {
			left: pos.left,
			top: pos.top,
			width: pos.width,
			maxHeight: `calc(100vh - 24px)`
		},
		children: [
			/* @__PURE__ */ jsxs("div", {
				className: "flex items-start gap-2",
				children: [/* @__PURE__ */ jsxs("div", {
					className: "min-w-0 flex-1",
					children: [/* @__PURE__ */ jsxs("p", {
						id: headingId,
						className: "text-sm font-semibold",
						children: [picked.kind, picked.text && /* @__PURE__ */ jsxs("span", {
							className: "font-normal text-zinc-600",
							children: [
								" “",
								picked.text,
								"”"
							]
						})]
					}), picked.where && /* @__PURE__ */ jsx("p", {
						className: "text-[11px] text-zinc-600",
						children: picked.where[0].toUpperCase() + picked.where.slice(1)
					})]
				}), /* @__PURE__ */ jsx("button", {
					type: "button",
					onClick: onClose,
					"aria-label": "Close",
					className: "grid h-7 w-7 shrink-0 place-items-center rounded-lg text-zinc-600 cursor-pointer hover:bg-zinc-100 hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900",
					children: /* @__PURE__ */ jsx(X, {
						className: "w-4 h-4",
						"aria-hidden": "true"
					})
				})]
			}),
			/* @__PURE__ */ jsxs("div", {
				className: "mt-2 flex flex-wrap gap-1.5",
				children: [/* @__PURE__ */ jsxs("button", {
					type: "button",
					onClick: onPickParent,
					disabled: !canPickParent,
					className: stepButton,
					children: [/* @__PURE__ */ jsx(ArrowUpLeft, {
						className: "w-3.5 h-3.5",
						"aria-hidden": "true"
					}), " The part around it"]
				}), /* @__PURE__ */ jsxs("button", {
					type: "button",
					onClick: onPickChild,
					disabled: !canPickChild,
					className: stepButton,
					children: [/* @__PURE__ */ jsx(ArrowDownRight, {
						className: "w-3.5 h-3.5",
						"aria-hidden": "true"
					}), " The part inside it"]
				})]
			}),
			!canPickChild && picked.text && /* @__PURE__ */ jsxs("p", {
				className: "mt-1.5 text-[11px] text-zinc-600",
				children: [
					"This is the text itself. To colour its words, use ",
					/* @__PURE__ */ jsx("strong", {
						className: "font-semibold text-zinc-800",
						children: "Text colour"
					}),
					" below."
				]
			}),
			paint.similar && /* @__PURE__ */ jsx("div", {
				role: "radiogroup",
				"aria-label": "Which ones",
				className: "mt-2.5 grid grid-cols-3 gap-1 rounded-lg bg-zinc-100 p-1",
				children: [
					[
						"one",
						"Just this one",
						{
							all: false,
							everywhere: false
						}
					],
					[
						"all",
						`All ${paint.likeIt} here`,
						{
							all: true,
							everywhere: false
						}
					],
					[
						"everywhere",
						"On every page",
						{
							all: true,
							everywhere: true
						}
					]
				].map(([id, label, change]) => {
					const on = (paint.everywhere ? "everywhere" : paint.all ? "all" : "one") === id;
					return /* @__PURE__ */ jsx("button", {
						type: "button",
						role: "radio",
						"aria-checked": on,
						onClick: () => update({
							...paint,
							...change
						}),
						"data-tip": id === "everywhere" ? `Every ${picked.kind.toLowerCase()} like it, on every page of your site` : void 0,
						className: `rounded-md px-1.5 py-1 text-[11px] leading-tight font-semibold cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 ${on ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-600 hover:text-zinc-900"}`,
						children: label
					}, id);
				})
			}),
			paint.everywhere && /* @__PURE__ */ jsxs("p", {
				className: "mt-1.5 text-[11px] leading-snug text-zinc-600",
				children: [
					"Studio will colour every ",
					picked.kind.toLowerCase(),
					" like this on every page of your site, as you open them."
				]
			}),
			check && /* @__PURE__ */ jsx(Readability, {
				check,
				onFix: fixText,
				fixed: fixTried
			}),
			/* @__PURE__ */ jsx("div", {
				className: "mt-3 space-y-2.5",
				children: PROPS.map(({ key, label }) => /* @__PURE__ */ jsx(ColourRow, {
					label: key === "text" ? "Text colour" : label,
					hint: key === "border" && !paint.hasBorder ? "adds an outline" : key === "background" ? "behind it" : key === "text" ? "its words" : null,
					value: paint.props[key],
					swatches,
					onChange: (v) => setColour(key, v),
					inScope,
					readsOn: main && key === "background" ? (hex) => ({
						ratio: contrastRatio(main.text, hex),
						need: main.need
					}) : main && key === "text" ? (hex) => ({
						ratio: contrastRatio(hex, main.background),
						need: main.need
					}) : null
				}, key))
			}),
			/* @__PURE__ */ jsxs("div", {
				className: "mt-3 flex gap-2",
				children: [saved && /* @__PURE__ */ jsxs("button", {
					type: "button",
					onClick: () => {
						removePaint(paint.id);
						onClose();
					},
					className: "inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-zinc-300 px-2.5 py-1.5 text-xs font-medium text-zinc-800 cursor-pointer hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900",
					children: [/* @__PURE__ */ jsx(Trash2, {
						className: "w-3.5 h-3.5",
						"aria-hidden": "true"
					}), " Undo these"]
				}), /* @__PURE__ */ jsxs("button", {
					type: "button",
					onClick: onClose,
					className: "inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-zinc-900 px-2.5 py-1.5 text-xs font-medium text-white cursor-pointer hover:bg-zinc-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2",
					children: [/* @__PURE__ */ jsx(Check, {
						className: "w-3.5 h-3.5",
						"aria-hidden": "true"
					}), " Done"]
				})]
			})
		]
	});
}
/**
* How readable the part's text is, shown as soon as it's picked: all good, or how many pieces are
* hard to read, with Fix. Text that still fails after a fix sits on a background of its own.
*/
function Readability({ check, onFix, fixed }) {
	const { checked, failing, worst } = check;
	const ok = !failing.length;
	const pieces = (n) => n === 1 ? "piece" : "pieces";
	return /* @__PURE__ */ jsxs("div", {
		role: "status",
		className: `mt-2.5 rounded-lg p-2.5 text-[11px] leading-snug ${ok ? "bg-emerald-50 text-emerald-900" : "bg-amber-50 text-amber-900"}`,
		children: [/* @__PURE__ */ jsxs("div", {
			className: "flex items-start justify-between gap-2",
			children: [/* @__PURE__ */ jsx("p", { children: ok ? /* @__PURE__ */ jsxs(Fragment, { children: [
				/* @__PURE__ */ jsx("strong", {
					className: "font-semibold",
					children: "Easy to read."
				}),
				" ",
				checked === 1 ? "Its text" : `All ${checked} ${pieces(checked)} of text`,
				" ",
				checked === 1 ? "reads" : "read",
				" well",
				worst && ` (${checked === 1 ? "" : "lowest "}${formatRatio(worst.ratio)})`,
				"."
			] }) : /* @__PURE__ */ jsxs(Fragment, { children: [
				/* @__PURE__ */ jsx("strong", {
					className: "font-semibold",
					children: "Hard to read."
				}),
				" ",
				failing.length === checked ? checked === 1 ? "Its text" : `All ${checked} ${pieces(checked)} of text` : `${failing.length} of ${checked} ${pieces(checked)} of text`,
				" ",
				failing.length === 1 && checked === 1 ? "is" : "are",
				" too faint on ",
				failing.length === 1 ? "its" : "their",
				" background (",
				formatRatio(worst.ratio),
				", needs ",
				formatRatio(worst.need),
				")."
			] }) }), !ok && /* @__PURE__ */ jsx("button", {
				type: "button",
				onClick: onFix,
				className: "shrink-0 rounded-md bg-amber-900 px-2 py-1 font-semibold text-amber-50 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-900 focus-visible:ring-offset-1",
				children: "Fix"
			})]
		}), !ok && fixed && /* @__PURE__ */ jsx("p", {
			className: "mt-1",
			children: "Some of it sits on a background of its own. Click that text to change it on its own."
		})]
	});
}
/** One colour: the theme's swatches, any colour, or none (the part's own). */
function ColourRow({ label, hint, value, swatches, onChange, inScope, readsOn }) {
	const id = useId();
	const current = value ? value.token && inScope ? swatches.find((s) => s.token === value.token)?.hex ?? value.hex : value.hex : null;
	return /* @__PURE__ */ jsxs("div", {
		role: "group",
		"aria-labelledby": id,
		children: [/* @__PURE__ */ jsxs("div", {
			className: "mb-1 flex items-center justify-between",
			children: [/* @__PURE__ */ jsxs("span", {
				id,
				className: "text-[11px] font-semibold text-zinc-700",
				children: [label, hint && /* @__PURE__ */ jsxs("span", {
					className: "ml-1 font-normal text-zinc-500",
					children: ["· ", hint]
				})]
			}), value && /* @__PURE__ */ jsx("button", {
				type: "button",
				onClick: () => onChange(null),
				className: "text-[11px] font-medium text-zinc-600 underline underline-offset-2 cursor-pointer hover:text-zinc-900",
				children: "Its own"
			})]
		}), /* @__PURE__ */ jsxs("div", {
			className: "flex flex-wrap items-center gap-1",
			children: [swatches.map((s) => {
				const on = value?.token === s.token;
				const name = TOKEN_LABELS[s.token] ?? s.token;
				const reads = readsOn?.(s.hex);
				const poor = reads && reads.ratio < reads.need;
				return /* @__PURE__ */ jsx("button", {
					type: "button",
					"aria-pressed": on,
					"aria-label": `${name} (${s.hex})${poor ? ", hard to read here" : ""}`,
					"data-tip": `${name} · ${s.hex}${reads ? poor ? ` · hard to read here (${formatRatio(reads.ratio)})` : ` · reads well (${formatRatio(reads.ratio)})` : ""}`,
					onClick: () => onChange({
						token: s.token,
						hex: s.hex
					}),
					className: `relative h-6 w-6 rounded-md border cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-1 ${on ? "border-zinc-900 ring-2 ring-zinc-900 ring-offset-1" : "border-black/15"}`,
					style: { background: s.hex },
					children: poor && /* @__PURE__ */ jsx("span", {
						"aria-hidden": "true",
						className: "absolute -top-1 -right-1 grid h-3 w-3 place-items-center rounded-full border border-white bg-amber-500 text-[8px] leading-none font-bold text-white",
						children: "!"
					})
				}, s.token);
			}), /* @__PURE__ */ jsxs("label", {
				className: `relative grid h-6 w-6 place-items-center overflow-hidden rounded-md border cursor-pointer ${value && !value.token ? "border-zinc-900 ring-2 ring-zinc-900 ring-offset-1" : "border-zinc-300"}`,
				style: { background: value && !value.token ? value.hex : "conic-gradient(#f43f5e, #f59e0b, #10b981, #0ea5e9, #6366f1, #d946ef, #f43f5e)" },
				"data-tip": "Any colour",
				children: [/* @__PURE__ */ jsxs("span", {
					className: "sr-only",
					children: ["Any colour for the ", label.toLowerCase()]
				}), /* @__PURE__ */ jsx("input", {
					type: "color",
					value: current ?? "#6366f1",
					onChange: (e) => onChange({ hex: e.target.value }),
					className: "absolute inset-0 h-full w-full cursor-pointer opacity-0"
				})]
			})]
		})]
	});
}
//#endregion
//#region src/panel-css.generated.js
var panel_css_generated_default = "/*! tailwindcss v4.3.3 | MIT License | https://tailwindcss.com */\n@layer properties{@supports (display:block){*,:before,:after,::backdrop{--tw-translate-x:0;--tw-translate-y:0;--tw-translate-z:0;--tw-scale-x:1;--tw-scale-y:1;--tw-scale-z:1;--tw-space-y-reverse:0;--tw-space-x-reverse:0;--tw-border-style:solid;--tw-leading:initial;--tw-font-weight:initial;--tw-tracking:initial;--tw-ordinal:initial;--tw-slashed-zero:initial;--tw-numeric-figure:initial;--tw-numeric-spacing:initial;--tw-numeric-fraction:initial;--tw-shadow:0 0 #0000;--tw-shadow-color:initial;--tw-shadow-alpha:100%;--tw-inset-shadow:0 0 #0000;--tw-inset-shadow-color:initial;--tw-inset-shadow-alpha:100%;--tw-ring-color:initial;--tw-ring-shadow:0 0 #0000;--tw-inset-ring-color:initial;--tw-inset-ring-shadow:0 0 #0000;--tw-ring-inset:initial;--tw-ring-offset-width:0px;--tw-ring-offset-color:#fff;--tw-ring-offset-shadow:0 0 #0000;--tw-outline-style:solid;--tw-blur:initial;--tw-brightness:initial;--tw-contrast:initial;--tw-grayscale:initial;--tw-hue-rotate:initial;--tw-invert:initial;--tw-opacity:initial;--tw-saturate:initial;--tw-sepia:initial;--tw-drop-shadow:initial;--tw-drop-shadow-color:initial;--tw-drop-shadow-alpha:100%;--tw-drop-shadow-size:initial;--tw-backdrop-blur:initial;--tw-backdrop-brightness:initial;--tw-backdrop-contrast:initial;--tw-backdrop-grayscale:initial;--tw-backdrop-hue-rotate:initial;--tw-backdrop-invert:initial;--tw-backdrop-opacity:initial;--tw-backdrop-saturate:initial;--tw-backdrop-sepia:initial;--tw-duration:initial;--tw-ease:initial}}}@layer theme{:root,:host{--font-sans:-apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, \"Helvetica Neue\", \"Noto Sans\", Arial, sans-serif, \"Apple Color Emoji\", \"Segoe UI Emoji\", \"Segoe UI Symbol\", \"Noto Color Emoji\";--font-mono:ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, \"Liberation Mono\", \"Courier New\", monospace;--color-red-600:oklch(57.7% .245 27.325);--color-red-700:oklch(50.5% .213 27.518);--color-amber-50:oklch(98.7% .022 95.277);--color-amber-100:oklch(96.2% .059 95.617);--color-amber-200:oklch(92.4% .12 95.746);--color-amber-300:oklch(87.9% .169 91.605);--color-amber-400:oklch(82.8% .189 84.429);--color-amber-500:oklch(76.9% .188 70.08);--color-amber-700:oklch(55.5% .163 48.998);--color-amber-800:oklch(47.3% .137 46.201);--color-amber-900:oklch(41.4% .112 45.904);--color-amber-950:oklch(27.9% .077 45.635);--color-emerald-50:oklch(97.9% .021 166.113);--color-emerald-800:oklch(43.2% .095 166.913);--color-emerald-900:oklch(37.8% .077 168.94);--color-sky-50:oklch(97.7% .013 236.62);--color-sky-100:oklch(95.1% .026 236.824);--color-sky-900:oklch(39.1% .09 240.876);--color-zinc-50:oklch(98.5% 0 none);--color-zinc-100:oklch(96.7% .001 286.375);--color-zinc-200:oklch(92% .004 286.32);--color-zinc-300:oklch(87.1% .006 286.286);--color-zinc-400:oklch(70.5% .015 286.067);--color-zinc-500:oklch(55.2% .016 285.938);--color-zinc-600:oklch(44.2% .017 285.786);--color-zinc-700:oklch(37% .013 285.805);--color-zinc-800:oklch(27.4% .006 286.033);--color-zinc-900:oklch(21% .006 285.885);--color-black:#000;--color-white:#fff;--spacing:4px;--text-xs:12px;--text-xs--line-height:calc(1 / .75);--text-sm:14px;--text-sm--line-height:calc(1.25 / .875);--text-base:16px;--text-base--line-height:calc(1.5 / 1);--font-weight-normal:400;--font-weight-medium:500;--font-weight-semibold:600;--font-weight-bold:700;--tracking-tight:-.025em;--tracking-wide:.025em;--leading-tight:1.25;--leading-snug:1.375;--radius-md:6px;--radius-lg:8px;--radius-xl:12px;--radius-2xl:16px;--ease-in-out:cubic-bezier(.4, 0, .2, 1);--animate-spin:spin 1s linear infinite;--default-transition-duration:.15s;--default-transition-timing-function:cubic-bezier(.4, 0, .2, 1);--default-font-family:var(--font-sans);--default-mono-font-family:var(--font-mono)}}@layer base{*,:after,:before,::backdrop{box-sizing:border-box;border:0 solid;margin:0;padding:0}::file-selector-button{box-sizing:border-box;border:0 solid;margin:0;padding:0}html,:host{-webkit-text-size-adjust:100%;tab-size:4;line-height:1.5;font-family:var(--default-font-family,-apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, \"Helvetica Neue\", \"Noto Sans\", Arial, sans-serif, \"Apple Color Emoji\", \"Segoe UI Emoji\", \"Segoe UI Symbol\", \"Noto Color Emoji\");font-feature-settings:var(--default-font-feature-settings,normal);font-variation-settings:var(--default-font-variation-settings,normal);-webkit-tap-highlight-color:transparent}hr{height:0;color:inherit;border-top-width:1px}abbr:where([title]){-webkit-text-decoration:underline dotted;text-decoration:underline dotted}h1,h2,h3,h4,h5,h6{font-size:inherit;font-weight:inherit}a{color:inherit;-webkit-text-decoration:inherit;-webkit-text-decoration:inherit;-webkit-text-decoration:inherit;text-decoration:inherit}b,strong{font-weight:bolder}code,kbd,samp,pre{font-family:var(--default-mono-font-family,ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, \"Liberation Mono\", \"Courier New\", monospace);font-feature-settings:var(--default-mono-font-feature-settings,normal);font-variation-settings:var(--default-mono-font-variation-settings,normal);font-size:1em}small{font-size:80%}sub,sup{vertical-align:baseline;font-size:75%;line-height:0;position:relative}sub{bottom:-.25em}sup{top:-.5em}table{text-indent:0;border-color:inherit;border-collapse:collapse}:-moz-focusring:where(:not(iframe)){outline:auto}progress{vertical-align:baseline}summary{display:list-item}ol,ul,menu{list-style:none}img,svg,video,canvas,audio,iframe,embed,object{vertical-align:middle;display:block}img,video{max-width:100%;height:auto}button,input,select,optgroup,textarea{font:inherit;font-feature-settings:inherit;font-variation-settings:inherit;letter-spacing:inherit;color:inherit;opacity:1;background-color:#0000;border-radius:0}::file-selector-button{font:inherit;font-feature-settings:inherit;font-variation-settings:inherit;letter-spacing:inherit;color:inherit;opacity:1;background-color:#0000;border-radius:0}:where(select:is([multiple],[size])) optgroup{font-weight:bolder}:where(select:is([multiple],[size])) optgroup option{padding-inline-start:20px}::file-selector-button{margin-inline-end:4px}::placeholder{opacity:1}@supports (not ((-webkit-appearance:-apple-pay-button))) or (contain-intrinsic-size:1px){::placeholder{color:currentColor}@supports (color:color-mix(in lab, red, red)){::placeholder{color:color-mix(in oklab, currentcolor 50%, transparent)}}}textarea{resize:vertical}::-webkit-search-decoration{-webkit-appearance:none}::-webkit-date-and-time-value{min-height:1lh;text-align:inherit}::-webkit-datetime-edit{display:inline-flex}::-webkit-datetime-edit-fields-wrapper{padding:0}::-webkit-datetime-edit{padding-block:0}::-webkit-datetime-edit-year-field{padding-block:0}::-webkit-datetime-edit-month-field{padding-block:0}::-webkit-datetime-edit-day-field{padding-block:0}::-webkit-datetime-edit-hour-field{padding-block:0}::-webkit-datetime-edit-minute-field{padding-block:0}::-webkit-datetime-edit-second-field{padding-block:0}::-webkit-datetime-edit-millisecond-field{padding-block:0}::-webkit-datetime-edit-meridiem-field{padding-block:0}::-webkit-calendar-picker-indicator{line-height:1}:-moz-ui-invalid{box-shadow:none}button,input:where([type=button],[type=reset],[type=submit]){appearance:button}::file-selector-button{appearance:button}::-webkit-inner-spin-button{height:auto}::-webkit-outer-spin-button{height:auto}[hidden]:where(:not([hidden=until-found])){display:none!important}.theme-switcher{letter-spacing:normal;color:var(--color-zinc-900);font-family:Inter,ui-sans-serif,system-ui,sans-serif;font-size:16px;line-height:1.5}}@layer components;@layer utilities{.\\@container{container-type:inline-size}.pointer-events-auto{pointer-events:auto}.pointer-events-none{pointer-events:none}.invisible{visibility:hidden}.visible{visibility:visible}.sr-only{clip-path:inset(50%);white-space:nowrap;border-width:0;width:1px;height:1px;margin:-1px;padding:0;position:absolute;overflow:hidden}.absolute{position:absolute}.fixed{position:fixed}.relative{position:relative}.sticky{position:sticky}.inset-0{inset:0}.inset-x-0{inset-inline:0}.inset-x-3{inset-inline:calc(var(--spacing) * 3)}.inset-x-5{inset-inline:calc(var(--spacing) * 5)}.inset-y-5{inset-block:calc(var(--spacing) * 5)}.-top-1{top:calc(var(--spacing) * -1)}.-top-2{top:calc(var(--spacing) * -2)}.-top-\\[6px\\]{top:-6px}.top-0{top:0}.top-1\\.5{top:calc(var(--spacing) * 1.5)}.top-1\\/2{top:50%}.top-5{top:calc(var(--spacing) * 5)}.top-\\[84px\\]{top:84px}.-right-0\\.5{right:calc(var(--spacing) * -.5)}.-right-1{right:calc(var(--spacing) * -1)}.-right-2{right:calc(var(--spacing) * -2)}.right-0{right:0}.right-1\\.5{right:calc(var(--spacing) * 1.5)}.right-2{right:calc(var(--spacing) * 2)}.right-5{right:calc(var(--spacing) * 5)}.right-6{right:calc(var(--spacing) * 6)}.right-full{right:100%}.-bottom-0\\.5{bottom:calc(var(--spacing) * -.5)}.-bottom-2{bottom:calc(var(--spacing) * -2)}.-bottom-\\[6px\\]{bottom:-6px}.bottom-2{bottom:calc(var(--spacing) * 2)}.bottom-3{bottom:calc(var(--spacing) * 3)}.bottom-4{bottom:calc(var(--spacing) * 4)}.bottom-5{bottom:calc(var(--spacing) * 5)}.-left-1{left:calc(var(--spacing) * -1)}.-left-2{left:calc(var(--spacing) * -2)}.left-0{left:0}.left-5{left:calc(var(--spacing) * 5)}.left-full{left:100%}.z-10{z-index:10}.z-20{z-index:20}.z-30{z-index:30}.z-\\[55\\]{z-index:55}.z-\\[56\\]{z-index:56}.z-\\[57\\]{z-index:57}.z-\\[60\\]{z-index:60}.z-\\[61\\]{z-index:61}.z-\\[62\\]{z-index:62}.z-\\[65\\]{z-index:65}.z-\\[70\\]{z-index:70}.container{width:100%}@media (min-width:640px){.container{max-width:640px}}@media (min-width:768px){.container{max-width:768px}}@media (min-width:1024px){.container{max-width:1024px}}@media (min-width:1280px){.container{max-width:1280px}}@media (min-width:1536px){.container{max-width:1536px}}.mx-4{margin-inline:calc(var(--spacing) * 4)}.-mt-1{margin-top:calc(var(--spacing) * -1)}.mt-0\\.5{margin-top:calc(var(--spacing) * .5)}.mt-1{margin-top:var(--spacing)}.mt-1\\.5{margin-top:calc(var(--spacing) * 1.5)}.mt-2{margin-top:calc(var(--spacing) * 2)}.mt-2\\.5{margin-top:calc(var(--spacing) * 2.5)}.mt-3{margin-top:calc(var(--spacing) * 3)}.mt-px{margin-top:1px}.-mr-1{margin-right:calc(var(--spacing) * -1)}.mr-2{margin-right:calc(var(--spacing) * 2)}.mb-1{margin-bottom:var(--spacing)}.mb-2\\.5{margin-bottom:calc(var(--spacing) * 2.5)}.ml-1{margin-left:var(--spacing)}.ml-1\\.5{margin-left:calc(var(--spacing) * 1.5)}.ml-2{margin-left:calc(var(--spacing) * 2)}.ml-auto{margin-left:auto}.block{display:block}.flex{display:flex}.grid{display:grid}.hidden{display:none}.inline-flex{display:inline-flex}.h-2\\.5{height:calc(var(--spacing) * 2.5)}.h-3{height:calc(var(--spacing) * 3)}.h-3\\.5{height:calc(var(--spacing) * 3.5)}.h-4{height:calc(var(--spacing) * 4)}.h-5{height:calc(var(--spacing) * 5)}.h-6{height:calc(var(--spacing) * 6)}.h-7{height:calc(var(--spacing) * 7)}.h-8{height:calc(var(--spacing) * 8)}.h-9{height:calc(var(--spacing) * 9)}.h-16{height:calc(var(--spacing) * 16)}.h-full{height:100%}.max-h-40{max-height:calc(var(--spacing) * 40)}.min-h-0{min-height:0}.min-h-12{min-height:calc(var(--spacing) * 12)}.w-2\\.5{width:calc(var(--spacing) * 2.5)}.w-3{width:calc(var(--spacing) * 3)}.w-3\\.5{width:calc(var(--spacing) * 3.5)}.w-4{width:calc(var(--spacing) * 4)}.w-5{width:calc(var(--spacing) * 5)}.w-6{width:calc(var(--spacing) * 6)}.w-7{width:calc(var(--spacing) * 7)}.w-8{width:calc(var(--spacing) * 8)}.w-9{width:calc(var(--spacing) * 9)}.w-16{width:calc(var(--spacing) * 16)}.w-24{width:calc(var(--spacing) * 24)}.w-\\[5\\.5rem\\]{width:88px}.w-auto{width:auto}.w-full{width:100%}.max-w-\\[50\\%\\]{max-width:50%}.max-w-\\[240px\\]{max-width:240px}.max-w-\\[320px\\]{max-width:320px}.max-w-\\[calc\\(100vw-80px\\)\\]{max-width:calc(100vw - 80px)}.max-w-full{max-width:100%}.min-w-0{min-width:0}.min-w-\\[1\\.25rem\\]{min-width:20px}.flex-1{flex:1}.shrink-0{flex-shrink:0}.-translate-y-1\\/2{--tw-translate-y:calc(calc(1 / 2 * 100%) * -1);translate:var(--tw-translate-x) var(--tw-translate-y)}.scale-110{--tw-scale-x:110%;--tw-scale-y:110%;--tw-scale-z:110%;scale:var(--tw-scale-x) var(--tw-scale-y)}.rotate-45{rotate:45deg}.rotate-90{rotate:90deg}.animate-spin{animation:var(--animate-spin)}.cursor-ew-resize{cursor:ew-resize}.cursor-grabbing{cursor:grabbing}.cursor-nesw-resize{cursor:nesw-resize}.cursor-ns-resize{cursor:ns-resize}.cursor-nwse-resize{cursor:nwse-resize}.cursor-pointer{cursor:pointer}.touch-none{touch-action:none}.resize{resize:both}.scroll-mt-3{scroll-margin-top:calc(var(--spacing) * 3)}.list-decimal{list-style-type:decimal}.list-disc{list-style-type:disc}.grid-cols-2{grid-template-columns:repeat(2,minmax(0,1fr))}.grid-cols-3{grid-template-columns:repeat(3,minmax(0,1fr))}.flex-col{flex-direction:column}.flex-wrap{flex-wrap:wrap}.place-items-center{place-items:center}.items-center{align-items:center}.items-start{align-items:flex-start}.justify-between{justify-content:space-between}.justify-center{justify-content:center}.gap-0\\.5{gap:calc(var(--spacing) * .5)}.gap-1{gap:var(--spacing)}.gap-1\\.5{gap:calc(var(--spacing) * 1.5)}.gap-2{gap:calc(var(--spacing) * 2)}.gap-2\\.5{gap:calc(var(--spacing) * 2.5)}.gap-3{gap:calc(var(--spacing) * 3)}:where(.space-y-0\\.5>:not(:last-child)){--tw-space-y-reverse:0;margin-block-start:calc(calc(var(--spacing) * .5) * var(--tw-space-y-reverse));margin-block-end:calc(calc(var(--spacing) * .5) * calc(1 - var(--tw-space-y-reverse)))}:where(.space-y-1>:not(:last-child)){--tw-space-y-reverse:0;margin-block-start:calc(var(--spacing) * var(--tw-space-y-reverse));margin-block-end:calc(var(--spacing) * calc(1 - var(--tw-space-y-reverse)))}:where(.space-y-1\\.5>:not(:last-child)){--tw-space-y-reverse:0;margin-block-start:calc(calc(var(--spacing) * 1.5) * var(--tw-space-y-reverse));margin-block-end:calc(calc(var(--spacing) * 1.5) * calc(1 - var(--tw-space-y-reverse)))}:where(.space-y-2>:not(:last-child)){--tw-space-y-reverse:0;margin-block-start:calc(calc(var(--spacing) * 2) * var(--tw-space-y-reverse));margin-block-end:calc(calc(var(--spacing) * 2) * calc(1 - var(--tw-space-y-reverse)))}:where(.space-y-2\\.5>:not(:last-child)){--tw-space-y-reverse:0;margin-block-start:calc(calc(var(--spacing) * 2.5) * var(--tw-space-y-reverse));margin-block-end:calc(calc(var(--spacing) * 2.5) * calc(1 - var(--tw-space-y-reverse)))}:where(.space-y-3>:not(:last-child)){--tw-space-y-reverse:0;margin-block-start:calc(calc(var(--spacing) * 3) * var(--tw-space-y-reverse));margin-block-end:calc(calc(var(--spacing) * 3) * calc(1 - var(--tw-space-y-reverse)))}:where(.space-y-4>:not(:last-child)){--tw-space-y-reverse:0;margin-block-start:calc(calc(var(--spacing) * 4) * var(--tw-space-y-reverse));margin-block-end:calc(calc(var(--spacing) * 4) * calc(1 - var(--tw-space-y-reverse)))}.gap-x-3{column-gap:calc(var(--spacing) * 3)}:where(.-space-x-1>:not(:last-child)){--tw-space-x-reverse:0;margin-inline-start:calc(calc(var(--spacing) * -1) * var(--tw-space-x-reverse));margin-inline-end:calc(calc(var(--spacing) * -1) * calc(1 - var(--tw-space-x-reverse)))}.gap-y-3\\.5{row-gap:calc(var(--spacing) * 3.5)}.truncate{text-overflow:ellipsis;white-space:nowrap;overflow:hidden}.overflow-auto{overflow:auto}.overflow-hidden{overflow:hidden}.overflow-y-auto{overflow-y:auto}.overscroll-contain{overscroll-behavior:contain}.rounded{border-radius:4px}.rounded-2xl{border-radius:var(--radius-2xl)}.rounded-\\[inherit\\]{border-radius:inherit}.rounded-full{border-radius:3.40282e38px}.rounded-lg{border-radius:var(--radius-lg)}.rounded-md{border-radius:var(--radius-md)}.rounded-xl{border-radius:var(--radius-xl)}.border{border-style:var(--tw-border-style);border-width:1px}.border-2{border-style:var(--tw-border-style);border-width:2px}.border-t{border-top-style:var(--tw-border-style);border-top-width:1px}.border-r{border-right-style:var(--tw-border-style);border-right-width:1px}.border-b{border-bottom-style:var(--tw-border-style);border-bottom-width:1px}.border-l{border-left-style:var(--tw-border-style);border-left-width:1px}.border-dashed{--tw-border-style:dashed;border-style:dashed}.border-amber-200{border-color:var(--color-amber-200)}.border-amber-300{border-color:var(--color-amber-300)}.border-amber-400{border-color:var(--color-amber-400)}.border-black\\/15{border-color:#00000026}@supports (color:color-mix(in lab, red, red)){.border-black\\/15{border-color:color-mix(in oklab, var(--color-black) 15%, transparent)}}.border-red-600{border-color:var(--color-red-600)}.border-transparent{border-color:#0000}.border-white{border-color:var(--color-white)}.border-zinc-200{border-color:var(--color-zinc-200)}.border-zinc-300{border-color:var(--color-zinc-300)}.border-zinc-900{border-color:var(--color-zinc-900)}.bg-amber-50{background-color:var(--color-amber-50)}.bg-amber-100{background-color:var(--color-amber-100)}.bg-amber-400{background-color:var(--color-amber-400)}.bg-amber-500{background-color:var(--color-amber-500)}.bg-amber-900{background-color:var(--color-amber-900)}.bg-emerald-50{background-color:var(--color-emerald-50)}.bg-sky-50{background-color:var(--color-sky-50)}.bg-sky-100{background-color:var(--color-sky-100)}.bg-white{background-color:var(--color-white)}.bg-white\\/90{background-color:#ffffffe6}@supports (color:color-mix(in lab, red, red)){.bg-white\\/90{background-color:color-mix(in oklab, var(--color-white) 90%, transparent)}}.bg-zinc-50{background-color:var(--color-zinc-50)}.bg-zinc-100{background-color:var(--color-zinc-100)}.bg-zinc-900{background-color:var(--color-zinc-900)}.bg-zinc-900\\/40{background-color:#18181b66}@supports (color:color-mix(in lab, red, red)){.bg-zinc-900\\/40{background-color:color-mix(in oklab, var(--color-zinc-900) 40%, transparent)}}.object-contain{object-fit:contain}.p-0\\.5{padding:calc(var(--spacing) * .5)}.p-1{padding:var(--spacing)}.p-2{padding:calc(var(--spacing) * 2)}.p-2\\.5{padding:calc(var(--spacing) * 2.5)}.p-3{padding:calc(var(--spacing) * 3)}.p-4{padding:calc(var(--spacing) * 4)}.px-0\\.5{padding-inline:calc(var(--spacing) * .5)}.px-1{padding-inline:var(--spacing)}.px-1\\.5{padding-inline:calc(var(--spacing) * 1.5)}.px-2{padding-inline:calc(var(--spacing) * 2)}.px-2\\.5{padding-inline:calc(var(--spacing) * 2.5)}.px-3{padding-inline:calc(var(--spacing) * 3)}.px-4{padding-inline:calc(var(--spacing) * 4)}.py-0\\.5{padding-block:calc(var(--spacing) * .5)}.py-1{padding-block:var(--spacing)}.py-1\\.5{padding-block:calc(var(--spacing) * 1.5)}.py-2{padding-block:calc(var(--spacing) * 2)}.py-2\\.5{padding-block:calc(var(--spacing) * 2.5)}.py-3{padding-block:calc(var(--spacing) * 3)}.py-5{padding-block:calc(var(--spacing) * 5)}.py-6{padding-block:calc(var(--spacing) * 6)}.pt-3{padding-top:calc(var(--spacing) * 3)}.pr-1\\.5{padding-right:calc(var(--spacing) * 1.5)}.pr-12{padding-right:calc(var(--spacing) * 12)}.pb-4{padding-bottom:calc(var(--spacing) * 4)}.pl-1{padding-left:var(--spacing)}.pl-3{padding-left:calc(var(--spacing) * 3)}.pl-4{padding-left:calc(var(--spacing) * 4)}.text-center{text-align:center}.text-left{text-align:left}.font-mono{font-family:var(--font-mono)}.font-sans{font-family:var(--font-sans)}.text-base{font-size:var(--text-base);line-height:var(--tw-leading,var(--text-base--line-height))}.text-sm{font-size:var(--text-sm);line-height:var(--tw-leading,var(--text-sm--line-height))}.text-xs{font-size:var(--text-xs);line-height:var(--tw-leading,var(--text-xs--line-height))}.text-\\[8px\\]{font-size:8px}.text-\\[10px\\]{font-size:10px}.text-\\[11px\\]{font-size:11px}.leading-none{--tw-leading:1;line-height:1}.leading-snug{--tw-leading:var(--leading-snug);line-height:var(--leading-snug)}.leading-tight{--tw-leading:var(--leading-tight);line-height:var(--leading-tight)}.font-bold{--tw-font-weight:var(--font-weight-bold);font-weight:var(--font-weight-bold)}.font-medium{--tw-font-weight:var(--font-weight-medium);font-weight:var(--font-weight-medium)}.font-normal{--tw-font-weight:var(--font-weight-normal);font-weight:var(--font-weight-normal)}.font-semibold{--tw-font-weight:var(--font-weight-semibold);font-weight:var(--font-weight-semibold)}.tracking-tight{--tw-tracking:var(--tracking-tight);letter-spacing:var(--tracking-tight)}.tracking-wide{--tw-tracking:var(--tracking-wide);letter-spacing:var(--tracking-wide)}.break-words{overflow-wrap:break-word}.break-all{word-break:break-all}.whitespace-nowrap{white-space:nowrap}.whitespace-pre-line{white-space:pre-line}.whitespace-pre-wrap{white-space:pre-wrap}.text-amber-50{color:var(--color-amber-50)}.text-amber-700{color:var(--color-amber-700)}.text-amber-800{color:var(--color-amber-800)}.text-amber-900{color:var(--color-amber-900)}.text-amber-950{color:var(--color-amber-950)}.text-emerald-800{color:var(--color-emerald-800)}.text-emerald-900{color:var(--color-emerald-900)}.text-red-700{color:var(--color-red-700)}.text-sky-900{color:var(--color-sky-900)}.text-white{color:var(--color-white)}.text-white\\/80{color:#fffc}@supports (color:color-mix(in lab, red, red)){.text-white\\/80{color:color-mix(in oklab, var(--color-white) 80%, transparent)}}.text-zinc-300{color:var(--color-zinc-300)}.text-zinc-500{color:var(--color-zinc-500)}.text-zinc-600{color:var(--color-zinc-600)}.text-zinc-700{color:var(--color-zinc-700)}.text-zinc-800{color:var(--color-zinc-800)}.text-zinc-900{color:var(--color-zinc-900)}.capitalize{text-transform:capitalize}.uppercase{text-transform:uppercase}.tabular-nums{--tw-numeric-spacing:tabular-nums;font-variant-numeric:var(--tw-ordinal,) var(--tw-slashed-zero,) var(--tw-numeric-figure,) var(--tw-numeric-spacing,) var(--tw-numeric-fraction,)}.underline{text-decoration-line:underline}.underline-offset-2{text-underline-offset:2px}.accent-zinc-900{accent-color:var(--color-zinc-900)}.opacity-0{opacity:0}.opacity-25{opacity:.25}.opacity-70{opacity:.7}.shadow{--tw-shadow:0 1px 3px 0 var(--tw-shadow-color,#0000001a), 0 1px 2px -1px var(--tw-shadow-color,#0000001a);box-shadow:var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)}.shadow-2xl{--tw-shadow:0 25px 50px -12px var(--tw-shadow-color,#00000040);box-shadow:var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)}.shadow-lg{--tw-shadow:0 10px 15px -3px var(--tw-shadow-color,#0000001a), 0 4px 6px -4px var(--tw-shadow-color,#0000001a);box-shadow:var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)}.shadow-md{--tw-shadow:0 4px 6px -1px var(--tw-shadow-color,#0000001a), 0 2px 4px -2px var(--tw-shadow-color,#0000001a);box-shadow:var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)}.shadow-sm{--tw-shadow:0 1px 3px 0 var(--tw-shadow-color,#0000001a), 0 1px 2px -1px var(--tw-shadow-color,#0000001a);box-shadow:var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)}.shadow-xl{--tw-shadow:0 20px 25px -5px var(--tw-shadow-color,#0000001a), 0 8px 10px -6px var(--tw-shadow-color,#0000001a);box-shadow:var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)}.ring-1{--tw-ring-shadow:var(--tw-ring-inset,) 0 0 0 calc(1px + var(--tw-ring-offset-width)) var(--tw-ring-color,currentcolor);box-shadow:var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)}.ring-2{--tw-ring-shadow:var(--tw-ring-inset,) 0 0 0 calc(2px + var(--tw-ring-offset-width)) var(--tw-ring-color,currentcolor);box-shadow:var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)}.ring-white{--tw-ring-color:var(--color-white)}.ring-zinc-900{--tw-ring-color:var(--color-zinc-900)}.ring-offset-1{--tw-ring-offset-width:1px;--tw-ring-offset-shadow:var(--tw-ring-inset,) 0 0 0 var(--tw-ring-offset-width) var(--tw-ring-offset-color)}.outline{outline-style:var(--tw-outline-style);outline-width:1px}.invert{--tw-invert:invert(100%);filter:var(--tw-blur,) var(--tw-brightness,) var(--tw-contrast,) var(--tw-grayscale,) var(--tw-hue-rotate,) var(--tw-invert,) var(--tw-saturate,) var(--tw-sepia,) var(--tw-drop-shadow,)}.filter{filter:var(--tw-blur,) var(--tw-brightness,) var(--tw-contrast,) var(--tw-grayscale,) var(--tw-hue-rotate,) var(--tw-invert,) var(--tw-saturate,) var(--tw-sepia,) var(--tw-drop-shadow,)}.backdrop-blur{--tw-backdrop-blur:blur(8px);-webkit-backdrop-filter:var(--tw-backdrop-blur,) var(--tw-backdrop-brightness,) var(--tw-backdrop-contrast,) var(--tw-backdrop-grayscale,) var(--tw-backdrop-hue-rotate,) var(--tw-backdrop-invert,) var(--tw-backdrop-opacity,) var(--tw-backdrop-saturate,) var(--tw-backdrop-sepia,);backdrop-filter:var(--tw-backdrop-blur,) var(--tw-backdrop-brightness,) var(--tw-backdrop-contrast,) var(--tw-backdrop-grayscale,) var(--tw-backdrop-hue-rotate,) var(--tw-backdrop-invert,) var(--tw-backdrop-opacity,) var(--tw-backdrop-saturate,) var(--tw-backdrop-sepia,)}.transition-\\[color\\,background-color\\,box-shadow\\,scale\\]{transition-property:color,background-color,box-shadow,scale;transition-timing-function:var(--tw-ease,var(--default-transition-timing-function));transition-duration:var(--tw-duration,var(--default-transition-duration))}.transition-colors{transition-property:color,background-color,border-color,outline-color,text-decoration-color,fill,stroke,--tw-gradient-from,--tw-gradient-via,--tw-gradient-to;transition-timing-function:var(--tw-ease,var(--default-transition-timing-function));transition-duration:var(--tw-duration,var(--default-transition-duration))}.transition-shadow{transition-property:box-shadow;transition-timing-function:var(--tw-ease,var(--default-transition-timing-function));transition-duration:var(--tw-duration,var(--default-transition-duration))}.transition-transform{transition-property:transform,translate,scale,rotate;transition-timing-function:var(--tw-ease,var(--default-transition-timing-function));transition-duration:var(--tw-duration,var(--default-transition-duration))}.duration-700{--tw-duration:.7s;transition-duration:.7s}.ease-in-out{--tw-ease:var(--ease-in-out);transition-timing-function:var(--ease-in-out)}.select-none{-webkit-user-select:none;user-select:none}.placeholder\\:text-zinc-500::placeholder{color:var(--color-zinc-500)}@media (hover:hover){.hover\\:border-zinc-900:hover{border-color:var(--color-zinc-900)}.hover\\:bg-amber-200:hover{background-color:var(--color-amber-200)}.hover\\:bg-white:hover{background-color:var(--color-white)}.hover\\:bg-zinc-50:hover{background-color:var(--color-zinc-50)}.hover\\:bg-zinc-100:hover{background-color:var(--color-zinc-100)}.hover\\:bg-zinc-200:hover{background-color:var(--color-zinc-200)}.hover\\:bg-zinc-400\\/30:hover{background-color:#9f9fa94d}@supports (color:color-mix(in lab, red, red)){.hover\\:bg-zinc-400\\/30:hover{background-color:color-mix(in oklab, var(--color-zinc-400) 30%, transparent)}}.hover\\:bg-zinc-700:hover{background-color:var(--color-zinc-700)}.hover\\:text-amber-950:hover{color:var(--color-amber-950)}.hover\\:text-zinc-900:hover{color:var(--color-zinc-900)}.hover\\:no-underline:hover{text-decoration-line:none}.hover\\:opacity-100:hover{opacity:1}}.focus\\:outline-none:focus{--tw-outline-style:none;outline-style:none}.focus-visible\\:ring-2:focus-visible{--tw-ring-shadow:var(--tw-ring-inset,) 0 0 0 calc(2px + var(--tw-ring-offset-width)) var(--tw-ring-color,currentcolor);box-shadow:var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)}.focus-visible\\:ring-amber-900:focus-visible{--tw-ring-color:var(--color-amber-900)}.focus-visible\\:ring-white:focus-visible{--tw-ring-color:var(--color-white)}.focus-visible\\:ring-zinc-900:focus-visible{--tw-ring-color:var(--color-zinc-900)}.focus-visible\\:ring-offset-1:focus-visible{--tw-ring-offset-width:1px;--tw-ring-offset-shadow:var(--tw-ring-inset,) 0 0 0 var(--tw-ring-offset-width) var(--tw-ring-offset-color)}.focus-visible\\:ring-offset-2:focus-visible{--tw-ring-offset-width:2px;--tw-ring-offset-shadow:var(--tw-ring-inset,) 0 0 0 var(--tw-ring-offset-width) var(--tw-ring-offset-color)}.focus-visible\\:outline-none:focus-visible{--tw-outline-style:none;outline-style:none}.focus-visible\\:ring-inset:focus-visible{--tw-ring-inset:inset}.disabled\\:cursor-default:disabled{cursor:default}.disabled\\:opacity-35:disabled{opacity:.35}.disabled\\:opacity-45:disabled{opacity:.45}.disabled\\:opacity-50:disabled{opacity:.5}@media (hover:hover){.disabled\\:hover\\:border-zinc-300:disabled:hover{border-color:var(--color-zinc-300)}.disabled\\:hover\\:bg-transparent:disabled:hover{background-color:#0000}}@media (prefers-reduced-motion:reduce){.motion-reduce\\:animate-none{animation:none}.motion-reduce\\:transition-none{transition-property:none}}@media (min-width:1200px){.min-\\[1200px\\]\\:top-\\[27px\\]{top:27px}.min-\\[1200px\\]\\:right-4{right:calc(var(--spacing) * 4)}}@media (min-width:640px){.sm\\:inline{display:inline}}@container (min-width:380px){.\\@min-\\[380px\\]\\:grid-cols-3{grid-template-columns:repeat(3,minmax(0,1fr))}}@container (min-width:400px){.\\@min-\\[400px\\]\\:inline{display:inline}}@container (min-width:460px){.\\@min-\\[460px\\]\\:inline{display:inline}.\\@min-\\[460px\\]\\:h-10{height:calc(var(--spacing) * 10)}.\\@min-\\[460px\\]\\:min-h-0{min-height:0}.\\@min-\\[460px\\]\\:flex-row{flex-direction:row}.\\@min-\\[460px\\]\\:justify-start{justify-content:flex-start}.\\@min-\\[460px\\]\\:gap-1\\.5{gap:calc(var(--spacing) * 1.5)}.\\@min-\\[460px\\]\\:truncate{text-overflow:ellipsis;white-space:nowrap;overflow:hidden}.\\@min-\\[460px\\]\\:px-2\\.5{padding-inline:calc(var(--spacing) * 2.5)}.\\@min-\\[460px\\]\\:py-0{padding-block:0}.\\@min-\\[460px\\]\\:text-left{text-align:left}.\\@min-\\[460px\\]\\:text-xs{font-size:var(--text-xs);line-height:var(--tw-leading,var(--text-xs--line-height))}}@container (min-width:520px){.\\@min-\\[520px\\]\\:ml-auto{margin-left:auto}.\\@min-\\[520px\\]\\:w-auto{width:auto}.\\@min-\\[520px\\]\\:grid-cols-3{grid-template-columns:repeat(3,minmax(0,1fr))}.\\@min-\\[520px\\]\\:justify-start{justify-content:flex-start}}}:host{all:initial}.cbm-dark{color-scheme:dark;--color-white:oklch(21% .006 285.885);--color-zinc-50:oklch(24.5% .006 286);--color-zinc-100:oklch(27.4% .006 286.033);--color-zinc-200:oklch(33% .01 285.9);--color-zinc-300:oklch(42% .015 285.8);--color-zinc-400:oklch(52% .016 285.9);--color-zinc-500:oklch(68% .015 286.067);--color-zinc-600:oklch(74% .012 286);--color-zinc-700:oklch(82% .008 286.2);--color-zinc-800:oklch(88% .006 286.3);--color-zinc-900:oklch(96.7% .001 286.375);--color-zinc-950:oklch(98.5% 0 0);--color-amber-50:oklch(27.9% .077 45.635);--color-amber-100:oklch(33% .09 46);--color-amber-200:oklch(41.4% .112 45.904);--color-amber-300:oklch(55.5% .163 48.998);--color-amber-700:oklch(87.9% .169 91.605);--color-amber-800:oklch(92.4% .12 95.746);--color-amber-900:oklch(96.2% .059 95.617);--color-amber-950:oklch(98.7% .022 95.277);--color-emerald-50:oklch(26.2% .051 172.552);--color-emerald-800:oklch(90.5% .093 164.15);--color-emerald-900:oklch(95% .052 163.051);--color-sky-50:oklch(29.3% .066 243.157);--color-sky-100:oklch(39.1% .09 240.876);--color-sky-900:oklch(95.1% .026 236.824);--color-red-600:oklch(70.4% .191 22.216);--color-red-700:oklch(80.8% .114 19.571)}.cbm-dark *{--tw-ring-offset-color:oklch(21% .006 285.885)}.theme-scroll{--cbm-thumb:var(--color-primary,oklch(55.2% .016 285.938))}@supports (color:color-mix(in lab, red, red)){.theme-scroll{--cbm-thumb:color-mix(in srgb, var(--color-primary,var(--color-zinc-500)) 55%, var(--color-white))}}.theme-scroll{--cbm-thumb-hover:var(--color-primary,oklch(55.2% .016 285.938))}@supports (color:color-mix(in lab, red, red)){.theme-scroll{--cbm-thumb-hover:color-mix(in srgb, var(--color-primary,var(--color-zinc-500)) 80%, var(--color-white))}}.theme-scroll{scrollbar-width:thin;scrollbar-color:var(--cbm-thumb) transparent}.theme-scroll:hover{scrollbar-color:var(--cbm-thumb-hover) transparent}.theme-scroll::-webkit-scrollbar{width:6px}.theme-scroll::-webkit-scrollbar-track{background:0 0}.theme-scroll::-webkit-scrollbar-thumb{background:var(--cbm-thumb);border-radius:9999px}.theme-scroll:hover::-webkit-scrollbar-thumb{background:var(--cbm-thumb-hover)}.theme-panel{transform-origin:100% 0;animation:.16s ease-out theme-panel-in}@keyframes theme-panel-in{0%{opacity:0;transform:translateY(-6px)scale(.98)}}.theme-hint{animation:.12s ease-out theme-hint-in}.theme-toast{animation:.18s ease-out theme-toast-in}@keyframes theme-toast-in{0%{opacity:0;transform:translateY(8px)}}@keyframes theme-hint-in{0%{opacity:0}}.theme-arrive{animation:.62s cubic-bezier(.34,1.56,.64,1) both theme-arrive}@keyframes theme-arrive{0%{opacity:0;transform:scale(.2)rotate(-45deg)}60%{opacity:1;transform:scale(1.16)rotate(8deg)}to{transform:scale(1)rotate(0)}}.theme-burst-piece{line-height:0;animation:.95s cubic-bezier(.15,.75,.3,1) both theme-burst-piece;display:block;position:absolute;top:50%;left:50%}@keyframes theme-burst-piece{0%{opacity:0;transform:translate(-50%, -50%) rotate(var(--r)) scale(.3)}12%{opacity:1}65%{opacity:1}to{opacity:0;transform:translate(calc(-50% + var(--x)), calc(-50% + var(--y))) rotate(calc(var(--r) + 150deg)) scale(1)}}.theme-piece-dot{background:currentColor;border-radius:9999px;width:6px;height:6px}.theme-piece-dash{background:currentColor;border-radius:9999px;width:10px;height:3px}.theme-studio-mark{animation:9s linear infinite theme-studio-hue}@keyframes theme-studio-hue{0%{filter:hue-rotate()}to{filter:hue-rotate(360deg)}}.theme-new-mark{animation:.5s cubic-bezier(.34,1.56,.64,1) both theme-new-in}@keyframes theme-new-in{0%{transform:scale(0)rotate(-90deg)}to{transform:scale(1)rotate(0)}}@media (prefers-reduced-motion:reduce){.theme-new-mark,.theme-studio-mark,.theme-panel,.theme-hint,.theme-toast{animation:none}.theme-arrive{animation:.3s ease-out both theme-hint-in}.theme-burst{display:none}}.theme-panel summary{list-style:none}.theme-panel summary::-webkit-details-marker{display:none}.theme-panel details[open]>summary .theme-chevron{transform:rotate(90deg)}@keyframes spin{to{transform:rotate(360deg)}}";
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
	const { updatesOn, issues, storageKey, tokens, position: requested, setLogoColouring, setColourStyle, setColourStrength, setImageTints, setPaletteDefault, features, intro, mode, modeSetting, setMode, settingDefaults } = useTheme();
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
	const [settings, setSettings] = useState(() => loadSettings(storageKey, settingDefaults));
	const updates = useUpdates(storageKey, updatesOn);
	useEffect(() => setLogoColouring(settings.colourLogo), [settings.colourLogo, setLogoColouring]);
	useEffect(() => setColourStyle(features.colourStyle ? settings.colourStyle : settingDefaults.colourStyle), [
		settings.colourStyle,
		features.colourStyle,
		settingDefaults.colourStyle,
		setColourStyle
	]);
	useEffect(() => setPaletteDefault(settings.paletteSize), [settings.paletteSize, setPaletteDefault]);
	useEffect(() => setColourStrength(settings.colourStrength), [settings.colourStrength, setColourStrength]);
	useEffect(() => setImageTints(settings.imageTints), [settings.imageTints, setImageTints]);
	const [auditOn, setAuditOn] = useState(false);
	const [picking, setPicking] = useState(false);
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
	const offsetTop = useTopOffset();
	const corner = placed ?? (position === "top-right" ? null : cornerPoint(position, viewport));
	const layout = panelLayout(corner && !placed && position.startsWith("top") ? {
		...corner,
		top: corner.top + offsetTop
	} : corner, viewport, size, offsetTop);
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
	const [kept, setKept] = useState(false);
	useEffect(() => {
		if (open) setKept(true);
	}, [open]);
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
		saveSettings(storageKey, {
			...next,
			mode: loadSettings(storageKey, settingDefaults).mode
		});
		return next;
	};
	const settingsApi = {
		settings: {
			...settings,
			mode: modeSetting,
			showPicks: settings.showPicks && features.picks,
			showLibrary: settings.showLibrary && features.library,
			showCustom: settings.showCustom && features.custom,
			showOverrides: settings.showOverrides && features.overrides,
			showImportExport: settings.showImportExport && features.importExport,
			colourStyle: features.colourStyle ? settings.colourStyle : settingDefaults.colourStyle
		},
		mode,
		updates,
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
		studio: {
			picking,
			start() {
				setAuditOn(false);
				setFindings([]);
				setOpen(false);
				setPicking(true);
			}
		},
		update: ({ mode: nextMode, ...patch }) => {
			if (nextMode) setMode(nextMode);
			if (Object.keys(patch).length) setSettings((s) => storeSettings({
				...s,
				...patch,
				mode: nextMode ?? modeSetting
			}));
		},
		reset: () => {
			setMode(settingDefaults.mode);
			setSettings(storeSettings(settingDefaults));
		},
		resetButton: saved ? resetPosition : null
	};
	useEffect(() => {
		if (!open) return;
		const panel = panelRef.current;
		const root = panel.getRootNode();
		const focused = () => root.activeElement ?? document.activeElement;
		const inside = (e, el) => e.composedPath().includes(el);
		panel.querySelector(FOCUSABLE)?.focus({ preventScroll: true });
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
					"aria-label": `colorsbymax theme settings${issues.length ? ` (${issues.length} contrast issues)` : ""}${updates.unseen ? " (something new in the bell)" : ""}`,
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
					style: placed ?? (offsetTop && position.startsWith("top") ? { marginTop: offsetTop } : void 0),
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
						updates.unseen && /* @__PURE__ */ jsx(NewMark, { className: "-top-1 -left-1" }),
						bursting && /* @__PURE__ */ jsx(Burst, { tokens }, burst),
						hint && !open && !dragPoint && /* @__PURE__ */ jsx("span", {
							"aria-hidden": "true",
							className: `theme-hint pointer-events-none absolute top-1/2 -translate-y-1/2 whitespace-nowrap rounded-md bg-zinc-900 px-2 py-1 text-[11px] font-medium text-white shadow-lg ${hintOnLeft ? "right-full mr-2" : "left-full ml-2"}`,
							children: "Hold and drag to move"
						})
					]
				}),
				(open || kept) && /* @__PURE__ */ jsxs("div", {
					ref: panelRef,
					id: "theme-panel",
					role: "dialog",
					"aria-modal": "true",
					"aria-labelledby": "theme-panel-title",
					style: layout.style,
					className: `theme-switcher theme-panel fixed z-[60] ${open ? "flex" : "hidden"} flex-col rounded-2xl border border-zinc-200 bg-white text-zinc-900 shadow-2xl`,
					children: [/* @__PURE__ */ jsx(ThemePanel, { open }), /* @__PURE__ */ jsx(ResizeHandles, {
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
				picking && features.studio && /* @__PURE__ */ jsx(StudioLayer, { onDone: () => {
					setPicking(false);
					setOpen(true);
				} }),
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
/**
* How far a bar the site pins to the top of the page (above its nav, e.g. an announcement) pushes
* the colour button and panel down: the CSS variable --colorsbymax-offset-top on <html>, in px.
*/
function useTopOffset() {
	const read = () => parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--colorsbymax-offset-top")) || 0;
	const [offset, setOffset] = useState(read);
	useLayoutEffect(() => {
		const update = () => setOffset(read());
		const observer = new MutationObserver(update);
		observer.observe(document.documentElement, {
			attributes: true,
			attributeFilter: ["style", "class"]
		});
		window.addEventListener("resize", update);
		update();
		return () => {
			observer.disconnect();
			window.removeEventListener("resize", update);
		};
	}, []);
	return offset;
}
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
function panelLayout(button, { width: vw, height: vh }, size, offsetTop = 0) {
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
		style.top = (wide ? 72 : 128) + offsetTop;
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
export { PAIRINGS as A, TOKEN_KEYS as C, MIN_CONTRAST_NON_TEXT as D, MIN_CONTRAST_LARGE_TEXT as E, contrastRatio as F, normalizeHex as I, checkTheme as M, fixAll as N, MIN_CONTRAST_TEXT as O, suggestFix as P, TOKEN_GROUPS as S, deriveAppTokens as T, darkTokens as _, DEFAULT_STORAGE_KEY as a, BASE_TOKENS as b, coloursFromFile as c, themeFromPalette as d, collectColors as f, themeFromRoles as g, suggestThemes as h, useTheme as i, checkRamp as j, MIN_RAMP_STEP_DELTA_E as k, dominantColours as l, inferRoles as m, ThemeProvider as n, prePaintScript as o, detectSiteName as p, applyTokens as r, DEFAULT_SETTINGS as s, ThemeSwitcher as t, rolesFromPalette as u, isDarkTheme as v, completeTokens as w, PRESETS as x, toDark as y };
