import type { ReactNode } from "react";

/** Simple hand-drawn line icons, 24×24, inheriting currentColor. */
const svg = (children: ReactNode) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    {children}
  </svg>
);

const stroke = {
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export const toolIcons = {
  compress: svg(
    <>
      <path d="M8 3v4M8 21v-4M16 3v4M16 21v-4" {...stroke} />
      <rect x="4" y="9" width="16" height="6" rx="1.5" {...stroke} />
      <path d="M9 5l-1 2 1 2M15 5l1 2-1 2" {...stroke} />
    </>,
  ),
  merge: svg(
    <>
      <rect x="3" y="4" width="9" height="12" rx="1.5" {...stroke} />
      <rect x="12" y="8" width="9" height="12" rx="1.5" {...stroke} />
    </>,
  ),
  split: svg(
    <>
      <rect x="4" y="3" width="10" height="14" rx="1.5" {...stroke} />
      <path d="M17 8h3v13H10v-3" {...stroke} />
      <path d="M8 7l3 3-3 3" {...stroke} />
    </>,
  ),
  rotate: svg(
    <>
      <path d="M20 11a8 8 0 1 0-2.3 5.6" {...stroke} />
      <path d="M20 5v6h-6" {...stroke} />
    </>,
  ),
  extract: svg(
    <>
      <path d="M6 3h9l3 3v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" {...stroke} />
      <path d="M14 3v4h4" {...stroke} />
      <path d="M8 13h6M8 16h4" {...stroke} />
    </>,
  ),
  protect: svg(
    <>
      <path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6l7-3z" {...stroke} />
      <path d="M12 11v3" {...stroke} />
      <circle cx="12" cy="10" r="0.4" fill="currentColor" stroke="none" />
    </>,
  ),
  editor: svg(
    <>
      <path d="M5 4h10l4 4v12H5V4z" {...stroke} />
      <path d="M15 4v4h4" {...stroke} />
      <path d="M9 15.5l6.2-6.2a1.3 1.3 0 011.8 1.8L10.8 17.3 8.5 18l.5-2.5z" {...stroke} />
    </>,
  ),
  unlock: svg(
    <>
      <rect x="5" y="11" width="14" height="9" rx="2" {...stroke} />
      <path d="M8 11V8a4 4 0 0 1 7.5-1.9" {...stroke} />
      <path d="M12 15v2" {...stroke} />
    </>,
  ),
} as const satisfies Record<string, ReactNode>;

export type ToolIconKey = keyof typeof toolIcons;
