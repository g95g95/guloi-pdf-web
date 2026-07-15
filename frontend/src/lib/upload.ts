/**
 * Upload a FormData body with progress reporting.
 *
 * Uses XMLHttpRequest because fetch cannot report upload progress. Resolves
 * with the response blob and the filename parsed from Content-Disposition;
 * rejects with an {@link UploadError} carrying the HTTP status and, when the
 * server sent a JSON `{ detail }` body, that message (Task 9 maps these to
 * toasts).
 */

/** Error thrown for any non-2xx response, network failure or timeout. */
export class UploadError extends Error {
  /** HTTP status, or 0 for network/timeout failures. */
  readonly status: number;
  /** Server-provided `detail` message when present. */
  readonly detail: string | undefined;

  constructor(message: string, status: number, detail?: string) {
    super(message);
    this.name = "UploadError";
    this.status = status;
    this.detail = detail;
  }
}

export interface UploadResult {
  blob: Blob;
  filename: string;
}

/** Extract the filename from a Content-Disposition header, if any. */
function parseFilename(header: string | null): string {
  if (!header) return "download.pdf";
  // RFC 5987 extended form takes precedence over the plain quoted form.
  const extended = /filename\*=(?:UTF-8'')?([^;]+)/i.exec(header);
  if (extended?.[1]) {
    try {
      return decodeURIComponent(extended[1].trim().replace(/^["']|["']$/g, ""));
    } catch {
      /* fall through to the plain form */
    }
  }
  const plain = /filename="?([^";]+)"?/i.exec(header);
  return plain?.[1] ? plain[1].trim() : "download.pdf";
}

/** Read a `{ detail }` message out of a JSON error blob. */
async function readDetail(blob: Blob): Promise<string | undefined> {
  try {
    const text = await blob.text();
    const parsed = JSON.parse(text) as { detail?: unknown };
    return typeof parsed.detail === "string" ? parsed.detail : undefined;
  } catch {
    return undefined;
  }
}

export function uploadWithProgress(
  url: string,
  formData: FormData,
  onProgress: (pct: number) => void,
): Promise<UploadResult> {
  return new Promise<UploadResult>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.responseType = "blob";

    xhr.upload.onprogress = (event: ProgressEvent) => {
      if (event.lengthComputable && event.total > 0) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };

    xhr.onload = () => {
      const blob = xhr.response as Blob;
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve({
          blob,
          filename: parseFilename(xhr.getResponseHeader("Content-Disposition")),
        });
        return;
      }
      void readDetail(blob).then((detail) =>
        reject(
          new UploadError(
            detail ?? `Errore ${xhr.status}`,
            xhr.status,
            detail,
          ),
        ),
      );
    };

    xhr.onerror = () =>
      reject(new UploadError("Errore di rete", 0));
    xhr.ontimeout = () =>
      reject(new UploadError("Richiesta scaduta", 0));

    xhr.send(formData);
  });
}
