/**
 * Coordinate conversion between the on-screen overlay space and PDF space.
 *
 * Overlay/viewport space: CSS pixels relative to the page element's top-left
 * corner, y grows DOWNWARD, scaled by the current zoom factor `scale`
 * (1 = 100%, i.e. 1 CSS px per PDF point).
 *
 * PDF space: points, origin at the page's BOTTOM-LEFT corner, y grows UPWARD.
 *
 *   pdfX = viewX / scale
 *   pdfY = pageHeightPts - viewY / scale
 *
 * Annotations are ALWAYS stored in PDF space; conversion happens once at
 * input time and once when projecting onto the overlay. This was the
 * historically bug-prone spot in the desktop app — keep these functions pure
 * and unit-tested.
 */

import type { Point, Rect } from "./annotations";

export interface ViewPoint {
  x: number;
  y: number;
}

/** Viewport (top-left, scaled CSS px) → PDF point (bottom-left, points). */
export function viewToPdfPoint(
  view: ViewPoint,
  pageHeightPts: number,
  scale: number,
): Point {
  return [view.x / scale, pageHeightPts - view.y / scale];
}

/** PDF point (bottom-left, points) → viewport (top-left, scaled CSS px). */
export function pdfToViewPoint(
  pdf: Point,
  pageHeightPts: number,
  scale: number,
): ViewPoint {
  return { x: pdf[0] * scale, y: (pageHeightPts - pdf[1]) * scale };
}

/** Normalize a PDF rect so x0<=x1 and y0<=y1. */
export function normalizeRect(rect: Rect): Rect {
  const [x0, y0, x1, y1] = rect;
  return [Math.min(x0, x1), Math.min(y0, y1), Math.max(x0, x1), Math.max(y0, y1)];
}

/**
 * Two viewport corners (any drag direction) → normalized PDF rect.
 * The y-flip inverts vertical order, hence the normalization at the end.
 */
export function viewCornersToPdfRect(
  a: ViewPoint,
  b: ViewPoint,
  pageHeightPts: number,
  scale: number,
): Rect {
  const [ax, ay] = viewToPdfPoint(a, pageHeightPts, scale);
  const [bx, by] = viewToPdfPoint(b, pageHeightPts, scale);
  return normalizeRect([ax, ay, bx, by]);
}

/**
 * Normalized PDF rect → viewport rect {x, y, width, height} (top-left corner).
 * Note: the rect's TOP edge in view space comes from the PDF rect's y1.
 */
export function pdfRectToView(
  rect: Rect,
  pageHeightPts: number,
  scale: number,
): { x: number; y: number; width: number; height: number } {
  const [x0, y0, x1, y1] = normalizeRect(rect);
  return {
    x: x0 * scale,
    y: (pageHeightPts - y1) * scale,
    width: (x1 - x0) * scale,
    height: (y1 - y0) * scale,
  };
}

/** Translate a PDF rect by (dx, dy) in PDF points. */
export function translateRect(rect: Rect, dx: number, dy: number): Rect {
  const [x0, y0, x1, y1] = rect;
  return [x0 + dx, y0 + dy, x1 + dx, y1 + dy];
}

/** Clamp a value into [min, max]. */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Clamp a viewport point to the page's on-screen bounds, so drags that leave
 * the page can never produce negative or off-page PDF coordinates.
 */
export function clampViewPoint(
  p: ViewPoint,
  widthPts: number,
  heightPts: number,
  scale: number,
): ViewPoint {
  return {
    x: clamp(p.x, 0, widthPts * scale),
    y: clamp(p.y, 0, heightPts * scale),
  };
}
