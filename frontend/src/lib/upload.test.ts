import { afterEach, describe, expect, it, vi } from "vitest";
import { UploadError, uploadWithProgress } from "./upload";

/** Minimal fake XHR whose behaviour tests drive step by step. */
class FakeXHR {
  static last: FakeXHR;
  upload = { onprogress: null as ((e: ProgressEvent) => void) | null };
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  ontimeout: (() => void) | null = null;
  status = 0;
  response: unknown = null;
  responseType = "";
  private headers: Record<string, string> = {};

  constructor() {
    FakeXHR.last = this;
  }

  open = vi.fn();
  setRequestHeader = vi.fn();
  send = vi.fn();
  getResponseHeader = (name: string) =>
    this.headers[name.toLowerCase()] ?? null;

  // Test helpers ---------------------------------------------------------
  __setResponseHeader(name: string, value: string) {
    this.headers[name.toLowerCase()] = value;
  }
  __emitProgress(loaded: number, total: number) {
    this.upload.onprogress?.({
      lengthComputable: true,
      loaded,
      total,
    } as ProgressEvent);
  }
  __succeed(status: number, response: unknown) {
    this.status = status;
    this.response = response;
    this.onload?.();
  }
}

afterEach(() => {
  vi.unstubAllGlobals();
});

function stubXHR() {
  vi.stubGlobal("XMLHttpRequest", FakeXHR as unknown as typeof XMLHttpRequest);
}

describe("uploadWithProgress", () => {
  it("reports progress percentages during upload", async () => {
    stubXHR();
    const onProgress = vi.fn();
    const promise = uploadWithProgress("/api/x", new FormData(), onProgress);
    const xhr = FakeXHR.last;
    xhr.__emitProgress(50, 200);
    xhr.__emitProgress(200, 200);
    expect(onProgress).toHaveBeenNthCalledWith(1, 25);
    expect(onProgress).toHaveBeenNthCalledWith(2, 100);
    xhr.__setResponseHeader("Content-Disposition", 'attachment; filename="r.pdf"');
    xhr.__succeed(200, new Blob(["ok"]));
    await promise;
  });

  it("resolves with the blob and filename parsed from Content-Disposition", async () => {
    stubXHR();
    const promise = uploadWithProgress("/api/x", new FormData(), () => {});
    const xhr = FakeXHR.last;
    const blob = new Blob(["pdf-bytes"], { type: "application/pdf" });
    xhr.__setResponseHeader(
      "Content-Disposition",
      'attachment; filename="risultato.pdf"',
    );
    xhr.__succeed(200, blob);
    const result = await promise;
    expect(result.blob).toBe(blob);
    expect(result.filename).toBe("risultato.pdf");
  });

  it("rejects with status and server detail on HTTP error", async () => {
    stubXHR();
    const promise = uploadWithProgress("/api/x", new FormData(), () => {});
    const xhr = FakeXHR.last;
    const errBlob = new Blob([JSON.stringify({ detail: "File non valido" })], {
      type: "application/json",
    });
    xhr.__succeed(422, errBlob);
    await expect(promise).rejects.toBeInstanceOf(UploadError);
    await promise.catch((e: UploadError) => {
      expect(e.status).toBe(422);
      expect(e.detail).toBe("File non valido");
    });
  });

  it("parses RFC 5987 filename*= (percent-encoded UTF-8) from Content-Disposition", async () => {
    stubXHR();
    const promise = uploadWithProgress("/api/x", new FormData(), () => {});
    const xhr = FakeXHR.last;
    xhr.__setResponseHeader(
      "Content-Disposition",
      "attachment; filename*=UTF-8''ricevuta%20perch%C3%A9.pdf",
    );
    xhr.__succeed(200, new Blob(["pdf"]));
    const result = await promise;
    expect(result.filename).toBe("ricevuta perché.pdf");
  });

  it("rejects on network error", async () => {
    stubXHR();
    const promise = uploadWithProgress("/api/x", new FormData(), () => {});
    FakeXHR.last.onerror?.();
    await expect(promise).rejects.toBeInstanceOf(UploadError);
  });
});
