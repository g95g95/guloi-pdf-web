import { useState } from "react";
import { ToolPage } from "../components/ToolPage";
import { PasswordField, useToast } from "../components/ui";
import { toolIcons } from "../components/toolIcons";
import { useT } from "../lib/i18n";

export function Sblocca() {
  const t = useT();
  const { toast } = useToast();
  const [password, setPassword] = useState("");

  return (
    <ToolPage
      titleKey="tool.unlock.name"
      descKey="tool.unlock.desc"
      endpoint="/api/password/remove"
      actionKey="unlock.action"
      icon={toolIcons.unlock}
      renderOptions={(disabled) => (
        <PasswordField
          label={t("unlock.password")}
          value={password}
          disabled={disabled}
          autoComplete="current-password"
          onChange={(e) => setPassword(e.target.value)}
        />
      )}
      buildFormData={(files) => {
        if (!password) {
          toast(t("unlock.password.required"), "error");
          return null;
        }
        const fd = new FormData();
        fd.append("file", files[0]!);
        fd.append("password", password);
        return fd;
      }}
    />
  );
}
