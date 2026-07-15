import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";
import App from "./App";
import { AppRoutes } from "./routes";
import { Button } from "./components/ui";
import { SOURCE_REPO_URL } from "./lib/constants";

function renderApp() {
  return render(
    <MemoryRouter>
      <App />
    </MemoryRouter>,
  );
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AppRoutes />
    </MemoryRouter>,
  );
}

describe("app shell smoke test", () => {
  it("renders the app name in the header", () => {
    renderApp();
    expect(screen.getByText("Guloi PDF")).toBeInTheDocument();
  });

  it("exposes the theme toggle as a switch", () => {
    renderApp();
    expect(screen.getByRole("switch")).toBeInTheDocument();
  });

  it("renders a skip-to-content link targeting the main region", () => {
    renderApp();
    const skip = screen.getByRole("link", { name: /vai al contenuto|skip to content/i });
    expect(skip).toHaveAttribute("href", "#main-content");
    expect(screen.getByRole("main")).toHaveAttribute("id", "main-content");
  });

  it("renders a primary button that can enter loading state", () => {
    render(<Button loading>Elabora</Button>);
    const btn = screen.getByRole("button", { name: /elabora/i });
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute("aria-busy", "true");
  });

  it("renders the AGPL footer with source-code and privacy links", () => {
    renderApp();
    const source = screen.getByRole("link", { name: /codice sorgente|source code/i });
    expect(source).toHaveAttribute("href", SOURCE_REPO_URL);
    expect(source).toHaveAttribute("target", "_blank");
    expect(source).toHaveAttribute("rel", "noopener noreferrer");

    const privacy = screen.getByRole("link", { name: "Privacy" });
    expect(privacy).toHaveAttribute("href", "/privacy");
  });

  it("renders the footer on a routed tool page too", () => {
    renderAt("/comprimi");
    expect(
      screen.getByRole("link", { name: /codice sorgente|source code/i }),
    ).toHaveAttribute("href", SOURCE_REPO_URL);
  });
});
