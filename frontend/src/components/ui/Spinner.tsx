import { cn } from "../../lib/cn";

type SpinnerSize = "sm" | "md" | "lg";

const sizes: Record<SpinnerSize, string> = {
  sm: "size-4 border-2",
  md: "size-5 border-2",
  lg: "size-8 border-[3px]",
};

export interface SpinnerProps {
  size?: SpinnerSize;
  className?: string;
  /** Accessible label; defaults to Italian "Caricamento". */
  label?: string;
}

export function Spinner({ size = "md", className, label = "Caricamento" }: SpinnerProps) {
  return (
    <span
      role="status"
      aria-label={label}
      className={cn(
        "inline-block animate-spin rounded-full border-current border-t-transparent align-[-0.125em]",
        sizes[size],
        className,
      )}
    />
  );
}
