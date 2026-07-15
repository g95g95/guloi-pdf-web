/**
 * Save-pipeline integration tests: gestures are simulated with pointer
 * events on the (mocked-pdf.js) page, then the FormData handed to
 * uploadWithProgress is asserted against the exact multipart contract.
 *
 * MAX_ANNOTATIONS is mocked down to 2 so the cap toast is testable without
 * 500 gestures (the real 500 cap is covered by the pure reducer test in
 * history.test.ts).
 */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "../components/I18nProvider";
import { ToastProvider } from "../components/ui";
import { Editor } from "../pages/Editor";

const uploadMock = vi.hoisted(() => vi.fn());
vi.mock("../lib/upload", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/upload")>();
  return { ...actual, uploadWithProgress: uploadMock };
});

const downloadMock = vi.hoisted(() => vi.fn());
vi.mock("../lib/download", () => ({ downloadBlob: downloadMock }));

vi.mock("./usePdfDocument", () => ({
  usePdfDocument: vi.fn((file: File | null) => ({
    state: file
      ? { status: "ready", numPages: 1, pages: [{ width: 600, height: 800 }] }
      : { status: "idle" },
    renderPage: vi.fn().mockResolvedValue(undefined),
  })),
}));

vi.mock("./annotations", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./annotations")>();
  return { ...actual, MAX_ANNOTATIONS: 2 };
});

/** jsdom has no Image loading — fire onload so signature assets register. */
class MockImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  naturalWidth = 100;
  naturalHeight = 50;
  set src(_v: string) {
    queueMicrotask(() => this.onload?.());
  }
}

const fetchMock = vi.fn();

function renderEditor() {
  return render(
    <I18nProvider>
      <ToastProvider>
        <Editor />
      </ToastProvider>
    </I18nProvider>,
  );
}

function pdf(): File {
  return new File(["%PDF-1.4"], "doc.pdf", { type: "application/pdf" });
}

async function openEditor(user: ReturnType<typeof userEvent.setup>) {
  const input = document.querySelector('input[type="file"]') as HTMLInputElement;
  await user.upload(input, pdf());
  await screen.findByRole("toolbar");
}

function page(): HTMLElement {
  return screen.getByTestId("editor-page-0");
}

function drag(el: HTMLElement, from: [number, number], to: [number, number]) {
  fireEvent.pointerDown(el, { clientX: from[0], clientY: from[1], button: 0, pointerId: 1 });
  fireEvent.pointerMove(el, { clientX: to[0], clientY: to[1], pointerId: 1 });
  fireEvent.pointerUp(el, { clientX: to[0], clientY: to[1], pointerId: 1 });
}

function annotationCount(): number {
  return document.querySelectorAll("[data-annotation-id]").length;
}

function lastFormData(): FormData {
  const call = uploadMock.mock.calls.at(-1) as [string, FormData, unknown];
  return call[1];
}

beforeEach(() => {
  localStorage.setItem("guloi-lang", "it");
  fetchMock.mockResolvedValue({ ok: true, json: () => Promise.resolve([]) });
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("Image", MockImage);
  URL.createObjectURL = vi.fn(() => "blob:mock");
  URL.revokeObjectURL = vi.fn();
  uploadMock.mockResolvedValue({
    blob: new Blob(["pdf"], { type: "application/pdf" }),
    filename: "modificato.pdf",
  });
});
afterEach(() => {
  vi.unstubAllGlobals();
  fetchMock.mockReset();
  uploadMock.mockReset();
  downloadMock.mockReset();
  localStorage.clear();
});

describe("save pipeline (multipart contract)", () => {
  it("posts file + serialized annotations to /api/editor/save", async () => {
    const user = userEvent.setup();
    renderEditor();
    await openEditor(user);

    await user.click(screen.getByRole("button", { name: "Evidenzia" }));
    drag(page(), [10, 20], [110, 120]);
    expect(annotationCount()).toBe(1);

    await user.click(screen.getByRole("button", { name: "SALVA PDF" }));
    await waitFor(() => expect(uploadMock).toHaveBeenCalledTimes(1));

    const [endpoint] = uploadMock.mock.calls[0] as [string, FormData, unknown];
    expect(endpoint).toBe("/api/editor/save");
    const fd = lastFormData();
    const file = fd.get("file") as File;
    expect(file).toBeInstanceOf(File);
    expect(file.name).toBe("doc.pdf");
    const annotations = JSON.parse(fd.get("annotations") as string) as unknown[];
    // Full contract object: view (10,20)-(110,120) on an 800pt page at 100%.
    expect(annotations).toEqual([
      { kind: "highlight", page: 0, rect: [10, 680, 110, 780], color: [1, 1, 0] },
    ]);
  });

  it("appends signature parts whose FILENAME is the image_key", async () => {
    const user = userEvent.setup();
    renderEditor();
    await openEditor(user);

    await user.click(screen.getByRole("button", { name: "Firma" }));
    const sigInput = document.querySelector(
      'input[accept="image/png,image/jpeg"]',
    ) as HTMLInputElement;
    const png = new File(["png-bytes"], "firma.png", { type: "image/png" });
    await user.upload(sigInput, png);
    await screen.findByText("Clicca sulla pagina per posizionare la firma");

    fireEvent.pointerDown(page(), { clientX: 300, clientY: 400, button: 0, pointerId: 1 });
    expect(annotationCount()).toBe(1);

    await user.click(screen.getByRole("button", { name: "SALVA PDF" }));
    await waitFor(() => expect(uploadMock).toHaveBeenCalledTimes(1));

    const fd = lastFormData();
    const parts = fd.getAll("signatures") as File[];
    expect(parts).toHaveLength(1);
    expect(parts[0]!.name).toBe("sig-1"); // collision-proof monotonic key
    const [ann] = JSON.parse(fd.get("annotations") as string) as [
      { kind: string; image_key: string; width: number; height: number },
    ];
    expect(ann.kind).toBe("signature");
    expect(ann.image_key).toBe(parts[0]!.name);
    expect(ann.width).toBe(150);
    expect(ann.height).toBe(75); // 100x50 source image → aspect 0.5
  });

  it("success path downloads the returned PDF", async () => {
    const user = userEvent.setup();
    renderEditor();
    await openEditor(user);

    await user.click(screen.getByRole("button", { name: "Evidenzia" }));
    drag(page(), [10, 20], [110, 120]);
    await user.click(screen.getByRole("button", { name: "SALVA PDF" }));

    await waitFor(() => expect(downloadMock).toHaveBeenCalledTimes(1));
    expect(downloadMock).toHaveBeenCalledWith(expect.any(Blob), "modificato.pdf");
  });
});

describe("hard-redaction confirm dialog", () => {
  async function addHardErase(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByRole("button", { name: "Cancella" }));
    await user.click(screen.getByRole("checkbox", { name: "Redazione definitiva" }));
    drag(page(), [50, 50], [150, 100]);
    expect(annotationCount()).toBe(1);
  }

  it("gates the save: no upload until confirmed, upload after confirm", async () => {
    const user = userEvent.setup();
    renderEditor();
    await openEditor(user);
    await addHardErase(user);

    await user.click(screen.getByRole("button", { name: "SALVA PDF" }));
    expect(screen.getByRole("alertdialog", { name: "Redazione definitiva" })).toBeInTheDocument();
    expect(uploadMock).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Salva comunque" }));
    await waitFor(() => expect(uploadMock).toHaveBeenCalledTimes(1));
    const annotations = JSON.parse(lastFormData().get("annotations") as string) as [
      { kind: string; hard: boolean },
    ];
    expect(annotations[0]).toMatchObject({ kind: "erase", hard: true });
  });

  it("cancel closes the dialog without uploading", async () => {
    const user = userEvent.setup();
    renderEditor();
    await openEditor(user);
    await addHardErase(user);

    await user.click(screen.getByRole("button", { name: "SALVA PDF" }));
    await user.click(screen.getByRole("button", { name: "Annulla" }));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(uploadMock).not.toHaveBeenCalled();
  });

  it("Delete is inert while the dialog is open", async () => {
    const user = userEvent.setup();
    renderEditor();
    await openEditor(user);
    await addHardErase(user);

    // Select the annotation with the select tool.
    await user.click(screen.getByRole("button", { name: "Seleziona" }));
    const ann = document.querySelector("[data-annotation-id]") as SVGGElement;
    fireEvent.pointerDown(ann, { clientX: 60, clientY: 60, button: 0, pointerId: 1 });
    fireEvent.pointerUp(page(), { clientX: 60, clientY: 60, pointerId: 1 });
    expect(screen.getByRole("button", { name: "Elimina annotazione selezionata" })).toBeEnabled();

    await user.click(screen.getByRole("button", { name: "SALVA PDF" }));
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "Delete" });
    expect(annotationCount()).toBe(1); // still there

    await user.click(screen.getByRole("button", { name: "Annulla" }));
    fireEvent.keyDown(window, { key: "Delete" });
    expect(annotationCount()).toBe(0); // guard lifted after close
  });
});

describe("annotation cap toast (MAX_ANNOTATIONS mocked to 2)", () => {
  it("shows the tooMany toast and keeps the count at the cap", async () => {
    const user = userEvent.setup();
    renderEditor();
    await openEditor(user);

    await user.click(screen.getByRole("button", { name: "Evidenzia" }));
    drag(page(), [10, 10], [60, 60]);
    drag(page(), [100, 100], [160, 160]);
    expect(annotationCount()).toBe(2);

    drag(page(), [200, 200], [260, 260]);
    expect(annotationCount()).toBe(2);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Troppe annotazioni: massimo 2.",
    );
  });
});
