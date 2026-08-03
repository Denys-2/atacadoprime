// Primitivas visuais reutilizáveis — padrão "Painel Admin".
// Todas as páginas autenticadas devem usar estes componentes para manter
// consistência visual (stat cards com ícone colorido + cards brancos
// arredondados + CTAs gradiente).
import { Link } from "@tanstack/react-router";
import type { ComponentType, ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export type CardTone =
  | "blue" | "green" | "orange" | "purple"
  | "pink" | "red" | "yellow" | "indigo" | "slate";

const TONE_SOLID: Record<CardTone, string> = {
  blue: "bg-blue-500",
  green: "bg-emerald-500",
  orange: "bg-orange-500",
  purple: "bg-violet-500",
  pink: "bg-pink-500",
  red: "bg-rose-500",
  yellow: "bg-amber-500",
  indigo: "bg-indigo-500",
  slate: "bg-slate-500",
};

const TONE_GRADIENT: Record<CardTone, string> = {
  blue: "from-blue-500 to-blue-600",
  green: "from-emerald-500 to-green-600",
  orange: "from-orange-500 to-amber-600",
  purple: "from-violet-600 to-indigo-600",
  pink: "from-pink-500 to-rose-600",
  red: "from-rose-500 to-red-600",
  yellow: "from-amber-400 to-orange-500",
  indigo: "from-indigo-500 to-blue-600",
  slate: "from-slate-600 to-slate-700",
};

type IconComp = ComponentType<{ className?: string; strokeWidth?: number }>;

// === StatCard ==============================================================
export function StatCard({
  label, value, icon: Icon, tone = "blue",
}: {
  label: string;
  value: number | string;
  icon?: IconComp;
  tone?: CardTone;
}) {
  return (
    <div className="bg-white rounded-2xl p-3 sm:p-5 shadow-sm border border-slate-100 flex items-center justify-between gap-2 sm:gap-3">
      <div className="min-w-0">
        <p className="text-[11px] sm:text-[12px] text-slate-500 font-medium truncate">{label}</p>
        <p className="text-base sm:text-[28px] leading-tight font-bold text-slate-900 mt-1 tabular-nums truncate">{value}</p>
      </div>
      {Icon && (
        <div
          aria-hidden
          className={cn(
            "h-9 w-9 sm:h-12 sm:w-12 rounded-xl grid place-items-center text-white shadow-sm shrink-0",
            TONE_SOLID[tone],
          )}
        >
          <Icon className="h-4 w-4 sm:h-5 sm:w-5" strokeWidth={2.2} />
        </div>
      )}
    </div>
  );
}

// === PanelCard =============================================================
export function PanelCard({
  title, action, children, className,
}: {
  title?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("bg-white rounded-2xl shadow-sm border border-slate-100 p-6", className)}>
      {(title || action) && (
        <div className="flex items-center justify-between mb-4 gap-3">
          {title && <h2 className="font-display text-[17px] font-bold text-slate-800">{title}</h2>}
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

// === CategoryTile ==========================================================
export function CategoryTile({
  to, label, sub, icon: Icon, tone = "blue",
}: {
  to: string;
  label: string;
  sub?: string;
  icon: IconComp;
  tone?: CardTone;
}) {
  return (
    <Link to={to} className="group flex items-center gap-3 p-3 rounded-xl border border-slate-100 hover:border-slate-200 hover:shadow-sm bg-white transition-all">
      <div className={cn("h-10 w-10 rounded-lg grid place-items-center text-white shrink-0", TONE_SOLID[tone])}>
        <Icon className="h-5 w-5" strokeWidth={2.2} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-semibold text-slate-800 truncate">{label}</p>
        {sub && <p className="text-[11px] text-slate-500 truncate">{sub}</p>}
      </div>
    </Link>
  );
}

// === CtaCard ===============================================================
export function CtaCard({
  to, title, subtitle, cta = "Acessar", tone = "purple",
}: {
  to: string;
  title: string;
  subtitle?: string;
  cta?: string;
  tone?: CardTone;
}) {
  return (
    <div className={cn("relative overflow-hidden rounded-2xl p-6 text-white bg-gradient-to-br shadow-md", TONE_GRADIENT[tone])}>
      <h3 className="text-lg font-bold">{title}</h3>
      {subtitle && <p className="text-sm text-white/85 mt-1">{subtitle}</p>}
      <Button asChild variant="secondary" size="sm" className="mt-4 bg-white text-slate-900 hover:bg-white/90 shadow-sm">
        <Link to={to}>{cta} <ArrowRight className="w-4 h-4 ml-1" /></Link>
      </Button>
    </div>
  );
}
