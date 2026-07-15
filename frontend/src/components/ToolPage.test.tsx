import type { ReactNode } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Comprimi } from "../pages/Comprimi";
import { I18nProvider } from "./I18nProvider";
import { ToastProvider } from "./ui";

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

describe("ToolPage focus management", () => {
  it("moves focus to the result panel after a successful run", async () => {
    const user = userEvent.setup();
    uploadMock.mockResolvedValue({
      blob: new Blob(["ok"], { type: "application/pdf" }),
      filename: "out.pdf",
    });
    renderPage(<Comprimi />);

    await user.upload(fileInput(), pdf());
    await user.click(screen.getByRole("button", { name: "COMPRIMI" }));

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /scarica/i })).toBeInTheDocument(),
    );
    // The result panel (a focusable region labelled with tool.done) receives focus.
    const panel = screen.getByRole("group", { name: /fatto/i });
    expect(panel).toHaveFocus();
  });

  it("returns focus to the drop zone after reset", async () => {
    const user = userEvent.setup();
    uploadMock.mockResolvedValue({
      blob: new Blob(["ok"], { type: "application/pdf" }),
      filename: "out.pdf",
    });
    renderPage(<Comprimi />);

    await user.upload(fileInput(), pdf());
    await user.click(screen.getByRole("button", { name: "COMPRIMI" }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /scarica/i })).toBeInTheDocument(),
    );

    await user.click(screen.getByRole("button", { name: /elabora un altro file/i }));

    await waitFor(() => {
      const drop = screen.getByRole("button", { name: /trascina/i });
      expect(drop).toHaveFocus();
    });
  });
});
