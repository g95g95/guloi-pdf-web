import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "../components/I18nProvider";
import { FormFieldsPanel, type PanelField } from "./FormFieldsPanel";

function renderPanel(fields: PanelField[], onEdit = vi.fn()) {
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
      { name: "nome", type: "text", value: "Mario" },
      { name: "citta", type: "text", value: "" },
    ]);
    expect(screen.getByLabelText("nome")).toHaveValue("Mario");
    expect(screen.getByLabelText("citta")).toHaveValue("");
    expect(screen.getByRole("heading", { name: "Campi modulo" })).toBeInTheDocument();
  });

  it("reports every keystroke upward (controlled component)", async () => {
    const user = userEvent.setup();
    const onEdit = renderPanel([{ name: "nome", type: "text", value: "" }]);
    await user.type(screen.getByLabelText("nome"), "X");
    expect(onEdit).toHaveBeenCalledWith("nome", "X");
  });

  it("checkbox: toggles between export value and Off", async () => {
    const user = userEvent.setup();
    const onEdit = renderPanel([
      { name: "privacy", type: "checkbox", value: "Off", exportValue: "Si" },
    ]);
    const box = screen.getByRole("checkbox", { name: "privacy" });
    expect(box).not.toBeChecked();
    await user.click(box);
    expect(onEdit).toHaveBeenCalledWith("privacy", "Si");
  });

  it("radio: lists every option of the group and reports the pick", async () => {
    const user = userEvent.setup();
    const onEdit = renderPanel([
      {
        name: "colore",
        type: "radio",
        value: "rosso",
        radioValues: ["rosso", "blu"],
      },
    ]);
    expect(screen.getByRole("radio", { name: "rosso" })).toBeChecked();
    await user.click(screen.getByRole("radio", { name: "blu" }));
    expect(onEdit).toHaveBeenCalledWith("colore", "blu");
  });

  it("choice: renders a select with the options and reports the pick", async () => {
    const user = userEvent.setup();
    const onEdit = renderPanel([
      {
        name: "taglia",
        type: "choice",
        value: "S",
        options: [
          { value: "S", label: "Small" },
          { value: "L", label: "Large" },
        ],
      },
    ]);
    const select = screen.getByRole("combobox", { name: "taglia" });
    expect(select).toHaveValue("S");
    await user.selectOptions(select, "L");
    expect(onEdit).toHaveBeenCalledWith("taglia", "L");
  });
});
