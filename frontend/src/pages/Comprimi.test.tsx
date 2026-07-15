import type { ReactNode } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Comprimi } from "./Comprimi";
import { UploadError } from "../lib/upload";
import { I18nProvider } from "../components/I18nProvider";
import { ToastProvider } from "../components/ui";

const uploadMock = vi.hoisted(() => vi.fn());
vi.mock("../lib/upload", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/upload")>();
  return { ...actual, uploadWithProgress: uploadMock };
});

function renderPage(node: ReactNode) {
  return render(
    <I18nProvider>
      <ToastProvider>{node}</ToastProvider>
    </I18nProvider>,
  );
}

function pdf(name = "doc.pdf"): File {
  const file = new File(["%PDF-1.4"], name, { type: "application/pdf" });
  Object.defineProperty(file, "size", { value: 1024 });
  return file;
}

function fileInput(): HTMLInputElement {
  return document.querySelector('input[type="file"]') as HTMLInputElement;
}

beforeEach(() => localStorage.setItem("guloi-lang", "it"));
afterEach(() => {
  uploadMock.mockReset();
  localStorage.clear();
});

describe("Comprimi page", () => {
  it("renders the compress action and the images option", () => {
    renderPage(<Comprimi />);
    expect(screen.getByRole("button", { name: "COMPRIMI" })).toBeInTheDocument();
    expect(
      screen.getByLabelText(/comprimi anche le immagini/i),
    ).toBeInTheDocument();
  });

  it("disables submit until a file is selected", () => {
    renderPage(<Comprimi />);
    expect(screen.getByRole("button", { name: "COMPRIMI" })).toBeDisabled();
  });

  it("uploads and shows a download button on success", async () => {
    const user = userEvent.setup();
    uploadMock.mockResolvedValue({
      blob: new Blob(["ok"], { type: "application/pdf" }),
      filename: "compresso.pdf",
    });
    renderPage(<Comprimi />);

    await user.upload(fileInput(), pdf());
    await user.click(screen.getByRole("button", { name: "COMPRIMI" }));

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /scarica/i })).toBeInTheDocument(),
    );
    expect(uploadMock).toHaveBeenCalledWith(
      "/api/compress",
      expect.any(FormData),
      expect.any(Function),
    );
  });

  it("shows the compression savings readout after a successful compress", async () => {
    const user = userEvent.setup();
    // Input file is 1024 B (1 KB); result blob is 512 B → 50% saved.
    const out = new Blob([new Uint8Array(512)], { type: "application/pdf" });
    uploadMock.mockResolvedValue({ blob: out, filename: "compresso.pdf" });
    renderPage(<Comprimi />);

    await user.upload(fileInput(), pdf());
    await user.click(screen.getByRole("button", { name: "COMPRIMI" }));

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /scarica/i })).toBeInTheDocument(),
    );
    // "Prima: 1 KB · Dopo: 1 KB · Risparmio: 50%" (512 B rounds to 1 KB)
    expect(screen.getByText(/Risparmio: 50%/)).toBeInTheDocument();
  });

  it("switches to target mode and sends target_mb instead of compress_images", async () => {
    const user = userEvent.setup();
    uploadMock.mockResolvedValue({
      blob: new Blob(["ok"], { type: "application/pdf" }),
      filename: "compresso.pdf",
      targetMet: true,
    });
    renderPage(<Comprimi />);

    await user.upload(fileInput(), pdf());
    await user.click(screen.getByRole("radio", { name: /dimensione desiderata/i }));
    expect(screen.getByRole("slider")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "COMPRIMI" }));

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /scarica/i })).toBeInTheDocument(),
    );
    const sentFormData = uploadMock.mock.calls[0]?.[1] as FormData;
    expect(sentFormData.has("target_mb")).toBe(true);
    expect(sentFormData.has("compress_images")).toBe(false);
  });

  it("shows a warning when the target size could not be met", async () => {
    const user = userEvent.setup();
    const out = new Blob([new Uint8Array(2048)], { type: "application/pdf" });
    uploadMock.mockResolvedValue({ blob: out, filename: "compresso.pdf", targetMet: false });
    renderPage(<Comprimi />);

    await user.upload(fileInput(), pdf());
    await user.click(screen.getByRole("radio", { name: /dimensione desiderata/i }));
    await user.click(screen.getByRole("button", { name: "COMPRIMI" }));

    await waitFor(() =>
      expect(screen.getByText(/non è stato possibile scendere sotto/i)).toBeInTheDocument(),
    );
  });

  it("accepts multiple files and sends them all under the files field", async () => {
    const user = userEvent.setup();
    uploadMock.mockResolvedValue({
      blob: new Blob(["ok"], { type: "application/zip" }),
      filename: "compressi.zip",
    });
    renderPage(<Comprimi />);

    await user.upload(fileInput(), [pdf("a.pdf"), pdf("b.pdf")]);
    await user.click(screen.getByRole("button", { name: "COMPRIMI" }));

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /scarica/i })).toBeInTheDocument(),
    );
    const sentFormData = uploadMock.mock.calls[0]?.[1] as FormData;
    expect(sentFormData.getAll("files")).toHaveLength(2);
  });

  it("shows the too-large toast on a 413 error", async () => {
    const user = userEvent.setup();
    uploadMock.mockRejectedValue(new UploadError("too big", 413));
    renderPage(<Comprimi />);

    await user.upload(fileInput(), pdf());
    await user.click(screen.getByRole("button", { name: "COMPRIMI" }));

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(/troppo grande/i),
    );
  });
});
