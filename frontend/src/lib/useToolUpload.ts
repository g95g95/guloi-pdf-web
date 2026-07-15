import { useCallback, useRef, useState } from "react";
import { uploadWithProgress, UploadError } from "./upload";
import { useToast } from "../components/ui";
import { useT, type MessageKey } from "./i18n";

/** State machine for a single tool submission. */
export type ToolState =
  | { status: "idle" }
  | { status: "uploading"; pct: number }
  | { status: "processing" }
  | { status: "done"; blob: Blob; filename: string }
  | { status: "error" };

/** Map an UploadError to a user-facing message key. */
function errorKey(err: unknown): MessageKey {
  if (err instanceof UploadError) {
    switch (err.status) {
      case 413:
        return "error.tooLarge";
      case 415:
        return "error.notPdf";
      case 429:
        return "error.tooMany";
      case 504:
        return "error.timeout";
      case 422:
        return "error.invalid"; // detail (if any) is surfaced separately below
    }
  }
  return "error.generic";
}

/**
 * Drives one tool upload: idle → uploading(pct) → processing → done | error.
 * On failure it shows a toast (mapped from the HTTP status) and resets to idle
 * so the form stays usable. Returns the current state plus `submit`/`reset`.
 */
export function useToolUpload(endpoint: string) {
  const t = useT();
  const { toast } = useToast();
  const [state, setState] = useState<ToolState>({ status: "idle" });
  // Guards against a stale response resolving after a reset.
  const runId = useRef(0);

  const submit = useCallback(
    async (formData: FormData) => {
      const id = ++runId.current;
      setState({ status: "uploading", pct: 0 });
      try {
        const result = await uploadWithProgress(endpoint, formData, (pct) => {
          if (runId.current !== id) return;
          // 100% uploaded → server is now processing.
          setState(pct >= 100 ? { status: "processing" } : { status: "uploading", pct });
        });
        if (runId.current !== id) return;
        setState({ status: "done", blob: result.blob, filename: result.filename });
      } catch (err) {
        if (runId.current !== id) return;
        const key = errorKey(err);
        const detail =
          key === "error.invalid" && err instanceof UploadError && err.detail
            ? err.detail
            : t(key);
        toast(detail, "error");
        setState({ status: "idle" });
      }
    },
    [endpoint, t, toast],
  );

  const reset = useCallback(() => {
    runId.current += 1;
    setState({ status: "idle" });
  }, []);

  return { state, submit, reset };
}
