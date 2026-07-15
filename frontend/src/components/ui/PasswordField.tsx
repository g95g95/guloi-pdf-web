import { useId, useState } from "react";
import type { InputHTMLAttributes, ReactNode } from "react";
import { cn } from "../../lib/cn";
import { useT } from "../../lib/i18n";

export interface PasswordFieldProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "id" | "type"> {
  label: ReactNode;
  hint?: ReactNode;
}

/** Password input with a show/hide toggle. */
export function PasswordField({ label, hint, className, ...rest }: PasswordFieldProps) {
  const t = useT();
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const [visible, setVisible] = useState(false);

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-fg">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={visible ? "text" : "password"}
          aria-describedby={hintId}
          className={cn(
            "h-10 w-full rounded-md border border-border bg-bg-elevated pl-3 pr-11 text-sm text-fg " +
              "placeholder:text-fg-muted transition-colors duration-[var(--duration-fast)] " +
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-border-strong " +
              "disabled:pointer-events-none disabled:opacity-55",
            className,
          )}
          {...rest}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? t("protect.hide") : t("protect.show")}
          aria-pressed={visible}
          className="absolute inset-y-0 right-0 inline-flex w-10 items-center justify-center rounded-r-md text-fg-muted transition-colors hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {visible ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M3 3l18 18M10.6 10.6a2 2 0 002.8 2.8M9.9 5.1A9.8 9.8 0 0112 5c5 0 9 4 10 7a11 11 0 01-2.3 3.4M6.1 6.1A11 11 0 002 12c1 3 5 7 10 7a9.8 9.8 0 003.5-.6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.6" />
            </svg>
          )}
        </button>
      </div>
      {hint && (
        <span id={hintId} className="text-xs text-fg-muted">
          {hint}
        </span>
      )}
    </div>
  );
}
