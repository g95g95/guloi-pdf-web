import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "../components/I18nProvider";
import { FormFieldsPanel } from "./FormFieldsPanel";

const fetchMock = vi.fn();

function pdf(): File {
  return new File(["%PDF-1.4"], "form.pdf", { type: "application/pdf" });
}

function renderPanel(onChange = vi.fn()) {
  render(
    <I18nProvider>
      <FormFieldsPanel file={pdf()} onChange={onChange} />
    </I18nProvider>,
  );
  return onChange;
}

beforeEach(() => {
  localStorage.setItem("guloi-lang", "it");
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
  fetchMock.mockReset();
  localStorage.clear();
});

describe("FormFieldsPanel", () => {
  it("renders nothing when the PDF has no form fields", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: () => Promise.resolve([]) });
    renderPanel();
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(screen.queryByRole("region")).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("lists the fields with their current values", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve([
          { name: "nome", value: "Mario", kind: "text" },
          { name: "citta", value: "", kind: "text" },
        ]),
    });
    renderPanel();

    expect(await screen.findByLabelText("nome")).toHaveValue("Mario");
    expect(screen.getByLabelText("citta")).toHaveValue("");
    expect(screen.getByRole("heading", { name: "Campi modulo" })).toBeInTheDocument();
  });

  it("reports only the CHANGED fields upward", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve([
          { name: "nome", value: "Mario", kind: "text" },
          { name: "citta", value: "", kind: "text" },
        ]),
    });
    const onChange = renderPanel();

    const citta = await screen.findByLabelText("citta");
    await user.type(citta, "Roma");
    expect(onChange).toHaveBeenLastCalledWith([{ name: "citta", value: "Roma" }]);

    // Reverting to the original value removes it from the diff.
    await user.clear(citta);
    expect(onChange).toHaveBeenLastCalledWith([]);
  });

  it("stays hidden when the endpoint fails", async () => {
    fetchMock.mockRejectedValue(new Error("network"));
    renderPanel();
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });
});
