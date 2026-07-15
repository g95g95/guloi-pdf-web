/**
 * Live form-field editing: the panel and the on-page widget inputs share one
 * state — typing in either place updates the other immediately, and the
 * current values end up in the save payload as form_field annotations.
 */

import { render, screen, within } from "@testing-library/react";
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

vi.mock("../lib/download", () => ({ downloadBlob: vi.fn() }));

vi.mock("./usePdfDocument", () => ({
  usePdfDocument: vi.fn((file: File | null) => ({
    state: file
      ? {
          status: "ready",
          numPages: 1,
          pages: [{ width: 600, height: 800 }],
          formFields: [
            { name: "nome", type: "text", value: "Mario", page: 0, rect: [100, 700, 300, 724] },
            { name: "citta", type: "text", value: "", page: 0, rect: [100, 650, 300, 674] },
            { name: "privacy", type: "checkbox", value: "Off", exportValue: "Yes",
              page: 0, rect: [100, 600, 116, 616] },
            { name: "colore", type: "radio", value: "rosso", exportValue: "rosso",
              page: 0, rect: [100, 550, 116, 566] },
            { name: "colore", type: "radio", value: "rosso", exportValue: "blu",
              page: 0, rect: [140, 550, 156, 566] },
            { name: "taglia", type: "choice", value: "S",
              options: [
                { value: "S", label: "Small" },
                { value: "M", label: "Medium" },
                { value: "L", label: "Large" },
              ],
              page: 0, rect: [100, 500, 220, 524] },
          ],
        }
      : { status: "idle" },
    renderPage: vi.fn().mockResolvedValue(undefined),
  })),
}));

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

function widget(name: string): HTMLInputElement {
  return screen.getByTestId(`form-widget-${name}`) as HTMLInputElement;
}

function panelInput(name: string): HTMLInputElement {
  const aside = screen.getByRole("complementary");
  return within(aside).getByLabelText(name) as HTMLInputElement;
}

function lastFormData(): FormData {
  const call = uploadMock.mock.calls.at(-1) as [string, FormData, unknown];
  return call[1];
}

beforeEach(() => {
  localStorage.setItem("guloi-lang", "it");
  uploadMock.mockResolvedValue({
    blob: new Blob(["pdf"], { type: "application/pdf" }),
    filename: "modificato.pdf",
  });
});
afterEach(() => {
  uploadMock.mockReset();
  localStorage.clear();
});

describe("live form fields", () => {
  it("renders an input on the page for each Tx widget, positioned in view space", async () => {
    const user = userEvent.setup();
    renderEditor();
    await openEditor(user);

    const w = widget("nome");
    expect(w).toHaveValue("Mario");
    // rect [100, 700, 300, 724] on an 800pt page at scale 1
    expect(w.style.left).toBe("100px");
    expect(w.style.top).toBe("76px");
    expect(w.style.width).toBe("200px");
    expect(w.style.height).toBe("24px");
  });

  it("typing on the page widget updates the panel immediately", async () => {
    const user = userEvent.setup();
    renderEditor();
    await openEditor(user);

    await user.clear(widget("nome"));
    await user.type(widget("nome"), "Rossi");
    expect(panelInput("nome")).toHaveValue("Rossi");
  });

  it("typing in the panel updates the page widget immediately", async () => {
    const user = userEvent.setup();
    renderEditor();
    await openEditor(user);

    await user.type(panelInput("citta"), "Roma");
    expect(widget("citta")).toHaveValue("Roma");
  });

  it("saves the edited values as form_field annotations with the widget's page", async () => {
    const user = userEvent.setup();
    renderEditor();
    await openEditor(user);

    await user.type(widget("citta"), "Roma");
    await user.click(screen.getByRole("button", { name: "SALVA PDF" }));

    const anns = JSON.parse(lastFormData().get("annotations") as string) as {
      kind: string;
      field_name?: string;
      value?: string;
      page: number;
    }[];
    const field = anns.find((a) => a.kind === "form_field");
    expect(field).toMatchObject({ field_name: "citta", value: "Roma", page: 0 });
    // unchanged field is not sent
    expect(anns.filter((a) => a.kind === "form_field")).toHaveLength(1);
  });

  it("checkbox: clicking on the page checks the panel and saves the export value", async () => {
    const user = userEvent.setup();
    renderEditor();
    await openEditor(user);

    await user.click(widget("privacy"));
    const aside = screen.getByRole("complementary");
    expect(within(aside).getByRole("checkbox", { name: "privacy" })).toBeChecked();

    await user.click(screen.getByRole("button", { name: "SALVA PDF" }));
    const anns = JSON.parse(lastFormData().get("annotations") as string) as {
      kind: string;
      field_name?: string;
      value?: string;
    }[];
    expect(anns.find((a) => a.kind === "form_field")).toMatchObject({
      field_name: "privacy",
      value: "Yes",
    });
  });

  it("radio: picking an option on the page updates the panel", async () => {
    const user = userEvent.setup();
    renderEditor();
    await openEditor(user);

    expect(widget("colore-rosso")).toBeChecked();
    await user.click(widget("colore-blu"));
    const aside = screen.getByRole("complementary");
    expect(within(aside).getByRole("radio", { name: "blu" })).toBeChecked();

    await user.click(screen.getByRole("button", { name: "SALVA PDF" }));
    const anns = JSON.parse(lastFormData().get("annotations") as string) as {
      kind: string;
      field_name?: string;
      value?: string;
    }[];
    expect(anns.find((a) => a.kind === "form_field")).toMatchObject({
      field_name: "colore",
      value: "blu",
    });
  });

  it("choice: selecting in the panel updates the page dropdown", async () => {
    const user = userEvent.setup();
    renderEditor();
    await openEditor(user);

    const aside = screen.getByRole("complementary");
    await user.selectOptions(
      within(aside).getByRole("combobox", { name: "taglia" }),
      "L",
    );
    expect(widget("taglia")).toHaveValue("L");
  });

  it("widgets ignore the pointer while a drawing tool is active", async () => {
    const user = userEvent.setup();
    renderEditor();
    await openEditor(user);

    expect(widget("nome").style.pointerEvents).toBe("auto");
    await user.click(screen.getByRole("button", { name: "Disegna" }));
    expect(widget("nome").style.pointerEvents).toBe("none");
  });
});
