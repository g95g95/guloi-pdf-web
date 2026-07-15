import type { ReactNode } from "react";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import axe from "axe-core";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { I18nProvider } from "./components/I18nProvider";
import { ToastProvider } from "./components/ui";
import { Home } from "./pages/Home";
import { Comprimi } from "./pages/Comprimi";
import { Dividi } from "./pages/Dividi";
import { Editor } from "./pages/Editor";
import { Privacy } from "./pages/Privacy";

/** Run axe against a container, restricting to WCAG 2.0/2.1 level A + AA. */
async function checkA11y(container: HTMLElement) {
  const results = await axe.run(container, {
    runOnly: {
      type: "tag",
      values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"],
    },
  });
  return results.violations;
}

function renderWithProviders(node: ReactNode) {
  return render(
    <MemoryRouter>
      <I18nProvider>
        <ToastProvider>{node}</ToastProvider>
      </I18nProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => localStorage.setItem("guloi-lang", "it"));
afterEach(() => localStorage.clear());

describe("accessibility (axe-core, WCAG A/AA)", () => {
  it("Home has no violations", async () => {
    const { container } = renderWithProviders(<Home />);
    const violations = await checkA11y(container);
    expect(violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
  });

  it("Comprimi tool page has no violations", async () => {
    const { container } = renderWithProviders(<Comprimi />);
    const violations = await checkA11y(container);
    expect(violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
  });

  it("Dividi tool page (radiogroup) has no violations", async () => {
    const { container } = renderWithProviders(<Dividi />);
    const violations = await checkA11y(container);
    expect(violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
  });

  it("Editor entry page has no violations", async () => {
    const { container } = renderWithProviders(<Editor />);
    const violations = await checkA11y(container);
    expect(violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
  });

  it("Privacy page has no violations", async () => {
    const { container } = renderWithProviders(<Privacy />);
    const violations = await checkA11y(container);
    expect(violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
  });
});
