import { useEffect } from "react";

/** Upsert a `<meta name|property="key" content>` tag, creating it if absent. */
function setMeta(attr: "name" | "property", key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

/**
 * Reflects the current page's title + description onto the document and the
 * OpenGraph tags. Re-runs whenever title/description change (e.g. on language
 * switch or route change), so SR page-title announcements stay in sync.
 */
export function useDocumentMeta(title: string, description: string): void {
  useEffect(() => {
    document.title = title;
    setMeta("name", "description", description);
    setMeta("property", "og:title", title);
    setMeta("property", "og:description", description);
  }, [title, description]);
}
