"use client";

import type { TraderLabel } from "@/lib/hl";
import { explorerUrl } from "@/lib/hl";
import { truncAddr } from "@/lib/format";

const STYLE: Record<TraderLabel, { badge: string; text: string; label: string }> = {
  MM: { badge: "bg-term-blue/20 text-term-blue", text: "text-term-blue", label: "MM" },
  VOLBOT: {
    badge: "bg-term-violet/20 text-term-violet",
    text: "text-term-violet",
    label: "VOL",
  },
  ORGANIC: { badge: "", text: "text-term-text", label: "" },
};

export function LabelBadge({ label }: { label: TraderLabel }) {
  if (label === "ORGANIC") return null;
  const s = STYLE[label];
  return (
    <span className={`px-1 text-[9px] font-bold tracking-wider ${s.badge}`}>{s.label}</span>
  );
}

export function AddrTag({
  addr,
  label,
  link = true,
}: {
  addr: string;
  label: TraderLabel;
  link?: boolean;
}) {
  const s = STYLE[label];
  const body = (
    <span className={`tnum ${s.text} ${link ? "hover:underline" : ""}`}>{truncAddr(addr)}</span>
  );
  return (
    <span className="inline-flex items-center gap-1">
      <LabelBadge label={label} />
      {link ? (
        <a href={explorerUrl(addr)} target="_blank" rel="noreferrer" title={addr}>
          {body}
        </a>
      ) : (
        body
      )}
    </span>
  );
}
