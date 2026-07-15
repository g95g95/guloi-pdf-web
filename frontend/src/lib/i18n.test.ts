import { describe, expect, it } from "vitest";
import { interpolate, translate, detectLang } from "./i18n";
import { it as itDict } from "../locales/it";
import { en } from "../locales/en";

describe("i18n", () => {
  it("interpolates named params", () => {
    expect(interpolate("Ciao {n}", { n: 2 })).toBe("Ciao 2");
    expect(interpolate("{a} e {b}", { a: "x", b: "y" })).toBe("x e y");
  });

  it("leaves unknown placeholders untouched", () => {
    expect(interpolate("Ciao {name}", {})).toBe("Ciao {name}");
    expect(interpolate("nessun param")).toBe("nessun param");
  });

  it("translates in the requested language", () => {
    expect(translate("it", "compress.action")).toBe("COMPRIMI");
    expect(translate("en", "compress.action")).toBe("COMPRESS");
  });

  it("interpolates the compress result template like the desktop app", () => {
    expect(
      translate("it", "compress.result", { before: 100, after: 60, saved: 40 }),
    ).toBe("Prima: 100 KB · Dopo: 60 KB · Risparmio: 40%");
  });

  it("keeps it and en dictionaries in sync (same keys)", () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(itDict).sort());
  });

  it("detects Italian from navigator.language, else English", () => {
    const original = navigator.language;
    try {
      localStorage.clear();
      Object.defineProperty(navigator, "language", {
        value: "it-IT",
        configurable: true,
      });
      expect(detectLang()).toBe("it");
      Object.defineProperty(navigator, "language", {
        value: "fr-FR",
        configurable: true,
      });
      expect(detectLang()).toBe("en");
    } finally {
      Object.defineProperty(navigator, "language", {
        value: original,
        configurable: true,
      });
    }
  });
});
