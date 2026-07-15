/**
 * AcroForm fields panel. Fully controlled: EditorView owns the single
 * formValues state shared with the on-page widget inputs (PageView), so
 * typing here updates the page immediately and vice versa.
 * Renders nothing when the document has no editable fields.
 */

import { Checkbox, TextField } from "../components/ui";
import { useT } from "../lib/i18n";
import type { FormFieldType } from "./usePdfDocument";

export interface PanelField {
  name: string;
  type: FormFieldType;
  /** Live value ("Off" = unchecked for checkboxes). */
  value: string;
  /** checkbox: the "on" export value. */
  exportValue?: string;
  /** choice: the selectable options. */
  options?: { value: string; label: string }[];
  /** radio: every export value in the group. */
  radioValues?: string[];
}

export interface FormFieldsPanelProps {
  fields: PanelField[];
  onEdit: (name: string, value: string) => void;
}

const selectClass =
  "h-9 rounded-md border border-border bg-bg px-2 text-sm text-fg " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function FormFieldsPanel({ fields, onEdit }: FormFieldsPanelProps) {
  const t = useT();

  if (fields.length === 0) return null;

  return (
    <section
      aria-label={t("editor.form.title")}
      className="flex w-full flex-col gap-3 rounded-lg border border-border bg-bg-elevated p-4"
    >
      <h2 className="text-sm font-semibold text-fg">{t("editor.form.title")}</h2>
      <p className="text-xs text-fg-muted">{t("editor.form.hint")}</p>
      <div className="flex flex-col gap-3">
        {fields.map((f) => {
          switch (f.type) {
            case "checkbox": {
              const on = f.exportValue ?? "Yes";
              return (
                <Checkbox
                  key={f.name}
                  label={f.name}
                  checked={f.value === on}
                  onChange={(e) => onEdit(f.name, e.target.checked ? on : "Off")}
                />
              );
            }
            case "radio":
              return (
                <fieldset key={f.name} className="flex flex-col gap-1.5">
                  <legend className="mb-1 text-xs font-medium text-fg-muted">
                    {f.name}
                  </legend>
                  {(f.radioValues ?? []).map((v) => (
                    <label
                      key={v}
                      className="flex items-center gap-2 text-sm text-fg"
                    >
                      <input
                        type="radio"
                        name={`ff-${f.name}`}
                        checked={f.value === v}
                        onChange={() => onEdit(f.name, v)}
                        className="accent-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      />
                      {v}
                    </label>
                  ))}
                </fieldset>
              );
            case "choice":
              return (
                <label key={f.name} className="flex flex-col gap-1 text-xs text-fg-muted">
                  {f.name}
                  <select
                    value={f.value}
                    onChange={(e) => onEdit(f.name, e.target.value)}
                    className={selectClass}
                  >
                    {(f.options ?? []).map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </label>
              );
            default:
              return (
                <TextField
                  key={f.name}
                  label={f.name}
                  value={f.value}
                  maxLength={1000}
                  onChange={(e) => onEdit(f.name, e.target.value)}
                />
              );
          }
        })}
      </div>
    </section>
  );
}
