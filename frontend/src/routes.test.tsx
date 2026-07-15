import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AppRoutes } from "./routes";
import { tools } from "./lib/tools";

beforeEach(() => localStorage.setItem("guloi-lang", "it"));
afterEach(() => localStorage.clear());

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AppRoutes />
    </MemoryRouter>,
  );
}

describe("home + router", () => {
  it("renders the privacy line and one card per tool with a working link", () => {
    renderAt("/");
    expect(
      screen.getByText(/subito eliminati/i),
    ).toBeInTheDocument();

    const hrefs = screen
      .getAllByRole("link")
      .map((a) => a.getAttribute("href"));
    for (const tool of tools) {
      expect(hrefs, `link for ${tool.path}`).toContain(tool.path);
    }
    // One card link per tool.
    const cardHrefs = hrefs.filter((h) => tools.some((t) => t.path === h));
    expect(cardHrefs.length).toBe(tools.length);
  });

  it("navigates to /comprimi and renders the compress page", async () => {
    const user = userEvent.setup();
    renderAt("/");
    const link = screen
      .getAllByRole("link")
      .find((a) => a.getAttribute("href") === "/comprimi")!;
    await user.click(link);
    expect(
      within(document.body).getByRole("button", { name: "COMPRIMI" }),
    ).toBeInTheDocument();
  });

  it("falls back to home for an unknown route", () => {
    renderAt("/does-not-exist");
    expect(screen.getByText(/subito eliminati/i)).toBeInTheDocument();
  });

  it("keeps the header app name across routes", () => {
    renderAt("/proteggi");
    expect(screen.getByText("Guloi PDF")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "PROTEGGI" })).toBeInTheDocument();
  });

  it("renders the privacy page at /privacy with a heading", () => {
    renderAt("/privacy");
    expect(screen.getByRole("heading", { level: 1, name: "Privacy" })).toBeInTheDocument();
  });
});
