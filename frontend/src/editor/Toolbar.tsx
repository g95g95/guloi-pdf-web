/**
 * Editor toolbar: tool picker (aria-pressed radiogroup-style buttons),
 * hard-erase toggle, undo/redo, zoom, delete-selection, save and close.
 */

import type { ReactNode } from "react";
import { Button, Checkbox } from "../components/ui";
import { cn } from "../lib/cn";
import { useT, type MessageKey } from "../lib/i18n";

export type ToolId =
  | "select"
  | "highlight"
  | "draw"
  | "text"
  | "signature"
  | "erase"
  | "textEdit";

const stroke = {
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

const icon = (children: ReactNode) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    {children}
  </svg>
);

const toolIcons: Record<ToolId, ReactNode> = {
  select: icon(<path d="M6 3l12 9-5.5 1L15 18l-2.5 1.2-2.5-5L6 16V3z" {...stroke} />),
  highlight: icon(
    <>
      <path d="M4 20h16" {...stroke} />
      <rect x="6" y="9" width="12" height="6" rx="1" {...stroke} fill="currentColor" fillOpacity="0.25" />
    </>,
  ),
  draw: icon(<path d="M4 20c3-1 2-4 5-5s4 1 7-2 2-6 2-6-4 0-6 2-1 4-3 6-4 1-5 5z" {...stroke} />),
  text: icon(
    <>
      <path d="M5 6V4h14v2" {...stroke} />
      <path d="M12 4v16M9 20h6" {...stroke} />
    </>,
  ),
  signature: icon(
    <>
      <path d="M4 16c2-6 4-8 5-6s-1 6 1 6 2-3 4-3 1 3 3 3h3" {...stroke} />
      <path d="M4 20h16" {...stroke} />
    </>,
  ),
  erase: icon(
    <>
      <path d="M9 15l6-6" {...stroke} />
      <path d="M4 15l7-7a2 2 0 012.8 0l3.2 3.2a2 2 0 010 2.8L11 20H7l-3-3a1.4 1.4 0 010-2z" {...stroke} />
      <path d="M11 20h9" {...stroke} />
    </>,
  ),
  textEdit: icon(
    <>
      <rect x="3" y="5" width="18" height="8" rx="1" {...stroke} strokeDasharray="3 2" />
      <path d="M7 18h4M14 20l6-6" {...stroke} />
      <path d="M18 12l2 2" {...stroke} />
    </>,
  ),
};

const toolKeys: Record<ToolId, MessageKey> = {
  select: "editor.tool.select",
  highlight: "editor.tool.highlight",
  draw: "editor.tool.draw",
  text: "editor.tool.text",
  signature: "editor.tool.signature",
  erase: "editor.tool.erase",
  textEdit: "editor.tool.textEdit",
};

const TOOL_IDS: ToolId[] = [
  "select",
  "highlight",
  "draw",
  "text",
  "signature",
  "erase",
  "textEdit",
];

export interface ToolbarProps {
  tool: ToolId;
  onToolChange: (tool: ToolId) => void;
  hardErase: boolean;
  onHardEraseChange: (hard: boolean) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  hasSelection: boolean;
  onDeleteSelected: () => void;
  scale: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onSave: () => void;
  saving: boolean;
  onClose: () => void;
}

function IconButton({
  label,
  onClick,
  disabled = false,
  pressed,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  pressed?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      {...(pressed !== undefined ? { "aria-pressed": pressed } : {})}
      className={cn(
        "inline-flex size-9 items-center justify-center rounded-md border transition-colors",
        "duration-[var(--duration-fast)] ease-[var(--ease-out)]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        "disabled:pointer-events-none disabled:opacity-45",
        pressed
          ? "border-accent bg-accent-subtle text-accent"
          : "border-transparent text-fg hover:bg-bg-subtle",
      )}
    >
      {children}
    </button>
  );
}

export function Toolbar({
  tool,
  onToolChange,
  hardErase,
  onHardEraseChange,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  hasSelection,
  onDeleteSelected,
  scale,
  onZoomIn,
  onZoomOut,
  onSave,
  saving,
  onClose,
}: ToolbarProps) {
  const t = useT();
  const pct = Math.round(scale * 100);

  return (
    <div
      role="toolbar"
      aria-label={t("editor.toolbar")}
      className="sticky top-16 z-30 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-border bg-bg-elevated/95 px-3 py-2 shadow-[var(--shadow-sm)] backdrop-blur"
    >
      <div className="flex items-center gap-1">
        {TOOL_IDS.map((id) => (
          <IconButton
            key={id}
            label={t(toolKeys[id])}
            pressed={tool === id}
            onClick={() => onToolChange(id)}
          >
            {toolIcons[id]}
          </IconButton>
        ))}
      </div>

      {tool === "erase" && (
        <Checkbox
          label={t("editor.hardErase")}
          checked={hardErase}
          onChange={(e) => onHardEraseChange(e.target.checked)}
        />
      )}

      <span aria-hidden="true" className="h-6 w-px bg-border" />

      <div className="flex items-center gap-1">
        <IconButton label={t("editor.undo")} disabled={!canUndo} onClick={onUndo}>
          {icon(<path d="M8 7L4 11l4 4M4 11h11a5 5 0 010 10h-3" {...stroke} />)}
        </IconButton>
        <IconButton label={t("editor.redo")} disabled={!canRedo} onClick={onRedo}>
          {icon(<path d="M16 7l4 4-4 4M20 11H9a5 5 0 000 10h3" {...stroke} />)}
        </IconButton>
        <IconButton
          label={t("editor.deleteSelected")}
          disabled={!hasSelection}
          onClick={onDeleteSelected}
        >
          {icon(
            <>
              <path d="M5 7h14M10 7V5h4v2M7 7l1 13h8l1-13" {...stroke} />
              <path d="M10 11v5M14 11v5" {...stroke} />
            </>,
          )}
        </IconButton>
      </div>

      <span aria-hidden="true" className="h-6 w-px bg-border" />

      <div className="flex items-center gap-1">
        <IconButton label={t("editor.zoomOut")} onClick={onZoomOut}>
          {icon(
            <>
              <circle cx="11" cy="11" r="6.5" {...stroke} />
              <path d="M8.5 11h5M16 16l4 4" {...stroke} />
            </>,
          )}
        </IconButton>
        <span className="min-w-[3.5rem] text-center text-xs tabular-nums text-fg-muted">
          {t("editor.zoomLevel", { pct })}
        </span>
        <IconButton label={t("editor.zoomIn")} onClick={onZoomIn}>
          {icon(
            <>
              <circle cx="11" cy="11" r="6.5" {...stroke} />
              <path d="M8.5 11h5M11 8.5v5M16 16l4 4" {...stroke} />
            </>,
          )}
        </IconButton>
      </div>

      <div className="ms-auto flex items-center gap-2">
        <Button size="sm" variant="ghost" onClick={onClose}>
          {t("editor.close")}
        </Button>
        <Button size="sm" loading={saving} onClick={onSave}>
          {t("editor.save")}
        </Button>
      </div>
    </div>
  );
}
