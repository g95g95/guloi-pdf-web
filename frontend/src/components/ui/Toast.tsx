import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";
import { cn } from "../../lib/cn";
import { useT } from "../../lib/i18n";

export type ToastVariant = "info" | "success" | "error";

export interface Toast {
  id: string;
  message: string;
  variant: ToastVariant;
}

interface ToastContextValue {
  toast: (message: string, variant?: ToastVariant, durationMs?: number) => string;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const DEFAULT_DURATION = 4000;

const variantStyles: Record<ToastVariant, string> = {
  info: "border-border bg-bg-elevated text-fg",
  success: "border-accent bg-accent-subtle text-fg",
  error: "border-danger bg-bg-elevated text-fg",
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const t = useT();
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const toast = useCallback(
    (
      message: string,
      variant: ToastVariant = "info",
      durationMs: number = DEFAULT_DURATION,
    ) => {
      const id =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random()}`;
      setToasts((prev) => [...prev, { id, message, variant }]);
      if (durationMs > 0) {
        const timer = setTimeout(() => dismiss(id), durationMs);
        timers.current.set(id, timer);
      }
      return id;
    },
    [dismiss],
  );

  // Clear any pending auto-dismiss timers when the provider unmounts.
  useEffect(() => {
    const map = timers.current;
    return () => {
      for (const timer of map.values()) clearTimeout(timer);
      map.clear();
    };
  }, []);

  const value = useMemo(() => ({ toast, dismiss }), [toast, dismiss]);

  const renderToast = (item: Toast) => (
    <div
      key={item.id}
      role={item.variant === "error" ? "alert" : "status"}
      className={cn(
        "pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-md border px-4 py-3 shadow-[var(--shadow-md)]",
        "animate-[guloi-toast-in_var(--duration-base)_var(--ease-out)]",
        variantStyles[item.variant],
      )}
    >
      <span className="min-w-0 flex-1 break-words text-sm">{item.message}</span>
      <button
        type="button"
        onClick={() => dismiss(item.id)}
        aria-label={t("toast.close")}
        className="-mr-1 shrink-0 rounded-sm text-fg-muted transition-colors duration-[var(--duration-fast)] hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" fill="none">
          <path
            d="M4 4l8 8M12 4l-8 8"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
      </button>
    </div>
  );

  const errorToasts = toasts.filter((item) => item.variant === "error");
  const politeToasts = toasts.filter((item) => item.variant !== "error");

  // Error toasts are interruptive → assertive region; everything else polite.
  // Both stacks share the same visual container so ordering/spacing is uniform.
  const containerClass =
    "pointer-events-none fixed inset-x-0 bottom-0 z-50 flex flex-col items-center gap-2 p-4 sm:items-end";

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className={containerClass}>
        <div aria-live="assertive" aria-atomic="false" className="flex flex-col items-center gap-2 sm:items-end">
          {errorToasts.map(renderToast)}
        </div>
        <div aria-live="polite" aria-atomic="false" className="flex flex-col items-center gap-2 sm:items-end">
          {politeToasts.map(renderToast)}
        </div>
      </div>
    </ToastContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast deve essere usato dentro <ToastProvider>");
  }
  return ctx;
}
