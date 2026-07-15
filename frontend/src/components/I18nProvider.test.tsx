import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { I18nProvider } from "./I18nProvider";
import { LangToggle } from "./LangToggle";
import { useT } from "../lib/i18n";

function Probe() {
  const t = useT();
  return <p>{t("compress.action")}</p>;
}

describe("I18nProvider language switch", () => {
  beforeEach(() => {
    localStorage.clear();
    Object.defineProperty(navigator, "language", {
      value: "it-IT",
      configurable: true,
    });
  });

  it("renders in the detected language and switches live", async () => {
    const user = userEvent.setup();
    render(
      <I18nProvider>
        <LangToggle />
        <Probe />
      </I18nProvider>,
    );

    expect(screen.getByText("COMPRIMI")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "EN" }));
    expect(screen.getByText("COMPRESS")).toBeInTheDocument();
    expect(localStorage.getItem("guloi-lang")).toBe("en");
  });
});
