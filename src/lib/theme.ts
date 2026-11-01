/**
 * Per-garage theming. A garage picks an accent; we compute a readable foreground
 * and a hover shade so a garage can never configure an unreadable button.
 */

export const ACCENT_PRESETS = [
  { name: "Indigo", hex: "#5B35F0" },
  { name: "Violet", hex: "#8B5CF6" },
  { name: "Ocean", hex: "#0B7FD4" },
  { name: "Teal", hex: "#0E9488" },
  { name: "Forest", hex: "#15803D" },
  { name: "Amber", hex: "#D97706" },
  { name: "Coral", hex: "#E0503B" },
  { name: "Plum", hex: "#A21C72" },
  { name: "Slate", hex: "#475569" },
  { name: "Ink", hex: "#1F2544" },
] as const;

const HEX = /^#([0-9a-f]{6})$/i;

export function parseHex(hex: string): [number, number, number] | null {
  const m = HEX.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1]!, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const toLinear = (c: number) => {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};

/** WCAG relative luminance, 0 (black) to 1 (white). */
export function luminance(hex: string): number {
  const rgb = parseHex(hex);
  if (!rgb) return 0;
  const [r, g, b] = rgb.map(toLinear) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string): number {
  const la = luminance(a), lb = luminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
const hexOf = (r: number, g: number, b: number) =>
  "#" + [r, g, b].map((c) => clamp(c).toString(16).padStart(2, "0")).join("");

export function mix(hex: string, target: "black" | "white", amount: number): string {
  const rgb = parseHex(hex);
  if (!rgb) return hex;
  const t = target === "white" ? 255 : 0;
  const [r, g, b] = rgb;
  return hexOf(r + (t - r) * amount, g + (t - g) * amount, b + (t - b) * amount);
}

export interface GarageTheme {
  accent: string;
  accentFg: string;
  accentHover: string;
  accentSoft: string;
}

const FALLBACK = "#5b35f0";
const INK = "#15112b";
const WHITE = "#ffffff";
/** WCAG AA for large text and UI components. */
export const MIN_CONTRAST = 4.5;

/**
 * Resolves a garage's chosen colour into a usable button.
 *
 * A garage can pick any hex, including one that is unreadable with both white and dark
 * text. Rather than reject it or ship a button nobody can read, the colour is nudged
 * toward black or white in small steps until it clears WCAG AA. The hue the garage chose
 * survives; only its lightness moves, and only as far as it has to.
 */
export function resolveTheme(accentHex: string | null | undefined): GarageTheme {
  const chosen = accentHex && parseHex(accentHex) ? accentHex.toLowerCase() : FALLBACK;

  // Whichever foreground starts out better is the one worth pushing toward.
  const preferWhite = contrastRatio(chosen, WHITE) >= contrastRatio(chosen, INK);
  const fg = preferWhite ? WHITE : INK;
  const toward = preferWhite ? "black" : "white";

  let accent = chosen;
  for (let step = 1; step <= 20 && contrastRatio(accent, fg) < MIN_CONTRAST; step++) {
    accent = mix(chosen, toward, step * 0.04);
  }

  const light = luminance(accent) > 0.5;
  return {
    accent,
    accentFg: fg,
    accentHover: mix(accent, light ? "black" : "white", 0.14),
    accentSoft: mix(accent, light ? "black" : "white", 0.88),
  };
}

/**
 * Inline CSS custom properties for a scoped wrapper. Only --brand is overridden, so a
 * garage changes its own chrome without touching MEQIVA's semantic colours — success,
 * warning and danger keep meaning the same thing everywhere.
 */
export function themeVars(t: GarageTheme): Record<string, string> {
  return {
    "--brand": t.accent,
    "--brand-fg": t.accentFg,
    "--brand-hover": t.accentHover,
    "--brand-soft": t.accentSoft,
  };
}
