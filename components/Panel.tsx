import { ReactNode } from "react";

/** v2 card: white surface, soft border, uppercase accent title in the header. */
export function Panel({
  title,
  right,
  children,
  className = "",
  bodyClassName = "",
}: {
  title: string;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section
      className={`flex flex-col rounded-lg border border-edge bg-surface shadow-card ${className}`}
    >
      <header className="flex items-center justify-between gap-3 border-b border-edge-soft px-4 py-2.5">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-accent">
          {title}
        </h2>
        {right ? <div className="text-[11px] text-ink-2">{right}</div> : null}
      </header>
      <div className={`min-h-0 flex-1 ${bodyClassName}`}>{children}</div>
    </section>
  );
}
