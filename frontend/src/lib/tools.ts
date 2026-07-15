import type { MessageKey } from "./i18n";
import type { ToolIconKey } from "../components/toolIcons";

/** One entry per tool: route, icon, and the i18n keys for its home card. */
export interface ToolMeta {
  path: string;
  icon: ToolIconKey;
  nameKey: MessageKey;
  descKey: MessageKey;
}

export const tools: ToolMeta[] = [
  { path: "/comprimi", icon: "compress", nameKey: "tool.compress.name", descKey: "tool.compress.desc" },
  { path: "/unisci", icon: "merge", nameKey: "tool.merge.name", descKey: "tool.merge.desc" },
  { path: "/dividi", icon: "split", nameKey: "tool.split.name", descKey: "tool.split.desc" },
  { path: "/ruota", icon: "rotate", nameKey: "tool.rotate.name", descKey: "tool.rotate.desc" },
  { path: "/estrai", icon: "extract", nameKey: "tool.extract.name", descKey: "tool.extract.desc" },
  { path: "/proteggi", icon: "protect", nameKey: "tool.protect.name", descKey: "tool.protect.desc" },
  { path: "/sblocca", icon: "unlock", nameKey: "tool.unlock.name", descKey: "tool.unlock.desc" },
  { path: "/editor", icon: "editor", nameKey: "tool.editor.name", descKey: "tool.editor.desc" },
];
