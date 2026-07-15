import { Card, CardBody } from "../components/ui";
import { useT } from "../lib/i18n";
import { useDocumentMeta } from "../lib/useDocumentMeta";
import { SOURCE_REPO_URL } from "../lib/constants";

/** Sections rendered in order: [titleKey, bodyKey]. */
const sections = [
  ["privacy.files.title", "privacy.files.body"],
  ["privacy.logs.title", "privacy.logs.body"],
  ["privacy.cookies.title", "privacy.cookies.body"],
  ["privacy.limits.title", "privacy.limits.body"],
] as const;

export function Privacy() {
  const t = useT();
  useDocumentMeta(`${t("privacy.title")} · ${t("app.name")}`, t("privacy.intro"));

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">{t("privacy.title")}</h1>
        <p className="text-sm text-fg-muted">{t("privacy.intro")}</p>
      </div>

      <Card>
        <CardBody className="flex flex-col gap-6">
          {sections.map(([titleKey, bodyKey]) => (
            <section key={titleKey} className="flex flex-col gap-1.5">
              <h2 className="text-base font-semibold">{t(titleKey)}</h2>
              <p className="text-sm text-fg-muted">{t(bodyKey)}</p>
            </section>
          ))}

          <section className="flex flex-col gap-1.5">
            <h2 className="text-base font-semibold">{t("privacy.license.title")}</h2>
            <p className="text-sm text-fg-muted">
              {t("privacy.license.body")}{" "}
              <a
                href={SOURCE_REPO_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-4 hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
              >
                {t("privacy.license.link")}
              </a>
            </p>
          </section>
        </CardBody>
      </Card>
    </div>
  );
}
