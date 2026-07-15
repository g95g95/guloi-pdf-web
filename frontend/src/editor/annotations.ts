/**
 * Annotation model — mirrors the /api/editor/save JSON contract verbatim
 * (see backend app/schemas.py). Coordinates are PDF-native points, origin
 * BOTTOM-LEFT, y grows upward. Colors are [r,g,b] floats 0..1. `page` is
 * 0-based. Rects are normalized [x0,y0,x1,y1] with x0<x1, y0<y1.
 *
 * Internally each annotation carries a client-side `id` used for selection
 * and undo/redo; `serializeAnnotations` strips it so the wire payload has
 * exactly the contract keys (the backend forbids extra keys).
 */

export type Color = readonly [number, number, number];
export type Rect = readonly [number, number, number, number];
export type Point = readonly [number, number];

export interface HighlightAnnotation {
  kind: "highlight";
  page: number;
  rect: Rect;
  color: Color;
}

export interface DrawAnnotation {
  kind: "draw";
  page: number;
  points: Point[];
  color: Color;
  width: number;
}

export interface TextAnnotation {
  kind: "text";
  page: number;
  /** Baseline-left anchor of the text, PDF points. */
  x: number;
  y: number;
  text: string;
  font_size: number;
  color: Color;
}

export interface SignatureAnnotation {
  kind: "signature";
  page: number;
  /** Bottom-left corner of the image box, PDF points. */
  x: number;
  y: number;
  width: number;
  height: number;
  image_key: string;
}

export interface EraseAnnotation {
  kind: "erase";
  page: number;
  rect: Rect;
  color: Color;
  /** true = real redaction (content removal, permanent). */
  hard: boolean;
}

export interface TextEditAnnotation {
  kind: "text_edit";
  page: number;
  cover_rect: Rect;
  x: number;
  y: number;
  text: string;
  font_size: number;
  color: Color;
}

export interface FormFieldAnnotation {
  kind: "form_field";
  page: number;
  field_name: string;
  value: string;
}

export type Annotation =
  | HighlightAnnotation
  | DrawAnnotation
  | TextAnnotation
  | SignatureAnnotation
  | EraseAnnotation
  | TextEditAnnotation
  | FormFieldAnnotation;

export type AnnotationKind = Annotation["kind"];

/** Annotation as held in editor state: contract shape + client-only id. */
export type EditorAnnotation = Annotation & { id: string };

export const MAX_ANNOTATIONS = 500;
export const MAX_TEXT_LEN = 5000;
export const MAX_FIELD_VALUE_LEN = 1000;
export const MAX_DRAW_POINTS = 10000;

let nextId = 0;
/** Monotonic client-side id (never serialized). */
export function newAnnotationId(): string {
  nextId += 1;
  return `a${nextId}`;
}

/**
 * Project an EditorAnnotation onto the exact wire object: verbatim key
 * order per kind, no extra keys (backend uses extra="forbid").
 */
export function toWire(ann: EditorAnnotation): Annotation {
  switch (ann.kind) {
    case "highlight":
      return { kind: ann.kind, page: ann.page, rect: ann.rect, color: ann.color };
    case "draw":
      return {
        kind: ann.kind,
        page: ann.page,
        points: ann.points,
        color: ann.color,
        width: ann.width,
      };
    case "text":
      return {
        kind: ann.kind,
        page: ann.page,
        x: ann.x,
        y: ann.y,
        text: ann.text,
        font_size: ann.font_size,
        color: ann.color,
      };
    case "signature":
      return {
        kind: ann.kind,
        page: ann.page,
        x: ann.x,
        y: ann.y,
        width: ann.width,
        height: ann.height,
        image_key: ann.image_key,
      };
    case "erase":
      return {
        kind: ann.kind,
        page: ann.page,
        rect: ann.rect,
        color: ann.color,
        hard: ann.hard,
      };
    case "text_edit":
      return {
        kind: ann.kind,
        page: ann.page,
        cover_rect: ann.cover_rect,
        x: ann.x,
        y: ann.y,
        text: ann.text,
        font_size: ann.font_size,
        color: ann.color,
      };
    case "form_field":
      return {
        kind: ann.kind,
        page: ann.page,
        field_name: ann.field_name,
        value: ann.value,
      };
  }
}

/** Serialize the annotation list to the /api/editor/save `annotations` field. */
export function serializeAnnotations(items: readonly EditorAnnotation[]): string {
  return JSON.stringify(items.map(toWire));
}

/** True when saving `items` performs a permanent redaction on the PDF. */
export function hasPermanentEdits(items: readonly EditorAnnotation[]): boolean {
  return items.some(
    (a) => (a.kind === "erase" && a.hard) || a.kind === "text_edit",
  );
}

/** image_keys referenced by signature annotations (deduplicated, in order). */
export function usedSignatureKeys(items: readonly EditorAnnotation[]): string[] {
  const keys: string[] = [];
  for (const a of items) {
    if (a.kind === "signature" && !keys.includes(a.image_key)) keys.push(a.image_key);
  }
  return keys;
}
