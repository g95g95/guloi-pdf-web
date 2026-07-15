import { createContext, useContext } from "react";
import { it } from "../locales/it";
import { en } from "../locales/en";

export type Lang = "it" | "en";
export type MessageKey = keyof typeof it;
/** Dictionary shape: same keys as `it`, values widened to plain strings. */
export type Messages = Record<MessageKey, string>;

const dictionaries: Record<Lang, Messages> = { it, en };

const STORAGE_KEY = "guloi-lang";

/** Values interpolated into `{placeholder}` slots. */
export type TParams = Record<string, string | number>;

/** Translation function: typed key, optional interpolation params. */
export type TFunc = (key: MessageKey, params?: TParams) => string;

/** Replace every `{name}` in `template` with `params.name`. */
export function interpolate(template: string, params?: TParams): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match,
  );
}

/** Look up and interpolate a message in the given language. */
export function translate(lang: Lang, key: MessageKey, params?: TParams): string {
  return interpolate(dictionaries[lang][key], params);
}

/** Best-effort default: it→it, everything else→en. */
export function detectLang(): Lang {
  const stored = getStoredLang();
  if (stored) return stored;
  const nav =
    typeof navigator !== "undefined" ? navigator.language.toLowerCase() : "en";
  return nav.startsWith("it") ? "it" : "en";
}

export function getStoredLang(): Lang | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === "it" || v === "en" ? v : null;
  } catch {
    return null;
  }
}

export function persistLang(lang: Lang): void {
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    /* storage unavailable — keep the choice for this session only */
  }
}

interface I18nContextValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: TFunc;
}

export const I18nContext = createContext<I18nContextValue | null>(null);

/** Access the current language, a setter, and the typed `t` function. */
export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error("useI18n must be used inside <I18nProvider>");
  }
  return ctx;
}

/**
 * Convenience: just the `t` function. Falls back to a provider-free Italian
 * translator so leaf components (and their isolated unit tests) render without
 * an <I18nProvider>; inside the app the context value is used.
 */
export function useT(): TFunc {
  const ctx = useContext(I18nContext);
  return ctx ? ctx.t : (key, params) => translate("it", key, params);
}
