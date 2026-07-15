import { describe, expect, it } from "vitest";
import type { Annotation, EditorAnnotation } from "./annotations";
import {
  historyReducer,
  initialHistory,
  translateAnnotation,
  type HistoryAction,
  type HistoryState,
} from "./history";

const highlight: Annotation = {
  kind: "highlight",
  page: 0,
  rect: [10, 20, 30, 40],
  color: [1, 1, 0],
};

const text: Annotation = {
  kind: "text",
  page: 1,
  x: 100,
  y: 200,
  text: "ciao",
  font_size: 12,
  color: [0, 0, 0],
};

function run(actions: HistoryAction[], from: HistoryState = initialHistory) {
  return actions.reduce(historyReducer, from);
}

describe("historyReducer add/remove", () => {
  it("add appends and selects the new annotation", () => {
    const s = run([{ type: "add", annotation: highlight, id: "h1" }]);
    expect(s.annotations).toHaveLength(1);
    expect(s.annotations[0]).toMatchObject({ ...highlight, id: "h1" });
    expect(s.selectedId).toBe("h1");
    expect(s.past).toHaveLength(1);
    expect(s.future).toHaveLength(0);
  });

  it("remove deletes by id and clears its selection", () => {
    const s = run([
      { type: "add", annotation: highlight, id: "h1" },
      { type: "add", annotation: text, id: "t1" },
      { type: "remove", id: "h1" },
    ]);
    expect(s.annotations.map((a) => a.id)).toEqual(["t1"]);
  });

  it("remove of an unknown id is a no-op (no history entry)", () => {
    const s1 = run([{ type: "add", annotation: highlight, id: "h1" }]);
    const s2 = historyReducer(s1, { type: "remove", id: "nope" });
    expect(s2).toBe(s1);
  });
});

describe("historyReducer move", () => {
  it("translates a rect annotation", () => {
    const s = run([
      { type: "add", annotation: highlight, id: "h1" },
      { type: "move", id: "h1", dx: 5, dy: -10 },
    ]);
    const ann = s.annotations[0] as EditorAnnotation & { kind: "highlight" };
    expect(ann.rect).toEqual([15, 10, 35, 30]);
  });

  it("translates a text annotation's anchor", () => {
    const s = run([
      { type: "add", annotation: text, id: "t1" },
      { type: "move", id: "t1", dx: -1, dy: 2 },
    ]);
    expect(s.annotations[0]).toMatchObject({ x: 99, y: 202 });
  });

  it("zero move is a no-op", () => {
    const s1 = run([{ type: "add", annotation: highlight, id: "h1" }]);
    expect(historyReducer(s1, { type: "move", id: "h1", dx: 0, dy: 0 })).toBe(s1);
  });
});

describe("translateAnnotation per kind", () => {
  it("draw translates every point", () => {
    const ann: EditorAnnotation = {
      id: "d1", kind: "draw", page: 0,
      points: [[0, 0], [10, 10]], color: [1, 0, 0], width: 2,
    };
    const moved = translateAnnotation(ann, 3, 4) as typeof ann;
    expect(moved.points).toEqual([[3, 4], [13, 14]]);
  });

  it("text_edit translates cover_rect and text anchor together", () => {
    const ann: EditorAnnotation = {
      id: "e1", kind: "text_edit", page: 0,
      cover_rect: [0, 0, 10, 10], x: 2, y: 3,
      text: "x", font_size: 12, color: [0, 0, 0],
    };
    const moved = translateAnnotation(ann, 1, 1) as typeof ann;
    expect(moved.cover_rect).toEqual([1, 1, 11, 11]);
    expect(moved.x).toBe(3);
    expect(moved.y).toBe(4);
  });

  it("form_field does not move", () => {
    const ann: EditorAnnotation = {
      id: "f1", kind: "form_field", page: 0, field_name: "a", value: "b",
    };
    expect(translateAnnotation(ann, 9, 9)).toBe(ann);
  });
});

describe("undo/redo", () => {
  it("undo restores the previous list, redo re-applies", () => {
    const s1 = run([
      { type: "add", annotation: highlight, id: "h1" },
      { type: "add", annotation: text, id: "t1" },
    ]);
    const undone = historyReducer(s1, { type: "undo" });
    expect(undone.annotations.map((a) => a.id)).toEqual(["h1"]);
    const redone = historyReducer(undone, { type: "redo" });
    expect(redone.annotations.map((a) => a.id)).toEqual(["h1", "t1"]);
  });

  it("undo at the beginning / redo at the end are no-ops", () => {
    expect(historyReducer(initialHistory, { type: "undo" })).toBe(initialHistory);
    const s = run([{ type: "add", annotation: highlight, id: "h1" }]);
    expect(historyReducer(s, { type: "redo" })).toBe(s);
  });

  it("a new action after undo clears the redo branch", () => {
    const s = run([
      { type: "add", annotation: highlight, id: "h1" },
      { type: "add", annotation: text, id: "t1" },
      { type: "undo" },
      { type: "add", annotation: text, id: "t2" },
    ]);
    expect(s.annotations.map((a) => a.id)).toEqual(["h1", "t2"]);
    expect(s.future).toHaveLength(0);
  });

  it("undo of a move restores the original coordinates", () => {
    const s = run([
      { type: "add", annotation: highlight, id: "h1" },
      { type: "move", id: "h1", dx: 100, dy: 100 },
      { type: "undo" },
    ]);
    expect(s.annotations[0]).toMatchObject({ rect: [10, 20, 30, 40] });
  });

  it("full sequence: add, add, remove, undo x3 → empty, redo x3 → back", () => {
    let s = run([
      { type: "add", annotation: highlight, id: "h1" },
      { type: "add", annotation: text, id: "t1" },
      { type: "remove", id: "h1" },
    ]);
    s = run([{ type: "undo" }, { type: "undo" }, { type: "undo" }], s);
    expect(s.annotations).toHaveLength(0);
    s = run([{ type: "redo" }, { type: "redo" }, { type: "redo" }], s);
    expect(s.annotations.map((a) => a.id)).toEqual(["t1"]);
  });
});

describe("annotation cap", () => {
  it("ignores adds beyond MAX_ANNOTATIONS (count stays at the cap)", () => {
    let s = initialHistory;
    for (let i = 0; i < 505; i++) {
      s = historyReducer(s, { type: "add", annotation: highlight, id: `h${i}` });
    }
    expect(s.annotations).toHaveLength(500);
    // The rejected adds left no history entries either.
    expect(s.past).toHaveLength(500);
  });
});

describe("select / update", () => {
  it("select does not touch history", () => {
    const s1 = run([{ type: "add", annotation: highlight, id: "h1" }]);
    const s2 = historyReducer(s1, { type: "select", id: null });
    expect(s2.past).toEqual(s1.past);
    expect(s2.selectedId).toBeNull();
  });

  it("update patches fields and is undoable", () => {
    const sig: Annotation = {
      kind: "signature", page: 0, x: 0, y: 0, width: 100, height: 50, image_key: "sig-1",
    };
    let s = run([
      { type: "add", annotation: sig, id: "s1" },
      { type: "update", id: "s1", patch: { width: 200, height: 100 } },
    ]);
    expect(s.annotations[0]).toMatchObject({ width: 200, height: 100 });
    s = historyReducer(s, { type: "undo" });
    expect(s.annotations[0]).toMatchObject({ width: 100, height: 50 });
  });
});
