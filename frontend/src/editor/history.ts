/**
 * Editor annotation state with undo/redo, as a pure reducer.
 *
 * Snapshot-based history: `past` and `future` hold previous/next annotation
 * lists. With the backend cap of 500 annotations this is cheap (lists are
 * shared structurally — only the array is copied, not the annotations).
 */

import type { Annotation, EditorAnnotation } from "./annotations";
import { MAX_ANNOTATIONS, newAnnotationId } from "./annotations";
import { translateRect } from "./coords";

export interface HistoryState {
  annotations: EditorAnnotation[];
  past: EditorAnnotation[][];
  future: EditorAnnotation[][];
  selectedId: string | null;
}

export const initialHistory: HistoryState = {
  annotations: [],
  past: [],
  future: [],
  selectedId: null,
};

export type HistoryAction =
  | { type: "add"; annotation: Annotation; id?: string }
  | { type: "remove"; id: string }
  | { type: "move"; id: string; dx: number; dy: number }
  | { type: "update"; id: string; patch: Partial<Annotation> }
  | { type: "select"; id: string | null }
  | { type: "undo" }
  | { type: "redo" }
  | { type: "reset" };

/** Translate any annotation by (dx, dy) PDF points. form_field is a no-op. */
export function translateAnnotation(
  ann: EditorAnnotation,
  dx: number,
  dy: number,
): EditorAnnotation {
  switch (ann.kind) {
    case "highlight":
    case "erase":
      return { ...ann, rect: translateRect(ann.rect, dx, dy) };
    case "draw":
      return { ...ann, points: ann.points.map(([x, y]) => [x + dx, y + dy]) };
    case "text":
    case "signature":
      return { ...ann, x: ann.x + dx, y: ann.y + dy };
    case "text_edit":
      return {
        ...ann,
        cover_rect: translateRect(ann.cover_rect, dx, dy),
        x: ann.x + dx,
        y: ann.y + dy,
      };
    case "form_field":
      return ann;
  }
}

function commit(
  state: HistoryState,
  annotations: EditorAnnotation[],
  selectedId: string | null,
): HistoryState {
  return {
    annotations,
    past: [...state.past, state.annotations],
    future: [],
    selectedId,
  };
}

export function historyReducer(
  state: HistoryState,
  action: HistoryAction,
): HistoryState {
  switch (action.type) {
    case "add": {
      if (state.annotations.length >= MAX_ANNOTATIONS) return state;
      const id = action.id ?? newAnnotationId();
      const ann = { ...action.annotation, id } as EditorAnnotation;
      return commit(state, [...state.annotations, ann], id);
    }
    case "remove": {
      const next = state.annotations.filter((a) => a.id !== action.id);
      if (next.length === state.annotations.length) return state;
      return commit(
        state,
        next,
        state.selectedId === action.id ? null : state.selectedId,
      );
    }
    case "move": {
      if (action.dx === 0 && action.dy === 0) return state;
      let changed = false;
      const next = state.annotations.map((a) => {
        if (a.id !== action.id) return a;
        changed = true;
        return translateAnnotation(a, action.dx, action.dy);
      });
      if (!changed) return state;
      return commit(state, next, state.selectedId);
    }
    case "update": {
      let changed = false;
      const next = state.annotations.map((a) => {
        if (a.id !== action.id) return a;
        changed = true;
        return { ...a, ...action.patch } as EditorAnnotation;
      });
      if (!changed) return state;
      return commit(state, next, state.selectedId);
    }
    case "select":
      if (state.selectedId === action.id) return state;
      return { ...state, selectedId: action.id };
    case "undo": {
      const prev = state.past[state.past.length - 1];
      if (!prev) return state;
      return {
        annotations: prev,
        past: state.past.slice(0, -1),
        future: [state.annotations, ...state.future],
        selectedId: null,
      };
    }
    case "redo": {
      const next = state.future[0];
      if (!next) return state;
      return {
        annotations: next,
        past: [...state.past, state.annotations],
        future: state.future.slice(1),
        selectedId: null,
      };
    }
    case "reset":
      return initialHistory;
  }
}
