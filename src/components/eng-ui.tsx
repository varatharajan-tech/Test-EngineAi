import type { ReactNode } from "react";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between sm:gap-6 mb-6">
      <div className="min-w-0">
        {eyebrow ? <p className="label-eng text-brand">{eyebrow}</p> : null}
        <h1 className="text-xl sm:text-2xl font-semibold tracking-tight mt-1 truncate">{title}</h1>
        {description ? <p className="text-sm text-muted-foreground mt-1">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={"panel p-4 sm:p-5 " + className}>{children}</div>;
}

export function PanelHeader({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-4">
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      {children}
    </div>
  );
}

export function KpiTile({
  label, value, unit, trend, accent,
}: {
  label: string; value: string; unit?: string; trend?: string; accent?: "brand" | "accent" | "danger";
}) {
  const color = accent === "accent" ? "text-accent" : accent === "danger" ? "text-danger" : "text-foreground";
  return (
    <div className="panel p-4">
      <p className="label-eng mb-1">{label}</p>
      <div className="flex items-baseline gap-1.5">
        <span className={"num text-xl sm:text-2xl " + color}>{value}</span>
        {unit ? <span className="text-xs text-muted-foreground">{unit}</span> : null}
      </div>
      {trend ? <p className="text-[11px] text-brand mt-2">{trend}</p> : null}
    </div>
  );
}

export function MetricTile({
  label, value, unit, confidence,
}: {
  label: string; value: string; unit?: string; confidence?: number;
}) {
  const filled = confidence ? Math.round((confidence / 100) * 5) : 0;
  return (
    <div className="panel p-4">
      <p className="label-eng mb-2">{label}</p>
      <div className="flex items-baseline gap-1.5">
        <span className="num text-lg text-foreground">{value}</span>
        {unit ? <span className="text-xs text-muted-foreground">{unit}</span> : null}
      </div>
      {confidence !== undefined ? (
        <>
          <div className="flex gap-0.5 mt-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className={"h-1 flex-1 " + (i < filled ? "bg-brand" : "bg-secondary")} />
            ))}
          </div>
          <p className="text-[9px] text-muted-foreground mt-1 text-right num">CONF {confidence.toFixed(1)}%</p>
        </>
      ) : null}
    </div>
  );
}

export function StatusPill({ status }: { status: string }) {
  const color =
    status === "completed" || status === "Validated"
      ? "bg-brand/10 text-brand ring-brand/30"
      : status === "running"
      ? "bg-accent/10 text-accent ring-accent/30"
      : "bg-secondary text-muted-foreground ring-white/5";
  return (
    <span className={"px-2 py-0.5 rounded-full text-[10px] uppercase font-bold ring-1 " + color}>
      {status}
    </span>
  );
}

export function EmptyState({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="panel p-8 sm:p-12 text-center">
      <p className="label-eng">No data</p>
      <h3 className="text-lg font-medium mt-2">{title}</h3>
      {hint ? <p className="text-sm text-muted-foreground mt-1">{hint}</p> : null}
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}
