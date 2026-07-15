import type { ReactNode } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useToolUpload } from "./useToolUpload";
import { UploadError } from "./upload";
import { I18nProvider } from "../components/I18nProvider";
import { ToastProvider } from "../components/ui";

const uploadMock = vi.hoisted(() => vi.fn());
vi.mock("./upload", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./upload")>();
  return { ...actual, uploadWithProgress: uploadMock };
});

function wrapper({ children }: { children: ReactNode }) {
  return (
    <I18nProvider>
      <ToastProvider>{children}</ToastProvider>
    </I18nProvider>
  );
}

afterEach(() => {
  uploadMock.mockReset();
});

describe("useToolUpload state machine", () => {
  it("starts idle", () => {
    const { result } = renderHook(() => useToolUpload("/api/compress"), { wrapper });
    expect(result.current.state.status).toBe("idle");
  });

  it("goes idle → uploading → processing → done", async () => {
    const blob = new Blob(["x"], { type: "application/pdf" });
    let reportProgress: (pct: number) => void = () => {};
    uploadMock.mockImplementation(
      (_url: string, _fd: FormData, onProgress: (pct: number) => void) => {
        reportProgress = onProgress;
        return new Promise((resolve) => {
          setTimeout(() => resolve({ blob, filename: "out.pdf" }), 0);
        });
      },
    );

    const { result } = renderHook(() => useToolUpload("/api/compress"), { wrapper });

    act(() => {
      void result.current.submit(new FormData());
    });
    expect(result.current.state.status).toBe("uploading");

    act(() => reportProgress(50));
    expect(result.current.state).toMatchObject({ status: "uploading", pct: 50 });

    act(() => reportProgress(100));
    expect(result.current.state.status).toBe("processing");

    await waitFor(() => expect(result.current.state.status).toBe("done"));
    expect(result.current.state).toMatchObject({ status: "done", filename: "out.pdf" });
  });

  it("returns to idle on error", async () => {
    uploadMock.mockRejectedValue(new UploadError("boom", 413));
    const { result } = renderHook(() => useToolUpload("/api/compress"), { wrapper });

    await act(async () => {
      await result.current.submit(new FormData());
    });
    expect(result.current.state.status).toBe("idle");
  });

  it("reset returns to idle after done", async () => {
    uploadMock.mockResolvedValue({
      blob: new Blob(["x"]),
      filename: "out.pdf",
    });
    const { result } = renderHook(() => useToolUpload("/api/compress"), { wrapper });

    await act(async () => {
      await result.current.submit(new FormData());
    });
    expect(result.current.state.status).toBe("done");

    act(() => result.current.reset());
    expect(result.current.state.status).toBe("idle");
  });
});
