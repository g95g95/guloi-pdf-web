/**
 * Serialization must match the backend wire contract EXACTLY (extra keys are
 * rejected server-side with extra="forbid"). Each kind is compared against a
 * hand-written expected JSON object.
 */

import { describe, expect, it } from "vitest";
import type { EditorAnnotation } from "./annotations";
import {
  hasPermanentEdits,
  serializeAnnotations,
  usedSignatureKeys,
} from "./annotations";

const all: EditorAnnotation[] = [
  { id: "a1", kind: "highlight", page: 0, rect: [10, 20, 110, 40], color: [1, 1, 0] },
  { id: "a2", kind: "draw", page: 1, points: [[0, 0], [5, 5], [10, 3]], color: [1, 0, 0], width: 2 },
  { id: "a3", kind: "text", page: 0, x: 50, y: 700, text: "Ciao", font_size: 14, color: [0, 0, 0] },
  { id: "a4", kind: "signature", page: 2, x: 100, y: 100, width: 150, height: 75, image_key: "sig-1" },
  { id: "a5", kind: "erase", page: 0, rect: [1, 2, 3, 4], color: [1, 1, 1], hard: false },
  { id: "a6", kind: "erase", page: 0, rect: [5, 6, 7, 8], color: [1, 1, 1], hard: true },
  {
    id: "a7", kind: "text_edit", page: 3, cover_rect: [10, 10, 60, 24],
    x: 12, y: 13, text: "nuovo", font_size: 12, color: [0, 0, 0],
  },
  { id: "a8", kind: "form_field", page: 0, field_name: "nome", value: "Mario" },
];

// Hand-written expected payload — the contract, verbatim.
const expected = [
  { kind: "highlight", page: 0, rect: [10, 20, 110, 40], color: [1, 1, 0] },
  { kind: "draw", page: 1, points: [[0, 0], [5, 5], [10, 3]], color: [1, 0, 0], width: 2 },
  { kind: "text", page: 0, x: 50, y: 700, text: "Ciao", font_size: 14, color: [0, 0, 0] },
  { kind: "signature", page: 2, x: 100, y: 100, width: 150, height: 75, image_key: "sig-1" },
  { kind: "erase", page: 0, rect: [1, 2, 3, 4], color: [1, 1, 1], hard: false },
  { kind: "erase", page: 0, rect: [5, 6, 7, 8], color: [1, 1, 1], hard: true },
  {
    kind: "text_edit", page: 3, cover_rect: [10, 10, 60, 24],
    x: 12, y: 13, text: "nuovo", font_size: 12, color: [0, 0, 0],
  },
  { kind: "form_field", page: 0, field_name: "nome", value: "Mario" },
];

describe("serializeAnnotations", () => {
  it("serializes every kind to the exact contract shape", () => {
    expect(JSON.parse(serializeAnnotations(all))).toEqual(expected);
  });

  it("never leaks the client-side id (or any extra key)", () => {
    const parsed = JSON.parse(serializeAnnotations(all)) as Record<string, unknown>[];
    const expectedKeys: Record<string, string[]> = {
      highlight: ["kind", "page", "rect", "color"],
      draw: ["kind", "page", "points", "color", "width"],
      text: ["kind", "page", "x", "y", "text", "font_size", "color"],
      signature: ["kind", "page", "x", "y", "width", "height", "image_key"],
      erase: ["kind", "page", "rect", "color", "hard"],
      text_edit: ["kind", "page", "cover_rect", "x", "y", "text", "font_size", "color"],
      form_field: ["kind", "page", "field_name", "value"],
    };
    for (const obj of parsed) {
      expect(Object.keys(obj).sort()).toEqual(
        [...(expectedKeys[obj.kind as string] ?? [])].sort(),
      );
    }
  });

  it("serializes an empty list to []", () => {
    expect(serializeAnnotations([])).toBe("[]");
  });
});

describe("hasPermanentEdits", () => {
  it("false for soft-only annotations", () => {
    expect(hasPermanentEdits(all.filter((a) => a.id !== "a6" && a.id !== "a7"))).toBe(false);
  });
  it("true when a hard erase is present", () => {
    expect(hasPermanentEdits(all.filter((a) => a.id === "a6"))).toBe(true);
  });
  it("true when a text_edit is present (always a real redaction)", () => {
    expect(hasPermanentEdits(all.filter((a) => a.id === "a7"))).toBe(true);
  });
});

describe("usedSignatureKeys", () => {
  it("collects deduplicated keys of signature annotations only", () => {
    const withDup: EditorAnnotation[] = [
      ...all,
      { id: "a9", kind: "signature", page: 0, x: 0, y: 0, width: 10, height: 5, image_key: "sig-1" },
      { id: "a10", kind: "signature", page: 0, x: 0, y: 0, width: 10, height: 5, image_key: "sig-2" },
    ];
    expect(usedSignatureKeys(withDup)).toEqual(["sig-1", "sig-2"]);
    expect(usedSignatureKeys([])).toEqual([]);
  });
});
