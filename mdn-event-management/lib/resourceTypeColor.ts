import type { CSSProperties } from "react";

/**
 * Gives every resource type a stable colour derived from its name.
 *
 * The name is hashed to a hue, and only a hue — lightness and chroma are fixed
 * in `app/globals.css` (`.type-swatch`), so every type reads at the same weight
 * and keeps the same text contrast no matter which colour it lands on, in light
 * and dark alike.
 *
 * The colour follows the name, not the id: renaming a type recolours it, and two
 * types with the same name anywhere in the app always match.
 */

/** FNV-1a (32-bit). Small, and avalanches well enough that names differing by
 *  one character land far apart on the wheel rather than side by side. */
function hash(value: string): number {
  let h = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Hue in degrees, 0–359, for a resource type name. */
export function resourceTypeHue(name: string): number {
  return hash(name.trim().toLowerCase()) % 360;
}

/**
 * Inline style carrying the hue. Pair it with `className="type-swatch"`, which
 * is what actually builds the colour — Tailwind cannot generate classes from
 * runtime values, so the hue has to arrive as a custom property.
 */
export function resourceTypeStyle(name: string): CSSProperties {
  // Deliberately a string: a bare number risks a unit being appended, and
  // `43px` is not a valid oklch hue, which would silently drop the colour.
  return { "--type-hue": String(resourceTypeHue(name)) } as CSSProperties;
}
