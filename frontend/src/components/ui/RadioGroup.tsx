import { useRef, type ReactNode } from "react";
import { cn } from "../../lib/cn";

export interface RadioOption<T extends string> {
  value: T;
  label: ReactNode;
}

export interface RadioGroupProps<T extends string> {
  /** Accessible group label. */
  label: string;
  options: RadioOption<T>[];
  value: T;
  onChange: (value: T) => void;
  disabled?: boolean;
  /** Layout of the option buttons; defaults to a vertical stack. */
  orientation?: "vertical" | "horizontal";
  className?: string;
  /** Renders one option button's inner content. `active` reflects selection. */
  renderOption: (option: RadioOption<T>, active: boolean) => ReactNode;
  /** Extra classes applied to each option button. */
  optionClassName?: (active: boolean) => string;
}

/**
 * A spec-correct radio group with roving tabindex: exactly one option is a tab
 * stop (the selected one), and Arrow keys move both focus and selection. Home/
 * End jump to the first/last option. This replaces the previous plain buttons
 * with role=radio that were all individually tabbable.
 */
export function RadioGroup<T extends string>({
  label,
  options,
  value,
  onChange,
  disabled = false,
  orientation = "vertical",
  className,
  renderOption,
  optionClassName,
}: RadioGroupProps<T>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  function focusAt(index: number) {
    const opt = options[index];
    if (!opt) return;
    onChange(opt.value);
    refs.current[index]?.focus();
  }

  function onKeyDown(e: React.KeyboardEvent, index: number) {
    if (disabled) return;
    const last = options.length - 1;
    switch (e.key) {
      case "ArrowDown":
      case "ArrowRight":
        e.preventDefault();
        focusAt(index === last ? 0 : index + 1);
        break;
      case "ArrowUp":
      case "ArrowLeft":
        e.preventDefault();
        focusAt(index === 0 ? last : index - 1);
        break;
      case "Home":
        e.preventDefault();
        focusAt(0);
        break;
      case "End":
        e.preventDefault();
        focusAt(last);
        break;
    }
  }

  return (
    <div
      role="radiogroup"
      aria-label={label}
      aria-orientation={orientation}
      className={cn(
        orientation === "vertical" ? "flex flex-col gap-2" : "inline-flex gap-2",
        className,
      )}
    >
      {options.map((option, index) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            ref={(el) => {
              refs.current[index] = el;
            }}
            type="button"
            role="radio"
            aria-checked={active}
            // Roving tabindex: only the selected option is a tab stop.
            tabIndex={disabled ? -1 : active ? 0 : -1}
            disabled={disabled}
            onClick={() => onChange(option.value)}
            onKeyDown={(e) => onKeyDown(e, index)}
            className={optionClassName?.(active)}
          >
            {renderOption(option, active)}
          </button>
        );
      })}
    </div>
  );
}
