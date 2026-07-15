/**
 * /editor entry: FileDrop for a single PDF; once a file is picked the
 * EditorView takes over the page (the App shell widens this route to
 * full width — see App.tsx).
 */

import { useState } from "react";
import { Card, CardBody } from "../components/ui";
import { FileDrop } from "../components/FileDrop";
import { toolIcons } from "../components/toolIcons";
import { EditorView } from "../editor/EditorView";
import { useT } from "../lib/i18n";
import { useDocumentMeta } from "../lib/useDocumentMeta";

export function Editor() {
  const t = useT();
  useDocumentMeta(`${t("tool.editor.name")} · ${t("app.name")}`, t("tool.editor.desc"));
  const [files, setFiles] = useState<File[]>([]);
  const file = files[0] ?? null;

  if (file) {
    return <EditorView file={file} onClose={() => setFiles([])} />;
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg bg-accent-subtle text-accent">
            {toolIcons.editor}
          </span>
          <h1 className="text-2xl font-semibold tracking-tight">
            {t("tool.editor.name")}
          </h1>
        </div>
        <p className="text-sm text-fg-muted">{t("tool.editor.desc")}</p>
      </div>
      <Card>
        <CardBody>
          <FileDrop value={files} onChange={setFiles} />
        </CardBody>
      </Card>
    </div>
  );
}
