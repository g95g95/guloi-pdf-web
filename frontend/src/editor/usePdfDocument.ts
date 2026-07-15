/**
 * Load a PDF File via pdf.js and expose per-page metadata + a render function.
 *
 * The worker is bundled by Vite through the `?url` import — fully
 * self-contained, no CDN. pdf.js is imported dynamically so the (large)
 * library only loads when the editor is actually used, and so unit tests can
 * mock this hook without pulling pdf.js into jsdom.
 *
 * Rendering strategy: no virtualization — pages are rendered lazily by
 * PageView via an IntersectionObserver (a canvas is only painted when it
 * approaches the viewport, and re-painted when the zoom changes). The editor
 * warns above 50 pages but still works.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy, PDFPageProxy, RenderTask } from "pdfjs-dist";

export interface PdfPageInfo {
  /** Page size in PDF points at scale 1. */
  width: number;
  height: number;
}

export interface FormFieldSpec {
  name: string;
  /** Current value stored in the PDF. */
  value: string;
  /** 0-based page of this widget. */
  page: number;
  /** Widget rect in PDF points, bottom-left origin, normalized [x0,y0,x1,y1]. */
  rect: [number, number, number, number];
}

export type PdfDocumentState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error" }
  | {
      status: "ready";
      numPages: number;
      pages: PdfPageInfo[];
      formFields: FormFieldSpec[];
    };

export interface UsePdfDocument {
  state: PdfDocumentState;
  /**
   * Render page `index` (0-based) into `canvas` at `scale` (CSS px per
   * point), devicePixelRatio-aware. Cancels any in-flight render of the same
   * page. Resolves when painting completes (or was superseded).
   */
  renderPage: (index: number, canvas: HTMLCanvasElement, scale: number) => Promise<void>;
}

export function usePdfDocument(file: File | null): UsePdfDocument {
  // Result is keyed to the file it was produced for, so "loading" is derived
  // (file set, no result yet) instead of set synchronously inside the effect.
  const [result, setResult] = useState<{
    file: File;
    state: Extract<PdfDocumentState, { status: "ready" | "error" }>;
  } | null>(null);
  const pagesRef = useRef<Map<number, PDFPageProxy>>(new Map());
  const tasksRef = useRef<Map<number, RenderTask>>(new Map());

  useEffect(() => {
    if (!file) return;
    let cancelled = false;
    let loadingTask: { destroy: () => Promise<void> } | null = null;

    void (async () => {
      try {
        const [pdfjs, worker, buffer] = await Promise.all([
          import("pdfjs-dist"),
          import("pdfjs-dist/build/pdf.worker.min.mjs?url"),
          file.arrayBuffer(),
        ]);
        pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
        const task = pdfjs.getDocument({ data: buffer });
        loadingTask = task;
        const doc: PDFDocumentProxy = await task.promise;
        if (cancelled) return;
        const pages: PdfPageInfo[] = [];
        const formFields: FormFieldSpec[] = [];
        for (let i = 1; i <= doc.numPages; i++) {
          const page = await doc.getPage(i);
          if (cancelled) return;
          pagesRef.current.set(i - 1, page);
          const viewport = page.getViewport({ scale: 1 });
          pages.push({ width: viewport.width, height: viewport.height });
          // Editable text widgets: drawn as live inputs by PageView (the
          // canvas render skips their appearance via ENABLE_FORMS below).
          for (const a of await page.getAnnotations()) {
            if (
              a.subtype === "Widget" &&
              a.fieldType === "Tx" &&
              typeof a.fieldName === "string" &&
              a.fieldName &&
              !a.readOnly &&
              Array.isArray(a.rect)
            ) {
              const [ax0, ay0, ax1, ay1] = a.rect as number[];
              formFields.push({
                name: a.fieldName,
                value: typeof a.fieldValue === "string" ? a.fieldValue : "",
                page: i - 1,
                rect: [
                  Math.min(ax0 ?? 0, ax1 ?? 0),
                  Math.min(ay0 ?? 0, ay1 ?? 0),
                  Math.max(ax0 ?? 0, ax1 ?? 0),
                  Math.max(ay0 ?? 0, ay1 ?? 0),
                ],
              });
            }
          }
        }
        setResult({
          file,
          state: { status: "ready", numPages: doc.numPages, pages, formFields },
        });
      } catch {
        if (!cancelled) setResult({ file, state: { status: "error" } });
      }
    })();

    const tasks = tasksRef.current;
    const pages = pagesRef.current;
    return () => {
      cancelled = true;
      for (const task of tasks.values()) task.cancel();
      tasks.clear();
      pages.clear();
      void loadingTask?.destroy().catch(() => {});
    };
  }, [file]);

  const renderPage = useCallback(
    async (index: number, canvas: HTMLCanvasElement, scale: number) => {
      const page = pagesRef.current.get(index);
      if (!page) return;
      tasksRef.current.get(index)?.cancel();
      const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
      const viewport = page.getViewport({ scale: scale * dpr });
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      // annotationMode 2 = AnnotationMode.ENABLE_FORMS: interactive form
      // widgets are NOT painted on the canvas (PageView draws them as live
      // inputs), while every other annotation appearance still renders.
      const task = page.render({ canvas, viewport, annotationMode: 2 });
      tasksRef.current.set(index, task);
      try {
        await task.promise;
      } catch {
        /* cancelled by a newer render — expected during zoom/scroll */
      } finally {
        if (tasksRef.current.get(index) === task) tasksRef.current.delete(index);
      }
    },
    [],
  );

  const state: PdfDocumentState = !file
    ? { status: "idle" }
    : result && result.file === file
      ? result.state
      : { status: "loading" };

  return { state, renderPage };
}
