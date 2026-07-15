import { describe, expect, it } from "vitest";
import {
  clamp,
  clampViewPoint,
  normalizeRect,
  pdfRectToView,
  pdfToViewPoint,
  translateRect,
  viewCornersToPdfRect,
  viewToPdfPoint,
} from "./coords";

// A4 portrait: 595.276 x 841.890 pts. Use a round page height for clarity.
const H = 800;

describe("viewToPdfPoint (y-flip + descale)", () => {
  it("maps the view origin (top-left) to the page's top-left in PDF space", () => {
    expect(viewToPdfPoint({ x: 0, y: 0 }, H, 1)).toEqual([0, 800]);
  });

  it("maps the view bottom-left to the PDF origin", () => {
    expect(viewToPdfPoint({ x: 0, y: 800 }, H, 1)).toEqual([0, 0]);
  });

  it("divides by the scale factor", () => {
    // 200% zoom: 100 CSS px = 50 pts.
    expect(viewToPdfPoint({ x: 100, y: 100 }, H, 2)).toEqual([50, 750]);
  });

  it("handles fractional scales", () => {
    const [x, y] = viewToPdfPoint({ x: 30, y: 60 }, H, 0.75);
    expect(x).toBeCloseTo(40);
    expect(y).toBeCloseTo(800 - 80);
  });
});

describe("pdfToViewPoint (inverse)", () => {
  it("is the exact inverse of viewToPdfPoint (round-trip)", () => {
    const cases: { x: number; y: number; scale: number }[] = [
      { x: 0, y: 0, scale: 1 },
      { x: 123.4, y: 567.8, scale: 1 },
      { x: 10, y: 790, scale: 2 },
      { x: 300, y: 5, scale: 0.5 },
      { x: 42.42, y: 611.7, scale: 1.25 },
    ];
    for (const { x, y, scale } of cases) {
      const pdf = viewToPdfPoint({ x, y }, H, scale);
      const back = pdfToViewPoint(pdf, H, scale);
      expect(back.x).toBeCloseTo(x, 10);
      expect(back.y).toBeCloseTo(y, 10);
    }
  });

  it("maps the PDF origin to the view bottom-left", () => {
    expect(pdfToViewPoint([0, 0], H, 1)).toEqual({ x: 0, y: 800 });
    expect(pdfToViewPoint([0, 0], H, 2)).toEqual({ x: 0, y: 1600 });
  });
});

describe("normalizeRect", () => {
  it("keeps an already-normalized rect", () => {
    expect(normalizeRect([1, 2, 3, 4])).toEqual([1, 2, 3, 4]);
  });
  it("swaps inverted x", () => {
    expect(normalizeRect([3, 2, 1, 4])).toEqual([1, 2, 3, 4]);
  });
  it("swaps inverted y", () => {
    expect(normalizeRect([1, 4, 3, 2])).toEqual([1, 2, 3, 4]);
  });
  it("swaps both", () => {
    expect(normalizeRect([3, 4, 1, 2])).toEqual([1, 2, 3, 4]);
  });
});

describe("viewCornersToPdfRect", () => {
  it("produces a normalized rect regardless of drag direction", () => {
    const a = { x: 10, y: 20 };
    const b = { x: 110, y: 120 };
    const expected = [10, H - 120, 110, H - 20];
    expect(viewCornersToPdfRect(a, b, H, 1)).toEqual(expected);
    expect(viewCornersToPdfRect(b, a, H, 1)).toEqual(expected);
    expect(viewCornersToPdfRect({ x: 110, y: 20 }, { x: 10, y: 120 }, H, 1)).toEqual(expected);
    expect(viewCornersToPdfRect({ x: 10, y: 120 }, { x: 110, y: 20 }, H, 1)).toEqual(expected);
  });

  it("applies the scale to both corners", () => {
    // 200% zoom: a 100x100 CSS px drag is a 50x50 pt rect.
    const rect = viewCornersToPdfRect({ x: 0, y: 0 }, { x: 100, y: 100 }, H, 2);
    expect(rect).toEqual([0, 750, 50, 800]);
  });

  it("y-flip preserves the on-screen TOP edge as the PDF rect's y1", () => {
    // Drag near the top of the page: high view y ↔ low pdf y.
    const [, y0, , y1] = viewCornersToPdfRect({ x: 0, y: 10 }, { x: 50, y: 30 }, H, 1);
    expect(y1).toBe(H - 10); // top edge on screen
    expect(y0).toBe(H - 30); // bottom edge on screen
    expect(y1).toBeGreaterThan(y0);
  });
});

describe("pdfRectToView", () => {
  it("round-trips with viewCornersToPdfRect", () => {
    const rect = viewCornersToPdfRect({ x: 25, y: 35 }, { x: 125, y: 235 }, H, 1.5);
    const view = pdfRectToView(rect, H, 1.5);
    expect(view.x).toBeCloseTo(25);
    expect(view.y).toBeCloseTo(35);
    expect(view.width).toBeCloseTo(100);
    expect(view.height).toBeCloseTo(200);
  });

  it("normalizes denormalized input", () => {
    const view = pdfRectToView([50, 700, 10, 600], H, 1);
    expect(view).toEqual({ x: 10, y: 100, width: 40, height: 100 });
  });
});

describe("clampViewPoint (page-bounds clamp)", () => {
  // Page 600x800 pts.
  it("keeps in-bounds points untouched", () => {
    expect(clampViewPoint({ x: 10, y: 20 }, 600, 800, 1)).toEqual({ x: 10, y: 20 });
  });

  it("clamps negative coordinates to 0", () => {
    expect(clampViewPoint({ x: -50, y: -30 }, 600, 800, 1)).toEqual({ x: 0, y: 0 });
  });

  it("clamps past-the-edge coordinates to the scaled page size", () => {
    expect(clampViewPoint({ x: 700, y: 900 }, 600, 800, 1)).toEqual({ x: 600, y: 800 });
    // 200% zoom: CSS bounds double.
    expect(clampViewPoint({ x: 1300, y: 1700 }, 600, 800, 2)).toEqual({ x: 1200, y: 1600 });
  });

  it("a drag ending off-page yields a rect clipped at the page edges (never negative)", () => {
    const a = clampViewPoint({ x: -50, y: -30 }, 600, 800, 1);
    const b = clampViewPoint({ x: 700, y: 900 }, 600, 800, 1);
    expect(viewCornersToPdfRect(a, b, 800, 1)).toEqual([0, 0, 600, 800]);
  });
});

describe("translateRect / clamp", () => {
  it("translates all four coordinates", () => {
    expect(translateRect([1, 2, 3, 4], 10, -2)).toEqual([11, 0, 13, 2]);
  });
  it("clamps into range", () => {
    expect(clamp(5, 0, 3)).toBe(3);
    expect(clamp(-1, 0, 3)).toBe(0);
    expect(clamp(2, 0, 3)).toBe(2);
  });
});
