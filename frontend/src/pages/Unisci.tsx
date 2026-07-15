import { ToolPage } from "../components/ToolPage";
import { toolIcons } from "../components/toolIcons";
import { useT } from "../lib/i18n";

export function Unisci() {
  const t = useT();

  return (
    <ToolPage
      titleKey="tool.merge.name"
      descKey="tool.merge.desc"
      endpoint="/api/merge"
      actionKey="merge.action"
      icon={toolIcons.merge}
      multiple
      maxFiles={20}
      hint={t("merge.hint")}
      canSubmit={(files) => files.length >= 2}
      buildFormData={(files) => {
        const fd = new FormData();
        for (const file of files) fd.append("files", file);
        return fd;
      }}
    />
  );
}
