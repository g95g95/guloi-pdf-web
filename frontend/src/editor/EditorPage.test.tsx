/**
 * Editor entry component test. pdf.js is NOT loaded: usePdfDocument is
 * mocked at the module boundary (jsdom cannot render real PDFs), and fetch
 * is stubbed for the form-fields probe.
 */

import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "../components/I18nProvider";
import { ToastProvider } from "../components/ui";
import { Editor } from "../pages/Editor";

vi.mock("./usePdfDocument", () => ({
  usePdfDocument: vi.fn((file: File | null) => ({
    state: file
      ? {
          status: "ready",
          numPages: 2,
          pages: [
            { width: 600, height: 800 },
            { width: 600, height: 800 },
          ],
          formFields: [
            { name: "nome", value: "", page: 0, rect: [100, 700, 300, 724] },
          ],
        }
      : { status: "idle" },
    renderPage: vi.fn().mockResolvedValue(undefined),
  })),
}));

const fetchMock = vi.fn();

function renderEditor(node: ReactNode = <Editor />) {
  return render(
    <I18nProvider>
      <ToastProvider>{node}</ToastProvider>
    </I18nProvider>,
  );
}

function pdf(name = "doc.pdf"): File {
  return new File(["%PDF-1.4"], name, { type: "application/pdf" });
}

function fileInput(): HTMLInputElement {
  return document.querySelector('input[type="file"]') as HTMLInputElement;
}

beforeEach(() => {
  localStorage.setItem("guloi-lang", "it");
  fetchMock.mockResolvedValue({ ok: true, json: () => Promise.resolve([]) });
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
  fetchMock.mockReset();
  localStorage.clear();
});

describe("Editor entry", () => {
  it("shows the FileDrop first, then the editor after picking a PDF", async () => {
    const user = userEvent.setup();
    renderEditor();

    expect(screen.getByRole("heading", { name: "Editor PDF" })).toBeInTheDocument();
    expect(screen.queryByRole("toolbar")).not.toBeInTheDocument();

    await user.upload(fileInput(), pdf());

    expect(await screen.findByRole("toolbar", { name: "Strumenti editor" })).toBeInTheDocument();
    // Both (mocked) pages are present.
    expect(screen.getByRole("group", { name: "Pagina 1 di 2" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Pagina 2 di 2" })).toBeInTheDocument();
  });

  it("tools expose aria-pressed and switch on click", async () => {
    const user = userEvent.setup();
    renderEditor();
    await user.upload(fileInput(), pdf());
    await screen.findByRole("toolbar");

    const select = screen.getByRole("button", { name: "Seleziona" });
    const highlight = screen.getByRole("button", { name: "Evidenzia" });
    expect(select).toHaveAttribute("aria-pressed", "true");
    expect(highlight).toHaveAttribute("aria-pressed", "false");

    await user.click(highlight);
    expect(highlight).toHaveAttribute("aria-pressed", "true");
    expect(select).toHaveAttribute("aria-pressed", "false");
  });

  it("erase tool reveals the hard-redaction toggle", async () => {
    const user = userEvent.setup();
    renderEditor();
    await user.upload(fileInput(), pdf());
    await screen.findByRole("toolbar");

    expect(screen.queryByRole("checkbox", { name: "Redazione definitiva" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Cancella" }));
    expect(screen.getByRole("checkbox", { name: "Redazione definitiva" })).toBeInTheDocument();
  });

  it("undo/redo buttons are disabled with an empty history", async () => {
    const user = userEvent.setup();
    renderEditor();
    await user.upload(fileInput(), pdf());
    await screen.findByRole("toolbar");

    expect(screen.getByRole("button", { name: "Annulla modifica" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Ripeti modifica" })).toBeDisabled();
  });

  it("zoom buttons update the zoom readout within 50%-300%", async () => {
    const user = userEvent.setup();
    renderEditor();
    await user.upload(fileInput(), pdf());
    await screen.findByRole("toolbar");

    expect(screen.getByText("Zoom 100%")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Aumenta zoom" }));
    expect(screen.getByText("Zoom 125%")).toBeInTheDocument();
    const out = screen.getByRole("button", { name: "Riduci zoom" });
    for (let i = 0; i < 8; i++) await user.click(out);
    expect(screen.getByText("Zoom 50%")).toBeInTheDocument();
  });

  it("close returns to the FileDrop entry", async () => {
    const user = userEvent.setup();
    renderEditor();
    await user.upload(fileInput(), pdf());
    await screen.findByRole("toolbar");

    await user.click(screen.getByRole("button", { name: "Chiudi il documento" }));
    expect(screen.queryByRole("toolbar")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Editor PDF" })).toBeInTheDocument();
  });

  it("shows the form fields from the document without extra network calls", async () => {
    const user = userEvent.setup();
    renderEditor();
    await user.upload(fileInput(), pdf());
    await screen.findByRole("toolbar");

    // Fields come from pdf.js widget annotations (mocked hook), not fetch.
    expect(screen.getByRole("heading", { name: "Campi modulo" })).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("Editor accessibility (axe)", () => {
  async function violations(container: HTMLElement) {
    const results = await axe.run(container, {
      runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] },
    });
    return results.violations.map((v) => `${v.id}: ${v.help}`);
  }

  it("entry view has no violations", async () => {
    const { container } = renderEditor();
    expect(await violations(container)).toEqual([]);
  });

  it("editor view (toolbar + pages) has no violations", async () => {
    const user = userEvent.setup();
    const { container } = renderEditor();
    await user.upload(fileInput(), pdf());
    await screen.findByRole("toolbar");
    expect(await violations(container)).toEqual([]);
  });
});
