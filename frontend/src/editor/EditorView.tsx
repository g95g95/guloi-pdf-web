/**
 * The PDF editor proper: toolbar + page list (canvas + overlay per page) +
 * form-fields panel + save pipeline.
 *
 * State shape:
 *  - annotations + undo/redo: pure historyReducer (PDF-space annotations);
 *  - tool / zoom / hard-erase toggle: local state;
 *  - signature assets: uploaded File + object URL + aspect ratio, keyed by
 *    the image_key sent to the backend;
 *  - form field edits: diff reported by FormFieldsPanel, converted to
 *    form_field annotations at save time;
 *  - save: reuses useToolUpload (same status→i18n error mapping as every
 *    other tool), then triggers the shared blob download.
 */

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { Spinner, useToast } from "../components/ui";
import { downloadBlob } from "../lib/download";
import { useT } from "../lib/i18n";
import { useToolUpload } from "../lib/useToolUpload";
import type { EditorAnnotation } from "./annotations";
import {
  hasPermanentEdits,
  MAX_ANNOTATIONS,
  newAnnotationId,
  serializeAnnotations,
  usedSignatureKeys,
} from "./annotations";
import { clamp } from "./coords";
import type { HistoryAction } from "./history";
import { ConfirmDialog } from "./ConfirmDialog";
import { FormFieldsPanel, type PanelField } from "./FormFieldsPanel";
import { SignatureDialog } from "./SignatureDialog";
import { historyReducer, initialHistory } from "./history";
import { PageView } from "./PageView";
import { Toolbar, type ToolId } from "./Toolbar";
import { usePdfDocument } from "./usePdfDocument";

const MIN_SCALE = 0.5;
const MAX_SCALE = 3;
const SCALE_STEP = 0.25;
const PAGE_WARN_THRESHOLD = 50;
const MAX_SIGNATURES = 10;
const MAX_SIGNATURE_BYTES = 5 * 1024 * 1024;

interface SignatureAsset {
  key: string;
  file: File;
  url: string;
  /** height / width of the source image. */
  aspectRatio: number;
}

function isEditableTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)
  );
}

export interface EditorViewProps {
  file: File;
  onClose: () => void;
}

export function EditorView({ file, onClose }: EditorViewProps) {
  const t = useT();
  const { toast } = useToast();
  const { state: doc, renderPage } = usePdfDocument(file);
  const [history, rawDispatch] = useReducer(historyReducer, initialHistory);
  const [tool, setTool] = useState<ToolId>("select");
  const [hardErase, setHardErase] = useState(false);
  const [scale, setScale] = useState(1);
  const [signatures, setSignatures] = useState<SignatureAsset[]>([]);
  const [activeSignatureKey, setActiveSignatureKey] = useState<string | null>(null);
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [sigDialogOpen, setSigDialogOpen] = useState(false);
  const { state: save, submit, reset } = useToolUpload("/api/editor/save");
  const sigInputRef = useRef<HTMLInputElement>(null);
  const sigCounterRef = useRef(0);
  const pagesRef = useRef<HTMLDivElement>(null);
  const warnedRef = useRef(false);

  const saving = save.status === "uploading" || save.status === "processing";

  // Dispatch that surfaces the backend's 500-annotation cap as a toast
  // instead of silently ignoring the add (the reducer also enforces it).
  const atCap = history.annotations.length >= MAX_ANNOTATIONS;
  const dispatch = useCallback(
    (action: HistoryAction) => {
      if (action.type === "add" && atCap) {
        toast(t("editor.tooMany", { max: MAX_ANNOTATIONS }), "error");
        return;
      }
      rawDispatch(action);
    },
    [atCap, toast, t],
  );

  // Single source of truth for form-field values, shared by the panel and
  // the on-page widget inputs. Initialized ONCE per document from the PDF's
  // own values — never re-run afterwards, or user edits would be reset.
  const formFields = useMemo(
    () => (doc.status === "ready" ? (doc.formFields ?? []) : []),
    [doc],
  );
  const formInitRef = useRef<File | null>(null);
  useEffect(() => {
    if (doc.status !== "ready" || formInitRef.current === file) return;
    formInitRef.current = file;
    setFormValues(Object.fromEntries(formFields.map((f) => [f.name, f.value])));
  }, [doc.status, formFields, file]);
  const editFormField = useCallback((name: string, value: string) => {
    setFormValues((prev) => ({ ...prev, [name]: value }));
  }, []);
  /** One entry per field name with its live value; radio groups aggregate
      every widget's export value so the panel can list all the options. */
  const panelFields = useMemo(() => {
    const byName = new Map<string, PanelField>();
    for (const f of formFields) {
      const existing = byName.get(f.name);
      if (!existing) {
        const pf: PanelField = {
          name: f.name,
          type: f.type,
          value: formValues[f.name] ?? "",
        };
        if (f.exportValue !== undefined) pf.exportValue = f.exportValue;
        if (f.options !== undefined) pf.options = f.options;
        if (f.type === "radio") pf.radioValues = f.exportValue ? [f.exportValue] : [];
        byName.set(f.name, pf);
      } else if (
        f.type === "radio" &&
        f.exportValue &&
        existing.radioValues &&
        !existing.radioValues.includes(f.exportValue)
      ) {
        existing.radioValues.push(f.exportValue);
      }
    }
    return [...byName.values()];
  }, [formFields, formValues]);

  // Large-document warning (once).
  useEffect(() => {
    if (doc.status === "ready" && doc.numPages > PAGE_WARN_THRESHOLD && !warnedRef.current) {
      warnedRef.current = true;
      toast(t("editor.manyPages", { n: doc.numPages }), "info");
    }
    if (doc.status === "error") toast(t("editor.loadError"), "error");
  }, [doc, toast, t]);

  // Save finished → download + notify, back to editing.
  useEffect(() => {
    if (save.status === "done") {
      downloadBlob(save.blob, save.filename);
      toast(t("editor.saved"), "success");
      reset();
    }
  }, [save, toast, t, reset]);

  // Revoke signature object URLs on unmount (ref snapshot: setState updaters
  // do not run on unmounted components).
  const signaturesRef = useRef<SignatureAsset[]>([]);
  useEffect(() => {
    signaturesRef.current = signatures;
  }, [signatures]);
  useEffect(() => {
    return () => {
      for (const s of signaturesRef.current) URL.revokeObjectURL(s.url);
    };
  }, []);

  const zoomBy = useCallback((delta: number) => {
    setScale((s) => clamp(Math.round((s + delta) * 100) / 100, MIN_SCALE, MAX_SCALE));
  }, []);

  // Keyboard: undo/redo/delete (skipped while typing in an input and while
  // the confirm dialog is open — the dialog owns the keyboard then).
  useEffect(() => {
    if (confirmOpen) return;
    function onKey(e: KeyboardEvent) {
      if (isEditableTarget(e.target)) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        dispatch({ type: e.shiftKey ? "redo" : "undo" });
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
        e.preventDefault();
        dispatch({ type: "redo" });
      } else if ((e.key === "Delete" || e.key === "Backspace") && history.selectedId) {
        e.preventDefault();
        dispatch({ type: "remove", id: history.selectedId });
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [history.selectedId, dispatch, confirmOpen]);

  // Ctrl+wheel zoom — native non-passive listener (React's onWheel is passive).
  useEffect(() => {
    const el = pagesRef.current;
    if (!el) return;
    function onWheel(e: WheelEvent) {
      if (!e.ctrlKey) return;
      e.preventDefault();
      zoomBy(e.deltaY < 0 ? SCALE_STEP : -SCALE_STEP);
    }
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [zoomBy, doc.status]);

  const signatureUrls = useMemo(
    () => Object.fromEntries(signatures.map((s) => [s.key, s.url])),
    [signatures],
  );
  const activeSignature = useMemo(() => {
    const asset = signatures.find((s) => s.key === activeSignatureKey);
    return asset ? { key: asset.key, aspectRatio: asset.aspectRatio } : null;
  }, [signatures, activeSignatureKey]);

  function onToolChange(next: ToolId) {
    setTool(next);
    dispatch({ type: "select", id: null });
    // Selecting the signature tool with none yet → open the creation dialog.
    if (next === "signature" && signatures.length === 0) {
      setSigDialogOpen(true);
    }
  }

  function addSignatureFile(f: File) {
    if (signatures.length >= MAX_SIGNATURES) {
      toast(t("editor.signature.limit"), "error");
      return;
    }
    const okType = f.type === "image/png" || f.type === "image/jpeg";
    if (!okType || f.size > MAX_SIGNATURE_BYTES) {
      toast(t("editor.signature.invalid"), "error");
      return;
    }
    // Monotonic counter → collision-proof keys within the session.
    sigCounterRef.current += 1;
    const key = `sig-${sigCounterRef.current}`;
    const url = URL.createObjectURL(f);
    const img = new Image();
    img.onload = () => {
      const aspectRatio =
        img.naturalWidth > 0 ? img.naturalHeight / img.naturalWidth : 0.5;
      setSignatures((prev) => [...prev, { key, file: f, url, aspectRatio }]);
      setActiveSignatureKey(key);
    };
    img.onerror = () => {
      setSignatures((prev) => [...prev, { key, file: f, url, aspectRatio: 0.5 }]);
      setActiveSignatureKey(key);
    };
    img.src = url;
    setSigDialogOpen(false);
  }

  function buildPayload(): { annotations: EditorAnnotation[]; formData: FormData } {
    // Only fields whose live value differs from the document's own value.
    const originals = new Map(formFields.map((f) => [f.name, f.value] as const));
    const fieldAnnotations: EditorAnnotation[] = panelFields
      .filter((f) => f.value !== (originals.get(f.name) ?? ""))
      .map((f) => ({
        kind: "form_field",
        page: formFields.find((w) => w.name === f.name)?.page ?? 0,
        field_name: f.name,
        value: f.value,
        id: newAnnotationId(),
      }));
    const all = [...history.annotations, ...fieldAnnotations];
    const formData = new FormData();
    formData.append("file", file);
    formData.append("annotations", serializeAnnotations(all));
    for (const key of usedSignatureKeys(all)) {
      const asset = signatures.find((s) => s.key === key);
      if (asset) formData.append("signatures", asset.file, asset.key);
    }
    return { annotations: all, formData };
  }

  function onSave() {
    if (saving) return;
    const { annotations, formData } = buildPayload();
    if (hasPermanentEdits(annotations)) {
      setConfirmOpen(true);
      return;
    }
    void submit(formData);
  }

  function onConfirmSave() {
    setConfirmOpen(false);
    void submit(buildPayload().formData);
  }

  return (
    <div className="flex w-full flex-col gap-4">
      <Toolbar
        tool={tool}
        onToolChange={onToolChange}
        hardErase={hardErase}
        onHardEraseChange={setHardErase}
        canUndo={history.past.length > 0}
        canRedo={history.future.length > 0}
        onUndo={() => dispatch({ type: "undo" })}
        onRedo={() => dispatch({ type: "redo" })}
        hasSelection={history.selectedId !== null}
        onDeleteSelected={() => {
          if (history.selectedId) dispatch({ type: "remove", id: history.selectedId });
        }}
        scale={scale}
        onZoomIn={() => zoomBy(SCALE_STEP)}
        onZoomOut={() => zoomBy(-SCALE_STEP)}
        onSave={onSave}
        saving={saving}
        onClose={onClose}
      />

      {/* Hidden signature file input, triggered by the signature tool. */}
      <input
        ref={sigInputRef}
        type="file"
        accept="image/png,image/jpeg"
        tabIndex={-1}
        aria-hidden="true"
        className="sr-only"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) addSignatureFile(f);
          e.target.value = "";
        }}
      />

      {tool === "signature" && (
        <div className="flex flex-wrap items-center gap-3 rounded-md border border-border bg-bg-elevated px-3 py-2 text-xs text-fg-muted">
          <button
            type="button"
            onClick={() => setSigDialogOpen(true)}
            className="rounded-sm font-medium text-accent underline underline-offset-4 hover:text-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {t("editor.signature.add")}
          </button>
          {signatures.length > 0 && (
            <div className="flex items-center gap-2">
              {signatures.map((s) => (
                <button
                  key={s.key}
                  type="button"
                  aria-label={s.file.name}
                  aria-pressed={s.key === activeSignatureKey}
                  onClick={() => setActiveSignatureKey(s.key)}
                  className={
                    "inline-flex h-9 items-center rounded-md border px-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring " +
                    (s.key === activeSignatureKey
                      ? "border-accent bg-accent-subtle"
                      : "border-border bg-bg")
                  }
                >
                  <img src={s.url} alt="" className="max-h-7 max-w-16 object-contain" />
                </button>
              ))}
            </div>
          )}
          {activeSignature && <span>{t("editor.signature.hint")}</span>}
        </div>
      )}

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <div
          ref={pagesRef}
          className="flex min-w-0 flex-1 flex-col items-center gap-6 overflow-x-auto rounded-lg bg-bg-subtle p-4"
        >
          {doc.status === "loading" && (
            <div className="flex items-center gap-2 py-16 text-sm text-fg-muted">
              <Spinner size="sm" label={t("editor.loading")} />
              {t("editor.loading")}
            </div>
          )}
          {doc.status === "error" && (
            <p className="py-16 text-sm text-danger">{t("editor.loadError")}</p>
          )}
          {doc.status === "ready" &&
            doc.pages.map((page, index) => (
              <PageView
                key={index}
                pageIndex={index}
                widthPts={page.width}
                heightPts={page.height}
                scale={scale}
                numPages={doc.numPages}
                renderPage={renderPage}
                tool={tool}
                hardErase={hardErase}
                annotations={history.annotations.filter((a) => a.page === index)}
                selectedId={history.selectedId}
                signatureUrls={signatureUrls}
                activeSignature={activeSignature}
                dispatch={dispatch}
                formFields={formFields.filter((f) => f.page === index)}
                formValues={formValues}
                onFormEdit={editFormField}
              />
            ))}
        </div>

        <aside className="w-full lg:w-80 lg:shrink-0">
          <FormFieldsPanel fields={panelFields} onEdit={editFormField} />
        </aside>
      </div>

      <SignatureDialog
        open={sigDialogOpen}
        onClose={() => setSigDialogOpen(false)}
        onCreate={addSignatureFile}
        onPickImage={() => sigInputRef.current?.click()}
      />

      <ConfirmDialog
        open={confirmOpen}
        title={t("editor.confirm.title")}
        body={t("editor.confirm.body")}
        confirmLabel={t("editor.confirm.ok")}
        cancelLabel={t("editor.confirm.cancel")}
        onConfirm={onConfirmSave}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}
