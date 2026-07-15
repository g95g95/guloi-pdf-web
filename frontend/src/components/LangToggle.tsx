import { useI18n, type Lang } from "../lib/i18n";
import { cn } from "../lib/cn";

const langs: Lang[] = ["it", "en"];

/** Header IT/EN switch. Persists the choice and re-renders the tree live. */
export function LangToggle() {
  const { lang, setLang, t } = useI18n();

  return (
    <div
      role="group"
      aria-label={t("lang.switch")}
      className="inline-flex items-center rounded-md border border-border bg-bg-elevated p-0.5"
    >
      {langs.map((code) => {
        const active = code === lang;
        return (
          <button
            key={code}
            type="button"
            aria-pressed={active}
            onClick={() => setLang(code)}
            className={cn(
              "rounded-sm px-2 py-1 text-xs font-medium transition-colors duration-[var(--duration-fast)] ease-[var(--ease-out)]",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              active
                ? "bg-accent text-accent-fg"
                : "text-fg-muted hover:text-fg",
            )}
          >
            {t(code === "it" ? "lang.it" : "lang.en")}
          </button>
        );
      })}
    </div>
  );
}
