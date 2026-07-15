import { useId } from "react";
import type { InputHTMLAttributes, ReactNode } from "react";
import { cn } from "../../lib/cn";

const inputBase =
  "h-10 w-full rounded-md border border-border bg-bg-elevated px-3 text-sm text-fg " +
  "placeholder:text-fg-muted transition-colors duration-[var(--duration-fast)] " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-border-strong " +
  "disabled:pointer-events-none disabled:opacity-55";

export interface TextFieldProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "id"> {
  label: ReactNode;
  hint?: ReactNode;
}

/** Labelled text/number input wired for accessibility. */
export function TextField({ label, hint, className, ...rest }: TextFieldProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-fg">
        {label}
      </label>
      <input
        id={id}
        aria-describedby={hintId}
        className={cn(inputBase, className)}
        {...rest}
      />
      {hint && (
        <span id={hintId} className="text-xs text-fg-muted">
          {hint}
        </span>
      )}
    </div>
  );
}

export interface CheckboxProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label: ReactNode;
}

/** Checkbox with an inline label. */
export function Checkbox({ label, className, ...rest }: CheckboxProps) {
  const id = useId();
  return (
    <div className="flex items-start gap-2.5">
      <input
        id={id}
        type="checkbox"
        className={cn(
          "mt-0.5 size-4 shrink-0 rounded border-border text-accent accent-[var(--accent)] " +
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          className,
        )}
        {...rest}
      />
      <label htmlFor={id} className="text-sm text-fg">
        {label}
      </label>
    </div>
  );
}
