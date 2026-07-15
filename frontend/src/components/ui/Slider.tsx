import { useId } from "react";
import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

export interface SliderProps {
  label: ReactNode;
  min: number;
  max: number;
  step?: number;
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  /** Formats the current value for the readout next to the label. */
  formatValue?: (value: number) => string;
  className?: string;
}

/** Labelled range input with a live value readout. */
export function Slider({
  label,
  min,
  max,
  step = 1,
  value,
  onChange,
  disabled = false,
  formatValue,
  className,
}: SliderProps) {
  const id = useId();
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={id} className="text-sm font-medium text-fg">
          {label}
        </label>
        <span className="text-sm text-fg-muted" aria-hidden="true">
          {formatValue ? formatValue(value) : value}
        </span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-valuetext={formatValue ? formatValue(value) : String(value)}
        className={cn(
          "h-2 w-full cursor-pointer appearance-none rounded-full bg-border accent-[var(--accent)]",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          "disabled:pointer-events-none disabled:opacity-55",
        )}
      />
    </div>
  );
}
