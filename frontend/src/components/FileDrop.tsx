import { forwardRef, useId, useRef, useState } from "react";
import { cn } from "../lib/cn";
import { useT } from "../lib/i18n";

export interface FileDropProps {
  /** Allow more than one file (enables reordering). */
  multiple?: boolean;
  /** Hard cap on the number of selected files. */
  maxFiles?: number;
  /** Per-file size limit in MB — mirror of the backend limit. */
  maxSizeMB?: number;
  /** Controlled list of selected files. */
  value: File[];
  onChange: (files: File[]) => void;
  disabled?: boolean;
  /** Optional heading shown above the drop zone. */
  label?: string;
}

const PDF_MIME = "application/pdf";

function isPdf(file: File): boolean {
  return (
    file.type === PDF_MIME ||
    (file.type === "" && file.name.toLowerCase().endsWith(".pdf"))
  );
}

/** Human-readable file size, e.g. "1,2 MB". */
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(0)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(1).replace(".", ",")} MB`;
}

export const FileDrop = forwardRef<HTMLDivElement, FileDropProps>(
  function FileDrop(
    {
      multiple = false,
      maxFiles,
      maxSizeMB = 50,
      value,
      onChange,
      disabled = false,
      label,
    },
    ref,
  ) {
    const t = useT();
    const inputRef = useRef<HTMLInputElement>(null);
    const [dragOver, setDragOver] = useState(false);
    const [errors, setErrors] = useState<string[]>([]);
    const dragDepth = useRef(0);
    const errorId = useId();

    const cap = multiple ? maxFiles : 1;
    const maxBytes = maxSizeMB * 1024 * 1024;

    function openPicker() {
      if (!disabled) inputRef.current?.click();
    }

    function addFiles(incoming: FileList | File[]) {
      const list = Array.from(incoming);
      const accepted: File[] = [];
      const rejected: string[] = [];

      for (const file of list) {
        if (!isPdf(file)) {
          rejected.push(t("filedrop.notPdf", { name: file.name }));
          continue;
        }
        if (file.size > maxBytes) {
          rejected.push(t("filedrop.tooBig", { name: file.name, max: maxSizeMB }));
          continue;
        }
        accepted.push(file);
      }

      let next = multiple ? [...value, ...accepted] : accepted.slice(-1);
      if (cap !== undefined && next.length > cap) {
        const overflow = next.length - cap;
        next = next.slice(0, cap);
        rejected.push(
          overflow === 1
            ? t("filedrop.overflowOne")
            : t("filedrop.overflowMany", { n: overflow, cap }),
        );
      }

      setErrors(rejected);
      if (next.length !== value.length || accepted.length > 0) {
        onChange(next);
      }
    }

    function removeAt(index: number) {
      onChange(value.filter((_, i) => i !== index));
    }

    function move(index: number, delta: number) {
      const target = index + delta;
      if (target < 0 || target >= value.length) return;
      const next = [...value];
      const tmp = next[index]!;
      next[index] = next[target]!;
      next[target] = tmp;
      onChange(next);
    }

    function onDrop(event: React.DragEvent) {
      event.preventDefault();
      dragDepth.current = 0;
      setDragOver(false);
      if (disabled) return;
      if (event.dataTransfer?.files?.length) addFiles(event.dataTransfer.files);
    }

    const hasFiles = value.length > 0;

    return (
      <div ref={ref} className="flex flex-col gap-3">
        {label && (
          <span className="text-sm font-medium text-fg">{label}</span>
        )}

        <div
          role="button"
          tabIndex={disabled ? -1 : 0}
          aria-label={t("filedrop.aria")}
          aria-disabled={disabled || undefined}
          aria-describedby={errors.length ? errorId : undefined}
          data-dragover={dragOver}
          onClick={openPicker}
          onKeyDown={(e) => {
            if (disabled) return;
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              openPicker();
            }
          }}
          onDragEnter={(e) => {
            e.preventDefault();
            if (disabled) return;
            dragDepth.current += 1;
            setDragOver(true);
          }}
          onDragOver={(e) => e.preventDefault()}
          onDragLeave={(e) => {
            e.preventDefault();
            dragDepth.current = Math.max(0, dragDepth.current - 1);
            if (dragDepth.current === 0) setDragOver(false);
          }}
          onDrop={onDrop}
          className={cn(
            "flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-6 py-10 text-center",
            "transition-colors duration-[var(--duration-fast)] ease-[var(--ease-out)]",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
            disabled
              ? "cursor-not-allowed border-border bg-bg-subtle opacity-55"
              : "cursor-pointer",
            dragOver
              ? "border-accent bg-accent-subtle"
              : hasFiles
                ? "border-border-strong bg-bg-elevated"
                : "border-border bg-bg-elevated hover:border-border-strong hover:bg-bg-subtle",
          )}
        >
          <svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
            className="text-fg-muted"
          >
            <path
              d="M12 16V4m0 0L7 9m5-5l5 5M5 20h14"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span className="text-sm text-fg">
            {multiple ? t("filedrop.promptMany") : t("filedrop.promptOne")}
            <span className="font-medium text-accent">{t("filedrop.browse")}</span>
          </span>
          <span className="text-xs text-fg-muted">
            {multiple && cap !== undefined
              ? t("filedrop.hintCap", { max: maxSizeMB, cap })
              : t("filedrop.hint", { max: maxSizeMB })}
          </span>
        </div>

        {/* Kept a sibling of (not nested inside) the role=button drop zone so
            no interactive control is nested in another — the zone triggers it
            programmatically via the ref. */}
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          multiple={multiple}
          disabled={disabled}
          tabIndex={-1}
          aria-hidden="true"
          className="sr-only"
          onChange={(e) => {
            if (e.target.files?.length) addFiles(e.target.files);
            // Reset so selecting the same file again re-fires change.
            e.target.value = "";
          }}
        />

        {errors.length > 0 && (
          <div
            id={errorId}
            role="alert"
            className="flex flex-col gap-1 text-sm text-danger"
          >
            {errors.map((msg, i) => (
              <span key={i}>{msg}</span>
            ))}
          </div>
        )}

        {hasFiles && (
          <ul className="flex flex-col gap-2">
            {value.map((file, index) => (
              <li
                key={`${file.name}-${index}`}
                className="flex items-center gap-3 rounded-md border border-border bg-bg-elevated px-3 py-2"
              >
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm text-fg">{file.name}</span>
                  <span className="text-xs text-fg-muted">
                    {formatSize(file.size)}
                  </span>
                </div>

                {multiple && value.length > 1 && (
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      disabled={disabled || index === 0}
                      aria-label={t("filedrop.moveUp", { name: file.name })}
                      onClick={() => move(index, -1)}
                      className="rounded-sm p-1 text-fg-muted transition-colors duration-[var(--duration-fast)] hover:text-fg disabled:pointer-events-none disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                        <path d="M8 12V4m0 0L4 8m4-4l4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      disabled={disabled || index === value.length - 1}
                      aria-label={t("filedrop.moveDown", { name: file.name })}
                      onClick={() => move(index, 1)}
                      className="rounded-sm p-1 text-fg-muted transition-colors duration-[var(--duration-fast)] hover:text-fg disabled:pointer-events-none disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                        <path d="M8 4v8m0 0l4-4m-4 4L4 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                  </div>
                )}

                <button
                  type="button"
                  disabled={disabled}
                  aria-label={t("filedrop.remove", { name: file.name })}
                  onClick={() => removeAt(index)}
                  className="shrink-0 rounded-sm p-1 text-fg-muted transition-colors duration-[var(--duration-fast)] hover:text-danger disabled:pointer-events-none disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                    <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                  </svg>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  },
);
