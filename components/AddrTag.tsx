"use client";

import type { TraderLabel } from "@/lib/hl";
import { explorerUrl } from "@/lib/hl";
import { truncAddr } from "@/lib/format";

const STYLE: Record<TraderLabel, { badge: string; text: string; label: string }> = {
  MM: { badge: "bg-s1/10 text-s1", text: "text-s1", label: "MM" },
  VOLBOT: {
    badge: "bg-s5/10 text-s5",
    text: "text-s5",
    label: "VOL",
  },
  TWAP: { badge: "bg-s2/10 text-s2", text: "text-s2", label: "TWAP" },
  ORGANIC: { badge: "", text: "text-ink", label: "" },
};

export function LabelBadge({ label }: { label: TraderLabel }) {
  if (label === "ORGANIC") return null;
  const s = STYLE[label];
  return (
    <span className={`rounded px-1 py-px text-[9px] font-bold tracking-wider ${s.badge}`}>
      {s.label}
    </span>
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
    <span className={`tnum font-mono ${s.text} ${link ? "hover:underline" : ""}`}>
      {truncAddr(addr)}
    </span>
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
