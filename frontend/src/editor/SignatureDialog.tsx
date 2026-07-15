/**
 * Adobe-style "add signature" dialog: draw it by hand on a canvas, type it
 * (rendered in a cursive font), or upload an image. Draw/type produce a
 * transparent PNG cropped to the ink, handed to EditorView as a File — from
 * there the existing signature pipeline (keys, multipart, backend) applies.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "../components/ui";
import { cn } from "../lib/cn";
import { useT } from "../lib/i18n";

const CANVAS_W = 480;
const CANVAS_H = 180;
const INK = "#1e3a8a";
const FONT_STACK = '"Segoe Script", "Brush Script MT", "Comic Sans MS", cursive';

type Mode = "draw" | "type" | "upload";

export interface SignatureDialogProps {
  open: boolean;
  onClose: () => void;
  /** Receives the generated PNG (draw/type modes). */
  onCreate: (file: File) => void;
  /** Opens the image file picker (upload mode). */
  onPickImage: () => void;
}

/** Crop to the inked bounding box (with padding); null if the canvas is blank. */
function cropToContent(canvas: HTMLCanvasElement): HTMLCanvasElement | null {
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const { width, height } = canvas;
  const data = ctx.getImageData(0, 0, width, height).data;
  let minX = width, minY = height, maxX = -1, maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if ((data[(y * width + x) * 4 + 3] ?? 0) > 8) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return null;
  const pad = 6;
  minX = Math.max(0, minX - pad);
  minY = Math.max(0, minY - pad);
  maxX = Math.min(width - 1, maxX + pad);
  maxY = Math.min(height - 1, maxY + pad);
  const out = document.createElement("canvas");
  out.width = maxX - minX + 1;
  out.height = maxY - minY + 1;
  out.getContext("2d")?.drawImage(
    canvas, minX, minY, out.width, out.height, 0, 0, out.width, out.height,
  );
  return out;
}

export function SignatureDialog({ open, ...rest }: SignatureDialogProps) {
  // Mount fresh on every open so all state (strokes, typed name, tab)
  // resets without effects.
  if (!open) return null;
  return <SignatureDialogInner {...rest} />;
}

function SignatureDialogInner({
  onClose,
  onCreate,
  onPickImage,
}: Omit<SignatureDialogProps, "open">) {
  const t = useT();
  const [mode, setMode] = useState<Mode>("draw");
  const [typed, setTyped] = useState("");
  const [hasInk, setHasInk] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const strokesRef = useRef<{ x: number; y: number }[][]>([]);
  const drawingRef = useRef(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  const repaint = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = INK;
    ctx.fillStyle = INK;
    if (mode === "draw") {
      ctx.lineWidth = 2.5;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      for (const stroke of strokesRef.current) {
        if (stroke.length < 2) continue;
        ctx.beginPath();
        ctx.moveTo(stroke[0]!.x, stroke[0]!.y);
        for (const p of stroke.slice(1)) ctx.lineTo(p.x, p.y);
        ctx.stroke();
      }
    } else if (mode === "type" && typed.trim()) {
      let size = 64;
      ctx.font = `${size}px ${FONT_STACK}`;
      while (size > 16 && ctx.measureText(typed).width > canvas.width - 32) {
        size -= 4;
        ctx.font = `${size}px ${FONT_STACK}`;
      }
      ctx.textBaseline = "middle";
      ctx.fillText(typed, 16, canvas.height / 2);
    }
  }, [mode, typed]);

  useEffect(() => {
    repaint();
  }, [repaint, hasInk]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function canvasPoint(e: React.PointerEvent): { x: number; y: number } {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * canvas.width,
      y: ((e.clientY - rect.top) / rect.height) * canvas.height,
    };
  }

  function onPointerDown(e: React.PointerEvent) {
    if (e.button !== 0) return;
    try {
      (e.target as Element).setPointerCapture(e.pointerId);
    } catch {
      /* jsdom */
    }
    drawingRef.current = true;
    strokesRef.current.push([canvasPoint(e)]);
    setHasInk(true);
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!drawingRef.current) return;
    strokesRef.current.at(-1)?.push(canvasPoint(e));
    repaint();
  }

  function confirm() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const cropped = cropToContent(canvas) ?? canvas;
    cropped.toBlob((blob) => {
      if (!blob) return;
      onCreate(new File([blob], "firma.png", { type: "image/png" }));
    }, "image/png");
  }

  const canConfirm = mode === "draw" ? hasInk : typed.trim().length > 0;
  const tabs: { id: Mode; label: string }[] = [
    { id: "draw", label: t("editor.signature.tab.draw") },
    { id: "type", label: t("editor.signature.tab.type") },
    { id: "upload", label: t("editor.signature.tab.upload") },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={t("editor.signature.dialog.title")}
        className="w-full max-w-xl rounded-lg border border-border bg-bg-elevated p-4 shadow-[var(--shadow-md)]"
      >
        <h2 className="mb-3 text-sm font-semibold text-fg">
          {t("editor.signature.dialog.title")}
        </h2>

        <div role="tablist" className="mb-3 flex gap-1 rounded-md bg-bg-subtle p-1">
          {tabs.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={mode === id}
              onClick={() => {
                setMode(id);
                strokesRef.current = [];
                setHasInk(false);
              }}
              className={cn(
                "flex-1 rounded-sm px-3 py-1.5 text-sm transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                mode === id
                  ? "bg-bg-elevated font-medium text-fg shadow-[var(--shadow-sm)]"
                  : "text-fg-muted hover:text-fg",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {mode === "upload" ? (
          <div className="flex flex-col items-center gap-3 rounded-md border border-dashed border-border py-10">
            <p className="text-sm text-fg-muted">{t("editor.signature.upload.hint")}</p>
            <Button size="sm" onClick={onPickImage}>
              {t("editor.signature.upload")}
            </Button>
          </div>
        ) : (
          <>
            {mode === "type" && (
              <input
                autoFocus
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                placeholder={t("editor.signature.type.placeholder")}
                maxLength={60}
                aria-label={t("editor.signature.type.placeholder")}
                className="mb-3 h-9 w-full rounded-md border border-border bg-bg px-2 text-sm text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            )}
            <canvas
              ref={canvasRef}
              width={CANVAS_W}
              height={CANVAS_H}
              data-testid="signature-canvas"
              aria-label={t("editor.signature.canvas")}
              onPointerDown={mode === "draw" ? onPointerDown : undefined}
              onPointerMove={mode === "draw" ? onPointerMove : undefined}
              onPointerUp={() => (drawingRef.current = false)}
              onPointerCancel={() => (drawingRef.current = false)}
              className={cn(
                "w-full touch-none rounded-md border border-dashed border-border bg-white",
                mode === "draw" && "cursor-crosshair",
              )}
            />
            <div className="mt-1 flex items-center justify-between">
              <span className="text-xs text-fg-muted">
                {mode === "draw"
                  ? t("editor.signature.draw.hint")
                  : t("editor.signature.type.hint")}
              </span>
              {mode === "draw" && (
                <button
                  type="button"
                  onClick={() => {
                    strokesRef.current = [];
                    setHasInk(false);
                    repaint();
                  }}
                  className="rounded-sm text-xs font-medium text-accent underline underline-offset-2 hover:text-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {t("editor.signature.clear")}
                </button>
              )}
            </div>
          </>
        )}

        <div className="mt-4 flex justify-end gap-2">
          <Button size="sm" variant="ghost" onClick={onClose}>
            {t("editor.signature.cancel")}
          </Button>
          {mode !== "upload" && (
            <Button size="sm" disabled={!canConfirm} onClick={confirm}>
              {t("editor.signature.confirm")}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
