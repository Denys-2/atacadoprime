import { useState, useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { V2InternalShell } from "@/components/v2/InternalShell";
import { CompanyMoneyCards } from "@/components/v2/CompanyMoneyCards";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { TrendingUp, TrendingDown, Plus, Landmark, Trash2, Banknote, CreditCard, QrCode, ArrowLeftRight, ArrowUpRight, ArrowDownRight, Search, Filter } from "lucide-react";
import { toast } from "sonner";
import { useBankAccounts, useCreateBankAccount, useDeleteBankAccount, useCreateBankTransfer, type AccountBalance } from "@/hooks/use-bank-accounts";
import { orderCodeHash } from "@/lib/order-code";

export const Route = createFileRoute("/_authenticated/v3/financeiro")({ component: FinancePage });

const STATUS_COLORS: Record<string, string> = {
  PAGO: "bg-emerald-100 text-emerald-700 border-emerald-200",
  PENDENTE: "bg-amber-100 text-amber-700 border-amber-200",
  ATRASADO: "bg-rose-100 text-rose-700 border-rose-200",
  PARCIAL: "bg-blue-100 text-blue-700 border-blue-200",
  CANCELADO: "bg-slate-100 text-slate-500 border-slate-200",
  ESTORNADO: "bg-slate-100 text-slate-500 border-slate-200",
};

function brl(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);
}

function fmtData(d: string) {
  if (!d) return "—";
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y.slice(2)}`;
}

type PeriodKey = string;

function periodRange(p: PeriodKey): { from: string; to: string; label: string } {
  const now = new Date();
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  if (p === "hoje") return { from: iso(now), to: iso(now), label: "Hoje" };
  if (p === "7d") { const f = new Date(now); f.setDate(f.getDate() - 6); return { from: iso(f), to: iso(now), label: "Últimos 7 dias" }; }
  if (p === "90d") { const f = new Date(now); f.setDate(f.getDate() - 89); return { from: iso(f), to: iso(now), label: "Últimos 90 dias" }; }
  if (p === "mes_ant") {
    const f = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const t = new Date(now.getFullYear(), now.getMonth(), 0);
    return { from: iso(f), to: iso(t), label: "Mês anterior" };
  }
  if (p === "tudo") return { from: "0000-01-01", to: "9999-12-31", label: "Todos os períodos" };
  if (p.startsWith("m:")) {
    const [y, m] = p.slice(2).split("-").map(Number);
    const f = new Date(y, m - 1, 1);
    const t = new Date(y, m, 0);
    const nomes = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
    return { from: iso(f), to: iso(t), label: `${nomes[m-1]}/${y}` };
  }
  const f = new Date(now.getFullYear(), now.getMonth(), 1);
  return { from: iso(f), to: iso(now), label: "Este mês" };
}

function monthOptions(): { value: string; label: string }[] {
  const nomes = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
  const now = new Date();
  const opts: { value: string; label: string }[] = [];
  for (let i = 2; i < 14; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    opts.push({ value: `m:${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`, label: `${nomes[d.getMonth()]} ${d.getFullYear()}` });
  }
  return opts;
}

function FinancePage() {
  const qc = useQueryClient();
  const [period, setPeriod] = useState<PeriodKey>("mes");
  const [accountFilter, setAccountFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [receiveTx, setReceiveTx] = useState<{ id: string; valor: number; label: string; row: any } | null>(null);
  const [receiveAccount, setReceiveAccount] = useState("");
  const [receiveValor, setReceiveValor] = useState("");
  const [receiveData, setReceiveData] = useState(new Date().toISOString().slice(0, 10));
  const [restoVenc, setRestoVenc] = useState("");
  const [entry, setEntry] = useState({ descricao: "", valor: "", tipo: "DESPESA" as "DESPESA" | "RECEITA", account_id: "", agendar: false, vencimento: new Date().toISOString().slice(0, 10) });
  const [entryOpen, setEntryOpen] = useState(false);
  const [pecasOpen, setPecasOpen] = useState(false);
  const [savedInfo, setSavedInfo] = useState<null | { tipo: "DESPESA" | "RECEITA"; valor: number; descricao: string; agendou: boolean; conta?: string }>(null);
  const [adjustAcc, setAdjustAcc] = useState<AccountBalance | null>(null);
  const [adjustValue, setAdjustValue] = useState("");

  const range = periodRange(period);

  const { data: accounts = [] } = useBankAccounts();

  const { data: txs = [] } = useQuery({
    queryKey: ["fin-tx"],
    queryFn: async () => {
      const { data } = await supabase.from("financial_transactions")
        .select("*, companies(legal_name, trade_name), bank_accounts(nome, cor)")
        .order("created_at", { ascending: false }).limit(1000);
      return data ?? [];
    },
  });

  const { data: entries = [] } = useQuery({
    queryKey: ["fin-entries"],
    queryFn: async () => {
      const { data } = await supabase.from("financial_entries")
        .select("*, bank_accounts(nome, cor)")
        .order("data", { ascending: false }).limit(1000);
      return data ?? [];
    },
  });

  const { data: tripExpenses = [] } = useQuery({
    queryKey: ["fin-trip-expenses"],
    queryFn: async () => {
      const { data } = await supabase.from("trip_expenses")
        .select("id, valor, data, categoria, descricao, bank_accounts(nome, cor), trips(cidade, estado, nome)")
        .order("data", { ascending: false }).limit(2000);
      return data ?? [];
    },
  });

  const { data: orderDetails = [] } = useQuery({
    queryKey: ["fin-order-costs", range.from, range.to],
    queryFn: async () => {
      const { data } = await supabase
        .from("orders")
        .select("id, total, created_at, order_items(quantidade, preco_unitario, custo_unitario, products(sku, nome))")
        .gte("created_at", range.from + "T00:00:00")
        .lte("created_at", range.to + "T23:59:59")
        .neq("status", "CANCELADO")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const { data: kpis } = useQuery({
    queryKey: ["fin-kpis", range.from, range.to],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("finance_kpis", {
        _from: range.from,
        _to: range.to,
      });
      if (error) throw error;
      return (data as any)?.[0] ?? null;
    },
  });

  const { data: cutoff } = useQuery({
    queryKey: ["extrato-cutoff"],
    queryFn: async () => {
      const { data } = await supabase.from("system_settings").select("valor").eq("chave", "extrato_cutoff_date").maybeSingle();
      const v = (data as any)?.valor;
      if (!v) return "0000-01-01";
      return typeof v === "string" ? v : String(v).replace(/"/g, "");
    },
  });
  const cutoffDate = cutoff ?? "0000-01-01";

  const saldoTotal = accounts.filter((a) => (a as any).incluir_saldo_total === true).reduce((s, a) => s + a.saldo, 0);
  const aReceber = Number(kpis?.a_receber ?? 0);
  const aReceberVencidas = Number(kpis?.a_receber_vencidas ?? 0);
  const aPagar = Number(kpis?.a_pagar_total ?? 0);
  const aPagarVencidas = Number(kpis?.a_pagar_total_vencidas ?? 0);


  // Quanto vendi no período — usa financial_transactions RECEITA (valor_bruto = venda cheia; valor = líquido)
  const { vendidoPeriodo, vendidoQtd, vendasPorForma, totalTaxas } = useMemo(() => {
    const base = (txs as any[])
      .filter((t) => t.tipo === "RECEITA" && t.status !== "CANCELADO" && t.status !== "ESTORNADO")
      .filter((t) => {
        const d = (t.pagamento || (t.created_at || "").slice(0, 10));
        return d >= range.from && d <= range.to;
      });
    const bruto = (t: any) => Number(t.valor_bruto ?? t.valor ?? 0);
    const norm = (f: any) => String(f || "").toUpperCase();
    const sumBy = (pred: (f: string) => boolean) => base.filter((t) => pred(norm(t.forma_pagamento))).reduce((s, t) => s + bruto(t), 0);
    const qtdBy = (pred: (f: string) => boolean) => base.filter((t) => pred(norm(t.forma_pagamento))).length;
    return {
      vendidoPeriodo: base.reduce((s, t) => s + bruto(t), 0),
      vendidoQtd: base.length,
      totalTaxas: base.reduce((s, t) => s + Number(t.taxas ?? 0), 0),
      vendasPorForma: {
        dinheiro: sumBy((f) => f === "DINHEIRO"),
        dinheiroQtd: qtdBy((f) => f === "DINHEIRO"),
        pix: sumBy((f) => f === "PIX"),
        pixQtd: qtdBy((f) => f === "PIX"),
        cartao: sumBy((f) => f.startsWith("CART")),
        cartaoQtd: qtdBy((f) => f.startsWith("CART")),
      },
    };
  }, [txs, range.from, range.to]);






  // Extrato unificado
  const extrato = useMemo(() => {
    type Row = { id: string; data: string; descricao: string; categoria: string; tipo: "RECEITA" | "DESPESA"; valor: number; origem: string; conta?: string; contaCor?: string; doc?: string };
    const rows: Row[] = [];
    for (const t of txs as any[]) {
      if (t.status !== "PAGO") continue;
      const data = t.pagamento || (t.created_at || "").slice(0, 10);
      const cliente = t.companies?.trade_name || t.companies?.legal_name || t.descricao || "Venda";
      rows.push({
        id: `t-${t.id}`,
        data,
        descricao: t.tipo === "RECEITA" ? `Recebimento — ${cliente}` : (t.descricao || "Pagamento"),
        categoria: t.tipo === "RECEITA" ? "Vendas" : (t.descricao?.split(" ")[0] || "Diversos"),
        tipo: t.tipo,
        valor: Number(t.valor),
        origem: "Venda",
        conta: t.bank_accounts?.nome,
        contaCor: t.bank_accounts?.cor,
        doc: t.order_id ? orderCodeHash(String(t.order_id), cliente) : (t.forma_pagamento || ""),
      });
    }
    for (const e of entries as any[]) {
      rows.push({
        id: `e-${e.id}`,
        data: e.data,
        descricao: e.descricao,
        categoria: "Manual",
        tipo: e.tipo,
        valor: Number(e.valor),
        origem: "Manual",
        conta: e.bank_accounts?.nome,
        contaCor: e.bank_accounts?.cor,
      });
    }
    // Agrupa despesas por viagem para não poluir o extrato
    const viagemMap = new Map<string, { key: string; local: string; total: number; ultima: string; conta?: string; contaCor?: string }>();
    for (const v of tripExpenses as any[]) {
      const t = v.trips ?? {};
      const tripKey = t.id || t.nome || "sem-viagem";
      const local = t.cidade ? `${t.cidade}${t.estado ? "-" + t.estado : ""}` : (t.nome || "Viagem");
      const cur = viagemMap.get(tripKey) ?? { key: tripKey, local, total: 0, ultima: v.data, conta: v.bank_accounts?.nome, contaCor: v.bank_accounts?.cor };
      cur.total += Number(v.valor || 0);
      if ((v.data || "") > (cur.ultima || "")) cur.ultima = v.data;
      if (!cur.conta && v.bank_accounts?.nome) { cur.conta = v.bank_accounts.nome; cur.contaCor = v.bank_accounts.cor; }
      viagemMap.set(tripKey, cur);
    }
    for (const g of viagemMap.values()) {
      rows.push({
        id: `v-${g.key}`,
        data: g.ultima,
        descricao: `Despesa viagem ${g.local}`,
        categoria: "Viagem",
        tipo: "DESPESA",
        valor: g.total,
        origem: "Viagem",
        conta: g.conta,
        contaCor: g.contaCor,
      });
    }
    return rows;
  }, [txs, entries, tripExpenses]);

  const extratoFiltrado = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = extrato.filter((r) => {
      if (r.data < cutoffDate) return false;
      if (r.data < range.from || r.data > range.to) return false;
      if (accountFilter !== "all") {
        const acc = accounts.find((a) => a.id === accountFilter);
        if (!acc || r.conta !== acc.nome) return false;
      }
      if (q && !`${r.descricao} ${r.categoria} ${r.conta || ""} ${r.doc || ""}`.toLowerCase().includes(q)) return false;
      return true;
    });
    const asc = [...filtered].sort((a, b) => (a.data || "").localeCompare(b.data || "") || a.id.localeCompare(b.id));
    let acc = 0;
    const withBalance = asc.map((r) => {
      acc += r.tipo === "RECEITA" ? r.valor : -r.valor;
      return { ...r, saldo: acc };
    });
    return withBalance.reverse();
  }, [extrato, range.from, range.to, accountFilter, accounts, search, cutoffDate]);

  const totalReceita = extratoFiltrado.reduce((s, r) => s + (r.tipo === "RECEITA" ? r.valor : 0), 0);
  const totalDespesa = extratoFiltrado.reduce((s, r) => s + (r.tipo === "DESPESA" ? r.valor : 0), 0);
  const resultadoPeriodo = totalReceita - totalDespesa;

  
  const totalContasPagar = Number(kpis?.contas_pagar ?? 0);
  const totalCustoPecas = Number(kpis?.custo_pecas_periodo ?? 0);
  const despesaViagemPeriodo = Number(kpis?.despesas_viagem_periodo ?? 0);
  const despesasPagasPeriodo = useMemo(() => {
    return (entries as any[])
      .filter((e) => e.tipo === "DESPESA" && (e.data || "") >= range.from && (e.data || "") <= range.to)
      .filter((e) => !String(e.descricao || "").toLowerCase().includes("ajuste de saldo"))
      .reduce((s, e) => s + Number(e.valor || 0), 0);
  }, [entries, range.from, range.to]);
  const resultadoLiquido = vendidoPeriodo - totalContasPagar - totalCustoPecas - despesaViagemPeriodo - despesasPagasPeriodo;



  const addEntry = useMutation({
    mutationFn: async () => {
      if (!entry.descricao) throw new Error("Informe a descrição");
      if (!entry.valor || Number(entry.valor) <= 0) throw new Error("Informe o valor");
      if (entry.agendar) {
        // Agenda como Conta a pagar/receber (pendente)
        const { error } = await supabase.from("financial_transactions").insert({
          descricao: entry.descricao,
          valor: Number(entry.valor),
          tipo: entry.tipo,
          status: "PENDENTE",
          vencimento: entry.vencimento,
          forma_pagamento: "OUTRO",
        });
        if (error) throw error;
      } else {
        if (!entry.account_id) throw new Error("Escolha a conta bancária");
        const { error } = await supabase.from("financial_entries").insert({
          descricao: entry.descricao,
          valor: Number(entry.valor),
          tipo: entry.tipo,
          data: new Date().toISOString().slice(0, 10),
          account_id: entry.account_id,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      const contaNome = accounts.find((a) => a.id === entry.account_id)?.nome;
      setSavedInfo({
        tipo: entry.tipo,
        valor: Number(entry.valor),
        descricao: entry.descricao,
        agendou: entry.agendar,
        conta: contaNome,
      });
      toast.success(entry.agendar ? "Conta agendada" : "Lançamento registrado");
      setEntry({ descricao: "", valor: "", tipo: "DESPESA", account_id: "", agendar: false, vencimento: new Date().toISOString().slice(0, 10) });
      setEntryOpen(false);
      qc.invalidateQueries({ queryKey: ["fin-entries"] });
      qc.invalidateQueries({ queryKey: ["fin-tx"] });
      qc.invalidateQueries({ queryKey: ["bank-accounts-balances"] });
      qc.invalidateQueries({ queryKey: ["fin-kpis"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const adjustBalance = useMutation({
    mutationFn: async () => {
      if (!adjustAcc) throw new Error("Conta não selecionada");
      const alvo = Number(adjustValue);
      if (Number.isNaN(alvo)) throw new Error("Informe o saldo real (número)");
      const diff = alvo - Number(adjustAcc.saldo || 0);
      if (Math.abs(diff) < 0.005) return; // já bate
      const tipo = diff > 0 ? "RECEITA" : "DESPESA";
      const { error } = await supabase.from("financial_entries").insert({
        descricao: `Ajuste de saldo — ${adjustAcc.nome}`,
        valor: Math.abs(diff),
        tipo,
        data: new Date().toISOString().slice(0, 10),
        account_id: adjustAcc.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Saldo ajustado");
      setAdjustAcc(null);
      setAdjustValue("");
      qc.invalidateQueries({ queryKey: ["bank-accounts-balances"] });
      qc.invalidateQueries({ queryKey: ["fin-entries"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const confirmReceive = useMutation({
    mutationFn: async () => {
      if (!receiveTx || !receiveAccount) throw new Error("Escolha a conta que recebeu");
      const total = Number(receiveTx.valor);
      const recebido = Number(String(receiveValor).replace(",", ".")) || 0;
      if (recebido <= 0) throw new Error("Informe o valor recebido");
      if (recebido > total + 0.005) throw new Error("Valor recebido maior que o saldo devedor");
      const resto = Math.round((total - recebido) * 100) / 100;
      const parcial = resto > 0.004;
      if (parcial && !restoVenc) throw new Error("Informe a nova data de vencimento da diferença");

      const { error } = await supabase.from("financial_transactions").update({
        status: "PAGO",
        pagamento: receiveData,
        account_id: receiveAccount,
        valor: recebido,
        descricao: parcial
          ? `${receiveTx.row?.descricao ?? ""} [Recebimento parcial ${brl(recebido)} de ${brl(total)}]`
          : receiveTx.row?.descricao,
      }).eq("id", receiveTx.id);
      if (error) throw error;

      if (parcial) {
        const r = receiveTx.row ?? {};
        const { error: iErr } = await supabase.from("financial_transactions").insert({
          order_id: r.order_id ?? null,
          company_id: r.company_id ?? null,
          tipo: "RECEITA",
          status: "PENDENTE",
          valor: resto,
          valor_bruto: resto,
          vencimento: restoVenc,
          pagamento: null,
          descricao: `${r.descricao ?? "Recebimento"} — saldo restante`,
          forma_pagamento: r.forma_pagamento ?? "OUTRO",
          parcelas: 1,
          parcela_num: 1,
          parcelas_total: 1,
          account_id: receiveAccount,
        });
        if (iErr) throw iErr;
      }
      return { parcial, resto };
    },
    onSuccess: (res) => {
      toast.success(res?.parcial ? `Recebimento parcial registrado — restam ${brl(res.resto)}` : "Recebimento confirmado");
      setReceiveTx(null); setReceiveAccount(""); setReceiveValor(""); setRestoVenc("");
      qc.invalidateQueries({ queryKey: ["fin-tx"] });
      qc.invalidateQueries({ queryKey: ["bank-accounts-balances"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <V2InternalShell title="Financeiro" eyebrow="Minha conta" description="Controle bancário, extrato e recebimentos">
      {/* Vendas do período — bruto por forma de pagamento */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
        <KpiCard label="Em dinheiro" value={brl(vendasPorForma.dinheiro)} icon={Banknote} accent="#16a34a" sub={`${vendasPorForma.dinheiroQtd} venda${vendasPorForma.dinheiroQtd===1?"":"s"} no período`} />
        <KpiCard label="Em PIX" value={brl(vendasPorForma.pix)} icon={QrCode} accent="#0ea5e9" sub={`${vendasPorForma.pixQtd} venda${vendasPorForma.pixQtd===1?"":"s"} no período`} />
        <KpiCard label="Em cartão (bruto)" value={brl(vendasPorForma.cartao)} icon={CreditCard} accent="#8b5cf6" sub={`${vendasPorForma.cartaoQtd} venda${vendasPorForma.cartaoQtd===1?"":"s"} · valor cheio antes da taxa`} />
        <KpiCard label={`Vendi — ${range.label.toLowerCase()}`} value={brl(vendidoPeriodo)} icon={TrendingUp} accent="#0d7377" sub={`${vendidoQtd} venda${vendidoQtd===1?"":"s"} · bruto (dinheiro + PIX + cartão)`} />
      </div>

      {/* Deduções e resultado */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <KpiCard label="(−) Taxas de cartão" value={brl(totalTaxas)} icon={ArrowDownRight} accent="#f97316" sub="Ton — debitado das parcelas" />
        <KpiCard label="Contas a pagar" value={brl(totalContasPagar)} icon={ArrowDownRight} accent="#ef4444" sub="Despesas em aberto" />
        <KpiCard label={`Despesa de viagem — ${range.label.toLowerCase()}`} value={brl(despesaViagemPeriodo)} icon={TrendingDown} accent="#f59e0b" sub="Gastos das viagens no período" />
        <KpiCard label="Custo peças" value={brl(totalCustoPecas)} icon={QrCode} accent="#f59e0b" sub="CMV em aberto · clique para detalhes" onClick={() => setPecasOpen(true)} />
        <KpiCard label={`Despesas pagas — ${range.label.toLowerCase()}`} value={brl(despesasPagasPeriodo)} icon={ArrowDownRight} accent="#dc2626" sub="Lançamentos manuais quitados no período" />
      </div>

      <div className="grid grid-cols-1 gap-3 mb-4">
        <KpiCard label={`Resultado — ${range.label.toLowerCase()}`} value={brl(resultadoLiquido - totalTaxas)} icon={TrendingUp} accent={(resultadoLiquido - totalTaxas) >= 0 ? "#16a34a" : "#ef4444"} sub="Vendi bruto − taxas − pagar − peças − viagem − despesas pagas" />
      </div>

      {/* Dinheiro da empresa vindo de parcelas de vendas já acertadas */}
      <CompanyMoneyCards />








      {/* Saldo por conta */}
      {accounts.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200/70 shadow-[0_1px_2px_rgba(15,23,42,0.04)] p-3 mb-4">
          <div className="flex items-center justify-between gap-2 mb-2 px-1">
            <p className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">Saldo por conta</p>
            <p className="text-[11px] text-slate-500 tabular-nums">Total <span className={`font-bold ${saldoTotal >= 0 ? "text-slate-900" : "text-rose-600"}`}>{brl(saldoTotal)}</span></p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
            {accounts.map((a) => (
              <div key={a.id} className="rounded-lg border border-slate-200 p-2.5 bg-gradient-to-br from-white to-slate-50/50">
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: a.cor }} />
                  <p className="text-[11px] font-semibold text-slate-700 truncate flex-1">{a.nome}</p>
                  <button
                    type="button"
                    onClick={() => { setAdjustAcc(a); setAdjustValue(String(a.saldo.toFixed(2))); }}
                    className="text-[10px] text-teal-700 hover:underline font-semibold shrink-0"
                    title="Ajustar saldo para o valor real do banco"
                  >Ajustar</button>
                </div>
                <p className={`text-base font-bold tabular-nums ${a.saldo >= 0 ? "text-slate-900" : "text-rose-600"}`}>{brl(a.saldo)}</p>
                <div className="flex items-center gap-2 mt-0.5 text-[10px] tabular-nums">
                  <span className="text-emerald-600">↑ {brl(a.entradas)}</span>
                  <span className="text-rose-600">↓ {brl(a.saidas)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}


      <CustoPecasDialog open={pecasOpen} onOpenChange={setPecasOpen} orders={orderDetails} rangeLabel={range.label} />

      <Tabs defaultValue="extrato" className="w-full">
        <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
          <TabsList className="bg-white border border-slate-200 h-9">

            <TabsTrigger value="extrato" className="text-xs">Extrato</TabsTrigger>
            <TabsTrigger value="pagar" className="text-xs">Contas a pagar</TabsTrigger>
            <TabsTrigger value="receber" className="text-xs">Contas a receber</TabsTrigger>
            <TabsTrigger value="pecas" className="text-xs">Custo peças</TabsTrigger>
            <TabsTrigger value="contas" className="text-xs">Contas</TabsTrigger>
          </TabsList>


          <div className="flex items-center gap-2 flex-wrap">
            <Select value={period} onValueChange={(v: PeriodKey) => setPeriod(v)}>
              <SelectTrigger className="h-9 w-40 text-xs bg-white"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="hoje">Hoje</SelectItem>
                <SelectItem value="7d">Últimos 7 dias</SelectItem>
                <SelectItem value="mes">Este mês</SelectItem>
                <SelectItem value="mes_ant">Mês anterior</SelectItem>
                <SelectItem value="90d">Últimos 90 dias</SelectItem>
                <SelectItem value="tudo">Todos</SelectItem>
                <div className="px-2 pt-2 pb-1 text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Meses anteriores</div>
                {monthOptions().map((m) => (
                  <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={accountFilter} onValueChange={setAccountFilter}>
              <SelectTrigger className="h-9 w-40 text-xs bg-white"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as contas</SelectItem>
                {accounts.map((a) => (<SelectItem key={a.id} value={a.id}>{a.nome}</SelectItem>))}
              </SelectContent>
            </Select>
            <Dialog open={entryOpen} onOpenChange={setEntryOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="h-9"><Plus className="w-3.5 h-3.5 mr-1" /> Lançar</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Novo lançamento</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setEntry({ ...entry, agendar: false })} className={`flex-1 rounded-lg border px-3 py-2 text-xs font-semibold ${!entry.agendar ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-600"}`}>Pago agora</button>
                    <button type="button" onClick={() => setEntry({ ...entry, agendar: true })} className={`flex-1 rounded-lg border px-3 py-2 text-xs font-semibold ${entry.agendar ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-600"}`}>Agendar (pagar depois)</button>
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Descrição</label>
                    <Input placeholder="Ex.: Aluguel do escritório" value={entry.descricao} onChange={(e) => setEntry({ ...entry, descricao: e.target.value })} className="mt-1" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Valor</label>
                      <Input type="number" step="0.01" placeholder="0,00" value={entry.valor} onChange={(e) => setEntry({ ...entry, valor: e.target.value })} className="mt-1 tabular-nums" />
                    </div>
                    <div>
                      <label className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Tipo</label>
                      <Select value={entry.tipo} onValueChange={(v: any) => setEntry({ ...entry, tipo: v })}>
                        <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="RECEITA">Receita (entrada)</SelectItem>
                          <SelectItem value="DESPESA">Despesa (saída)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  {entry.agendar ? (
                    <div>
                      <label className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Vencimento</label>
                      <Input type="date" value={entry.vencimento} onChange={(e) => setEntry({ ...entry, vencimento: e.target.value })} className="mt-1" />
                      <p className="text-[11px] text-slate-500 mt-1">Vai aparecer na aba <b>{entry.tipo === "DESPESA" ? "Contas a pagar" : "Contas a receber"}</b>. Você quita clicando em <b>Pagar</b>/<b>Receber</b> lá.</p>
                    </div>
                  ) : (
                    <div>
                      <label className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Conta bancária</label>
                      <AccountSelect value={entry.account_id} onChange={(v) => setEntry({ ...entry, account_id: v })} accounts={accounts} className="mt-1" />
                      <p className="text-[11px] text-slate-500 mt-1">O saldo desta conta será {entry.tipo === "DESPESA" ? "debitado" : "creditado"} imediatamente.</p>
                    </div>
                  )}
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setEntryOpen(false)}>Cancelar</Button>
                  <Button disabled={addEntry.isPending} onClick={() => addEntry.mutate()}>
                    {addEntry.isPending ? "Salvando…" : entry.agendar ? "Agendar" : "Registrar"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <TabsContent value="extrato" className="mt-0">
          <ExtratoView
            rows={extratoFiltrado}
            search={search}
            onSearch={setSearch}
            totalReceita={totalReceita}
            totalDespesa={totalDespesa}
            resultado={resultadoPeriodo}
            periodLabel={range.label}
          />
        </TabsContent>

        <TabsContent value="pagar" className="mt-0">
          <ContasPagarView txs={txs} accounts={accounts} kind="DESPESAS" />
        </TabsContent>

        <TabsContent value="receber" className="mt-0">
          <ContasReceberView txs={txs} onOpenReceive={(t) => { setReceiveTx({ id: t.id, valor: Number(t.valor), label: t.companies?.trade_name || t.companies?.legal_name || t.descricao || "—", row: t }); setReceiveAccount(""); setReceiveValor(String(Number(t.valor).toFixed(2))); setReceiveData(new Date().toISOString().slice(0, 10)); setRestoVenc(new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10)); }} />
        </TabsContent>

        <TabsContent value="pecas" className="mt-0">
          <ContasPagarView txs={txs} accounts={accounts} kind="PECAS" />
        </TabsContent>

        <TabsContent value="contas" className="mt-0">
          <BankAccountsPanel accounts={accounts} />
        </TabsContent>
      </Tabs>


      <Dialog open={!!receiveTx} onOpenChange={(o) => !o && setReceiveTx(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Confirmar recebimento</DialogTitle></DialogHeader>
          {receiveTx && (() => {
            const recebido = Number(String(receiveValor).replace(",", ".")) || 0;
            const resto = Math.round((Number(receiveTx.valor) - recebido) * 100) / 100;
            const parcial = resto > 0.004;
            return (
            <div className="space-y-3">
              <div className="rounded-lg bg-slate-50 border border-slate-200 p-3">
                <p className="text-xs text-slate-500">Cliente</p>
                <p className="font-medium">{receiveTx.label}</p>
                <p className="text-xs text-slate-500 mt-2">Saldo devedor</p>
                <p className="text-lg font-bold text-emerald-600 tabular-nums">{brl(receiveTx.valor)}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Valor recebido</label>
                  <Input type="number" step="0.01" min="0" value={receiveValor} onChange={(e) => setReceiveValor(e.target.value)} className="mt-1" />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Data do recebimento</label>
                  <Input type="date" value={receiveData} onChange={(e) => setReceiveData(e.target.value)} className="mt-1" />
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" size="sm" variant="outline" className="h-7 text-xs" onClick={() => setReceiveValor(String(Number(receiveTx.valor).toFixed(2)))}>Total</Button>
                <Button type="button" size="sm" variant="outline" className="h-7 text-xs" onClick={() => setReceiveValor((Number(receiveTx.valor) / 2).toFixed(2))}>50%</Button>
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Em qual conta caiu?</label>
                <AccountSelect value={receiveAccount} onChange={setReceiveAccount} accounts={accounts} placeholder="Selecione a conta bancária" className="mt-1" />
              </div>
              {parcial && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-2">
                  <p className="text-sm text-amber-800">
                    Recebimento parcial — resta <b className="tabular-nums">{brl(resto)}</b> em aberto.
                  </p>
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider text-amber-700">Novo vencimento da diferença</label>
                    <Input type="date" value={restoVenc} onChange={(e) => setRestoVenc(e.target.value)} className="mt-1 bg-white" />
                  </div>
                </div>
              )}
            </div>
            );
          })()}
          <DialogFooter>
            <Button variant="outline" onClick={() => setReceiveTx(null)}>Cancelar</Button>
            <Button disabled={!receiveAccount || confirmReceive.isPending} onClick={() => confirmReceive.mutate()}>Confirmar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmação visual pós-lançamento */}
      <Dialog open={!!savedInfo} onOpenChange={(o) => !o && setSavedInfo(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="w-9 h-9 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-lg">✓</span>
              Lançamento salvo
            </DialogTitle>
          </DialogHeader>
          {savedInfo && (
            <div className="text-sm space-y-2">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">{savedInfo.tipo === "DESPESA" ? "Despesa" : "Receita"} {savedInfo.agendou ? "agendada" : "quitada"}</p>
                <p className="font-semibold text-slate-900 truncate">{savedInfo.descricao}</p>
                <p className={`text-xl font-bold tabular-nums ${savedInfo.tipo === "DESPESA" ? "text-rose-600" : "text-emerald-600"}`}>
                  {savedInfo.tipo === "DESPESA" ? "− " : "+ "}{brl(savedInfo.valor)}
                </p>
                {savedInfo.conta && <p className="text-xs text-slate-600">Conta: <b>{savedInfo.conta}</b></p>}
              </div>
              <p className="text-xs text-slate-500">
                {savedInfo.agendou
                  ? "Aparece na aba Contas a pagar/receber."
                  : "Já foi debitado/creditado da conta e aparece no Extrato."}
              </p>
            </div>
          )}
          <DialogFooter>
            <Button className="w-full bg-emerald-600 hover:bg-emerald-700" onClick={() => setSavedInfo(null)}>OK</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Ajustar saldo real */}
      <Dialog open={!!adjustAcc} onOpenChange={(o) => { if (!o) { setAdjustAcc(null); setAdjustValue(""); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Ajustar saldo real — {adjustAcc?.nome}</DialogTitle></DialogHeader>
          {adjustAcc && (
            <div className="space-y-3 text-sm">
              <p className="text-xs text-slate-500">Saldo calculado hoje: <b className="tabular-nums">{brl(adjustAcc.saldo)}</b>. Informe o saldo <b>real</b> que aparece no seu banco — o sistema lança a diferença automaticamente.</p>
              <div>
                <label className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Saldo real do banco</label>
                <Input type="number" step="0.01" value={adjustValue} onChange={(e) => setAdjustValue(e.target.value)} className="mt-1 tabular-nums text-lg" />
              </div>
              {adjustValue !== "" && !Number.isNaN(Number(adjustValue)) && (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs">
                  Diferença que será lançada:{" "}
                  <b className={`tabular-nums ${Number(adjustValue) - adjustAcc.saldo >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                    {Number(adjustValue) - adjustAcc.saldo >= 0 ? "+ " : "− "}{brl(Math.abs(Number(adjustValue) - adjustAcc.saldo))}
                  </b>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setAdjustAcc(null); setAdjustValue(""); }}>Cancelar</Button>
            <Button disabled={adjustBalance.isPending || adjustValue === ""} onClick={() => adjustBalance.mutate()} className="bg-emerald-600 hover:bg-emerald-700">
              {adjustBalance.isPending ? "Salvando…" : "Ajustar saldo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </V2InternalShell>
  );
}

function KpiCard({ label, value, icon: Icon, sub, accent = "#0d7377", onClick }: { label: string; value: string; icon: any; sub?: string; accent?: string; onClick?: () => void; tone?: any; subTone?: any; highlight?: any }) {
  const clickable = !!onClick;
  return (
    <div
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      onClick={onClick}
      onKeyDown={clickable ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick!(); } } : undefined}
      className={`rounded-2xl border border-slate-200 bg-white p-4 ${clickable ? "cursor-pointer hover:border-slate-300 transition" : ""}`}
    >
      <div className="flex items-center gap-2 mb-2">
        <div className="h-8 w-8 rounded-lg grid place-items-center shrink-0" style={{ background: `${accent}22`, color: accent }}>
          <Icon className="h-4 w-4" strokeWidth={2.4} />
        </div>
        <div className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold truncate">{label}</div>
      </div>
      <div className="text-xl font-bold tabular-nums text-slate-900">{value}</div>
      {sub && <div className="text-[11px] mt-0.5 text-slate-500">{sub}</div>}
    </div>
  );
}


function ExtratoView({ rows, search, onSearch, totalReceita, totalDespesa, resultado, periodLabel }: {
  rows: Array<{ id: string; data: string; descricao: string; categoria: string; tipo: "RECEITA" | "DESPESA"; valor: number; origem: string; conta?: string; contaCor?: string; doc?: string; saldo: number }>;
  search: string; onSearch: (v: string) => void;
  totalReceita: number; totalDespesa: number; resultado: number; periodLabel: string;
}) {
  // Agrupa por data para exibição estilo extrato bancário
  const groups = useMemo(() => {
    const map = new Map<string, typeof rows>();
    for (const r of rows) {
      const arr = map.get(r.data) ?? [];
      arr.push(r);
      map.set(r.data, arr);
    }
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [rows]);

  const fmtDia = (d: string) => {
    if (!d) return "";
    const dt = new Date(d + "T12:00:00");
    const dias = ["Domingo","Segunda","Terça","Quarta","Quinta","Sexta","Sábado"];
    const meses = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];
    return `${dias[dt.getDay()]}, ${dt.getDate()} de ${meses[dt.getMonth()]}`;
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/70 shadow-[0_1px_2px_rgba(15,23,42,0.04)] overflow-hidden">
      {/* Cabeçalho */}
      <div className="px-5 py-4 border-b border-slate-100 flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-base font-semibold text-slate-900 tracking-tight">Extrato bancário</h2>
          <p className="text-[11px] text-slate-500 mt-0.5">{periodLabel} · saldo acumulado do período</p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input placeholder="Buscar descrição, conta, documento…" value={search} onChange={(e) => onSearch(e.target.value)} className="h-9 pl-9 text-xs rounded-lg" />
        </div>
      </div>

      {/* Totais em faixa clara */}
      <div className="grid grid-cols-3 border-b border-slate-100 bg-gradient-to-b from-slate-50/60 to-white">
        <div className="py-3.5 px-4 border-r border-slate-100">
          <div className="flex items-center gap-1.5 text-emerald-700 mb-0.5">
            <ArrowUpRight className="w-3 h-3" />
            <span className="text-[10px] uppercase tracking-wider font-semibold">Entradas</span>
          </div>
          <p className="text-lg font-bold text-emerald-600 tabular-nums leading-tight">{brl(totalReceita)}</p>
        </div>
        <div className="py-3.5 px-4 border-r border-slate-100">
          <div className="flex items-center gap-1.5 text-rose-700 mb-0.5">
            <ArrowDownRight className="w-3 h-3" />
            <span className="text-[10px] uppercase tracking-wider font-semibold">Saídas</span>
          </div>
          <p className="text-lg font-bold text-rose-600 tabular-nums leading-tight">{brl(totalDespesa)}</p>
        </div>
        <div className="py-3.5 px-4">
          <div className="flex items-center gap-1.5 text-slate-700 mb-0.5">
            <TrendingUp className="w-3 h-3" />
            <span className="text-[10px] uppercase tracking-wider font-semibold">Resultado</span>
          </div>
          <p className={`text-lg font-bold tabular-nums leading-tight ${resultado >= 0 ? "text-emerald-600" : "text-rose-600"}`}>{brl(resultado)}</p>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="py-20 text-center">
          <div className="w-14 h-14 rounded-full bg-slate-50 mx-auto mb-3 grid place-items-center">
            <Filter className="w-6 h-6 text-slate-300" />
          </div>
          <p className="text-sm text-slate-500 font-medium">Nenhum lançamento no período</p>
          <p className="text-[11px] text-slate-400 mt-1">Ajuste o filtro de período ou registre um lançamento</p>
        </div>
      ) : (
        <div className="max-h-[640px] overflow-y-auto divide-y divide-slate-100">
          {groups.map(([dia, itens]) => {
            const diaTotal = itens.reduce((s, r) => s + (r.tipo === "RECEITA" ? r.valor : -r.valor), 0);
            return (
              <section key={dia}>
                {/* Cabeçalho do dia */}
                <div className="px-5 py-2 bg-slate-50/70 border-b border-slate-100 flex items-center justify-between sticky top-0 z-10 backdrop-blur">
                  <div className="flex items-center gap-2">
                    <span className="w-8 h-8 rounded-lg bg-white border border-slate-200 grid place-items-center text-[11px] font-bold text-slate-700 tabular-nums">
                      {dia.slice(8, 10)}
                    </span>
                    <div>
                      <p className="text-xs font-semibold text-slate-800 leading-tight">{fmtDia(dia)}</p>
                      <p className="text-[10px] text-slate-500 tabular-nums leading-tight">{itens.length} lançamento{itens.length === 1 ? "" : "s"}</p>
                    </div>
                  </div>
                  <p className={`text-xs font-bold tabular-nums ${diaTotal >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                    {diaTotal >= 0 ? "+" : "−"} {brl(Math.abs(diaTotal))}
                  </p>
                </div>

                {/* Itens do dia */}
                <div className="divide-y divide-slate-100">
                  {itens.map((r) => (
                    <div key={r.id} className="px-5 py-3 flex items-center gap-3 hover:bg-slate-50/50 transition">
                      <div className={`w-9 h-9 rounded-full grid place-items-center shrink-0 ${r.tipo === "RECEITA" ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"}`}>
                        {r.tipo === "RECEITA" ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium text-slate-900 truncate">{r.descricao}</p>
                          {r.doc && <span className="text-[10px] text-slate-400 tabular-nums font-mono">{r.doc}</span>}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-500 flex-wrap">
                          <span className="inline-flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full" style={{ background: r.contaCor || "#94a3b8" }} />
                            {r.conta || "—"}
                          </span>
                          <span className="w-0.5 h-0.5 rounded-full bg-slate-300" />
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-medium">{r.categoria}</span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className={`text-sm font-bold tabular-nums ${r.tipo === "RECEITA" ? "text-emerald-600" : "text-rose-600"}`}>
                          {r.tipo === "RECEITA" ? "+" : "−"} {brl(r.valor)}
                        </p>
                        <p className={`text-[10px] tabular-nums mt-0.5 ${r.saldo >= 0 ? "text-slate-400" : "text-rose-400"}`}>
                          saldo {brl(r.saldo)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ContasReceberView({ txs, onOpenReceive }: { txs: any[]; onOpenReceive: (t: any) => void }) {
  const [statusFilter, setStatusFilter] = useState<string>("PENDENTE");
  const filtered = txs.filter((t: any) => t.tipo === "RECEITA" && (statusFilter === "all" ? true : t.status === statusFilter));
  const total = filtered.reduce((s: number, t: any) => s + Number(t.valor), 0);

  return (
    <div className="bg-white rounded-xl border border-slate-200/70 shadow-[0_1px_2px_rgba(15,23,42,0.04)] overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Contas a receber</h2>
          <p className="text-[11px] text-slate-500">{filtered.length} título{filtered.length === 1 ? "" : "s"}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Total em aberto</p>
            <p className="text-xl font-bold text-emerald-600 tabular-nums">{brl(total)}</p>
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40 h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="PENDENTE">Pendente</SelectItem>
              <SelectItem value="ATRASADO">Atrasado</SelectItem>
              <SelectItem value="PARCIAL">Parcial</SelectItem>
              <SelectItem value="PAGO">Pago</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      {filtered.length === 0 ? (
        <p className="py-12 text-sm text-slate-500 text-center">Nenhuma conta neste filtro</p>
      ) : (
        <div className="divide-y divide-slate-100 max-h-[600px] overflow-y-auto">
          {filtered.map((t: any) => (
            <div key={t.id} className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 items-center px-4 py-3 hover:bg-slate-50/60">
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-900 truncate">{t.companies?.trade_name || t.companies?.legal_name || t.descricao || "—"}</p>
                <p className="text-[11px] text-slate-500 truncate">
                  Venc: {t.vencimento ? fmtData(t.vencimento) : "—"} · {t.forma_pagamento || "—"}
                  {t.bank_accounts?.nome && <span className="ml-1 text-slate-700">• {t.bank_accounts.nome}</span>}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Badge className={`${STATUS_COLORS[t.status] || ""} text-[10px] border`}>{t.status}</Badge>
                <span className="text-sm font-bold text-slate-900 tabular-nums w-24 text-right">{brl(Number(t.valor))}</span>
                {t.status !== "PAGO" && (
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => onOpenReceive(t)}>Receber</Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ContasPagarView({ txs, accounts, kind = "DESPESAS" }: { txs: any[]; accounts: AccountBalance[]; kind?: "DESPESAS" | "PECAS" }) {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>("PENDENTE");
  const [payTx, setPayTx] = useState<{ id: string; valor: number; label: string } | null>(null);
  const [payAccount, setPayAccount] = useState("");

  const isPeca = (d: string) => /custo.*pe[çc]a/i.test(d || "");
  const filtered = txs
    .filter((t: any) => t.tipo === "DESPESA")
    .filter((t: any) => (kind === "PECAS" ? isPeca(t.descricao) : !isPeca(t.descricao)))
    .filter((t: any) => (statusFilter === "all" ? true : t.status === statusFilter));
  const total = filtered.reduce((s: number, t: any) => s + Number(t.valor), 0);
  const title = kind === "PECAS" ? "Custo peças" : "Contas a pagar";



  const confirmPay = useMutation({
    mutationFn: async () => {
      if (!payTx || !payAccount) throw new Error("Escolha a conta que pagou");
      const { error } = await supabase.from("financial_transactions").update({
        status: "PAGO", pagamento: new Date().toISOString().slice(0, 10), account_id: payAccount,
      }).eq("id", payTx.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Pagamento confirmado");
      setPayTx(null); setPayAccount("");
      qc.invalidateQueries({ queryKey: ["fin-tx"] });
      qc.invalidateQueries({ queryKey: ["bank-accounts-balances"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="bg-white rounded-xl border border-slate-200/70 shadow-[0_1px_2px_rgba(15,23,42,0.04)] overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
          <p className="text-[11px] text-slate-500">{filtered.length} título{filtered.length === 1 ? "" : "s"}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Total em aberto</p>
            <p className={`text-xl font-bold tabular-nums ${kind === "PECAS" ? "text-amber-600" : "text-rose-600"}`}>{brl(total)}</p>
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40 h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="PENDENTE">Pendente</SelectItem>
              <SelectItem value="ATRASADO">Atrasado</SelectItem>
              <SelectItem value="PARCIAL">Parcial</SelectItem>
              <SelectItem value="PAGO">Pago</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      {filtered.length === 0 ? (
        <p className="py-12 text-sm text-slate-500 text-center">Nenhuma conta a pagar neste filtro</p>
      ) : (
        <div className="divide-y divide-slate-100 max-h-[600px] overflow-y-auto">
          {filtered.map((t: any) => (
            <div key={t.id} className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 items-center px-4 py-3 hover:bg-slate-50/60">
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-900 truncate">{t.descricao || t.companies?.trade_name || "—"}</p>
                <p className="text-[11px] text-slate-500 truncate">
                  Venc: {t.vencimento ? fmtData(t.vencimento) : "—"} · {t.forma_pagamento || "—"}
                  {t.bank_accounts?.nome && <span className="ml-1 text-slate-700">• {t.bank_accounts.nome}</span>}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Badge className={`${STATUS_COLORS[t.status] || ""} text-[10px] border`}>{t.status}</Badge>
                <span className="text-sm font-bold text-rose-600 tabular-nums w-24 text-right">{brl(Number(t.valor))}</span>
                {t.status !== "PAGO" && (
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { setPayTx({ id: t.id, valor: Number(t.valor), label: t.descricao || "—" }); setPayAccount(""); }}>Pagar</Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!payTx} onOpenChange={(o) => !o && setPayTx(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Confirmar pagamento</DialogTitle></DialogHeader>
          {payTx && (
            <div className="space-y-3">
              <div className="rounded-lg bg-slate-50 border border-slate-200 p-3">
                <p className="text-xs text-slate-500">Descrição</p>
                <p className="font-medium">{payTx.label}</p>
                <p className="text-xs text-slate-500 mt-2">Valor</p>
                <p className="text-lg font-bold text-rose-600 tabular-nums">{brl(payTx.valor)}</p>
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">De qual conta saiu?</label>
                <AccountSelect value={payAccount} onChange={setPayAccount} accounts={accounts} placeholder="Selecione a conta bancária" className="mt-1" />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayTx(null)}>Cancelar</Button>
            <Button disabled={!payAccount || confirmPay.isPending} onClick={() => confirmPay.mutate()}>Confirmar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AccountSelect({ value, onChange, accounts, placeholder, className }: { value: string; onChange: (v: string) => void; accounts: AccountBalance[]; placeholder?: string; className?: string }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className={className}><SelectValue placeholder={placeholder ?? "Conta bancária"} /></SelectTrigger>
      <SelectContent>
        {accounts.map((a) => (
          <SelectItem key={a.id} value={a.id}>
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full" style={{ background: a.cor }} />
              {a.nome} {a.banco ? `· ${a.banco}` : ""}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function BankAccountsPanel({ accounts }: { accounts: AccountBalance[] }) {
  const create = useCreateBankAccount();
  const del = useDeleteBankAccount();
  const transfer = useCreateBankTransfer();
  const [open, setOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [form, setForm] = useState({ nome: "", banco: "", tipo: "CORRENTE" as const, cor: "#6366f1", saldo_inicial: "0" });
  const [tForm, setTForm] = useState({ from_account_id: "", to_account_id: "", valor: "", observacao: "" });

  const totalGeral = accounts.reduce((s, a) => s + a.saldo, 0);

  const submitTransfer = () => {
    transfer.mutate(
      { from_account_id: tForm.from_account_id, to_account_id: tForm.to_account_id, valor: Number(tForm.valor), observacao: tForm.observacao || null },
      { onSuccess: () => { toast.success("Transferência registrada"); setTForm({ from_account_id: "", to_account_id: "", valor: "", observacao: "" }); setTransferOpen(false); }, onError: (e: any) => toast.error(e.message) }
    );
  };

  const submit = () => {
    if (!form.nome) { toast.error("Informe o nome"); return; }
    create.mutate(
      { nome: form.nome, banco: form.banco || null, tipo: form.tipo, cor: form.cor, saldo_inicial: Number(form.saldo_inicial) },
      { onSuccess: () => { toast.success("Conta cadastrada"); setForm({ nome: "", banco: "", tipo: "CORRENTE", cor: "#6366f1", saldo_inicial: "0" }); setOpen(false); }, onError: (e: any) => toast.error(e.message) }
    );
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200/70 shadow-[0_1px_2px_rgba(15,23,42,0.04)] p-4">
      <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-emerald-50 text-emerald-600 grid place-items-center">
            <Landmark className="w-4 h-4" strokeWidth={2.4} />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Contas bancárias</h2>
            <p className="text-[11px] text-slate-500">Saldo real: entradas − saídas por conta</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <p className="text-[10px] uppercase tracking-wider text-slate-500">Total geral</p>
            <p className={`text-base font-bold tabular-nums ${totalGeral >= 0 ? "text-slate-900" : "text-rose-600"}`}>{brl(totalGeral)}</p>
          </div>
          <Dialog open={transferOpen} onOpenChange={setTransferOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" className="h-8" disabled={accounts.length < 2}>
                <ArrowLeftRight className="w-3.5 h-3.5 mr-1" /> Transferir
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Transferência entre contas</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">De</label>
                  <AccountSelect value={tForm.from_account_id} onChange={(v) => setTForm({ ...tForm, from_account_id: v })} accounts={accounts} placeholder="Conta de origem" className="mt-1" />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Para</label>
                  <AccountSelect value={tForm.to_account_id} onChange={(v) => setTForm({ ...tForm, to_account_id: v })} accounts={accounts.filter((a) => a.id !== tForm.from_account_id)} placeholder="Conta de destino" className="mt-1" />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Valor</label>
                  <Input type="number" step="0.01" placeholder="0,00" value={tForm.valor} onChange={(e) => setTForm({ ...tForm, valor: e.target.value })} className="mt-1 tabular-nums" />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Observação</label>
                  <Input placeholder="Ex.: acerto do mês" value={tForm.observacao} onChange={(e) => setTForm({ ...tForm, observacao: e.target.value })} className="mt-1" />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setTransferOpen(false)}>Cancelar</Button>
                <Button onClick={submitTransfer} disabled={transfer.isPending || !tForm.from_account_id || !tForm.to_account_id || !tForm.valor}>Transferir</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="h-8"><Plus className="w-3.5 h-3.5 mr-1" /> Nova conta</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Cadastrar conta bancária</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Nome</label>
                  <Input placeholder="Ex.: Itaú PJ" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} className="mt-1" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Banco</label>
                    <Input placeholder="Ex.: Itaú" value={form.banco} onChange={(e) => setForm({ ...form, banco: e.target.value })} className="mt-1" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Tipo</label>
                    <Select value={form.tipo} onValueChange={(v: any) => setForm({ ...form, tipo: v })}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="CORRENTE">Conta corrente</SelectItem>
                        <SelectItem value="POUPANCA">Poupança</SelectItem>
                        <SelectItem value="DINHEIRO">Dinheiro (caixa)</SelectItem>
                        <SelectItem value="CARTAO">Cartão</SelectItem>
                        <SelectItem value="OUTRO">Outro</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Saldo inicial</label>
                    <Input type="number" step="0.01" value={form.saldo_inicial} onChange={(e) => setForm({ ...form, saldo_inicial: e.target.value })} className="mt-1 tabular-nums" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Cor</label>
                    <Input type="color" value={form.cor} onChange={(e) => setForm({ ...form, cor: e.target.value })} className="mt-1 h-10 p-1" />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                <Button onClick={submit} disabled={create.isPending}>Cadastrar</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {accounts.length === 0 ? (
        <div className="text-center py-8 border-2 border-dashed border-slate-200 rounded-lg">
          <Banknote className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-500">Nenhuma conta cadastrada</p>
          <p className="text-xs text-slate-400 mt-1">Cadastre pelo menos uma conta para começar a controlar o saldo</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {accounts.map((a) => (
            <div key={a.id} className="relative rounded-xl border border-slate-200 p-3 bg-gradient-to-br from-white to-slate-50/50 group">
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-8 h-8 rounded-lg grid place-items-center shrink-0" style={{ background: a.cor + "22", color: a.cor }}>
                    <Landmark className="w-4 h-4" strokeWidth={2.4} />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate">{a.nome}</p>
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider">{a.banco || a.tipo}</p>
                  </div>
                </div>
                <button
                  onClick={() => confirm(`Desativar a conta ${a.nome}?`) && del.mutate(a.id)}
                  className="opacity-0 group-hover:opacity-100 transition text-slate-400 hover:text-rose-600"
                  aria-label="Excluir"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
              <p className={`text-xl font-bold tabular-nums ${a.saldo >= 0 ? "text-slate-900" : "text-rose-600"}`}>{brl(a.saldo)}</p>
              <div className="flex items-center gap-3 mt-1 text-[11px] text-slate-500 tabular-nums">
                <span className="text-emerald-600">↑ {brl(a.entradas)}</span>
                <span className="text-rose-600">↓ {brl(a.saidas)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

type OrderCostItem = { quantidade: number; preco_unitario: number; custo_unitario: number | null; products: { sku: string | null; nome: string | null } | null };
type OrderCostRow = { id: string; total: number; created_at: string; order_items: OrderCostItem[] | null };

function CustoPecasDialog({ open, onOpenChange, orders, rangeLabel }: { open: boolean; onOpenChange: (v: boolean) => void; orders: OrderCostRow[]; rangeLabel: string }) {
  const rows = useMemo(() => {
    return orders.map((o) => {
      const items = (o.order_items || [])
        .filter((i) => Number(i.custo_unitario || 0) > 0)
        .map((i) => {
          const custo = Number(i.custo_unitario || 0);
          const qtd = Number(i.quantidade || 0);
          return {
            sku: i.products?.sku || "—",
            nome: i.products?.nome || "—",
            quantidade: qtd,
            custo_unitario: custo,
            total: custo * qtd,
          };
        });
      const custoTotal = items.reduce((s, it) => s + it.total, 0);
      return { order: o, items, custoTotal };
    }).filter((r) => r.custoTotal > 0);
  }, [orders]);


  const totalGeral = rows.reduce((s, r) => s + r.custoTotal, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="shrink-0">
          <DialogTitle className="text-base">Detalhamento dos custos — {rangeLabel}</DialogTitle>
          <p className="text-[11px] text-slate-500">Custo total das peças: <span className="font-bold text-slate-900">{brl(totalGeral)}</span></p>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto pr-1">
          {rows.length === 0 ? (
            <div className="py-12 text-center">
              <Filter className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm text-slate-500">Nenhuma venda com custo de peças no período</p>
            </div>
          ) : (
            <div className="space-y-4">
              {rows.map((r) => (
                <div key={r.order.id} className="border border-slate-200 rounded-lg overflow-hidden">
                  <div className="bg-slate-50 px-3 py-2 border-b border-slate-200 flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-900">
                      Pedido {orderCodeHash(String(r.order.id))} — Venda {brl(Number(r.order.total))} · Custo {brl(r.custoTotal)}
                    </p>
                    <p className="text-[11px] text-slate-500">{fmtData((r.order.created_at || "").slice(0, 10))}</p>
                  </div>
                  <div className="hidden md:block">
                    <table className="w-full text-sm">
                      <thead className="text-[10px] uppercase tracking-wider text-slate-500 bg-slate-50/50">
                        <tr>
                          <th className="text-left font-semibold px-3 py-2 w-24">SKU</th>
                          <th className="text-left font-semibold px-3 py-2">Peça</th>
                          <th className="text-right font-semibold px-3 py-2 w-16">Qtd</th>
                          <th className="text-right font-semibold px-3 py-2 w-28">Custo un.</th>
                          <th className="text-right font-semibold px-3 py-2 w-28">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {r.items.map((it, idx) => (
                          <tr key={idx}>
                            <td className="px-3 py-2 text-xs text-slate-600 tabular-nums">{it.sku}</td>
                            <td className="px-3 py-2 text-slate-900">{it.nome}</td>
                            <td className="px-3 py-2 text-right tabular-nums text-slate-600">{it.quantidade}</td>
                            <td className="px-3 py-2 text-right tabular-nums text-slate-600">{brl(it.custo_unitario)}</td>
                            <td className="px-3 py-2 text-right tabular-nums font-medium text-slate-900">{brl(it.total)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="md:hidden divide-y divide-slate-100">
                    {r.items.map((it, idx) => (
                      <div key={idx} className="px-3 py-2 flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-900 truncate">{it.nome}</p>
                          <p className="text-[11px] text-slate-500">{it.sku} · {it.quantidade} un. · {brl(it.custo_unitario)}</p>
                        </div>
                        <p className="text-sm font-semibold tabular-nums text-slate-900">{brl(it.total)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <DialogFooter className="shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

