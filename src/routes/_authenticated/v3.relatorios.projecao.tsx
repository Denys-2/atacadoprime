import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { V2InternalShell } from "@/components/v2/InternalShell";
import { V2 } from "@/components/v2/theme";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ArrowLeft, Target, TrendingUp, Calculator, Printer, Info } from "lucide-react";
import { brl } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/v3/relatorios/projecao")({
  head: () => ({ meta: [{ title: "Projeção de ganho — Prime Automotive" }] }),
  component: ProjectionReport,
});

const PERIODS = [
  { v: "30", label: "Últimos 30 dias" },
  { v: "60", label: "Últimos 60 dias" },
  { v: "90", label: "Últimos 90 dias" },
  { v: "180", label: "Últimos 6 meses" },
  { v: "365", label: "Últimos 12 meses" },
  { v: "0", label: "Todo o período" },
];

const QUICK_TARGETS = [3000, 5000, 10000, 15000, 20000, 30000];

function ProjectionReport() {
  const [period, setPeriod] = useState("90");
  const [target, setTarget] = useState<number>(10000);

  const sinceIso = useMemo(() => {
    const days = Number(period);
    if (!days) return null;
    const d = new Date();
    d.setDate(d.getDate() - days);
    return d.toISOString();
  }, [period]);

  // Historical: orders totals (real revenue after discounts)
  const { data: orders = [], isLoading: loadingOrders } = useQuery({
    queryKey: ["proj-orders", sinceIso],
    queryFn: async () => {
      let q = supabase.from("orders").select("id,total,created_at,status").neq("status", "CANCELADO");
      if (sinceIso) q = q.gte("created_at", sinceIso);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  // Historical: items to get COGS (custo)
  const { data: items = [], isLoading: loadingItems } = useQuery({
    queryKey: ["proj-items", sinceIso],
    queryFn: async () => {
      let q = supabase
        .from("order_items")
        .select("quantidade,custo_unitario,preco_final,orders!inner(status,created_at)")
        .neq("orders.status", "CANCELADO");
      if (sinceIso) q = q.gte("orders.created_at", sinceIso);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  // Historical: trip expenses in period
  const { data: expenses = [], isLoading: loadingExp } = useQuery({
    queryKey: ["proj-expenses", sinceIso],
    queryFn: async () => {
      let q = supabase.from("trip_expenses").select("valor,data");
      if (sinceIso) q = q.gte("data", sinceIso.slice(0, 10));
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const stats = useMemo(() => {
    const receita = orders.reduce((s, o: any) => s + Number(o.total || 0), 0);
    const grossItems = items.reduce((s, i: any) => s + Number(i.preco_final || 0) * Number(i.quantidade || 0), 0);
    const custo = items.reduce((s, i: any) => s + Number(i.custo_unitario || 0) * Number(i.quantidade || 0), 0);
    const despesas = expenses.reduce((s, e: any) => s + Number(e.valor || 0), 0);

    // proportion of item cost within gross item value → applies to real revenue
    const custoPctOnGross = grossItems > 0 ? custo / grossItems : 0;
    const custoReal = receita * custoPctOnGross;

    const lucroBruto = receita - custoReal;
    const lucroLiquido = lucroBruto - despesas;

    const margemBrutaPct = receita > 0 ? lucroBruto / receita : 0;
    const margemLiquidaPct = receita > 0 ? lucroLiquido / receita : 0;
    const despesasPct = receita > 0 ? despesas / receita : 0;

    return {
      receita,
      custo: custoReal,
      despesas,
      lucroBruto,
      lucroLiquido,
      margemBrutaPct,
      margemLiquidaPct,
      despesasPct,
      pedidos: orders.length,
      ticketMedio: orders.length > 0 ? receita / orders.length : 0,
    };
  }, [orders, items, expenses]);

  const projection = useMemo(() => {
    const t = Number(target) || 0;
    const mLiq = stats.margemLiquidaPct;
    const mBruta = stats.margemBrutaPct;

    // Cenário A: assume que despesas escalam junto (proporcionais)
    const receitaNecA = mLiq > 0 ? t / mLiq : 0;

    // Cenário B: despesas fixas iguais ao período
    const receitaNecB = mBruta > 0 ? (t + stats.despesas) / mBruta : 0;

    const pedidosA = stats.ticketMedio > 0 ? receitaNecA / stats.ticketMedio : 0;
    const pedidosB = stats.ticketMedio > 0 ? receitaNecB / stats.ticketMedio : 0;

    // Comparativo: quanto ganho a mais/menos com receita atual
    const gap = t - stats.lucroLiquido;

    return { receitaNecA, receitaNecB, pedidosA, pedidosB, gap };
  }, [target, stats]);

  const loading = loadingOrders || loadingItems || loadingExp;
  const hasData = stats.receita > 0 && stats.margemLiquidaPct > 0;

  return (
    <V2InternalShell
      title="Projeção de ganho"
      eyebrow="Relatório"
      description="Calcule quanto precisa vender para atingir um lucro-alvo, com base no seu histórico real."
      actions={
        <div className="flex gap-2">
          <Link to="/v3/relatorios">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
            </Button>
          </Link>
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="h-4 w-4 mr-1" /> Imprimir
          </Button>
        </div>
      }
    >
      {/* Filtros */}
      <div
        className="rounded-2xl border p-4 mb-4 grid gap-3 md:grid-cols-2"
        style={{ borderColor: V2.GRAPHITE, background: V2.SURFACE }}
      >
        <div>
          <label className="text-xs mb-1 block" style={{ color: V2.MUTED }}>
            Período base (histórico)
          </label>
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {PERIODS.map((p) => <SelectItem key={p.v} value={p.v}>{p.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs mb-1 block" style={{ color: V2.MUTED }}>
            Lucro líquido desejado (R$)
          </label>
          <Input
            type="number"
            min={0}
            step={100}
            value={target}
            onChange={(e) => setTarget(Number(e.target.value) || 0)}
            placeholder="10000"
          />
          <div className="flex flex-wrap gap-1.5 mt-2">
            {QUICK_TARGETS.map((v) => (
              <button
                key={v}
                onClick={() => setTarget(v)}
                className="text-xs px-2.5 py-1 rounded-full border transition"
                style={{
                  borderColor: target === v ? V2.TEAL : V2.GRAPHITE,
                  background: target === v ? `${V2.TEAL}22` : "transparent",
                  color: target === v ? V2.TEAL : V2.MUTED,
                }}
              >
                {brl(v)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-8" style={{ color: V2.MUTED }}>Carregando histórico…</div>
      ) : !hasData ? (
        <div
          className="rounded-2xl border p-6 text-center"
          style={{ borderColor: V2.GRAPHITE, background: V2.SURFACE, color: V2.MUTED }}
        >
          Sem dados suficientes no período selecionado. Escolha um período maior ou registre mais vendas.
        </div>
      ) : (
        <>
          {/* Base histórica */}
          <div className="mb-2 text-xs uppercase tracking-wide" style={{ color: V2.MUTED }}>
            Base histórica ({PERIODS.find((p) => p.v === period)?.label})
          </div>
          <div className="grid gap-3 grid-cols-2 md:grid-cols-4 mb-6">
            <Kpi label="Receita" value={brl(stats.receita)} tone="teal" />
            <Kpi label="Custo (CMV)" value={brl(stats.custo)} sub={pct(1 - stats.margemBrutaPct)} />
            <Kpi label="Despesas" value={brl(stats.despesas)} sub={pct(stats.despesasPct)} />
            <Kpi label="Lucro líquido" value={brl(stats.lucroLiquido)} sub={pct(stats.margemLiquidaPct)} tone={stats.lucroLiquido >= 0 ? "green" : "red"} />
          </div>

          <div className="grid gap-3 grid-cols-2 md:grid-cols-3 mb-6">
            <Kpi label="Margem bruta" value={pct(stats.margemBrutaPct)} />
            <Kpi label="Margem líquida" value={pct(stats.margemLiquidaPct)} />
            <Kpi label="Ticket médio" value={brl(stats.ticketMedio)} sub={`${stats.pedidos} pedidos`} />
          </div>

          {/* Projeção */}
          <div
            className="rounded-2xl border p-5 mb-4"
            style={{ borderColor: V2.TEAL, background: `${V2.TEAL}0d` }}
          >
            <div className="flex items-center gap-2 mb-3">
              <Target className="h-5 w-5" style={{ color: V2.TEAL }} />
              <h3 className="text-lg font-semibold" style={{ color: V2.TEXT }}>
                Para lucrar {brl(target)} líquido
              </h3>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <ScenarioCard
                id="A"
                icon={<TrendingUp className="h-4 w-4" />}
                title="Cenário A — despesas proporcionais"
                desc="Assumindo que as despesas crescem junto com as vendas (mesma margem líquida atual)."
                receita={projection.receitaNecA}
                pedidos={projection.pedidosA}
                margem={stats.margemLiquidaPct}
                base={stats.receita}
                target={target}
                stats={stats}
              />
              <ScenarioCard
                id="B"
                icon={<Calculator className="h-4 w-4" />}
                title="Cenário B — despesas fixas"
                desc="Assumindo despesas iguais ao período histórico (não escalam). Realista para viagens curtas."
                receita={projection.receitaNecB}
                pedidos={projection.pedidosB}
                margem={stats.margemBrutaPct}
                base={stats.receita}
                target={target}
                stats={stats}
                extra={`Despesas fixas consideradas: ${brl(stats.despesas)}`}
              />
            </div>

            <div
              className="mt-4 rounded-xl border p-3 text-sm"
              style={{ borderColor: V2.GRAPHITE, background: V2.SURFACE, color: V2.MUTED }}
            >
              <strong style={{ color: V2.TEXT }}>Comparativo: </strong>
              seu lucro atual no período é <strong style={{ color: V2.TEXT }}>{brl(stats.lucroLiquido)}</strong>.{" "}
              {projection.gap > 0
                ? <>Faltam <strong style={{ color: V2.TEAL }}>{brl(projection.gap)}</strong> de lucro para chegar na meta.</>
                : <>Você já superou a meta em <strong style={{ color: "#16a34a" }}>{brl(-projection.gap)}</strong>.</>}
            </div>
          </div>

          <div
            className="rounded-2xl border p-4 text-xs"
            style={{ borderColor: V2.GRAPHITE, background: V2.SURFACE, color: V2.MUTED }}
          >
            <strong style={{ color: V2.TEXT }}>Como é calculado: </strong>
            usamos suas vendas reais (receita líquida de descontos), o custo das peças vendidas (CMV) e as despesas de viagem lançadas no período.
            A margem líquida é <em>(receita − custo − despesas) ÷ receita</em>. A receita necessária é <em>lucro-alvo ÷ margem</em>.
          </div>
        </>
      )}
    </V2InternalShell>
  );
}

function Kpi({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "teal" | "green" | "red" }) {
  const color = tone === "green" ? "#16a34a" : tone === "red" ? "#dc2626" : tone === "teal" ? V2.TEAL : V2.TEXT;
  return (
    <div className="rounded-2xl border p-3" style={{ borderColor: V2.GRAPHITE, background: V2.SURFACE }}>
      <div className="text-[11px] uppercase tracking-wide" style={{ color: V2.MUTED }}>{label}</div>
      <div className="text-lg font-bold" style={{ color }}>{value}</div>
      {sub && <div className="text-[11px]" style={{ color: V2.MUTED }}>{sub}</div>}
    </div>
  );
}

type ScenarioProps = {
  id: "A" | "B";
  icon: React.ReactNode;
  title: string;
  desc: string;
  receita: number;
  pedidos: number;
  margem: number;
  base: number;
  target: number;
  stats: {
    receita: number;
    custo: number;
    despesas: number;
    margemBrutaPct: number;
    margemLiquidaPct: number;
    ticketMedio: number;
  };
  extra?: string;
};

function ScenarioCard(props: ScenarioProps) {
  const { id, icon, title, desc, receita, pedidos, margem, base, extra, target, stats } = props;
  const [open, setOpen] = useState(false);
  const mult = base > 0 ? receita / base : 0;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-left rounded-xl border p-4 w-full transition hover:shadow-lg hover:-translate-y-0.5"
        style={{ borderColor: V2.GRAPHITE, background: V2.SURFACE }}
      >
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2 text-sm font-semibold" style={{ color: V2.TEXT }}>
            {icon} {title}
          </div>
          <Info className="h-4 w-4 opacity-60" style={{ color: V2.TEAL }} />
        </div>
        <div className="text-xs mb-3" style={{ color: V2.MUTED }}>{desc}</div>
        <div className="text-2xl font-extrabold" style={{ color: V2.TEAL }}>{brl(receita)}</div>
        <div className="text-xs mt-1" style={{ color: V2.MUTED }}>
          em vendas · margem base {pct(margem)}
        </div>
        <div className="mt-3 space-y-1 text-sm" style={{ color: V2.TEXT }}>
          <div>≈ <strong>{Math.ceil(pedidos)}</strong> pedidos (no ticket médio atual)</div>
          <div>≈ <strong>{mult.toFixed(2)}x</strong> o volume atual do período</div>
          {extra && <div className="text-xs" style={{ color: V2.MUTED }}>{extra}</div>}
        </div>
        <div className="mt-3 text-[11px] uppercase tracking-wide" style={{ color: V2.TEAL }}>
          Toque para ver o cálculo detalhado →
        </div>
      </button>

      <ScenarioDialog
        open={open}
        onClose={() => setOpen(false)}
        id={id}
        title={title}
        target={target}
        stats={stats}
        receita={receita}
        pedidos={pedidos}
      />
    </>
  );
}

function ScenarioDialog({
  open, onClose, id, title, target, stats, receita, pedidos,
}: {
  open: boolean;
  onClose: () => void;
  id: "A" | "B";
  title: string;
  target: number;
  stats: ScenarioProps["stats"];
  receita: number;
  pedidos: number;
}) {
  const custo = receita * (1 - stats.margemBrutaPct);
  const despesasProj = id === "A" ? receita * (stats.despesas / (stats.receita || 1)) : stats.despesas;
  const lucroConf = receita - custo - despesasProj;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto" style={{ background: V2.SURFACE, color: V2.TEXT, borderColor: V2.GRAPHITE }}>
        <DialogHeader>
          <DialogTitle style={{ color: V2.TEXT }}>{title}</DialogTitle>
          <DialogDescription style={{ color: V2.MUTED }}>
            Como esse cenário chegou em <strong style={{ color: V2.TEAL }}>{brl(receita)}</strong> para você lucrar <strong style={{ color: V2.TEAL }}>{brl(target)}</strong> líquido.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          {/* Quando usar */}
          <Section title="🎯 Quando usar este cenário">
            {id === "A" ? (
              <p>
                Use quando estiver <strong>planejando um período longo</strong> (mês, trimestre, ano) e as despesas de viagem, combustível,
                hospedagem tendem a <strong>crescer proporcionalmente</strong> ao volume de vendas. É a visão mais <strong>conservadora</strong>.
              </p>
            ) : (
              <p>
                Use quando quiser saber <strong>quanto ainda precisa vender NESTA viagem</strong> que já está aberta.
                As despesas (combustível, hotel, refeições) já foram planejadas e <strong>não sobem</strong> se você vender mais.
                Toda receita extra vira lucro sobre a margem bruta.
              </p>
            )}
          </Section>

          {/* Premissas */}
          <Section title="📊 Premissas usadas do seu histórico">
            <ul className="space-y-1">
              <li>• Receita real (líquida de descontos): <strong>{brl(stats.receita)}</strong></li>
              <li>• Custo das peças vendidas (CMV): <strong>{brl(stats.custo)}</strong></li>
              <li>• Despesas de viagem lançadas: <strong>{brl(stats.despesas)}</strong></li>
              <li>• Margem bruta = (receita − custo) ÷ receita = <strong>{pct(stats.margemBrutaPct)}</strong></li>
              <li>• Margem líquida = (receita − custo − despesas) ÷ receita = <strong>{pct(stats.margemLiquidaPct)}</strong></li>
              <li>• Ticket médio: <strong>{brl(stats.ticketMedio)}</strong></li>
            </ul>
          </Section>

          {/* Fórmula */}
          <Section title="🧮 Fórmula pensada">
            {id === "A" ? (
              <>
                <Formula>Receita necessária = Lucro-alvo ÷ Margem líquida</Formula>
                <p className="mt-2" style={{ color: V2.MUTED }}>
                  Como estamos assumindo que a margem líquida se mantém (despesas crescem junto), basta dividir o lucro
                  desejado pela % que sobra hoje em cada real vendido.
                </p>
              </>
            ) : (
              <>
                <Formula>Receita necessária = (Lucro-alvo + Despesas fixas) ÷ Margem bruta</Formula>
                <p className="mt-2" style={{ color: V2.MUTED }}>
                  As despesas já são conhecidas e não escalam. Então: você precisa gerar lucro bruto suficiente para
                  pagar as despesas fixas <strong>e ainda sobrar</strong> o lucro-alvo. Por isso somamos as despesas no numerador.
                </p>
              </>
            )}
          </Section>

          {/* Aplicando */}
          <Section title="🔢 Aplicando aos seus números">
            {id === "A" ? (
              <Calc>
                <div>{brl(target)} ÷ {pct(stats.margemLiquidaPct)}</div>
                <div>= {brl(target)} ÷ {stats.margemLiquidaPct.toFixed(4)}</div>
                <div style={{ color: V2.TEAL }}>= {brl(receita)} de vendas</div>
              </Calc>
            ) : (
              <Calc>
                <div>({brl(target)} + {brl(stats.despesas)}) ÷ {pct(stats.margemBrutaPct)}</div>
                <div>= {brl(target + stats.despesas)} ÷ {stats.margemBrutaPct.toFixed(4)}</div>
                <div style={{ color: V2.TEAL }}>= {brl(receita)} de vendas</div>
              </Calc>
            )}
          </Section>

          {/* Conferência */}
          <Section title="✅ Conferência (DRE projetada)">
            <div className="rounded-lg border p-3 space-y-1" style={{ borderColor: V2.GRAPHITE, background: V2.BG }}>
              <Row label="Receita projetada" value={brl(receita)} />
              <Row label={`(−) Custo das peças (${pct(1 - stats.margemBrutaPct)})`} value={`− ${brl(custo)}`} />
              <Row label="(=) Lucro bruto" value={brl(receita - custo)} strong />
              <Row label={id === "A" ? "(−) Despesas proporcionais" : "(−) Despesas fixas"} value={`− ${brl(despesasProj)}`} />
              <div className="pt-1 mt-1 border-t" style={{ borderColor: V2.GRAPHITE }}>
                <Row label="(=) Lucro líquido" value={brl(lucroConf)} strong tone="teal" />
              </div>
            </div>
          </Section>

          {/* Ação */}
          <Section title="🛒 O que isso significa na prática">
            <ul className="space-y-1">
              <li>• Você precisa fechar <strong>≈ {Math.ceil(pedidos)} pedidos</strong> no ticket médio atual de {brl(stats.ticketMedio)}.</li>
              <li>• Isso equivale a <strong>{(stats.receita > 0 ? receita / stats.receita : 0).toFixed(2)}x</strong> o volume que você fez no período base.</li>
              {id === "B" && (
                <li>• Todo real vendido acima disso, nesta viagem, vira <strong>{pct(stats.margemBrutaPct)}</strong> direto no bolso.</li>
              )}
            </ul>
          </Section>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide mb-1.5" style={{ color: V2.TEAL }}>{title}</div>
      <div style={{ color: V2.TEXT }}>{children}</div>
    </div>
  );
}

function Formula({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="rounded-lg border p-3 font-mono text-sm text-center"
      style={{ borderColor: V2.TEAL, background: `${V2.TEAL}14`, color: V2.TEAL }}
    >
      {children}
    </div>
  );
}

function Calc({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="rounded-lg border p-3 font-mono text-sm space-y-1"
      style={{ borderColor: V2.GRAPHITE, background: V2.BG, color: V2.TEXT }}
    >
      {children}
    </div>
  );
}

function Row({ label, value, strong, tone }: { label: string; value: string; strong?: boolean; tone?: "teal" }) {
  return (
    <div className="flex justify-between text-sm">
      <span style={{ color: V2.MUTED }}>{label}</span>
      <span style={{ color: tone === "teal" ? V2.TEAL : V2.TEXT, fontWeight: strong ? 700 : 500 }}>{value}</span>
    </div>
  );
}


function pct(v: number) {
  return `${(v * 100).toFixed(1)}%`;
}
