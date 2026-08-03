import { cn } from "@/lib/utils";
import { Loader2, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

/* ============================================================
 * Primitivos compartilhados — UI premium consistente em todo o admin
 * ============================================================ */

export function PageActions({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("flex flex-wrap items-center gap-2", className)}>{children}</div>;
}

export function SectionCard({
  title,
  description,
  actions,
  children,
  className,
  noPadding,
}: {
  title?: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  noPadding?: boolean;
}) {
  return (
    <section className={cn("surface-card overflow-hidden", className)}>
      {(title || actions) && (
        <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-5 py-4 border-b border-border">
          <div className="min-w-0">
            {title && <h2 className="font-display text-[15px] font-semibold tracking-tight truncate">{title}</h2>}
            {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={cn(!noPadding && "p-5")}>{children}</div>
    </section>
  );
}

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  trend,
  accent,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  icon?: LucideIcon;
  trend?: { value: string; positive?: boolean };
  accent?: boolean;
}) {
  return (
    <div className="surface-card p-5 group hover:shadow-elevated transition-shadow duration-200">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
        {Icon && (
          <div
            className={cn(
              "w-8 h-8 rounded-lg grid place-items-center shrink-0 transition-colors",
              accent ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary"
            )}
          >
            <Icon className="w-4 h-4" />
          </div>
        )}
      </div>
      <p className="font-display text-3xl font-semibold tracking-tight mt-3">{value}</p>
      {(hint || trend) && (
        <div className="flex items-center gap-2 mt-2">
          {trend && (
            <span
              className={cn(
                "text-xs font-semibold px-1.5 py-0.5 rounded-md",
                trend.positive ? "text-success bg-success/10" : "text-destructive bg-destructive/10"
              )}
            >
              {trend.positive ? "▲" : "▼"} {trend.value}
            </span>
          )}
          {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
        </div>
      )}
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-6">
      {Icon && (
        <div className="w-14 h-14 rounded-2xl bg-muted grid place-items-center mb-4">
          <Icon className="w-6 h-6 text-muted-foreground" />
        </div>
      )}
      <h3 className="font-display font-semibold text-base text-foreground">{title}</h3>
      {description && <p className="text-sm text-muted-foreground mt-1 max-w-sm">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function LoadingBlock({ label = "Carregando…", className }: { label?: string; className?: string }) {
  return (
    <div className={cn("flex items-center justify-center gap-2 text-sm text-muted-foreground py-12", className)}>
      <Loader2 className="w-4 h-4 animate-spin" />
      {label}
    </div>
  );
}

export function ErrorBlock({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="surface-card p-6 border-destructive/30 bg-destructive/5">
      <p className="text-sm font-medium text-destructive">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-3 text-xs font-semibold text-destructive hover:underline"
        >
          Tentar novamente
        </button>
      )}
    </div>
  );
}

/** Skeleton retangular leve para listas/cards */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-muted", className)} />;
}
