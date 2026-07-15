import { useState } from "react";
import { ToolPage } from "../components/ToolPage";
import { RadioGroup, TextField, useToast } from "../components/ui";
import { toolIcons } from "../components/toolIcons";
import { useT } from "../lib/i18n";
import { cn } from "../lib/cn";

type Mode = "every" | "ranges";

/** Accepts forms like "1-3,5,7-9" (pages and ascending ranges). */
const RANGES_RE = /^\s*\d+(\s*-\s*\d+)?(\s*,\s*\d+(\s*-\s*\d+)?)*\s*$/;

export function Dividi() {
  const t = useT();
  const { toast } = useToast();
  const [mode, setMode] = useState<Mode>("every");
  const [every, setEvery] = useState("1");
  const [ranges, setRanges] = useState("");

  return (
    <ToolPage
      titleKey="tool.split.name"
      descKey="tool.split.desc"
      endpoint="/api/split"
      actionKey="split.action"
      icon={toolIcons.split}
      renderOptions={(disabled) => (
        <>
          <RadioGroup<Mode>
            label={t("split.mode")}
            value={mode}
            onChange={setMode}
            disabled={disabled}
            options={[
              { value: "every", label: t("split.mode.every") },
              { value: "ranges", label: t("split.mode.ranges") },
            ]}
            optionClassName={(active) =>
              cn(
                "flex items-center gap-2.5 rounded-md border px-3 py-2.5 text-left text-sm",
                "transition-colors duration-[var(--duration-fast)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                "disabled:pointer-events-none disabled:opacity-55",
                active
                  ? "border-accent bg-accent-subtle"
                  : "border-border bg-bg-elevated hover:border-border-strong",
              )
            }
            renderOption={(option, active) => (
              <>
                <span
                  aria-hidden="true"
                  className={cn(
                    "inline-flex size-4 shrink-0 items-center justify-center rounded-full border-2",
                    active ? "border-accent" : "border-border-strong",
                  )}
                >
                  {active && <span className="size-2 rounded-full bg-accent" />}
                </span>
                {option.label}
              </>
            )}
          />

          {mode === "every" ? (
            <TextField
              label={t("split.every.label")}
              type="number"
              min={1}
              value={every}
              disabled={disabled}
              onChange={(e) => setEvery(e.target.value)}
            />
          ) : (
            <TextField
              label={t("split.ranges.label")}
              placeholder={t("split.ranges.placeholder")}
              value={ranges}
              disabled={disabled}
              inputMode="numeric"
              onChange={(e) => setRanges(e.target.value)}
            />
          )}
        </>
      )}
      buildFormData={(files) => {
        let value: string;
        if (mode === "every") {
          const n = Number(every);
          if (!Number.isInteger(n) || n < 1) {
            toast(t("split.every.invalid"), "error");
            return null;
          }
          value = String(n);
        } else {
          if (!RANGES_RE.test(ranges)) {
            toast(t("split.ranges.invalid"), "error");
            return null;
          }
          value = ranges.trim();
        }
        const fd = new FormData();
        fd.append("file", files[0]!);
        fd.append("mode", mode);
        fd.append("value", value);
        return fd;
      }}
    />
  );
}
