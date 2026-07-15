/**
 * Pure gesture → annotation builders. Each takes viewport-space input
 * (top-left CSS px at the current scale) plus the page geometry and returns
 * a contract-shaped annotation in PDF space, or null when the gesture is
 * too small to be meaningful.
 */

import type {
  Annotation,
  Color,
  DrawAnnotation,
  EraseAnnotation,
  HighlightAnnotation,
  Point,
  SignatureAnnotation,
  TextAnnotation,
  TextEditAnnotation,
} from "./annotations";
import { MAX_DRAW_POINTS, MAX_TEXT_LEN } from "./annotations";
import type { ViewPoint } from "./coords";
import { viewCornersToPdfRect, viewToPdfPoint } from "./coords";

/** Default colors (match the backend/desktop defaults). */
export const HIGHLIGHT_COLOR: Color = [1, 1, 0];
export const DRAW_COLOR: Color = [1, 0, 0];
export const TEXT_COLOR: Color = [0, 0, 0];
export const ERASE_COLOR: Color = [1, 1, 1];
export const DEFAULT_FONT_SIZE = 14;
export const DEFAULT_DRAW_WIDTH = 2;
/** Default placed width of a signature, PDF points. */
export const DEFAULT_SIGNATURE_WIDTH = 150;

/** Minimum drag extent (PDF points) below which a rect gesture is ignored. */
const MIN_RECT_PTS = 2;

export interface PageGeometry {
  page: number;
  /** Page height in PDF points (for the y-flip). */
  heightPts: number;
  /** Current zoom factor: CSS px per PDF point. */
  scale: number;
}

function dragRect(a: ViewPoint, b: ViewPoint, geo: PageGeometry) {
  const rect = viewCornersToPdfRect(a, b, geo.heightPts, geo.scale);
  const [x0, y0, x1, y1] = rect;
  if (x1 - x0 < MIN_RECT_PTS || y1 - y0 < MIN_RECT_PTS) return null;
  return rect;
}

export function buildHighlight(
  a: ViewPoint,
  b: ViewPoint,
  geo: PageGeometry,
): HighlightAnnotation | null {
  const rect = dragRect(a, b, geo);
  if (!rect) return null;
  return { kind: "highlight", page: geo.page, rect, color: HIGHLIGHT_COLOR };
}

export function buildErase(
  a: ViewPoint,
  b: ViewPoint,
  geo: PageGeometry,
  hard: boolean,
): EraseAnnotation | null {
  const rect = dragRect(a, b, geo);
  if (!rect) return null;
  return { kind: "erase", page: geo.page, rect, color: ERASE_COLOR, hard };
}

/**
 * Freehand stroke. Needs at least 2 points; extra points beyond the backend
 * cap are dropped from the tail (a 10k-point stroke is already absurd).
 */
export function buildDraw(
  viewPoints: readonly ViewPoint[],
  geo: PageGeometry,
): DrawAnnotation | null {
  if (viewPoints.length < 2) return null;
  const points: Point[] = viewPoints
    .slice(0, MAX_DRAW_POINTS)
    .map((p) => viewToPdfPoint(p, geo.heightPts, geo.scale));
  return {
    kind: "draw",
    page: geo.page,
    points,
    color: DRAW_COLOR,
    width: DEFAULT_DRAW_WIDTH,
  };
}

/** Click point = text baseline-left anchor. Empty text → null. */
export function buildText(
  at: ViewPoint,
  text: string,
  fontSize: number,
  geo: PageGeometry,
): TextAnnotation | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  const [x, y] = viewToPdfPoint(at, geo.heightPts, geo.scale);
  return {
    kind: "text",
    page: geo.page,
    x,
    y,
    text: trimmed.slice(0, MAX_TEXT_LEN),
    font_size: fontSize,
    color: TEXT_COLOR,
  };
}

/**
 * Place a signature centered on the click point at the default width,
 * keeping the image's aspect ratio. (x, y) is the box's bottom-left corner.
 */
export function buildSignature(
  at: ViewPoint,
  imageKey: string,
  aspectRatio: number, // height / width of the source image
  geo: PageGeometry,
): SignatureAnnotation {
  const [cx, cy] = viewToPdfPoint(at, geo.heightPts, geo.scale);
  const width = DEFAULT_SIGNATURE_WIDTH;
  const height = width * (aspectRatio > 0 ? aspectRatio : 0.5);
  return {
    kind: "signature",
    page: geo.page,
    x: cx - width / 2,
    y: cy - height / 2,
    width,
    height,
    image_key: imageKey,
  };
}

/**
 * Text edit: the dragged cover rect is redacted; the replacement text is
 * anchored a few points inside the rect's bottom-left corner (baseline).
 */
export function buildTextEdit(
  a: ViewPoint,
  b: ViewPoint,
  text: string,
  fontSize: number,
  geo: PageGeometry,
): TextEditAnnotation | null {
  const rect = dragRect(a, b, geo);
  if (!rect) return null;
  const [x0, y0] = rect;
  return {
    kind: "text_edit",
    page: geo.page,
    cover_rect: rect,
    x: x0 + 2,
    y: y0 + 3,
    text: text.slice(0, MAX_TEXT_LEN),
    font_size: fontSize,
    color: TEXT_COLOR,
  };
}

export type BuiltAnnotation = Annotation | null;
