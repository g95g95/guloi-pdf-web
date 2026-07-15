import { Link, Outlet, useLocation } from "react-router";
import { cn } from "./lib/cn";
import { ThemeToggle } from "./components/ThemeToggle";
import { LangToggle } from "./components/LangToggle";
import { I18nProvider } from "./components/I18nProvider";
import { ToastProvider } from "./components/ui";
import { useT } from "./lib/i18n";
import { SOURCE_REPO_URL } from "./lib/constants";

function Header() {
  const t = useT();
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-bg/85 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between px-4 sm:px-6">
        <Link
          to="/"
          className="flex items-center gap-2.5 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
        >
          <span
            aria-hidden="true"
            className="inline-flex size-8 items-center justify-center rounded-md bg-accent text-sm font-bold text-accent-fg"
          >
            G
          </span>
          <span className="text-lg font-semibold tracking-tight">{t("app.name")}</span>
        </Link>
        <div className="flex items-center gap-2">
          <LangToggle />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}

/** Persistent footer: AGPL source-code link (§13 compliance) + privacy link. */
function Footer() {
  const t = useT();
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex w-full max-w-5xl flex-col items-center gap-1.5 px-4 py-6 text-center text-xs text-fg-muted sm:px-6">
        <p>
          {t("footer.license")}
          {" · "}
          <a
            href={SOURCE_REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-4 hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
          >
            {t("footer.sourceCode")}
          </a>
        </p>
        <p>
          <Link
            to="/privacy"
            className="underline underline-offset-4 hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
          >
            {t("footer.privacy")}
          </Link>
        </p>
      </div>
    </footer>
  );
}

/** Skip link: first tab stop, visually hidden until focused. */
function SkipLink() {
  const t = useT();
  return (
    <a
      href="#main-content"
      className="sr-only rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-fg focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
    >
      {t("skip.toContent")}
    </a>
  );
}

/** App shell: persistent header + routed content, wrapped in the providers. */
export default function App() {
  // The canvas editor needs the whole viewport width; every other page keeps
  // the centered reading column.
  const fullWidth = useLocation().pathname === "/editor";
  return (
    <I18nProvider>
      <ToastProvider>
        <div className="flex min-h-screen flex-col">
          <SkipLink />
          <Header />
          <main
            id="main-content"
            tabIndex={-1}
            className={cn(
              "mx-auto w-full flex-1 px-4 py-8 focus-visible:outline-none sm:px-6",
              fullWidth ? "max-w-none" : "max-w-5xl",
            )}
          >
            <Outlet />
          </main>
          <Footer />
        </div>
      </ToastProvider>
    </I18nProvider>
  );
}
