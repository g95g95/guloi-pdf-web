import { useState } from "react";
import { ToolPage } from "../components/ToolPage";
import { RadioGroup, TextField } from "../components/ui";
import { toolIcons } from "../components/toolIcons";
import { useT } from "../lib/i18n";
import { cn } from "../lib/cn";

const angles = ["90", "180", "270"] as const;
type Angle = (typeof angles)[number];

export function Ruota() {
  const t = useT();
  const [angle, setAngle] = useState<Angle>("90");
  const [pages, setPages] = useState("");

  return (
    <ToolPage
      titleKey="tool.rotate.name"
      descKey="tool.rotate.desc"
      endpoint="/api/rotate"
      actionKey="rotate.action"
      icon={toolIcons.rotate}
      renderOptions={(disabled) => (
        <>
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-fg">{t("rotate.angle")}</span>
            <RadioGroup<Angle>
              label={t("rotate.angle")}
              orientation="horizontal"
              value={angle}
              onChange={setAngle}
              disabled={disabled}
              className="w-full"
              options={angles.map((a) => ({ value: a, label: `${a}°` }))}
              optionClassName={(active) =>
                cn(
                  "inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-md border text-sm font-medium",
                  "transition-colors duration-[var(--duration-fast)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  "disabled:pointer-events-none disabled:opacity-55",
                  active
                    ? "border-accent bg-accent-subtle text-accent"
                    : "border-border bg-bg-elevated text-fg hover:border-border-strong",
                )
              }
              renderOption={(option) => (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path
                      d="M20 11a8 8 0 1 0-2.3 5.6M20 5v6h-6"
                      stroke="currentColor"
                      strokeWidth="1.7"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  {option.label}
                </>
              )}
            />
          </div>
          <TextField
            label={t("rotate.pages")}
            placeholder={t("rotate.pages.placeholder")}
            value={pages}
            disabled={disabled}
            inputMode="numeric"
            onChange={(e) => setPages(e.target.value)}
          />
        </>
      )}
      buildFormData={(files) => {
        const fd = new FormData();
        fd.append("file", files[0]!);
        fd.append("angle", angle);
        fd.append("pages", pages.trim());
        return fd;
      }}
    />
  );
}
