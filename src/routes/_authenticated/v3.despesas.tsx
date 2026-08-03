import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { V2InternalShell } from "@/components/v2/InternalShell";
import { V2 } from "@/components/v2/theme";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Receipt, Search, Truck, ArrowRight } from "lucide-react";
import { brl, formatDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/v3/despesas")({
  head: () => ({ meta: [{ title: "Despesas — Prime Automotive" }] }),
  component: ExpensesPage,
});

type Expense = {
  id: string;
  trip_id: string;
  categoria: string;
  descricao: string | null;
  valor: number;
  data: string;
  forma_pagamento: string | null;
  created_at: string;
  trips: { nome: string; cidade: string | null; estado: string | null } | null;
};

const CATEGORIES = [
  "COMBUSTIVEL",
  "ALIMENTACAO",
  "HOSPEDAGEM",
  "PEDAGIO",
  "MANUTENCAO",
  "MATERIAL",
  "OUTRO",
];

const categoryLabel = (c?: string) => {
  if (!c) return "—";
  const map: Record<string, string> = {
    COMBUSTIVEL: "Combustível",
    ALIMENTACAO: "Alimentação",
    HOSPEDAGEM: "Hospedagem",
    PEDAGIO: "Pedágio",
    MANUTENCAO: "Manutenção",
    MATERIAL: "Material",
    OUTRO: "Outro",
  };
  return map[c] || c;
};

const formatMonth = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

function ExpensesPage() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [period, setPeriod] = useState<string>("all");
  const [tripFilter, setTripFilter] = useState<string>("all");

  const { data: expenses = [], isLoading } = useQuery({
    queryKey: ["all-trip-expenses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trip_expenses")
        .select("id,trip_id,categoria,descricao,valor,data,forma_pagamento,created_at,trips(nome,cidade,estado)")
        .order("data", { ascending: false })
        .limit(1000);
      if (error) throw error;
      return (data ?? []) as Expense[];
    },
  });

  const months = useMemo(() => {
    const set = new Set<string>();
    expenses.forEach((e) => {
      if (e.data) set.add(e.data.slice(0, 7));
    });
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [expenses]);

  const tripOptions = useMemo(() => {
    const map = new Map<string, { id: string; label: string; total: number }>();
    expenses.forEach((e) => {
      if (!e.trip_id) return;
      const label = e.trips?.cidade
        ? `${e.trips.cidade}${e.trips.estado ? `/${e.trips.estado}` : ""}${e.trips?.nome ? ` — ${e.trips.nome}` : ""}`
        : (e.trips?.nome ?? "Viagem sem nome");
      const cur = map.get(e.trip_id) ?? { id: e.trip_id, label, total: 0 };
      cur.total += Number(e.valor || 0);
      map.set(e.trip_id, cur);
    });
    return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [expenses]);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return expenses
      .filter((e) => {
        const matchesSearch =
          !s ||
          categoryLabel(e.categoria).toLowerCase().includes(s) ||
          (e.descricao ?? "").toLowerCase().includes(s) ||
          (e.trips?.nome ?? "").toLowerCase().includes(s) ||
          (e.trips?.cidade ?? "").toLowerCase().includes(s);
        const matchesCategory = category === "all" || e.categoria === category;
        const matchesPeriod = period === "all" || (e.data && e.data.startsWith(period));
        const matchesTrip = tripFilter === "all" || e.trip_id === tripFilter;
        return matchesSearch && matchesCategory && matchesPeriod && matchesTrip;
      })
      .sort((a, b) => Number(b.valor || 0) - Number(a.valor || 0));
  }, [expenses, search, category, period, tripFilter]);

  const total = useMemo(() => filtered.reduce((sum, e) => sum + Number(e.valor || 0), 0), [filtered]);

  return (
    <V2InternalShell
      title="Despesas"
      eyebrow="Controle de gastos"
      description="Todas as despesas lançadas nas viagens, com filtros por categoria e período."
      actions={
        <Link to="/v3/viagens">
          <Button style={{ background: V2.TEAL, color: "#fff" }}>
            <Receipt className="h-4 w-4 mr-1" /> Lançar nova
          </Button>
        </Link>
      }
    >
      <div className="grid gap-5">
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: V2.MUTED }} />
            <Input
              placeholder="Buscar despesa..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
              style={{ background: V2.SURFACE, borderColor: V2.GRAPHITE, color: V2.TEXT }}
            />
          </div>

          <Select value={tripFilter} onValueChange={setTripFilter}>
            <SelectTrigger style={{ background: V2.SURFACE, borderColor: V2.GRAPHITE, color: V2.TEXT }}>
              <SelectValue placeholder="Viagem" />
            </SelectTrigger>
            <SelectContent style={{ background: V2.SURFACE, borderColor: V2.GRAPHITE }}>
              <SelectItem value="all">Todas as viagens</SelectItem>
              {tripOptions.map((t) => (
                <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger style={{ background: V2.SURFACE, borderColor: V2.GRAPHITE, color: V2.TEXT }}>
              <SelectValue placeholder="Categoria" />
            </SelectTrigger>
            <SelectContent style={{ background: V2.SURFACE, borderColor: V2.GRAPHITE }}>
              <SelectItem value="all">Todas as categorias</SelectItem>
              {CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>{categoryLabel(c)}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger style={{ background: V2.SURFACE, borderColor: V2.GRAPHITE, color: V2.TEXT }}>
              <SelectValue placeholder="Período" />
            </SelectTrigger>
            <SelectContent style={{ background: V2.SURFACE, borderColor: V2.GRAPHITE }}>
              <SelectItem value="all">Todos os períodos</SelectItem>
              {months.map((m) => (
                <SelectItem key={m} value={m}>{m.slice(5, 7)}/{m.slice(0, 4)}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div
            className="rounded-xl border p-4 flex flex-col justify-center"
            style={{ background: V2.SURFACE, borderColor: V2.GRAPHITE }}
          >
            <span className="text-[10px] uppercase tracking-[0.2em] font-semibold" style={{ color: V2.MUTED }}>
              Total filtrado
            </span>
            <span className="text-lg font-semibold mt-0.5">{brl(total)}</span>
          </div>
        </section>

        {tripFilter === "all" && tripOptions.length > 0 && (
          <section
            className="rounded-2xl border p-4"
            style={{ background: V2.SURFACE, borderColor: V2.GRAPHITE }}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] uppercase tracking-[0.2em] font-semibold" style={{ color: V2.MUTED }}>
                Totais por viagem
              </span>
              <span className="text-xs" style={{ color: V2.MUTED }}>
                Clique para filtrar
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {tripOptions.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTripFilter(t.id)}
                  className="text-left rounded-lg border p-3 hover:bg-white/[0.03] transition flex items-center justify-between gap-3"
                  style={{ borderColor: V2.GRAPHITE }}
                >
                  <div className="min-w-0 flex items-center gap-2">
                    <Truck className="h-4 w-4 shrink-0" style={{ color: V2.MUTED }} />
                    <span className="text-sm truncate" style={{ color: V2.TEXT }}>{t.label}</span>
                  </div>
                  <span className="text-sm font-semibold shrink-0" style={{ color: V2.TEXT }}>
                    {brl(t.total)}
                  </span>
                </button>
              ))}
            </div>
          </section>
        )}

        <div
          className="rounded-2xl border shadow-sm overflow-hidden"
          style={{ background: V2.SURFACE, borderColor: V2.GRAPHITE }}
        >
          {isLoading ? (
            <div className="p-8 text-center text-sm" style={{ color: V2.MUTED }}>Carregando…</div>
          ) : filtered.length === 0 ? (
            <div className="p-10 text-center">
              <Receipt className="h-10 w-10 mx-auto mb-2" style={{ color: V2.MUTED }} />
              <p className="text-sm" style={{ color: V2.MUTED }}>
                Nenhuma despesa encontrada.
              </p>
            </div>
          ) : (
            <div className="divide-y" style={{ borderColor: V2.GRAPHITE }}>
              {filtered.map((e) => (
                <Link
                  key={e.id}
                  to="/v3/viagens"
                  className="w-full text-left p-4 grid grid-cols-1 md:grid-cols-[1fr_1fr_auto_auto] gap-3 md:items-center hover:bg-white/[0.03] transition"
                >
                  <div className="min-w-0">
                    <p className="font-semibold truncate" style={{ color: V2.TEXT }}>
                      {categoryLabel(e.categoria)}
                      {e.descricao ? ` — ${e.descricao}` : ""}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: V2.MUTED }}>
                      {formatDate(e.data)} {e.forma_pagamento ? `· ${e.forma_pagamento}` : ""}
                    </p>
                  </div>
                  <div className="min-w-0 flex items-center gap-2" style={{ color: V2.MUTED }}>
                    <Truck className="h-3.5 w-3.5 shrink-0" />
                    <span className="text-sm truncate">
                      {e.trips?.nome ?? "Viagem"}
                      {e.trips?.cidade ? ` — ${e.trips.cidade}${e.trips.estado ? `/${e.trips.estado}` : ""}` : ""}
                    </span>
                  </div>
                  <p className="font-semibold text-right md:text-left" style={{ color: V2.TEXT }}>
                    {brl(Number(e.valor))}
                  </p>
                  <div className="hidden md:flex justify-end">
                    <ArrowRight className="h-4 w-4" style={{ color: V2.MUTED }} />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </V2InternalShell>
  );
}
