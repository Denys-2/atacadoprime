import { createFileRoute, Link } from "@tanstack/react-router";
import { V2InternalShell } from "@/components/v2/InternalShell";
import { V2 } from "@/components/v2/theme";
import { Truck, ChevronRight, BarChart3, Users, Target, Boxes, ShoppingCart, TrendingUp } from "lucide-react";

export const Route = createFileRoute("/_authenticated/v3/relatorios/")({
  head: () => ({ meta: [{ title: "Relatórios — Prime Automotive" }] }),
  component: ReportsIndex,
});

const REPORTS = [
  {
    to: "/v3/relatorios/resultado",
    label: "Resultado do período",
    desc: "Venda, custo das peças, despesas e lucro líquido — com % de cada item sobre a venda total. Escolha o período.",
    icon: TrendingUp,
    available: true,
  },
  {
    to: "/v3/relatorios/vendas",
    label: "Relatório de vendas",
    desc: "Filtre por dia, semana, mês ou período customizado. Receita, ticket, pagamentos e pedidos.",
    icon: ShoppingCart,
    available: true,
  },
  {
    to: "/v3/relatorios/viagem",
    label: "Relatório de viagem",
    desc: "Produtos vendidos, custo, margem, despesas e resultado líquido por viagem.",
    icon: Truck,
    available: true,
  },

  {
    to: "/v3/relatorios/abc",
    label: "Curva ABC de produtos",
    desc: "Peças mais vendidas classificadas em A/B/C por receita, quantidade ou margem.",
    icon: BarChart3,
    available: true,
  },
  {
    to: "/v3/relatorios/abc-clientes",
    label: "Curva ABC de clientes",
    desc: "Melhores clientes por cidade (Top 5/10) classificados por receita.",
    icon: Users,
    available: true,
  },
  {
    to: "/v3/relatorios/projecao",
    label: "Projeção de ganho",
    desc: "Defina um lucro-alvo e veja quanto precisa vender com base no seu histórico.",
    icon: Target,
    available: true,
  },
  {
    to: "/v3/relatorios/giro",
    label: "Giro de estoque",
    desc: "Produtos parados, capital empatado, cobertura em dias e alertas de reposição.",
    icon: Boxes,
    available: true,
  },
];



function ReportsIndex() {
  return (
    <V2InternalShell
      title="Relatórios"
      eyebrow="Central de relatórios"
      description="Escolha um relatório para análise detalhada."
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {REPORTS.map((r) => {
          const Icon = r.icon;
          const Card = (
            <div
              className="group flex items-center gap-4 rounded-2xl border p-4 transition hover:shadow-lg"
              style={{ borderColor: V2.GRAPHITE, background: V2.SURFACE }}
            >
              <div
                className="flex h-12 w-12 items-center justify-center rounded-xl"
                style={{ background: `${V2.TEAL}22`, color: V2.TEAL }}
              >
                <Icon className="h-6 w-6" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-semibold" style={{ color: V2.TEXT }}>
                  {r.label}
                </div>
                <div className="text-xs" style={{ color: V2.MUTED }}>
                  {r.desc}
                </div>
              </div>
              <ChevronRight className="h-5 w-5 opacity-40 group-hover:opacity-100 transition" />
            </div>
          );
          return r.available ? (
            <Link key={r.to} to={r.to}>{Card}</Link>
          ) : (
            <div key={r.to} className="opacity-50 cursor-not-allowed">{Card}</div>
          );
        })}
      </div>

      <div
        className="mt-6 rounded-2xl border p-4 text-sm"
        style={{ borderColor: V2.GRAPHITE, background: V2.SURFACE, color: V2.MUTED }}
      >
        <div className="flex items-center gap-2 mb-2" style={{ color: V2.TEXT }}>
          <BarChart3 className="h-4 w-4" />
          <strong>Novos relatórios em breve</strong>
        </div>
        Descreva o próximo relatório que você precisa e adicionamos aqui como submenu.
      </div>
    </V2InternalShell>
  );
}
