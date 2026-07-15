import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "../components/I18nProvider";
import { FormFieldsPanel } from "./FormFieldsPanel";

function renderPanel(
  fields: { name: string; value: string }[],
  onEdit = vi.fn(),
) {
  render(
    <I18nProvider>
      <FormFieldsPanel fields={fields} onEdit={onEdit} />
    </I18nProvider>,
  );
  return onEdit;
}

beforeEach(() => {
  localStorage.setItem("guloi-lang", "it");
});
afterEach(() => {
  localStorage.clear();
});

describe("FormFieldsPanel", () => {
  it("renders nothing when the PDF has no form fields", () => {
    renderPanel([]);
    expect(screen.queryByRole("region")).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("lists the fields with their current values", () => {
    renderPanel([
      { name: "nome", value: "Mario" },
      { name: "citta", value: "" },
    ]);
    expect(screen.getByLabelText("nome")).toHaveValue("Mario");
    expect(screen.getByLabelText("citta")).toHaveValue("");
    expect(screen.getByRole("heading", { name: "Campi modulo" })).toBeInTheDocument();
  });

  it("reports every keystroke upward (controlled component)", async () => {
    const user = userEvent.setup();
    const onEdit = renderPanel([{ name: "nome", value: "" }]);
    await user.type(screen.getByLabelText("nome"), "X");
    expect(onEdit).toHaveBeenCalledWith("nome", "X");
  });
});
