import { ReactNode } from "react";

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
    <section className={`panel corner flex flex-col ${className}`}>
      <header className="flex items-center justify-between border-b border-bg-line px-3 py-2">
        <h2 className="label text-term-green/90">
          <span className="text-term-dim">// </span>
          {title}
        </h2>
        {right ? <div className="text-[10px] text-term-muted">{right}</div> : null}
      </header>
      <div className={`flex-1 ${bodyClassName}`}>{children}</div>
    </section>
  );
}
