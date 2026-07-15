import { useEffect, useRef, useState, type ReactNode } from "react";
import { Button, Card, CardBody, ProgressBar, Spinner } from "./ui";
import { FileDrop } from "./FileDrop";
import { useToolUpload } from "../lib/useToolUpload";
import { downloadBlob } from "../lib/download";
import { useT, type MessageKey } from "../lib/i18n";
import { useDocumentMeta } from "../lib/useDocumentMeta";

export interface ToolPageProps {
  /** i18n key for the tool title (also the page heading). */
  titleKey: MessageKey;
  /** i18n key for the one-line description. */
  descKey: MessageKey;
  /** Backend endpoint, e.g. "/api/compress". */
  endpoint: string;
  /** i18n key for the submit button label (e.g. "compress.action"). */
  actionKey: MessageKey;
  /** Inline hand-drawn icon for the header. */
  icon: ReactNode;
  /** FileDrop config. */
  multiple?: boolean;
  maxFiles?: number;
  /** Optional hint shown under the drop zone. */
  hint?: ReactNode;
  /**
   * Renders the tool-specific option controls. Receives whether the form is
   * disabled (during upload/processing).
   */
  renderOptions?: (disabled: boolean) => ReactNode;
  /**
   * Builds the FormData from the selected files. Return `null` to block submit
   * (e.g. client-side validation failed — the tool surfaces its own message).
   */
  buildFormData: (files: File[]) => FormData | null;
  /** Enable submit only when this returns true (defaults to ≥1 file). */
  canSubmit?: (files: File[]) => boolean;
  /**
   * Optional extra line rendered inside the result panel (below the download
   * action). Receives the total size of the submitted input files and the
   * result blob so a tool can show e.g. a compression savings readout.
   */
  renderResultMeta?: (info: { inputBytes: number; blob: Blob }) => ReactNode;
}

/**
 * Shared layout + workflow for every tool page: FileDrop, options slot, submit
 * with progress, and a result panel with download + reset. The per-tool logic
 * lives entirely in the props so there is no duplication across the 7 pages.
 */
export function ToolPage({
  titleKey,
  descKey,
  endpoint,
  actionKey,
  icon,
  multiple = false,
  maxFiles,
  hint,
  renderOptions,
  buildFormData,
  canSubmit,
  renderResultMeta,
}: ToolPageProps) {
  const t = useT();
  useDocumentMeta(`${t(titleKey)} · ${t("app.name")}`, t(descKey));
  const [files, setFiles] = useState<File[]>([]);
  // Total size of the files submitted for the current run, captured at submit
  // time so the result panel can compare input vs output (e.g. compression).
  const [inputBytes, setInputBytes] = useState(0);
  const { state, submit, reset } = useToolUpload(endpoint);

  const busy = state.status === "uploading" || state.status === "processing";
  const submittable = canSubmit ? canSubmit(files) : files.length > 0;

  // Focus management: land keyboard/SR users on the result panel when a run
  // finishes, and return focus to the drop zone after a reset.
  const resultRef = useRef<HTMLDivElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);
  const done = state.status === "done";
  const returnFocus = useRef(false);

  useEffect(() => {
    if (done) {
      resultRef.current?.focus();
    } else if (returnFocus.current) {
      returnFocus.current = false;
      // The drop zone's focusable element is the role="button" inside the wrapper.
      dropRef.current?.querySelector<HTMLElement>('[role="button"]')?.focus();
    }
  }, [done]);

  function onSubmit() {
    const formData = buildFormData(files);
    if (formData) {
      setInputBytes(files.reduce((sum, f) => sum + f.size, 0));
      void submit(formData);
    }
  }

  function onReset() {
    returnFocus.current = true;
    setFiles([]);
    reset();
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg bg-accent-subtle text-accent">
            {icon}
          </span>
          <h1 className="text-2xl font-semibold tracking-tight">{t(titleKey)}</h1>
        </div>
        <p className="text-sm text-fg-muted">{t(descKey)}</p>
      </div>

      {state.status === "done" ? (
        <Card>
          <CardBody
            ref={resultRef}
            tabIndex={-1}
            role="group"
            aria-label={t("tool.done")}
            className="flex flex-col items-center gap-4 text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg"
          >
            <span className="inline-flex size-12 items-center justify-center rounded-full bg-accent-subtle text-accent">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M4 12.5l5 5 11-11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <p className="text-sm text-fg">{t("tool.done")}</p>
            {renderResultMeta && (
              <p className="text-xs text-fg-muted">
                {renderResultMeta({ inputBytes, blob: state.blob })}
              </p>
            )}
            <Button
              onClick={() => downloadBlob(state.blob, state.filename)}
              leftIcon={
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M12 3v12m0 0l-4-4m4 4l4-4M5 21h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              }
            >
              {t("tool.download")}
            </Button>
            <button
              type="button"
              onClick={onReset}
              className="text-sm text-fg-muted underline underline-offset-4 transition-colors hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
            >
              {t("tool.reset")}
            </button>
          </CardBody>
        </Card>
      ) : (
        <Card>
          <CardBody className="flex flex-col gap-5">
            <FileDrop
              ref={dropRef}
              multiple={multiple}
              {...(maxFiles !== undefined ? { maxFiles } : {})}
              value={files}
              onChange={setFiles}
              disabled={busy}
            />
            {hint && <p className="text-xs text-fg-muted">{hint}</p>}

            {renderOptions && (
              <div className="flex flex-col gap-4">{renderOptions(busy)}</div>
            )}

            {/* Reserve the progress slot so the layout does not shift when a
                run starts. Empty (but sized) while idle. */}
            <div className="flex min-h-[3.25rem] flex-col justify-center gap-2" aria-hidden={!busy}>
              {busy && (
                <>
                  <ProgressBar
                    value={state.status === "uploading" ? state.pct : null}
                    label={t("tool.progress")}
                  />
                  <span className="flex items-center gap-2 text-xs text-fg-muted">
                    <Spinner size="sm" label={t("tool.processing")} />
                    {state.status === "uploading" ? t("tool.uploading") : t("tool.processing")}
                  </span>
                </>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <Button
                size="lg"
                loading={busy}
                disabled={!submittable}
                onClick={onSubmit}
              >
                {t(actionKey)}
              </Button>
              {/* Reserved so toggling the hint never shifts the button. */}
              <span className="min-h-[1.125rem] text-center text-xs text-fg-muted">
                {!submittable && files.length === 0 ? t("tool.selectFile") : ""}
              </span>
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
