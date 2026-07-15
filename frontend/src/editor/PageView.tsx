/**
 * One PDF page: pdf.js canvas + SVG annotation overlay + pointer gestures.
 *
 * The canvas is painted lazily — an IntersectionObserver marks the page
 * visible when it approaches the viewport, and the render effect re-runs on
 * zoom changes. The page keeps its final CSS size from the start so the
 * scroll layout never jumps.
 *
 * All gestures work in viewport coordinates and are converted to PDF space
 * (bottom-left origin) exactly once, via the pure builders in gestures.ts.
 */

import { useEffect, useRef, useState } from "react";
import type { Annotation, EditorAnnotation } from "./annotations";
import { clampViewPoint, type ViewPoint } from "./coords";
import {
  buildDraw,
  buildErase,
  buildHighlight,
  buildSignature,
  buildText,
  buildTextEdit,
  DEFAULT_FONT_SIZE,
} from "./gestures";
import type { HistoryAction } from "./history";
import { Overlay } from "./Overlay";
import type { ToolId } from "./Toolbar";
import { useT } from "../lib/i18n";
import { Button } from "../components/ui";

type Gesture =
  | { type: "rect"; start: ViewPoint; last: ViewPoint }
  | { type: "draw"; points: ViewPoint[] }
  | { type: "move"; id: string; start: ViewPoint }
  | { type: "resize"; id: string; start: ViewPoint; width: number; height: number; y: number };

interface PendingText {
  view: ViewPoint;
  /** For text_edit: the dragged cover rect corners (view space). */
  corners?: { a: ViewPoint; b: ViewPoint };
}

export interface PageViewProps {
  pageIndex: number;
  widthPts: number;
  heightPts: number;
  scale: number;
  numPages: number;
  renderPage: (index: number, canvas: HTMLCanvasElement, scale: number) => Promise<void>;
  tool: ToolId;
  hardErase: boolean;
  annotations: EditorAnnotation[];
  selectedId: string | null;
  signatureUrls: Readonly<Record<string, string>>;
  activeSignature: { key: string; aspectRatio: number } | null;
  dispatch: (action: HistoryAction) => void;
}

export function PageView({
  pageIndex,
  widthPts,
  heightPts,
  scale,
  numPages,
  renderPage,
  tool,
  hardErase,
  annotations,
  selectedId,
  signatureUrls,
  activeSignature,
  dispatch,
}: PageViewProps) {
  const t = useT();
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gestureRef = useRef<Gesture | null>(null);
  const [transient, setTransient] = useState<Annotation | null>(null);
  const [dragOffset, setDragOffset] = useState<{ id: string; dx: number; dy: number } | null>(null);
  const [pendingText, setPendingText] = useState<PendingText | null>(null);
  const [textValue, setTextValue] = useState("");
  const [fontSize, setFontSize] = useState(DEFAULT_FONT_SIZE);
  const [visible, setVisible] = useState(
    typeof IntersectionObserver === "undefined",
  );

  // Lazy visibility: paint only when the page nears the viewport.
  useEffect(() => {
    if (visible) return;
    const el = containerRef.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) setVisible(true);
      },
      { rootMargin: "300px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [visible]);

  // Paint (and re-paint on zoom) once visible.
  useEffect(() => {
    if (!visible) return;
    const canvas = canvasRef.current;
    if (canvas) void renderPage(pageIndex, canvas, scale);
  }, [visible, scale, pageIndex, renderPage]);

  const geo = { page: pageIndex, heightPts, scale };

  function viewPoint(e: React.PointerEvent): ViewPoint {
    const rect = containerRef.current?.getBoundingClientRect();
    const raw = rect
      ? { x: e.clientX - rect.left, y: e.clientY - rect.top }
      : { x: 0, y: 0 };
    // Pointer capture lets drags continue outside the page — clamp so the
    // resulting PDF coordinates always stay within the page bounds.
    return clampViewPoint(raw, widthPts, heightPts, scale);
  }

  function capture(e: React.PointerEvent) {
    try {
      containerRef.current?.setPointerCapture(e.pointerId);
    } catch {
      /* jsdom / unsupported */
    }
  }

  function onPointerDown(e: React.PointerEvent) {
    if (pendingText) return; // popover open — let it handle input
    if (e.button !== 0) return;
    const p = viewPoint(e);
    switch (tool) {
      case "select":
        // Empty-area press clears the selection (annotation hits stop propagation).
        dispatch({ type: "select", id: null });
        break;
      case "highlight":
      case "erase":
      case "textEdit":
        gestureRef.current = { type: "rect", start: p, last: p };
        capture(e);
        break;
      case "draw":
        gestureRef.current = { type: "draw", points: [p] };
        capture(e);
        break;
      case "text":
        setPendingText({ view: p });
        setTextValue("");
        break;
      case "signature":
        if (activeSignature) {
          dispatch({
            type: "add",
            annotation: buildSignature(p, activeSignature.key, activeSignature.aspectRatio, geo),
          });
        }
        break;
    }
  }

  function onPointerMove(e: React.PointerEvent) {
    const g = gestureRef.current;
    if (!g) return;
    const p = viewPoint(e);
    switch (g.type) {
      case "rect": {
        g.last = p;
        const preview =
          tool === "highlight"
            ? buildHighlight(g.start, p, geo)
            : buildErase(g.start, p, geo, tool === "erase" && hardErase);
        setTransient(preview);
        break;
      }
      case "draw": {
        g.points.push(p);
        setTransient(buildDraw(g.points, geo));
        break;
      }
      case "move":
        setDragOffset({
          id: g.id,
          dx: (p.x - g.start.x) / scale,
          dy: -(p.y - g.start.y) / scale,
        });
        break;
      case "resize": {
        const dw = (p.x - g.start.x) / scale;
        const width = Math.max(10, g.width + dw);
        const height = width * (g.height / g.width);
        const ann = annotations.find((a) => a.id === g.id);
        if (ann && ann.kind === "signature") {
          setTransient({ ...ann, width, height, y: g.y + g.height - height });
        }
        break;
      }
    }
  }

  function onPointerUp(e: React.PointerEvent) {
    const g = gestureRef.current;
    gestureRef.current = null;
    setTransient(null);
    setDragOffset(null);
    if (!g) return;
    const p = viewPoint(e);
    switch (g.type) {
      case "rect": {
        if (tool === "highlight") {
          const ann = buildHighlight(g.start, p, geo);
          if (ann) dispatch({ type: "add", annotation: ann });
        } else if (tool === "erase") {
          const ann = buildErase(g.start, p, geo, hardErase);
          if (ann) dispatch({ type: "add", annotation: ann });
        } else {
          // text_edit: keep the rect, ask for the replacement text.
          const probe = buildErase(g.start, p, geo, false);
          if (probe) {
            setPendingText({ view: p, corners: { a: g.start, b: p } });
            setTextValue("");
          }
        }
        break;
      }
      case "draw": {
        const ann = buildDraw(g.points, geo);
        if (ann) dispatch({ type: "add", annotation: ann });
        break;
      }
      case "move": {
        const dx = (p.x - g.start.x) / scale;
        const dy = -(p.y - g.start.y) / scale;
        if (dx !== 0 || dy !== 0) dispatch({ type: "move", id: g.id, dx, dy });
        break;
      }
      case "resize": {
        const dw = (p.x - g.start.x) / scale;
        const width = Math.max(10, g.width + dw);
        const height = width * (g.height / g.width);
        dispatch({
          type: "update",
          id: g.id,
          patch: { width, height, y: g.y + g.height - height },
        });
        break;
      }
    }
  }

  function onAnnotationPointerDown(id: string, e: React.PointerEvent) {
    if (tool !== "select") return;
    e.stopPropagation();
    dispatch({ type: "select", id });
    gestureRef.current = { type: "move", id, start: viewPoint(e) };
    capture(e);
  }

  function onResizePointerDown(id: string, e: React.PointerEvent) {
    if (tool !== "select") return;
    e.stopPropagation();
    const ann = annotations.find((a) => a.id === id);
    if (!ann || ann.kind !== "signature") return;
    gestureRef.current = {
      type: "resize",
      id,
      start: viewPoint(e),
      width: ann.width,
      height: ann.height,
      y: ann.y,
    };
    capture(e);
  }

  function confirmText() {
    const pending = pendingText;
    if (!pending) return;
    if (pending.corners) {
      const ann = buildTextEdit(pending.corners.a, pending.corners.b, textValue, fontSize, geo);
      if (ann) dispatch({ type: "add", annotation: ann });
    } else {
      const ann = buildText(pending.view, textValue, fontSize, geo);
      if (ann) dispatch({ type: "add", annotation: ann });
    }
    setPendingText(null);
    setTextValue("");
  }

  const cssW = widthPts * scale;
  const cssH = heightPts * scale;

  return (
    <div
      role="group"
      aria-label={t("editor.page", { n: pageIndex + 1, total: numPages })}
      className="relative mx-auto"
      style={{ width: cssW, height: cssH }}
    >
      <div
        ref={containerRef}
        data-testid={`editor-page-${pageIndex}`}
        className="absolute inset-0 touch-none select-none overflow-hidden rounded-sm border border-border bg-white shadow-[var(--shadow-sm)]"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => {
          gestureRef.current = null;
          setTransient(null);
          setDragOffset(null);
        }}
      >
        <canvas
          ref={canvasRef}
          aria-hidden="true"
          className="absolute left-0 top-0"
          style={{ width: cssW, height: cssH }}
        />
        <Overlay
          widthPts={widthPts}
          heightPts={heightPts}
          scale={scale}
          annotations={annotations}
          selectedId={selectedId}
          signatureUrls={signatureUrls}
          transient={transient}
          dragOffset={dragOffset}
          interactive={tool === "select"}
          hardLabel={t("editor.hardBadge")}
          onAnnotationPointerDown={onAnnotationPointerDown}
          onResizePointerDown={onResizePointerDown}
        />
      </div>

      {pendingText && (
        <form
          data-testid="text-popover"
          className="absolute z-10 flex w-64 flex-col gap-2 rounded-md border border-border bg-bg-elevated p-3 shadow-[var(--shadow-md)]"
          style={{
            left: Math.min(pendingText.view.x, Math.max(0, cssW - 260)),
            top: Math.min(pendingText.view.y, Math.max(0, cssH - 130)),
          }}
          onSubmit={(e) => {
            e.preventDefault();
            confirmText();
          }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <label className="flex flex-col gap-1 text-xs text-fg-muted">
            {t("editor.text.label")}
            <input
              autoFocus
              value={textValue}
              onChange={(e) => setTextValue(e.target.value)}
              placeholder={t("editor.text.placeholder")}
              onKeyDown={(e) => {
                if (e.key === "Escape") setPendingText(null);
              }}
              className="h-9 rounded-md border border-border bg-bg px-2 text-sm text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </label>
          <label className="flex items-center gap-2 text-xs text-fg-muted">
            {t("editor.text.fontSize")}
            <input
              type="number"
              min={4}
              max={144}
              value={fontSize}
              onChange={(e) => {
                const v = Number(e.target.value);
                if (Number.isFinite(v)) setFontSize(Math.min(144, Math.max(4, v)));
              }}
              className="h-8 w-20 rounded-md border border-border bg-bg px-2 text-sm text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </label>
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setPendingText(null)}>
              {t("editor.text.cancel")}
            </Button>
            <Button size="sm" type="submit">
              {t("editor.text.confirm")}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
