import { useState } from "react";
import { ToolPage } from "../components/ToolPage";
import { TextField, useToast } from "../components/ui";
import { toolIcons } from "../components/toolIcons";
import { useT } from "../lib/i18n";

export function Estrai() {
  const t = useT();
  const { toast } = useToast();
  const [pages, setPages] = useState("");

  return (
    <ToolPage
      titleKey="tool.extract.name"
      descKey="tool.extract.desc"
      endpoint="/api/extract"
      actionKey="extract.action"
      icon={toolIcons.extract}
      renderOptions={(disabled) => (
        <TextField
          label={t("extract.pages")}
          placeholder={t("extract.pages.placeholder")}
          value={pages}
          disabled={disabled}
          inputMode="numeric"
          onChange={(e) => setPages(e.target.value)}
        />
      )}
      buildFormData={(files) => {
        if (!pages.trim()) {
          toast(t("extract.pages.invalid"), "error");
          return null;
        }
        const fd = new FormData();
        fd.append("file", files[0]!);
        fd.append("pages", pages.trim());
        return fd;
      }}
    />
  );
}
