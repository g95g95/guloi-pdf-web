import { cn } from "../../lib/cn";

export interface ProgressBarProps {
  /** 0–100. Omit (or pass null) for an indeterminate bar. */
  value?: number | null;
  className?: string;
  /** Accessible label; defaults to Italian "Avanzamento". */
  label?: string;
}

export function ProgressBar({
  value = null,
  className,
  label = "Avanzamento",
}: ProgressBarProps) {
  const indeterminate = value === null || value === undefined;
  const clamped = indeterminate ? 0 : Math.min(100, Math.max(0, value));

  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={indeterminate ? undefined : Math.round(clamped)}
      className={cn(
        "h-2 w-full overflow-hidden rounded-full bg-bg-subtle",
        className,
      )}
    >
      <div
        className={cn(
          "h-full rounded-full bg-accent",
          indeterminate
            ? "w-2/5 animate-[guloi-indeterminate_1.4s_ease-in-out_infinite]"
            : "transition-[width] duration-[var(--duration-base)] ease-[var(--ease-out)]",
        )}
        style={indeterminate ? undefined : { width: `${clamped}%` }}
      />
    </div>
  );
}
