/**
 * Tiny className combiner. Filters falsy values and joins with a space.
 * Kept dependency-free (no clsx/tailwind-merge) — the app stays self-contained.
 */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
