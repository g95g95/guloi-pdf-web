/**
 * Adobe-style signature dialog: draw / type / upload, wired through the
 * Editor page. Canvas 2D is stubbed (jsdom has no canvas implementation).
 */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "../components/I18nProvider";
import { ToastProvider } from "../components/ui";
import { Editor } from "../pages/Editor";

vi.mock("../lib/upload", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/upload")>();
  return { ...actual, uploadWithProgress: vi.fn() };
});
vi.mock("../lib/download", () => ({ downloadBlob: vi.fn() }));

vi.mock("./usePdfDocument", () => ({
  usePdfDocument: vi.fn((file: File | null) => ({
    state: file
      ? {
          status: "ready",
          numPages: 1,
          pages: [{ width: 600, height: 800 }],
          formFields: [],
        }
      : { status: "idle" },
    renderPage: vi.fn().mockResolvedValue(undefined),
  })),
}));

class MockImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  naturalWidth = 200;
  naturalHeight = 80;
  set src(_v: string) {
    queueMicrotask(() => this.onload?.());
  }
}

const ctxStub = {
  clearRect: vi.fn(),
  beginPath: vi.fn(),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  stroke: vi.fn(),
  fillText: vi.fn(),
  measureText: vi.fn(() => ({ width: 120 })),
  drawImage: vi.fn(),
  getImageData: vi.fn((_x: number, _y: number, w: number, h: number) => ({
    data: new Uint8ClampedArray(w * h * 4).fill(255),
  })),
};

function renderEditor() {
  return render(
    <I18nProvider>
      <ToastProvider>
        <Editor />
      </ToastProvider>
    </I18nProvider>,
  );
}

async function openEditor(user: ReturnType<typeof userEvent.setup>) {
  const input = document.querySelector('input[type="file"]') as HTMLInputElement;
  await user.upload(input, new File(["%PDF-1.4"], "doc.pdf", { type: "application/pdf" }));
  await screen.findByRole("toolbar");
}

beforeEach(() => {
  localStorage.setItem("guloi-lang", "it");
  vi.stubGlobal("Image", MockImage);
  URL.createObjectURL = vi.fn(() => "blob:mock");
  URL.revokeObjectURL = vi.fn();
  HTMLCanvasElement.prototype.getContext = vi.fn(
    () => ctxStub,
  ) as unknown as typeof HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.toBlob = vi.fn(function (cb: BlobCallback) {
    cb(new Blob(["png"], { type: "image/png" }));
  });
});
afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe("SignatureDialog", () => {
  it("opens when the signature tool is selected with no signatures yet", async () => {
    const user = userEvent.setup();
    renderEditor();
    await openEditor(user);

    await user.click(screen.getByRole("button", { name: "Firma" }));
    expect(screen.getByRole("dialog", { name: "Aggiungi firma" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "A mano" })).toHaveAttribute(
      "aria-selected", "true",
    );
  });

  it("typed signature: writes the name, confirms, signature ready to place", async () => {
    const user = userEvent.setup();
    renderEditor();
    await openEditor(user);
    await user.click(screen.getByRole("button", { name: "Firma" }));

    await user.click(screen.getByRole("tab", { name: "Digita" }));
    await user.type(screen.getByPlaceholderText("Il tuo nome"), "Mario Rossi");
    await user.click(screen.getByRole("button", { name: "Usa firma" }));

    await screen.findByText("Clicca sulla pagina per posizionare la firma");
    expect(screen.queryByRole("dialog", { name: "Aggiungi firma" })).not.toBeInTheDocument();
  });

  it("drawn signature: strokes enable the confirm button and create the asset", async () => {
    const user = userEvent.setup();
    renderEditor();
    await openEditor(user);
    await user.click(screen.getByRole("button", { name: "Firma" }));

    const confirm = screen.getByRole("button", { name: "Usa firma" });
    expect(confirm).toBeDisabled();

    const canvas = screen.getByTestId("signature-canvas");
    fireEvent.pointerDown(canvas, { clientX: 20, clientY: 40, button: 0, pointerId: 1 });
    fireEvent.pointerMove(canvas, { clientX: 120, clientY: 60, pointerId: 1 });
    fireEvent.pointerUp(canvas, { pointerId: 1 });

    expect(confirm).toBeEnabled();
    await user.click(confirm);
    await screen.findByText("Clicca sulla pagina per posizionare la firma");
  });

  it("upload tab exposes the image picker; Escape closes the dialog", async () => {
    const user = userEvent.setup();
    renderEditor();
    await openEditor(user);
    await user.click(screen.getByRole("button", { name: "Firma" }));

    await user.click(screen.getByRole("tab", { name: "Immagine" }));
    expect(
      screen.getByRole("button", { name: "Carica immagine firma (PNG o JPG)" }),
    ).toBeInTheDocument();

    await user.keyboard("{Escape}");
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Aggiungi firma" })).not.toBeInTheDocument(),
    );
  });

  it("placed signature ends up in the save payload (unchanged pipeline)", async () => {
    const user = userEvent.setup();
    const { uploadWithProgress } = await import("../lib/upload");
    (uploadWithProgress as ReturnType<typeof vi.fn>).mockResolvedValue({
      blob: new Blob(["pdf"], { type: "application/pdf" }),
      filename: "modificato.pdf",
    });
    renderEditor();
    await openEditor(user);
    await user.click(screen.getByRole("button", { name: "Firma" }));
    await user.click(screen.getByRole("tab", { name: "Digita" }));
    await user.type(screen.getByPlaceholderText("Il tuo nome"), "MR");
    await user.click(screen.getByRole("button", { name: "Usa firma" }));
    await screen.findByText("Clicca sulla pagina per posizionare la firma");

    fireEvent.pointerDown(screen.getByTestId("editor-page-0"), {
      clientX: 200, clientY: 300, button: 0, pointerId: 1,
    });
    await user.click(screen.getByRole("button", { name: "SALVA PDF" }));
    await waitFor(() => expect(uploadWithProgress).toHaveBeenCalled());

    const fd = (uploadWithProgress as ReturnType<typeof vi.fn>).mock.calls.at(-1)![1] as FormData;
    const parts = fd.getAll("signatures") as File[];
    expect(parts).toHaveLength(1);
    expect(parts[0]!.type).toBe("image/png");
    const anns = JSON.parse(fd.get("annotations") as string) as { kind: string }[];
    expect(anns.some((a) => a.kind === "signature")).toBe(true);
  });
});
