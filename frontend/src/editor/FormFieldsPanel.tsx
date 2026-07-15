/**
 * AcroForm fields panel. Fully controlled: EditorView owns the single
 * formValues state shared with the on-page widget inputs (PageView), so
 * typing here updates the page immediately and vice versa.
 * Renders nothing when the document has no editable text fields.
 */

import { TextField } from "../components/ui";
import { useT } from "../lib/i18n";

export interface FormFieldsPanelProps {
  /** Unique field names with their current (live) values. */
  fields: { name: string; value: string }[];
  onEdit: (name: string, value: string) => void;
}

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
        {fields.map((f) => (
          <TextField
            key={f.name}
            label={f.name}
            value={f.value}
            maxLength={1000}
            onChange={(e) => onEdit(f.name, e.target.value)}
          />
        ))}
      </div>
    </section>
  );
}
