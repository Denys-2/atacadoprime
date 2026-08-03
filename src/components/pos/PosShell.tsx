import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { LogOut, ShoppingBag, ListChecks, Users, Printer } from "lucide-react";
import { V2 } from "@/components/v2/theme";
import { useAuth } from "@/hooks/use-auth";
import { usePosDensity } from "@/hooks/use-pos-density";
import { printerDiagnostics, getPrinterPref } from "@/lib/pos-printer";

import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { PosCacheGuard } from "@/components/pos/PosCacheGuard";


const brl = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

type Tab = { to: string; label: string; icon: typeof ShoppingBag };
const TABS: Tab[] = [
  { to: "/pos/vender", label: "Vender", icon: ShoppingBag },
  { to: "/pos/clientes", label: "Clientes", icon: Users },
  { to: "/pos/pedidos", label: "Pedidos", icon: ListChecks },
];


function useDaySales() {
  return useQuery({
    queryKey: ["pos", "day-sales"],
    queryFn: async () => {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const { data, error } = await supabase
        .from("orders")
        .select("total")
        .eq("status", "PAGO")
        .gte("created_at", today.toISOString());
      if (error) throw error;
      const rows = (data ?? []) as { total: number }[];
      return { count: rows.length, total: rows.reduce((s, r) => s + Number(r.total ?? 0), 0) };
    },
  });
}

export function PosShell({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { data: daySales } = useDaySales();
  const showSummary = pathname.startsWith("/pos/vender") || pathname === "/pos";
  const { mode, scale, cycle } = usePosDensity();
  const printerReady = printerDiagnostics().bridge !== "nenhuma";

  // O <link rel="manifest"> do site (start_url /v3) vem do __root e é lido
  // primeiro pelo navegador. Dentro do /pos forçamos o manifesto do POS para
  // que "Adicionar à tela inicial" crie o atalho direto na tela de venda.
  // Limpa preferências antigas de impressora (system/rawbt/share) que faziam a
  // maquininha abrir o diálogo do Android (ISO C7) em vez da ponte nativa.
  useEffect(() => { getPrinterPref(); }, []);

  useEffect(() => {
    const links = Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel="manifest"]'));
    const previous = links.map((l) => l.getAttribute("href"));
    links.forEach((l, i) => {
      if (i === 0) l.setAttribute("href", "/manifest-pos.webmanifest?v=3");
      else l.remove();
    });
    return () => {
      const current = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
      if (current && previous[0]) current.setAttribute("href", previous[0]);
    };
  }, []);


  return (
    <div
      className="pos-root min-h-screen flex flex-col"
      style={{ background: V2.LIGHT_BG, color: V2.LIGHT_TEXT, zoom: scale }}
    >
      {/* Header enxuto */}
      <header
        className="h-12 px-3 flex items-center justify-between border-b"
        style={{ borderColor: V2.LIGHT_BORDER, background: V2.LIGHT_SURFACE }}
      >
        <Link to="/pos/vender" className="flex items-center gap-2 font-bold text-sm">
          <span style={{ color: V2.TEAL }}>●</span> POS Prime
        </Link>
        <div className="flex items-center gap-2 text-xs">
          {showSummary && (
            <div className="hidden sm:flex items-center gap-2 px-2 py-1 rounded-md text-[10px] font-semibold" style={{ background: V2.LIGHT_BG }}>
              <span style={{ color: V2.LIGHT_MUTED }}>{daySales?.count ?? 0} vendas</span>
              <span style={{ color: V2.TEAL }}>{brl(daySales?.total ?? 0)}</span>
            </div>
          )}
          <span className="truncate max-w-[140px] hidden sm:inline" style={{ color: V2.LIGHT_MUTED }}>{user?.email ?? "—"}</span>
          <button
            onClick={cycle}
            className="px-1.5 py-1 rounded text-[10px] font-bold border"
            style={{ borderColor: V2.LIGHT_BORDER, color: V2.LIGHT_MUTED }}
            aria-label="Alternar tamanho da tela"
            title={`Densidade: ${mode} (${Math.round(scale * 100)}%)`}
          >
            {mode === "auto" ? "A" : mode === "compact" ? "S" : "M"}
          </button>
          <Link
            to="/pos/teste"
            onContextMenu={(e) => {
              e.preventDefault();
              alert(JSON.stringify(printerDiagnostics(), null, 2));
            }}
            className="flex items-center gap-1 px-1.5 py-1 rounded text-[10px] font-bold border"
            style={{
              borderColor: V2.LIGHT_BORDER,
              color: printerReady ? V2.TEAL : V2.LIGHT_MUTED,
            }}
            aria-label="Testar impressora interna"
            title={printerReady ? "Impressora interna conectada — abrir teste" : "Abrir teste de impressão"}
          >
            <Printer className="h-3.5 w-3.5" />
            {printerReady ? "Q2I OK" : "SEM APP"}
          </Link>
          <PosCacheGuard />
          <button


            onClick={() => supabase.auth.signOut()}
            className="p-1.5 rounded hover:bg-black/5"
            aria-label="Sair"
          >
            <LogOut className="h-4 w-4" style={{ color: V2.LIGHT_MUTED }} />
          </button>

        </div>
      </header>

      {/* Conteúdo com padding-bottom pra não passar por baixo do nav */}
      <main className="flex-1 overflow-y-auto pb-[68px]">{children}</main>

      {/* Bottom nav fixo */}
      <nav
        className="fixed bottom-0 left-0 right-0 h-[64px] border-t grid grid-cols-3"
        style={{ background: V2.LIGHT_SURFACE, borderColor: V2.LIGHT_BORDER }}
      >
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = pathname.startsWith(t.to);
          return (
            <Link
              key={t.to}
              to={t.to}
              className={cn("flex flex-col items-center justify-center gap-1 text-[11px] font-medium")}
              style={{ color: active ? V2.TEAL : V2.LIGHT_MUTED }}
            >
              <Icon className="h-5 w-5" />
              {t.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
