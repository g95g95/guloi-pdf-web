import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  detectLang,
  I18nContext,
  persistLang,
  translate,
  type Lang,
  type TFunc,
} from "../lib/i18n";

/** Provides the current language + `t` to the tree; switching re-renders live. */
export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(detectLang);

  const setLang = useCallback((next: Lang) => {
    persistLang(next);
    setLangState(next);
  }, []);

  // Reflect the active language on <html lang> for a11y and correct hyphenation.
  useEffect(() => {
    document.documentElement.setAttribute("lang", lang);
  }, [lang]);

  const t = useCallback<TFunc>(
    (key, params) => translate(lang, key, params),
    [lang],
  );

  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}
