/**
 * Per-page SVG annotation layer, drawn OVER the pdf.js canvas.
 *
 * The svg viewBox is the page in PDF points, so every shape is positioned in
 * PDF units with only the y-flip applied (viewY = pageHeight - pdfY); the
 * browser scales the svg to the zoomed CSS size. The layer is aria-hidden:
 * annotations are mouse/touch-authored graphics; all commands (delete, undo)
 * are reachable from the toolbar.
 */

import { useId, type ReactNode } from "react";
import type { Annotation, EditorAnnotation, Rect } from "./annotations";
import { normalizeRect } from "./coords";

/** Approximate bbox of an annotation in PDF points (for selection outline). */
function annotationBBox(ann: Annotation): Rect | null {
  switch (ann.kind) {
    case "highlight":
    case "erase":
      return normalizeRect(ann.rect);
    case "text_edit":
      return normalizeRect(ann.cover_rect);
    case "signature":
      return [ann.x, ann.y, ann.x + ann.width, ann.y + ann.height];
    case "text": {
      const w = ann.text.length * ann.font_size * 0.6;
      return [ann.x, ann.y - ann.font_size * 0.25, ann.x + w, ann.y + ann.font_size];
    }
    case "draw": {
      if (ann.points.length === 0) return null;
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const [x, y] of ann.points) {
        x0 = Math.min(x0, x); y0 = Math.min(y0, y);
        x1 = Math.max(x1, x); y1 = Math.max(y1, y);
      }
      return [x0, y0, x1, y1];
    }
    case "form_field":
      return null;
  }
}

function rgb([r, g, b]: readonly [number, number, number]): string {
  return `rgb(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)})`;
}

interface ShapeProps {
  ann: Annotation;
  pageH: number;
  signatureUrls: Readonly<Record<string, string>>;
  hardLabel: string;
  hatchId: string;
}

/** One annotation as SVG shapes (viewBox = PDF points, y already flipped). */
function Shape({ ann, pageH, signatureUrls, hardLabel, hatchId }: ShapeProps): ReactNode {
  switch (ann.kind) {
    case "highlight": {
      const [x0, y0, x1, y1] = normalizeRect(ann.rect);
      return (
        <rect
          x={x0} y={pageH - y1} width={x1 - x0} height={y1 - y0}
          fill={rgb(ann.color)} fillOpacity={0.35}
        />
      );
    }
    case "erase": {
      const [x0, y0, x1, y1] = normalizeRect(ann.rect);
      return (
        <g>
          <rect
            x={x0} y={pageH - y1} width={x1 - x0} height={y1 - y0}
            fill={rgb(ann.color)} stroke="var(--border-strong)" strokeWidth={0.75}
          />
          {ann.hard && (
            <>
              <rect
                x={x0} y={pageH - y1} width={x1 - x0} height={y1 - y0}
                fill={`url(#${hatchId})`}
              />
              <text
                x={x0 + 3} y={pageH - y0 - 3} fontSize={8}
                fill="var(--danger)" fontFamily="sans-serif" fontWeight="bold"
              >
                {hardLabel}
              </text>
            </>
          )}
        </g>
      );
    }
    case "draw": {
      const d = ann.points
        .map(([x, y], i) => `${i === 0 ? "M" : "L"}${x} ${pageH - y}`)
        .join(" ");
      return (
        <path
          d={d} fill="none" stroke={rgb(ann.color)} strokeWidth={ann.width}
          strokeLinecap="round" strokeLinejoin="round"
        />
      );
    }
    case "text":
      return (
        <text
          x={ann.x} y={pageH - ann.y} fontSize={ann.font_size}
          fill={rgb(ann.color)} fontFamily="Helvetica, Arial, sans-serif"
          style={{ whiteSpace: "pre" }}
        >
          {ann.text}
        </text>
      );
    case "signature": {
      const url = signatureUrls[ann.image_key];
      const y = pageH - (ann.y + ann.height);
      if (!url) {
        return (
          <rect
            x={ann.x} y={y} width={ann.width} height={ann.height}
            fill="none" stroke="var(--fg-muted)" strokeDasharray="4 3"
          />
        );
      }
      return (
        <image
          href={url} x={ann.x} y={y} width={ann.width} height={ann.height}
          preserveAspectRatio="xMidYMid meet"
        />
      );
    }
    case "text_edit": {
      const [x0, y0, x1, y1] = normalizeRect(ann.cover_rect);
      return (
        <g>
          <rect
            x={x0} y={pageH - y1} width={x1 - x0} height={y1 - y0}
            fill="#ffffff" stroke="var(--danger)" strokeWidth={0.75}
            strokeDasharray="3 2"
          />
          <text
            x={ann.x} y={pageH - ann.y} fontSize={ann.font_size}
            fill={rgb(ann.color)} fontFamily="Helvetica, Arial, sans-serif"
            style={{ whiteSpace: "pre" }}
          >
            {ann.text}
          </text>
        </g>
      );
    }
    case "form_field":
      return null; // edited via the side panel, no page visual
  }
}

export interface OverlayProps {
  /** Page size in PDF points. */
  widthPts: number;
  heightPts: number;
  /** Zoom factor (CSS px per point) — only affects the svg CSS size. */
  scale: number;
  annotations: readonly EditorAnnotation[];
  selectedId: string | null;
  /** image_key → object URL for signature previews. */
  signatureUrls: Readonly<Record<string, string>>;
  /** In-progress gesture preview (not yet committed). */
  transient?: Annotation | null;
  /** Live drag translation of the annotation being moved, PDF points. */
  dragOffset?: { id: string; dx: number; dy: number } | null;
  /** True when the select tool is active: annotations become hit targets. */
  interactive: boolean;
  hardLabel: string;
  onAnnotationPointerDown?: ((id: string, e: React.PointerEvent) => void) | undefined;
  onResizePointerDown?: ((id: string, e: React.PointerEvent) => void) | undefined;
}

export function Overlay({
  widthPts,
  heightPts,
  scale,
  annotations,
  selectedId,
  signatureUrls,
  transient = null,
  dragOffset = null,
  interactive,
  hardLabel,
  onAnnotationPointerDown,
  onResizePointerDown,
}: OverlayProps) {
  const hatchId = useId();
  const selected = annotations.find((a) => a.id === selectedId);
  const selectedBBox = selected ? annotationBBox(selected) : null;
  const handleSize = 8 / scale;

  return (
    <svg
      aria-hidden="true"
      data-testid="editor-overlay"
      viewBox={`0 0 ${widthPts} ${heightPts}`}
      width={widthPts * scale}
      height={heightPts * scale}
      className="absolute left-0 top-0"
      style={{ width: widthPts * scale, height: heightPts * scale }}
    >
      <defs>
        <pattern
          id={hatchId} width={6} height={6}
          patternUnits="userSpaceOnUse" patternTransform="rotate(45)"
        >
          <line x1={0} y1={0} x2={0} y2={6} stroke="var(--danger)" strokeWidth={1} strokeOpacity={0.5} />
        </pattern>
      </defs>

      {annotations.map((ann) => {
        const off = dragOffset && dragOffset.id === ann.id ? dragOffset : null;
        return (
          <g
            key={ann.id}
            data-annotation-id={ann.id}
            transform={off ? `translate(${off.dx} ${-off.dy})` : undefined}
            {...(interactive && ann.kind !== "form_field"
              ? {
                  onPointerDown: (e: React.PointerEvent) =>
                    onAnnotationPointerDown?.(ann.id, e),
                  style: { cursor: "move", pointerEvents: "all" as const },
                }
              : { style: { pointerEvents: "none" as const } })}
          >
            <Shape
              ann={ann} pageH={heightPts}
              signatureUrls={signatureUrls} hardLabel={hardLabel}
              hatchId={hatchId}
            />
          </g>
        );
      })}

      {selected && selectedBBox && (
        <g
          transform={
            dragOffset && dragOffset.id === selected.id
              ? `translate(${dragOffset.dx} ${-dragOffset.dy})`
              : undefined
          }
          style={{ pointerEvents: "none" }}
        >
          <rect
            x={selectedBBox[0] - 2}
            y={heightPts - selectedBBox[3] - 2}
            width={selectedBBox[2] - selectedBBox[0] + 4}
            height={selectedBBox[3] - selectedBBox[1] + 4}
            fill="none" stroke="var(--accent)" strokeWidth={1.25 / scale}
            strokeDasharray={`${4 / scale} ${3 / scale}`}
          />
          {selected.kind === "signature" && (
            <rect
              data-testid="resize-handle"
              x={selectedBBox[2] - handleSize / 2}
              y={heightPts - selectedBBox[1] - handleSize / 2}
              width={handleSize} height={handleSize}
              fill="var(--accent)"
              style={{ pointerEvents: "all", cursor: "nwse-resize" }}
              onPointerDown={(e) => onResizePointerDown?.(selected.id, e)}
            />
          )}
        </g>
      )}

      {transient && (
        <g style={{ pointerEvents: "none" }} opacity={0.8}>
          <Shape
            ann={transient} pageH={heightPts}
            signatureUrls={signatureUrls} hardLabel={hardLabel}
            hatchId={hatchId}
          />
        </g>
      )}
    </svg>
  );
}
