import { useState } from "react";
import { ToolPage } from "../components/ToolPage";
import { PasswordField, useToast } from "../components/ui";
import { toolIcons } from "../components/toolIcons";
import { useT } from "../lib/i18n";

export function Proteggi() {
  const t = useT();
  const { toast } = useToast();
  const [password, setPassword] = useState("");
  const [owner, setOwner] = useState("");
  const [advanced, setAdvanced] = useState(false);

  return (
    <ToolPage
      titleKey="tool.protect.name"
      descKey="tool.protect.desc"
      endpoint="/api/password/set"
      actionKey="protect.action"
      icon={toolIcons.protect}
      renderOptions={(disabled) => (
        <>
          <PasswordField
            label={t("protect.password")}
            placeholder={t("protect.password.placeholder")}
            value={password}
            disabled={disabled}
            autoComplete="new-password"
            onChange={(e) => setPassword(e.target.value)}
          />
          <div className="flex flex-col gap-3">
            <button
              type="button"
              aria-expanded={advanced}
              disabled={disabled}
              onClick={() => setAdvanced((v) => !v)}
              className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-fg-muted transition-colors hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm disabled:pointer-events-none disabled:opacity-55"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 16 16"
                fill="none"
                aria-hidden="true"
                className={advanced ? "rotate-90 transition-transform" : "transition-transform"}
              >
                <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {t("protect.owner.section")}
            </button>
            {advanced && (
              <PasswordField
                label={t("protect.owner.label")}
                hint={t("protect.owner.hint")}
                value={owner}
                disabled={disabled}
                autoComplete="new-password"
                onChange={(e) => setOwner(e.target.value)}
              />
            )}
          </div>
        </>
      )}
      buildFormData={(files) => {
        if (password.length < 4) {
          toast(t("protect.password.short"), "error");
          return null;
        }
        const fd = new FormData();
        fd.append("file", files[0]!);
        fd.append("password", password);
        if (owner.trim()) fd.append("owner_password", owner);
        return fd;
      }}
    />
  );
}
