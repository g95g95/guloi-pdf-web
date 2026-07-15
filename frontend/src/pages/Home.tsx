import { Link } from "react-router";
import { Card, CardBody } from "../components/ui";
import { toolIcons } from "../components/toolIcons";
import { tools } from "../lib/tools";
import { useT } from "../lib/i18n";
import { useDocumentMeta } from "../lib/useDocumentMeta";

export function Home() {
  const t = useT();
  useDocumentMeta(`${t("app.name")} · ${t("app.tagline")}`, t("home.hero.subtitle"));

  return (
    <div className="flex flex-col gap-10">
      <section className="flex flex-col items-center gap-4 pt-4 text-center">
        <h1 className="max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">
          {t("home.hero.title")}
        </h1>
        <p className="max-w-xl text-base text-fg-muted">{t("home.hero.subtitle")}</p>
        <p className="max-w-md text-sm text-fg-muted">{t("home.privacy")}</p>
      </section>

      <section
        aria-label={t("app.tagline")}
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
      >
        {tools.map((tool) => (
          <Link
            key={tool.path}
            to={tool.path}
            className="rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
          >
            <Card interactive className="h-full">
              <CardBody className="flex flex-col gap-3">
                <span className="inline-flex size-11 items-center justify-center rounded-lg bg-accent-subtle text-accent">
                  {toolIcons[tool.icon]}
                </span>
                <div className="flex flex-col gap-1">
                  <h2 className="text-base font-semibold">{t(tool.nameKey)}</h2>
                  <p className="text-sm text-fg-muted">{t(tool.descKey)}</p>
                </div>
              </CardBody>
            </Card>
          </Link>
        ))}
      </section>
    </div>
  );
}
