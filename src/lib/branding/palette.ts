/** Derives a Tailwind-style brand palette (50..900) from a single base colour and applies it
 *  as CSS variables (--color-brand-*) so the whole UI (buttons, accents) adopts the tenant colour. */

type RGB = { r: number; g: number; b: number };

function hexToRgb(hex: string): RGB | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function mix(c: RGB, target: RGB, t: number): RGB {
  return {
    r: Math.round(c.r + (target.r - c.r) * t),
    g: Math.round(c.g + (target.g - c.g) * t),
    b: Math.round(c.b + (target.b - c.b) * t),
  };
}

function toHex({ r, g, b }: RGB): string {
  return "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");
}

const WHITE: RGB = { r: 255, g: 255, b: 255 };
const BLACK: RGB = { r: 17, g: 24, b: 39 }; // slate-900-ish for pleasant darks

/** Shade → mix factor: below 500 mix toward white, above 500 toward black. */
const STEPS: Record<number, { target: RGB; t: number }> = {
  50: { target: WHITE, t: 0.92 },
  100: { target: WHITE, t: 0.84 },
  200: { target: WHITE, t: 0.68 },
  300: { target: WHITE, t: 0.5 },
  400: { target: WHITE, t: 0.26 },
  500: { target: WHITE, t: 0 },
  600: { target: BLACK, t: 0.18 },
  700: { target: BLACK, t: 0.34 },
  800: { target: BLACK, t: 0.5 },
  900: { target: BLACK, t: 0.66 },
};

/** Applies the palette derived from `hex` to the document root. No-op for invalid colours. */
export function applyBrandColor(hex: string | null | undefined): void {
  if (typeof document === "undefined" || !hex) return;
  const base = hexToRgb(hex);
  if (!base) return;
  const root = document.documentElement;
  for (const [shade, { target, t }] of Object.entries(STEPS)) {
    root.style.setProperty(`--color-brand-${shade}`, toHex(mix(base, target, t)));
  }
}

/** Clears the runtime overrides, falling back to the default theme. */
export function clearBrandColor(): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  for (const shade of Object.keys(STEPS)) root.style.removeProperty(`--color-brand-${shade}`);
}
