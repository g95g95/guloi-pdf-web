import { useState } from "react";
import { ToolPage } from "../components/ToolPage";
import { Checkbox } from "../components/ui";
import { toolIcons } from "../components/toolIcons";
import { useT } from "../lib/i18n";

export function Comprimi() {
  const t = useT();
  const [compressImages, setCompressImages] = useState(false);

  return (
    <ToolPage
      titleKey="tool.compress.name"
      descKey="tool.compress.desc"
      endpoint="/api/compress"
      actionKey="compress.action"
      icon={toolIcons.compress}
      renderOptions={(disabled) => (
        <Checkbox
          label={t("compress.images")}
          checked={compressImages}
          disabled={disabled}
          onChange={(e) => setCompressImages(e.target.checked)}
        />
      )}
      buildFormData={(files) => {
        const fd = new FormData();
        fd.append("file", files[0]!);
        fd.append("compress_images", String(compressImages));
        return fd;
      }}
      renderResultMeta={({ inputBytes, blob }) => {
        const before = Math.round(inputBytes / 1024);
        const after = Math.round(blob.size / 1024);
        const saved =
          inputBytes > 0
            ? Math.max(0, Math.round((1 - blob.size / inputBytes) * 100))
            : 0;
        return t("compress.result", { before, after, saved });
      }}
    />
  );
}
