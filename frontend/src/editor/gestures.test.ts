import { describe, expect, it } from "vitest";
import {
  buildDraw,
  buildErase,
  buildHighlight,
  buildSignature,
  buildText,
  buildTextEdit,
  DEFAULT_SIGNATURE_WIDTH,
  type PageGeometry,
} from "./gestures";

const geo: PageGeometry = { page: 2, heightPts: 800, scale: 2 };

describe("buildHighlight / buildErase (drag rect)", () => {
  it("converts the drag to a normalized PDF rect at the right page", () => {
    const ann = buildHighlight({ x: 20, y: 40 }, { x: 220, y: 140 }, geo);
    expect(ann).toEqual({
      kind: "highlight",
      page: 2,
      rect: [10, 730, 110, 780],
      color: [1, 1, 0],
    });
  });

  it("rejects sub-threshold drags (accidental clicks)", () => {
    expect(buildHighlight({ x: 10, y: 10 }, { x: 12, y: 12 }, geo)).toBeNull();
    expect(buildErase({ x: 10, y: 10 }, { x: 11, y: 300 }, geo, false)).toBeNull();
  });

  it("erase carries the hard flag", () => {
    const soft = buildErase({ x: 0, y: 0 }, { x: 100, y: 100 }, geo, false);
    const hard = buildErase({ x: 0, y: 0 }, { x: 100, y: 100 }, geo, true);
    expect(soft?.hard).toBe(false);
    expect(hard?.hard).toBe(true);
    expect(hard?.color).toEqual([1, 1, 1]);
  });
});

describe("buildDraw", () => {
  it("needs at least 2 points", () => {
    expect(buildDraw([{ x: 1, y: 1 }], geo)).toBeNull();
  });

  it("converts every point (y-flip + descale)", () => {
    const ann = buildDraw([{ x: 0, y: 0 }, { x: 2, y: 4 }], geo);
    expect(ann).toMatchObject({
      kind: "draw",
      page: 2,
      points: [[0, 800], [1, 798]],
      width: 2,
    });
  });
});

describe("buildText", () => {
  it("uses the click point as baseline anchor in PDF space", () => {
    const ann = buildText({ x: 100, y: 200 }, "hello", 14, geo);
    expect(ann).toEqual({
      kind: "text",
      page: 2,
      x: 50,
      y: 700,
      text: "hello",
      font_size: 14,
      color: [0, 0, 0],
    });
  });

  it("rejects empty/whitespace text", () => {
    expect(buildText({ x: 0, y: 0 }, "   ", 12, geo)).toBeNull();
  });
});

describe("buildSignature", () => {
  it("centers the default-width box on the click point, keeping aspect", () => {
    const ann = buildSignature({ x: 400, y: 400 }, "sig-1", 0.5, geo);
    const w = DEFAULT_SIGNATURE_WIDTH;
    const h = w * 0.5;
    expect(ann).toEqual({
      kind: "signature",
      page: 2,
      x: 200 - w / 2,
      y: 600 - h / 2,
      width: w,
      height: h,
      image_key: "sig-1",
    });
  });

  it("falls back to a sane aspect for degenerate images", () => {
    const ann = buildSignature({ x: 0, y: 0 }, "s", 0, geo);
    expect(ann.height).toBeGreaterThan(0);
  });
});

describe("buildTextEdit", () => {
  it("keeps the cover rect and anchors the text inside its bottom-left", () => {
    const ann = buildTextEdit({ x: 0, y: 0 }, { x: 200, y: 100 }, "nuovo", 12, geo);
    expect(ann).toMatchObject({
      kind: "text_edit",
      page: 2,
      cover_rect: [0, 750, 100, 800],
      x: 2,
      y: 753,
      text: "nuovo",
      font_size: 12,
    });
  });

  it("allows empty replacement text (pure redaction) but not a tiny rect", () => {
    expect(buildTextEdit({ x: 0, y: 0 }, { x: 200, y: 100 }, "", 12, geo)?.text).toBe("");
    expect(buildTextEdit({ x: 0, y: 0 }, { x: 1, y: 1 }, "x", 12, geo)).toBeNull();
  });
});
