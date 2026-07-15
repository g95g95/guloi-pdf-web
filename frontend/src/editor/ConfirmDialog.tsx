/**
 * Minimal accessible confirm dialog (used for the hard-redaction warning
 * before save — same semantics as the desktop app's warning). Focus lands on
 * the cancel button; Esc cancels; the backdrop click cancels too.
 */

import { useEffect, useRef } from "react";
import { Button } from "../components/ui";

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) cancelRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-black/45"
        onClick={onCancel}
      />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="guloi-confirm-title"
        aria-describedby="guloi-confirm-body"
        className="relative flex w-full max-w-md flex-col gap-4 rounded-lg border border-border bg-bg-elevated p-5 shadow-[var(--shadow-md)]"
      >
        <h2 id="guloi-confirm-title" className="text-base font-semibold text-fg">
          {title}
        </h2>
        <p id="guloi-confirm-body" className="text-sm text-fg-muted">
          {body}
        </p>
        <div className="flex justify-end gap-2">
          <Button ref={cancelRef} variant="secondary" size="sm" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button variant="danger" size="sm" onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
