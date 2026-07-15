import { useState } from "react";
import { ToolPage } from "../components/ToolPage";
import { Checkbox, RadioGroup, Slider } from "../components/ui";
import { toolIcons } from "../components/toolIcons";
import { useT } from "../lib/i18n";
import { cn } from "../lib/cn";

type Mode = "simple" | "target";

const TARGET_MIN_MB = 0.1;
const TARGET_MAX_MB = 50;
const TARGET_STEP_MB = 0.1;

export function Comprimi() {
  const t = useT();
  const [mode, setMode] = useState<Mode>("simple");
  const [compressImages, setCompressImages] = useState(false);
  const [targetMb, setTargetMb] = useState(5);

  return (
    <ToolPage
      titleKey="tool.compress.name"
      descKey="tool.compress.desc"
      endpoint="/api/compress"
      actionKey="compress.action"
      icon={toolIcons.compress}
      multiple
      maxFiles={20}
      hint={t("compress.hint")}
      renderOptions={(disabled) => (
        <>
          <RadioGroup<Mode>
            label={t("compress.mode")}
            value={mode}
            onChange={setMode}
            disabled={disabled}
            orientation="horizontal"
            options={[
              { value: "simple", label: t("compress.mode.simple") },
              { value: "target", label: t("compress.mode.target") },
            ]}
            optionClassName={(active) =>
              cn(
                "flex items-center gap-2 rounded-md border px-3 py-2 text-left text-sm",
                "transition-colors duration-[var(--duration-fast)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                "disabled:pointer-events-none disabled:opacity-55",
                active
                  ? "border-accent bg-accent-subtle"
                  : "border-border bg-bg-elevated hover:border-border-strong",
              )
            }
            renderOption={(option) => option.label}
          />

          {mode === "simple" ? (
            <Checkbox
              label={t("compress.images")}
              checked={compressImages}
              disabled={disabled}
              onChange={(e) => setCompressImages(e.target.checked)}
            />
          ) : (
            <Slider
              label={t("compress.target.label")}
              min={TARGET_MIN_MB}
              max={TARGET_MAX_MB}
              step={TARGET_STEP_MB}
              value={targetMb}
              disabled={disabled}
              onChange={setTargetMb}
              formatValue={(v) => `${v.toFixed(1)} MB`}
            />
          )}
        </>
      )}
      buildFormData={(files) => {
        const fd = new FormData();
        for (const file of files) fd.append("files", file);
        if (mode === "target") {
          fd.append("target_mb", String(targetMb));
        } else {
          fd.append("compress_images", String(compressImages));
        }
        return fd;
      }}
      renderResultMeta={({ inputBytes, fileCount, blob, targetMet }) => {
        const before = Math.round(inputBytes / 1024);
        const after = Math.round(blob.size / 1024);
        const saved =
          inputBytes > 0
            ? Math.max(0, Math.round((1 - blob.size / inputBytes) * 100))
            : 0;
        if (targetMet === false) {
          return fileCount > 1
            ? t("compress.target.notMetMulti", { target: targetMb.toFixed(1) })
            : t("compress.target.notMet", { target: targetMb.toFixed(1), after });
        }
        return t("compress.result", { before, after, saved });
      }}
    />
  );
}
