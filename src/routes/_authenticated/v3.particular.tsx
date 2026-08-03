import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { V2InternalShell } from "@/components/v2/InternalShell";
import { V2 } from "@/components/v2/theme";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { ArrowDownRight, ArrowUpRight, CheckCircle2, Plus, Trash2, Wallet, PiggyBank, TrendingDown, TrendingUp, Eye, EyeOff } from "lucide-react";
import { brl, formatDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/v3/particular")({
  head: () => ({ meta: [{ title: "Meu financeiro particular — Prime" }] }),
  component: PersonalPage,
});

type PersonalEntry = {
  id: string;
  tipo: "RECEITA" | "DESPESA";
  descricao: string;
  valor: number;
  vencimento: string;
  pagamento: string | null;
  status: "PENDENTE" | "PAGO";
  categoria: string | null;
  observacao: string | null;
  origem: "MANUAL" | "FECHAMENTO";
  fechamento_id: string | null;
  created_at: string;
};

type Periodo = "MES_ATUAL" | "PROX_MES" | "MES_ANTERIOR" | "ULT_30" | "ULT_90" | "ANO" | "TUDO" | "CUSTOM";

function rangeFor(p: Periodo, ini?: string, fim?: string): { start: string; end: string; label: string } {
  const now = new Date();
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const monthStart = (y: number, m: number) => iso(new Date(y, m, 1));
  const monthEnd = (y: number, m: number) => iso(new Date(y, m + 1, 0));
  switch (p) {
    case "MES_ATUAL": return { start: monthStart(now.getFullYear(), now.getMonth()), end: monthEnd(now.getFullYear(), now.getMonth()), label: "Este mês" };
    case "PROX_MES": { const d = new Date(now.getFullYear(), now.getMonth() + 1, 1); return { start: monthStart(d.getFullYear(), d.getMonth()), end: monthEnd(d.getFullYear(), d.getMonth()), label: "Próximo mês" }; }
    case "MES_ANTERIOR": { const d = new Date(now.getFullYear(), now.getMonth() - 1, 1); return { start: monthStart(d.getFullYear(), d.getMonth()), end: monthEnd(d.getFullYear(), d.getMonth()), label: "Mês anterior" }; }
    case "ULT_30": { const s = new Date(now); s.setDate(s.getDate() - 29); return { start: iso(s), end: iso(now), label: "Últimos 30 dias" }; }
    case "ULT_90": { const s = new Date(now); s.setDate(s.getDate() - 89); return { start: iso(s), end: iso(now), label: "Últimos 90 dias" }; }
    case "ANO": return { start: `${now.getFullYear()}-01-01`, end: `${now.getFullYear()}-12-31`, label: "Este ano" };
    case "TUDO": return { start: "0000-01-01", end: "9999-12-31", label: "Tudo" };
    case "CUSTOM": return { start: ini || iso(now), end: fim || iso(now), label: "Personalizado" };
  }
}

function PersonalPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState("resumo");
  const [openNew, setOpenNew] = useState<null | "RECEITA" | "DESPESA">(null);
  const [hideValues, setHideValues] = useState(false);
  const [periodo, setPeriodo] = useState<Periodo>("MES_ATUAL");
  const [customIni, setCustomIni] = useState<string>(new Date().toISOString().slice(0, 10));
  const [customFim, setCustomFim] = useState<string>(new Date().toISOString().slice(0, 10));

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const saved = window.localStorage.getItem("prime:hide-card-values");
      if (saved === "1") setHideValues(true);
    } catch {}
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem("prime:hide-card-values", hideValues ? "1" : "0");
    } catch {}
  }, [hideValues]);

  const range = useMemo(() => rangeFor("MES_ATUAL"), []);
  const rangeList = useMemo(() => rangeFor(periodo, customIni, customFim), [periodo, customIni, customFim]);

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ["personal-entries"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("personal_entries" as never)
        .select("*")
        .order("vencimento", { ascending: false })
        .limit(1000);
      if (error) throw error;
      return (data ?? []) as unknown as PersonalEntry[];
    },
  });

  const totals = useMemo(() => {
    let receitaPaga = 0, despesaPaga = 0, aReceber = 0, aPagar = 0, aPagarVencidas = 0;
    const hoje = new Date().toISOString().slice(0, 10);
    for (const e of entries) {
      if (e.status === "PAGO") {
        const ref = e.pagamento ?? e.vencimento;
        if (ref >= range.start && ref <= range.end) {
          if (e.tipo === "RECEITA") receitaPaga += Number(e.valor);
          else despesaPaga += Number(e.valor);
        }
      } else {
        if (e.vencimento >= range.start && e.vencimento <= range.end) {
          if (e.tipo === "RECEITA") aReceber += Number(e.valor);
          else {
            aPagar += Number(e.valor);
            if (e.vencimento < hoje) aPagarVencidas += Number(e.valor);
          }
        }
      }
    }
    return { receitaPaga, despesaPaga, saldo: receitaPaga - despesaPaga, aReceber, aPagar, aPagarVencidas };
  }, [entries, range]);


  const setPago = useMutation({
    mutationFn: async ({ id, pago }: { id: string; pago: boolean }) => {
      const { error } = await supabase
        .from("personal_entries" as never)
        .update({ status: pago ? "PAGO" : "PENDENTE", pagamento: pago ? new Date().toISOString().slice(0, 10) : null } as never)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["personal-entries"] });
      toast.success("Atualizado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("personal_entries" as never).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["personal-entries"] });
      toast.success("Removido");
    },
    onError: (e: Error) => toast.error(e.message || "Não foi possível remover"),
  });

  const byVencAsc = (a: PersonalEntry, b: PersonalEntry) => a.vencimento.localeCompare(b.vencimento);
  const inRangeList = (date: string) => date >= rangeList.start && date <= rangeList.end;
  const aReceberList = entries.filter((e) => e.tipo === "RECEITA" && e.status === "PENDENTE" && inRangeList(e.vencimento)).sort(byVencAsc);
  const aPagarList = entries.filter((e) => e.tipo === "DESPESA" && e.status === "PENDENTE" && inRangeList(e.vencimento)).sort(byVencAsc);
  const extrato = entries.filter((e) => e.status === "PAGO" && inRangeList(e.pagamento ?? e.vencimento)).slice(0, 200);

  return (
    <V2InternalShell
      title="Meu financeiro particular"
      eyebrow="Só seu, isolado da empresa"
      description="Controle de contas a pagar e receber pessoais. Nada aqui afeta o financeiro da empresa."
      actions={
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setOpenNew("DESPESA")} className="gap-2"><ArrowDownRight className="h-4 w-4" /> Nova despesa</Button>
          <Button onClick={() => setOpenNew("RECEITA")} className="gap-2" style={{ background: V2.SUCCESS, color: "#fff" }}><ArrowUpRight className="h-4 w-4" /> Nova receita</Button>
        </div>
      }
    >
      {/* KPIs — sempre do mês atual */}
      <div className="mb-2 flex items-center justify-end">
        <button
          type="button"
          onClick={() => setHideValues((v) => !v)}
          className="flex items-center gap-1.5 text-xs font-medium hover:opacity-80 transition-opacity"
          style={{ color: V2.MUTED }}
          aria-label={hideValues ? "Mostrar valores" : "Ocultar valores"}
        >
          {hideValues ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
          {hideValues ? "Mostrar valores" : "Ocultar valores"}
        </button>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <Kpi label={`Saldo · ${range.label}`} value={brl(totals.saldo)} hidden={hideValues} icon={<PiggyBank className="h-4 w-4" />} color={totals.saldo >= 0 ? V2.SUCCESS : "#dc2626"} />
        <Kpi label={`Recebido · ${range.label}`} value={brl(totals.receitaPaga)} hidden={hideValues} icon={<TrendingUp className="h-4 w-4" />} color={V2.SUCCESS} />
        <Kpi label={`Pago · ${range.label}`} value={brl(totals.despesaPaga)} hidden={hideValues} icon={<TrendingDown className="h-4 w-4" />} color="#dc2626" />
        <Kpi label={`A pagar · ${range.label}`} value={brl(totals.aPagar)} hidden={hideValues} sub={totals.aPagarVencidas > 0 ? `${brl(totals.aPagarVencidas)} vencidas` : "em dia"} icon={<Wallet className="h-4 w-4" />} color={totals.aPagarVencidas > 0 ? "#dc2626" : V2.TEXT} />
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="resumo">Resumo</TabsTrigger>
          <TabsTrigger value="pagar">Contas a pagar ({aPagarList.length})</TabsTrigger>
          <TabsTrigger value="receber">A receber ({aReceberList.length})</TabsTrigger>
          <TabsTrigger value="extrato">Extrato</TabsTrigger>
        </TabsList>

        <div className="mt-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium" style={{ color: V2.MUTED }}>Período da lista</span>
            <Select value={periodo} onValueChange={(v) => setPeriodo(v as Periodo)}>
              <SelectTrigger className="w-44 text-xs">
                <SelectValue placeholder="Período" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="MES_ATUAL">Este mês</SelectItem>
                <SelectItem value="PROX_MES">Próximo mês</SelectItem>
                <SelectItem value="MES_ANTERIOR">Mês anterior</SelectItem>
                <SelectItem value="ULT_30">Últimos 30 dias</SelectItem>
                <SelectItem value="ULT_90">Últimos 90 dias</SelectItem>
                <SelectItem value="ANO">Este ano</SelectItem>
                <SelectItem value="TUDO">Tudo</SelectItem>
                <SelectItem value="CUSTOM">Personalizado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {periodo === "CUSTOM" && (
            <div className="flex items-center gap-2">
              <Input type="date" value={customIni} onChange={(e) => setCustomIni(e.target.value)} className="w-32 text-xs" />
              <span className="text-xs" style={{ color: V2.MUTED }}>até</span>
              <Input type="date" value={customFim} onChange={(e) => setCustomFim(e.target.value)} className="w-32 text-xs" />
            </div>
          )}
          <span className="text-xs" style={{ color: V2.MUTED }}>{rangeList.label}</span>
        </div>

        <TabsContent value="resumo" className="mt-4">
          <div className="grid lg:grid-cols-2 gap-4">
            <Section title="Próximas contas a pagar">
              <EntryList entries={aPagarList.slice(0, 6)} onPago={(id) => setPago.mutate({ id, pago: true })} onDelete={(id) => del.mutate(id)} />
            </Section>
            <Section title="A receber">
              <EntryList entries={aReceberList.slice(0, 6)} onPago={(id) => setPago.mutate({ id, pago: true })} onDelete={(id) => del.mutate(id)} />
            </Section>
          </div>
        </TabsContent>
        <TabsContent value="pagar" className="mt-4">
          <Section title="Contas a pagar">
            <EntryList entries={aPagarList} onPago={(id) => setPago.mutate({ id, pago: true })} onDelete={(id) => del.mutate(id)} />
          </Section>
        </TabsContent>
        <TabsContent value="receber" className="mt-4">
          <Section title="A receber">
            <EntryList entries={aReceberList} onPago={(id) => setPago.mutate({ id, pago: true })} onDelete={(id) => del.mutate(id)} />
          </Section>
        </TabsContent>
        <TabsContent value="extrato" className="mt-4">
          <Section title="Extrato — pagos">
            {isLoading ? <p className="text-sm" style={{ color: V2.MUTED }}>Carregando…</p>
              : extrato.length === 0 ? <p className="text-sm" style={{ color: V2.MUTED }}>Nenhum lançamento pago ainda.</p>
              : (
                <div className="divide-y" style={{ borderColor: V2.GRAPHITE }}>
                  {extrato.map((e) => (
                    <div key={e.id} className="py-2.5 flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full grid place-items-center shrink-0" style={{ background: e.tipo === "RECEITA" ? V2.SUCCESS_LIGHT : "rgba(220,38,38,0.1)", color: e.tipo === "RECEITA" ? V2.SUCCESS_DARK : "#dc2626" }}>
                        {e.tipo === "RECEITA" ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate" style={{ color: V2.TEXT }}>{e.descricao}</p>
                        <p className="text-[11px]" style={{ color: V2.MUTED }}>
                          {formatDate(e.pagamento ?? e.vencimento)}
                          {e.categoria && ` · ${e.categoria}`}
                          {e.origem === "FECHAMENTO" && " · Retirada de fechamento"}
                        </p>
                      </div>
                      <span className="text-sm font-semibold whitespace-nowrap" style={{ color: e.tipo === "RECEITA" ? V2.SUCCESS_DARK : "#dc2626" }}>
                        {e.tipo === "RECEITA" ? "+" : "−"} {brl(Number(e.valor))}
                      </span>
                      {e.origem === "MANUAL" && (
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => del.mutate(e.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
          </Section>
        </TabsContent>
      </Tabs>

      <NewEntryDialog open={!!openNew} tipo={openNew ?? "DESPESA"} onClose={() => setOpenNew(null)} onSaved={() => qc.invalidateQueries({ queryKey: ["personal-entries"] })} />
    </V2InternalShell>
  );
}

function Kpi({ label, value, sub, hidden, icon, color }: { label: string; value: string; sub?: string; hidden?: boolean; icon: React.ReactNode; color: string }) {
  return (
    <div className="rounded-2xl p-4" style={{ background: V2.SURFACE, border: `1px solid ${V2.GRAPHITE}` }}>
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider font-semibold" style={{ color: V2.MUTED }}>
        <span style={{ color }}>{icon}</span> {label}
      </div>
      <p className="mt-2 text-2xl font-bold tabular-nums tracking-widest" style={{ color }}>{hidden ? "••••" : value}</p>
      {sub && !hidden && <p className="text-[11px] mt-0.5" style={{ color: V2.MUTED }}>{sub}</p>}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl p-4" style={{ background: V2.SURFACE, border: `1px solid ${V2.GRAPHITE}` }}>
      <h3 className="text-sm font-semibold mb-3" style={{ color: V2.TEXT }}>{title}</h3>
      {children}
    </div>
  );
}

function EntryList({ entries, onPago, onDelete }: { entries: PersonalEntry[]; onPago: (id: string) => void; onDelete: (id: string) => void }) {
  const hoje = new Date().toISOString().slice(0, 10);
  if (entries.length === 0) return <p className="text-sm" style={{ color: V2.MUTED }}>Nada por aqui.</p>;
  return (
    <div className="divide-y" style={{ borderColor: V2.GRAPHITE }}>
      {entries.map((e) => {
        const vencida = e.vencimento < hoje;
        const isRec = e.tipo === "RECEITA";
        return (
          <div key={e.id} className="py-2.5 flex items-center gap-3">
            <div className="h-8 w-8 rounded-full grid place-items-center shrink-0" style={{ background: isRec ? V2.SUCCESS_LIGHT : "rgba(220,38,38,0.1)", color: isRec ? V2.SUCCESS_DARK : "#dc2626" }}>
              {isRec ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate" style={{ color: V2.TEXT }}>{e.descricao}</p>
              <p className="text-[11px]" style={{ color: vencida ? "#dc2626" : V2.MUTED }}>
                Vence {formatDate(e.vencimento)}
                {vencida && " · vencida"}
                {e.categoria && ` · ${e.categoria}`}
              </p>
            </div>
            <span className="text-sm font-semibold whitespace-nowrap" style={{ color: isRec ? V2.SUCCESS_DARK : "#dc2626" }}>
              {brl(Number(e.valor))}
            </span>
            <Button size="sm" variant="outline" className="gap-1" onClick={() => onPago(e.id)}>
              <CheckCircle2 className="h-3.5 w-3.5" /> {isRec ? "Recebi" : "Paguei"}
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onDelete(e.id)}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        );
      })}
    </div>
  );
}

function NewEntryDialog({ open, tipo, onClose, onSaved }: { open: boolean; tipo: "RECEITA" | "DESPESA"; onClose: () => void; onSaved: () => void }) {
  const [descricao, setDescricao] = useState("");
  const [valor, setValor] = useState("");
  const [vencimento, setVencimento] = useState(new Date().toISOString().slice(0, 10));
  const [categoria, setCategoria] = useState("");
  const [status, setStatus] = useState<"PENDENTE" | "PAGO">("PENDENTE");
  const [obs, setObs] = useState("");
  const [parcelas, setParcelas] = useState("1");

  function reset() {
    setDescricao(""); setValor(""); setVencimento(new Date().toISOString().slice(0, 10));
    setCategoria(""); setStatus("PENDENTE"); setObs(""); setParcelas("1");
  }

  const nParcelas = Math.max(1, Math.min(48, Math.floor(Number(parcelas) || 1)));
  const valorNum = Number(valor) || 0;
  const totalPreview = valorNum * nParcelas;

  const save = useMutation({
    mutationFn: async () => {
      if (!descricao) throw new Error("Informe a descrição");
      const v = Number(valor);
      if (!v || v <= 0) throw new Error("Informe um valor válido");
      const n = nParcelas;
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Sessão expirada");
      const valorParcela = v;
      const [by, bm, bd] = vencimento.split("-").map(Number);
      const rows = Array.from({ length: n }, (_, i) => {
        const d = new Date(by, (bm - 1) + i, bd);
        const venc = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        return {
          user_id: user.id,
          tipo,
          descricao: n > 1 ? `${descricao} (${i + 1}/${n})` : descricao,
          valor: valorParcela,
          vencimento: venc,
          pagamento: status === "PAGO" ? venc : null,
          status,
          categoria: categoria || null,
          observacao: obs || null,
          origem: "MANUAL",
        };
      });
      const { error } = await supabase.from("personal_entries" as never).insert(rows as never);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(tipo === "RECEITA" ? "Receita registrada" : "Despesa registrada");
      reset();
      onSaved();
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{tipo === "RECEITA" ? "Nova receita pessoal" : "Nova despesa pessoal"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium" style={{ color: V2.MUTED }}>Descrição</label>
            <Input value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder={tipo === "RECEITA" ? "Ex: Salário, freelas" : "Ex: Aluguel, luz, mercado"} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium" style={{ color: V2.MUTED }}>Valor</label>
              <Input type="number" step="0.01" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="0,00" />
            </div>
            <div>
              <label className="text-xs font-medium" style={{ color: V2.MUTED }}>{status === "PAGO" ? "Data do pagamento" : "Vencimento"}</label>
              <Input type="date" value={vencimento} onChange={(e) => setVencimento(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium" style={{ color: V2.MUTED }}>Categoria (opcional)</label>
              <Input value={categoria} onChange={(e) => setCategoria(e.target.value)} placeholder="Casa, saúde, lazer…" />
            </div>
            <div>
              <label className="text-xs font-medium" style={{ color: V2.MUTED }}>Status</label>
              <Select value={status} onValueChange={(v) => setStatus(v as "PENDENTE" | "PAGO")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="PENDENTE">{tipo === "RECEITA" ? "A receber" : "A pagar"}</SelectItem>
                  <SelectItem value="PAGO">{tipo === "RECEITA" ? "Já recebido" : "Já pago"}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium" style={{ color: V2.MUTED }}>Parcelas</label>
              <Input type="number" min="1" max="48" value={parcelas} onChange={(e) => setParcelas(e.target.value)} />
            </div>
            <div className="flex items-end">
              <p className="text-[11px]" style={{ color: V2.MUTED }}>
                {nParcelas === 1 ? "Lançamento único" : `Cria ${nParcelas} lançamentos mensais`}
              </p>
            </div>
          </div>
          {nParcelas > 1 && valorNum > 0 && (
            <p className="text-xs" style={{ color: V2.MUTED }}>
              {nParcelas}x de <strong style={{ color: V2.TEXT }}>{brl(valorNum)}</strong> · total {brl(totalPreview)} · 1ª em {formatDate(vencimento)}
            </p>
          )}
          <div>
            <label className="text-xs font-medium" style={{ color: V2.MUTED }}>Observação (opcional)</label>
            <Input value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Notas rápidas" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose}>Cancelar</Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending} style={{ background: tipo === "RECEITA" ? V2.SUCCESS : V2.TEAL_DARK, color: "#fff" }}>
              <Plus className="h-4 w-4 mr-1" /> Salvar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
