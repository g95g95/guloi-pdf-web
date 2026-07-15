/**
 * AcroForm fields panel. Fetches the document's fields from
 * POST /api/editor/fields once per file and lets the user edit their values.
 * On every edit it reports the full diff (changed fields only) upward —
 * EditorView turns that into form_field annotations at save time.
 * Renders nothing when the document has no form.
 */

import { useEffect, useState } from "react";
import { TextField } from "../components/ui";
import { useT } from "../lib/i18n";

export interface FormFieldInfo {
  name: string;
  value: string;
  kind: string;
}

export interface FormFieldsPanelProps {
  file: File;
  /** Called with the changed (name, value) pairs after every edit. */
  onChange: (changed: { name: string; value: string }[]) => void;
}

export function FormFieldsPanel({ file, onChange }: FormFieldsPanelProps) {
  const t = useT();
  const [fields, setFields] = useState<FormFieldInfo[]>([]);
  const [values, setValues] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    const body = new FormData();
    body.append("file", file);
    void fetch("/api/editor/fields", { method: "POST", body })
      .then((res) => (res.ok ? res.json() : []))
      .then((data: unknown) => {
        if (cancelled || !Array.isArray(data)) return;
        const list = data.filter(
          (f): f is FormFieldInfo =>
            typeof f === "object" && f !== null &&
            typeof (f as FormFieldInfo).name === "string",
        );
        setFields(list);
        setValues(Object.fromEntries(list.map((f) => [f.name, f.value ?? ""])));
      })
      .catch(() => {
        /* no panel on failure — form editing is optional */
      });
    return () => {
      cancelled = true;
    };
  }, [file]);

  if (fields.length === 0) return null;

  function edit(name: string, value: string) {
    const next = { ...values, [name]: value };
    setValues(next);
    onChange(
      fields
        .filter((f) => next[f.name] !== undefined && next[f.name] !== (f.value ?? ""))
        .map((f) => ({ name: f.name, value: next[f.name] ?? "" })),
    );
  }

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
            value={values[f.name] ?? ""}
            maxLength={1000}
            onChange={(e) => edit(f.name, e.target.value)}
          />
        ))}
      </div>
    </section>
  );
}
