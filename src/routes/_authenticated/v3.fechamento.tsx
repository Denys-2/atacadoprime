import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { V2InternalShell } from "@/components/v2/InternalShell";
import { V2 } from "@/components/v2/theme";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowLeft, PiggyBank, HandCoins, Wallet, CheckCircle2, AlertCircle, Building2 } from "lucide-react";
import { brl, formatDate } from "@/lib/format";
import { toast } from "sonner";
import { useBankAccounts } from "@/hooks/use-bank-accounts";
import { CompanyMoneyCards } from "@/components/v2/CompanyMoneyCards";


function FechamentoErro({ error, reset }: { error: Error; reset: () => void }) {
  console.error("[fechamento]", error);
  return (
    <div className="p-8 text-center">
      <div className="text-lg font-semibold" style={{ color: V2.TEXT }}>Não foi possível abrir o fechamento</div>
      <div className="text-sm mt-2" style={{ color: V2.MUTED }}>{error?.message ?? "Erro inesperado"}</div>
      <div className="mt-4 flex justify-center gap-2">
        <Button onClick={() => reset()}>Tentar de novo</Button>
        <Link to="/v3/dashboard"><Button variant="outline">Voltar ao painel</Button></Link>
      </div>
    </div>
  );
}

export const Route = createFileRoute("/_authenticated/v3/fechamento")({
  head: () => ({ meta: [{ title: "Fechamento — Prime Automotive" }] }),
  component: FechamentoPage,
  errorComponent: FechamentoErro,
});

// Protege contra cache antigo/serializado que não seja array
function asArray<T>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}

// Converte "2026-07-01" -> "01/07/2026" sem quebrar com valor nulo/inválido

function brDate(v: string | null | undefined) {
  if (!v || typeof v !== "string") return "—";
  const parts = v.slice(0, 10).split("-");
  return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : v;
}


type Periodo = "semana" | "mes" | "mes_ant" | "custom";

function isoDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const y = x.getFullYear();
  const m = String(x.getMonth() + 1).padStart(2, "0");
  const day = String(x.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// Horário de Brasília fixo (-03:00) — evita contar venda do dia anterior/seguinte
const startOfDayIso = (d: string) => `${d}T00:00:00-03:00`;
const endOfDayIso = (d: string) => `${d}T23:59:59.999-03:00`;

function rangeFor(p: Periodo, from: string, to: string): { from: string; to: string } {
  const now = new Date();
  const today = new Date(now); today.setHours(0, 0, 0, 0);
  const startMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const endMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  const startPrev = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const endPrev = new Date(today.getFullYear(), today.getMonth(), 0);
  // Semana atual: domingo -> sábado (horário local/Brasília)
  const startWeek = new Date(today); startWeek.setDate(startWeek.getDate() - startWeek.getDay());
  const endWeek = new Date(startWeek); endWeek.setDate(endWeek.getDate() + 6);
  switch (p) {
    case "semana": return { from: isoDay(startWeek), to: isoDay(endWeek) };
    case "mes": return { from: isoDay(startMonth), to: isoDay(endMonth) };
    case "mes_ant": return { from: isoDay(startPrev), to: isoDay(endPrev) };
    case "custom": return { from: from || isoDay(startMonth), to: to || isoDay(endMonth) };
    default: return { from: isoDay(startMonth), to: isoDay(endMonth) };

  }
}

type OrderAgg = {
  id: string;
  created_at: string;
  total: number;
  fechamento_id: string | null;
  order_items: { quantidade: number; custo_unitario: number | null }[];
};

type Fechamento = {
  id: string;
  periodo_from: string;
  periodo_to: string;
  vendas_periodo: number;
  custo_pecas_periodo: number;
  taxas_periodo: number;
  despesas_periodo: number;
  despesa_viagem_periodo: number;
  despesa_empresa_periodo: number;
  lucro_liquido: number;
  pct_reserva: number;
  valor_reserva: number;
  valor_transferido: number;
  valor_retirada: number;
  valor_empresa_pendente?: number | null;
  account_id: string | null;
  account_id_pessoal: string | null;
  observacao: string | null;
  created_at: string;
};

function FechamentoPage() {
  const qc = useQueryClient();
  const today = isoDay(new Date());
  const [periodo, setPeriodo] = useState<Periodo>("semana");
  const [from, setFrom] = useState<string>(today);
  const [to, setTo] = useState<string>(today);
  const range = useMemo(() => rangeFor(periodo, from, to), [periodo, from, to]);

  const { data: bankAccountsRaw } = useBankAccounts();
  const bankAccounts = useMemo(() => asArray<NonNullable<typeof bankAccountsRaw>[number]>(bankAccountsRaw), [bankAccountsRaw]);
  const [accountId, setAccountId] = useState<string>("");
  const [accountIdPessoal, setAccountIdPessoal] = useState<string>("");
  useEffect(() => {
    if (!accountId && bankAccounts.length > 0) setAccountId(bankAccounts[0].id);
    if (!accountIdPessoal && bankAccounts.length > 1) setAccountIdPessoal(bankAccounts[1].id);
    else if (!accountIdPessoal && bankAccounts.length > 0) setAccountIdPessoal(bankAccounts[0].id);
  }, [bankAccounts, accountId, accountIdPessoal]);

  // % salva
  const { data: reinvestSetting } = useQuery({
    queryKey: ["setting", "reinvest_pct_receita"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("system_settings")
        .select("valor")
        .eq("chave", "reinvest_pct_receita")
        .maybeSingle();
      if (error) throw error;
      const v = (data?.valor as { pct?: number } | null)?.pct;
      return typeof v === "number" ? v : 0;
    },
  });
  const savedPct = reinvestSetting ?? 0;
  const [pctInput, setPctInput] = useState<string>("");
  useEffect(() => {
    if (reinvestSetting !== undefined) setPctInput(String(reinvestSetting));
  }, [reinvestSetting]);

  const savePct = useMutation({
    mutationFn: async (pct: number) => {
      const { error } = await supabase
        .from("system_settings")
        .upsert(
          { chave: "reinvest_pct_receita", categoria: "fechamento", valor: { pct } as never, descricao: "% da receita reservada como reinvestimento da empresa no fechamento" },
          { onConflict: "categoria,chave" },
        );
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["setting", "reinvest_pct_receita"] });
      toast.success("Percentual salvo");
    },
    onError: (e: Error) => toast.error(e.message || "Falha ao salvar"),
  });

  // Vendas do período (bruto)
  const { data: ordersRaw, isLoading: loadingOrders } = useQuery({
    queryKey: ["fechamento-orders", range.from, range.to],
    queryFn: async () => {
      const startISO = startOfDayIso(range.from);
      const endISO = endOfDayIso(range.to);
      const { data, error } = await supabase
        .from("orders")
        .select("id,created_at,total,fechamento_id,order_items(quantidade,custo_unitario)")
        .gte("created_at", startISO)
        .lte("created_at", endISO)
        .neq("status", "CANCELADO");
      if (error) throw error;
      return (data ?? []) as unknown as OrderAgg[];
    },
  });
  const orders = useMemo(() => asArray<OrderAgg>(ordersRaw), [ordersRaw]);

  const orderIds = useMemo(() => orders.map((o) => o.id), [orders]);


  // Financeiro vinculado às vendas do período (realizado + a receber, ambos brutos após rateio da taxa)
  const { data: finRowsRaw } = useQuery({
    queryKey: ["fechamento-fin-orders", orderIds.join(",")],
    enabled: orderIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financial_transactions")
        .select("id,order_id,valor,status,vencimento,pagamento,descricao,bandeira,parcela_num,parcelas_total")
        .eq("tipo", "RECEITA")
        .in("order_id", orderIds);
      if (error) throw error;
      return data ?? [];
    },
  });
  const finRows = useMemo(
    () => asArray<NonNullable<typeof finRowsRaw>[number]>(finRowsRaw),
    [finRowsRaw],
  );

  // Taxas de cartão do período (despesa financeira das vendas do período)
  const { data: cardFeeRowsRaw } = useQuery({
    queryKey: ["fechamento-taxas", orderIds.join(",")],
    enabled: orderIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financial_transactions")
        .select("valor,descricao,order_id")
        .eq("tipo", "DESPESA")
        .in("order_id", orderIds);
      if (error) throw error;
      return (data ?? []).filter((r) => /taxa.*cart[ãa]o/i.test(r.descricao ?? ""));
    },
  });
  const cardFeeRows = useMemo(
    () => asArray<NonNullable<typeof cardFeeRowsRaw>[number]>(cardFeeRowsRaw),
    [cardFeeRowsRaw],
  );

  // Parcelas pendentes de vendas JÁ acertadas (fora do período) — dinheiro que ainda vai entrar
  const { data: outrasReceberRaw } = useQuery({
    queryKey: ["fechamento-receber-antigos", orderIds.join(",")],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financial_transactions")
        .select("id,order_id,valor,status,vencimento,pagamento,descricao,bandeira,parcela_num,parcelas_total")
        .eq("tipo", "RECEITA")
        .in("status", ["PENDENTE", "PARCIAL", "ATRASADO"]);
      if (error) throw error;
      const atuais = new Set(orderIds);
      return (data ?? []).filter((r) => !r.order_id || !atuais.has(r.order_id));
    },
  });
  const outrasReceberRows = useMemo(
    () => asArray<NonNullable<typeof outrasReceberRaw>[number]>(outrasReceberRaw),
    [outrasReceberRaw],
  );


  // Parcelas pendentes (para o modal "A receber")
  const aReceberRows = useMemo(
    () => finRows.filter((r) => r.status === "PENDENTE" || r.status === "PARCIAL" || r.status === "ATRASADO"),
    [finRows],
  );

  const outrasReceberTotal = useMemo(
    () => outrasReceberRows.reduce((s, r) => s + Number(r.valor || 0), 0),
    [outrasReceberRows],
  );

  // Lista completa exibida no modal: período atual + acertos anteriores
  const receberTodos = useMemo(
    () => [
      ...aReceberRows.map((r) => ({ ...r, anterior: false })),
      ...outrasReceberRows.map((r) => ({ ...r, anterior: true })),
    ].sort((a, b) => String(a.vencimento ?? "").localeCompare(String(b.vencimento ?? ""))),
    [aReceberRows, outrasReceberRows],
  );


  // Despesas do período separadas: viagem vs operacionais/empresa
  const { data: expensesSplit = { trip: 0, company: 0, total: 0, tripRows: [] as { data: string; valor: number }[], companyRows: [] as { data: string; valor: number }[] } } = useQuery({
    queryKey: ["fechamento-expenses", range.from, range.to],
    queryFn: async () => {
      const startISO = startOfDayIso(range.from);
      const endISO = endOfDayIso(range.to);
      const [trip, fin] = await Promise.all([
        supabase.from("trip_expenses").select("valor,data").gte("data", range.from).lte("data", range.to),
        supabase
          .from("financial_transactions")
          .select("valor,descricao,created_at,vencimento,pagamento,purchase_order_id")
          .eq("tipo", "DESPESA")
          .gte("created_at", startISO)
          .lte("created_at", endISO),
      ]);
      if (trip.error) throw trip.error;
      if (fin.error) throw fin.error;
      const tripRows = (trip.data ?? []).map((r) => ({ data: String(r.data ?? "").slice(0, 10), valor: Number(r.valor || 0) }));
      const tripSum = tripRows.reduce((s, r) => s + r.valor, 0);
      const finCompany = (fin.data ?? [])
        .filter((r) => !/custo.*pe[çc]a/i.test(r.descricao ?? ""))
        .filter((r) => !/taxa.*cart[ãa]o/i.test(r.descricao ?? ""))
        .filter((r) => !/compra de (mercadoria|material)/i.test(r.descricao ?? ""))
        .filter((r) => !(r as { purchase_order_id?: string | null }).purchase_order_id);
      const companyRows = finCompany.map((r) => ({ data: String(r.created_at ?? "").slice(0, 10), valor: Number(r.valor || 0) }));
      const finCompanySum = companyRows.reduce((s, r) => s + r.valor, 0);
      return { trip: tripSum, company: finCompanySum, total: tripSum + finCompanySum, tripRows, companyRows };
    },
  });



  // Fechamentos que sobrepõem o período
  const { data: fechamentosSobrepostosRaw } = useQuery({
    queryKey: ["fechamentos-sobrepostos", range.from, range.to],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fechamentos" as never)
        .select("*")
        .lte("periodo_from", range.to)
        .gte("periodo_to", range.from)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Fechamento[];
    },
  });

  const fechamentosSobrepostos = useMemo(() => asArray<Fechamento>(fechamentosSobrepostosRaw), [fechamentosSobrepostosRaw]);

  // Reserva da empresa ainda não coberta por acertos anteriores
  const { data: reservaAbertaRaw } = useQuery({
    queryKey: ["fechamentos-reserva-pendente"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fechamentos" as never)
        .select("id,valor_empresa_pendente,periodo_to")
        .gt("valor_empresa_pendente", 0);
      if (error) throw error;
      return (data ?? []) as unknown as { id: string; valor_empresa_pendente: number; periodo_to: string }[];
    },
  });
  const reservaAberta = useMemo(
    () => asArray<{ id: string; valor_empresa_pendente: number; periodo_to: string }>(reservaAbertaRaw),
    [reservaAbertaRaw],
  );
  const compromissoAnterior = useMemo(
    () => reservaAberta.reduce((s, r) => s + Number(r.valor_empresa_pendente || 0), 0),
    [reservaAberta],
  );

  // Histórico completo
  const { data: historicoRaw } = useQuery({
    queryKey: ["fechamentos-historico"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fechamentos" as never)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as unknown as Fechamento[];
    },
  });


  const historico = useMemo(() => asArray<Fechamento>(historicoRaw), [historicoRaw]);

  const calc = useMemo(() => {
    const list = orders;
    const abertos = list.filter((o) => !o.fechamento_id);
    const abertoIds = new Set(abertos.map((o) => o.id));

    const sumTotal = (arr: OrderAgg[]) => arr.reduce((s, o) => s + Number(o.total || 0), 0);
    const sumCusto = (arr: OrderAgg[]) =>
      arr.reduce(
        (s, o) => s + (o.order_items || []).reduce((a, i) => a + Number(i.quantidade || 0) * Number(i.custo_unitario || 0), 0),
        0,
      );
    const sumTaxas = (ids?: Set<string>) =>
      cardFeeRows
        .filter((r) => !ids || ids.has(String((r as { order_id?: string }).order_id ?? "")))
        .reduce((s, r) => s + Number(r.valor || 0), 0);
    const sumRealizado = (ids?: Set<string>) =>
      finRows
        .filter((r) => r.status === "PAGO")
        .filter((r) => !ids || ids.has(String(r.order_id ?? "")))
        .reduce((s, r) => s + Number(r.valor || 0), 0);

    const despesasViagem = Number(expensesSplit.trip || 0);
    const despesasEmpresa = Number(expensesSplit.company || 0);
    const despesas = despesasViagem + despesasEmpresa;

    // ---- Período completo (blocos 1 e 2): número real, sem descontar acerto anterior
    const vendasBruto = sumTotal(list);
    const custo = sumCusto(list);
    const taxas = sumTaxas();
    const realizado = sumRealizado();
    const aReceber = Math.max(vendasBruto - realizado, 0);
    // Investimento/reserva incide sobre o TOTAL vendido (não apenas o recebido).
    const reserva = vendasBruto * (savedPct / 100);
    const lucroLiquido = vendasBruto - taxas - custo - despesas - reserva;
    const caixaLivre = Math.max(realizado - despesas - taxas, 0);

    // ---- Somente vendas ainda NÃO acertadas (bloco 3 = o que sai da conta hoje)
    const vendasBrutoAberto = sumTotal(abertos);
    const custoAberto = sumCusto(abertos);
    const taxasAberto = sumTaxas(abertoIds);
    const realizadoAberto = sumRealizado(abertoIds);
    // Despesas do período entram integralmente (mesma base do bloco 1)
    const despesasAberto = despesas;
    const despesasViagemAberto = despesasViagem;
    const despesasEmpresaAberto = despesasEmpresa;

    const reservaAberto = vendasBrutoAberto * (savedPct / 100);
    const lucroAberto = vendasBrutoAberto - taxasAberto - custoAberto - despesasAberto - reservaAberto;
    const caixaLivreAberto = Math.max(realizadoAberto - despesasAberto - taxasAberto, 0);

    // Só é possível transferir o que já está em caixa.
    // Prioridade: 1) sua retirada (lucro), 2) empresa (custo + reserva + compromisso reservado de acertos anteriores).
    const empresaPeriodo = custoAberto + reservaAberto;
    const totalIdealEmpresa = empresaPeriodo + compromissoAnterior;
    const lucroIdeal = Math.max(lucroAberto, 0);
    const retiradaIdeal = Math.min(lucroIdeal, caixaLivreAberto);
    const retiradaAguardando = Math.max(lucroIdeal - retiradaIdeal, 0);
    const empresaCaixaAgora = Math.max(Math.min(totalIdealEmpresa, caixaLivreAberto - retiradaIdeal), 0);
    const empresaAguardando = Math.max(totalIdealEmpresa - empresaCaixaAgora, 0);

    // ---- Quanto do período JÁ foi acertado: usamos o ÚLTIMO fechamento,
    // não a soma de todos. O usuário quer descontar no mês apenas o acerto
    // mais recente (ex: dia 24).
    const ultimoFechamento = fechamentosSobrepostos[0];
    const temUltimoFechamento = !!ultimoFechamento;

    // Acertos antigos foram gravados antes de existirem as colunas de despesa/taxa.
    // Nesses casos derivamos o valor pelas despesas lançadas até a data do acerto.
    const cutoff = temUltimoFechamento
      ? String(ultimoFechamento.created_at ?? ultimoFechamento.periodo_to ?? "").slice(0, 10)
      : "";
    const sumUpTo = (rows: { data: string; valor: number }[]) =>
      rows.filter((r) => !cutoff || (r.data && r.data <= cutoff)).reduce((s, r) => s + Number(r.valor || 0), 0);
    const pick = (stored: unknown, fallback: number) => {
      const v = Number(stored || 0);
      return v > 0 ? v : fallback;
    };

    const acertadosIds = new Set(list.filter((o) => o.fechamento_id).map((o) => o.id));
    const acertadosList = list.filter((o) => o.fechamento_id);

    const acertadoVendas = temUltimoFechamento ? pick(ultimoFechamento.vendas_periodo, sumTotal(acertadosList)) : sumTotal(acertadosList);
    const acertadoCusto = temUltimoFechamento ? pick(ultimoFechamento.custo_pecas_periodo, sumCusto(acertadosList)) : sumCusto(acertadosList);
    const acertadoTaxas = temUltimoFechamento ? pick(ultimoFechamento.taxas_periodo, sumTaxas(acertadosIds)) : sumTaxas(acertadosIds);
    const acertadoReserva = temUltimoFechamento
      ? pick(ultimoFechamento.valor_reserva, sumTotal(acertadosList) * (savedPct / 100))
      : sumTotal(acertadosList) * (savedPct / 100);
    const acertadoLucro = temUltimoFechamento ? pick(ultimoFechamento.lucro_liquido, lucroLiquido - lucroAberto) : lucroLiquido - lucroAberto;

    const jaDespesaViagem = temUltimoFechamento
      ? pick(ultimoFechamento.despesa_viagem_periodo, sumUpTo(expensesSplit.tripRows ?? []))
      : fechamentosSobrepostos.reduce((s, f) => s + Number(f.despesa_viagem_periodo || 0), 0);
    const jaDespesaEmpresa = temUltimoFechamento
      ? pick(ultimoFechamento.despesa_empresa_periodo, sumUpTo(expensesSplit.companyRows ?? []))
      : fechamentosSobrepostos.reduce((s, f) => s + Number(f.despesa_empresa_periodo || 0), 0);

    const jaTaxas = acertadoTaxas;
    const jaReserva = acertadoReserva;

    const temAcerto = temUltimoFechamento || list.some((o) => o.fechamento_id);
    const aReceberAberto = Math.max(vendasBrutoAberto - realizadoAberto, 0);

    return {
      vendas: realizado,
      vendasBruto,
      aReceber,
      taxas,
      custo, despesas, despesasViagem, despesasEmpresa,
      reserva,
      caixaLivre,
      lucroLiquido,
      // bloco 2 (mesma base do lucro líquido em aberto)
      realizadoAberto,
      aReceberAberto,
      taxasAberto,
      // bloco 3 (apenas vendas não acertadas)
      pedidosAbertos: abertos.length,
      vendasBrutoAberto,
      custoAberto,
      despesasAberto,
      despesasViagemAberto,
      despesasEmpresaAberto,
      reservaAberto,
      lucroAberto,
      caixaLivreAberto,
      retiradaIdeal, totalIdealEmpresa, lucroIdeal, retiradaAguardando,
      empresaCaixaAgora, empresaAguardando, empresaPeriodo, compromissoAnterior,

      jaEmpresa: temUltimoFechamento ? Number(ultimoFechamento.valor_transferido || 0) : fechamentosSobrepostos.reduce((s, f) => s + Number(f.valor_transferido || 0), 0),
      jaRetirada: temUltimoFechamento ? Number(ultimoFechamento.valor_retirada || 0) : fechamentosSobrepostos.reduce((s, f) => s + Number(f.valor_retirada || 0), 0),
      jaTaxas, jaReserva, jaDespesaViagem, jaDespesaEmpresa,
      temAcerto, acertadoVendas, acertadoCusto, acertadoReserva, acertadoLucro,
      pendenteEmpresa: empresaCaixaAgora,
      pendenteRetirada: retiradaIdeal,
      pedidos: list.length,
    };

  }, [orders, expensesSplit, savedPct, fechamentosSobrepostos, finRows, cardFeeRows, compromissoAnterior]);


  // Total do "A receber" exibido no card: parcelas em aberto do período + parcelas
  // pendentes de vendas já acertadas.
  const receberTotalCard = calc.aReceberAberto + outrasReceberTotal;

  /**
   * Quando o período selecionado já tem acerto(s) confirmado(s), mostra abaixo do
   * valor cheio quanto já foi acertado e quanto ainda falta. Sem acerto no período,
   * o card fica limpo (só o valor total).
   */
  const acertoBreakdown = (total: number, jaAcertado: number) => {
    if (!calc.temAcerto || jaAcertado <= 0) return undefined;
    const restante = Math.max(total - jaAcertado, 0);
    return [
      { label: "Já acertado", value: brl(jaAcertado), accent: "#94a3b8" },
      { label: "Restante", value: brl(restante), accent: restante > 0 ? "#16a34a" : "#94a3b8" },
    ];
  };


  const [obs, setObs] = useState<string>("");
  const [openReceber, setOpenReceber] = useState(false);


  const confirmar = useMutation({
    mutationFn: async () => {
      if (!accountId) throw new Error("Selecione a conta da empresa");
      if (calc.pendenteRetirada > 0 && !accountIdPessoal) throw new Error("Selecione a conta pessoal para a retirada");
      if (calc.pendenteEmpresa <= 0 && calc.pendenteRetirada <= 0) throw new Error("Não há valor pendente para transferir");
      if (calc.lucroAberto <= 0) throw new Error("As vendas ainda não acertadas não geram lucro — não há retirada a fazer");
      if (calc.retiradaIdeal <= 0) throw new Error("Após a reserva da empresa não sobra retirada pessoal — ajuste a % ou o período");
      const { data: { user } } = await supabase.auth.getUser();
      const { data: inserted, error } = await supabase.from("fechamentos" as never).insert({
        periodo_from: range.from,
        periodo_to: range.to,
        vendas_periodo: calc.vendasBrutoAberto,
        custo_pecas_periodo: calc.custoAberto,
        taxas_periodo: calc.taxasAberto,
        despesas_periodo: calc.despesasAberto,
        despesa_viagem_periodo: calc.despesasViagemAberto,
        despesa_empresa_periodo: calc.despesasEmpresaAberto,
        lucro_liquido: calc.lucroAberto,
        pct_reserva: savedPct,
        valor_reserva: calc.reservaAberto,
        valor_transferido: calc.pendenteEmpresa,
        valor_retirada: calc.pendenteRetirada,
        valor_empresa_pendente: calc.empresaAguardando,
        account_id: accountId,
        account_id_pessoal: calc.pendenteRetirada > 0 ? accountIdPessoal : null,
        observacao: obs || null,
        created_by: user?.id ?? null,
      } as never).select("id").single();
      if (error) throw error;

      // O compromisso reservado dos acertos anteriores foi absorvido por este acerto
      const idsReserva = reservaAberta.map((r) => r.id);
      if (idsReserva.length > 0) {
        const { error: resErr } = await supabase
          .from("fechamentos" as never)
          .update({ valor_empresa_pendente: 0 } as never)
          .in("id", idsReserva);
        if (resErr) throw resErr;
      }

      // Marca as vendas do período que ainda não estavam acertadas
      const ids = (orders ?? []).filter((o) => !o.fechamento_id).map((o) => o.id);
      if (ids.length > 0) {
        const { error: upErr } = await supabase
          .from("orders")
          .update({ fechamento_id: (inserted as unknown as { id: string }).id } as never)
          .in("id", ids);
        if (upErr) throw upErr;
      }

    },
    onSuccess: () => {
      toast.success("Fechamento registrado. Empresa e retirada pessoal transferidas.");
      setObs("");
      qc.invalidateQueries({ queryKey: ["fechamento-orders"] });
      qc.invalidateQueries({ queryKey: ["fechamentos-sobrepostos"] });
      qc.invalidateQueries({ queryKey: ["fechamentos-historico"] });
      qc.invalidateQueries({ queryKey: ["fechamentos-reserva-pendente"] });
      qc.invalidateQueries({ queryKey: ["bank-accounts-balances"] });
    },
    onError: (e: Error) => toast.error(e.message || "Falha ao registrar fechamento"),
  });

  const remover = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("fechamentos" as never).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Fechamento removido");
      qc.invalidateQueries({ queryKey: ["fechamento-orders"] });
      qc.invalidateQueries({ queryKey: ["fechamentos-sobrepostos"] });
      qc.invalidateQueries({ queryKey: ["fechamentos-historico"] });
      qc.invalidateQueries({ queryKey: ["fechamentos-reserva-pendente"] });
      qc.invalidateQueries({ queryKey: ["bank-accounts-balances"] });
    },
    onError: (e: Error) => toast.error(e.message || "Falha ao remover"),
  });

  const rangeLabel = `${range.from.split("-").reverse().join("/")} → ${range.to.split("-").reverse().join("/")}`;
  const accountNameById = (id: string | null) => bankAccounts.find((a) => a.id === id)?.nome ?? "—";

  return (
    <V2InternalShell
      title="Fechamento"
      eyebrow="Acerto de viagem/período"
      description="Confirme o acerto do período e transfira o valor de custos + reserva para o caixa da empresa."
      actions={
        <Link to="/v3/relatorios">
          <Button variant="outline"><ArrowLeft className="h-4 w-4 mr-2" /> Voltar</Button>
        </Link>
      }
    >
      {/* Filtros */}
      <div className="rounded-2xl border p-4 mb-4 flex flex-wrap items-end gap-3" style={{ borderColor: V2.GRAPHITE, background: V2.SURFACE }}>
        <div>
          <div className="text-xs mb-1" style={{ color: V2.MUTED }}>Período</div>
          <Select value={periodo} onValueChange={(v) => setPeriodo(v as Periodo)}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="semana">Esta semana (dom → sáb)</SelectItem>
              <SelectItem value="mes">Este mês</SelectItem>
              <SelectItem value="mes_ant">Mês anterior</SelectItem>
              <SelectItem value="custom">Personalizado</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {periodo === "custom" && (
          <>
            <div>
              <div className="text-xs mb-1" style={{ color: V2.MUTED }}>De</div>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" />
            </div>
            <div>
              <div className="text-xs mb-1" style={{ color: V2.MUTED }}>Até</div>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" />
            </div>
          </>
        )}
        <div className="ml-auto max-w-xs">
          <div className="text-xs mb-1" style={{ color: V2.MUTED }}>% de investimento sobre a venda total</div>
          <div className="flex gap-2">
            <Input
              type="number" inputMode="decimal" step="0.1" min="0" max="100"
              value={pctInput} onChange={(e) => setPctInput(e.target.value)}
              className="w-24" placeholder="0"
            />
            <Button
              variant="outline"
              onClick={() => {
                const n = Number(pctInput);
                if (!Number.isFinite(n) || n < 0 || n > 100) { toast.error("Informe 0 a 100"); return; }
                savePct.mutate(n);
              }}
              disabled={savePct.isPending || Number(pctInput) === savedPct}
            >
              {savePct.isPending ? "Salvando..." : "Salvar %"}
            </Button>
          </div>
          <div className="text-[11px] mt-1" style={{ color: V2.MUTED }}>
            Aplicada: <strong style={{ color: V2.TEXT }}>{savedPct}%</strong>. Isso apenas grava o percentual; para efetivar o acerto, use <strong>Confirmar fechamento</strong> abaixo.
          </div>
        </div>
      </div>

      <div className="text-xs mb-3 px-1" style={{ color: V2.MUTED }}>
        {rangeLabel} · {calc.pedidos} pedidos
      </div>

      {loadingOrders ? (
        <div className="rounded-2xl border p-8 text-center" style={{ borderColor: V2.GRAPHITE, background: V2.SURFACE, color: V2.MUTED }}>
          Carregando...
        </div>
      ) : (
        <>
          {/* BLOCO 1 — Demonstrativo contábil (visão de fechamento) */}
          <SectionBlock title="1. Demonstrativo do período" hint={`${rangeLabel} · ${calc.pedidos} pedidos · valores acumulados de todo o período selecionado`}>
            <ClosingStatement
              rows={[
                {
                  label: "Total de venda",
                  total: calc.vendasBruto,
                  jaAcertado: calc.acertadoVendas,
                  accent: "#0d7377",
                  bg: "#f0fdfa",
                  prefix: "",
                },
                {
                  label: "Taxas de cartão",
                  total: calc.taxas,
                  jaAcertado: calc.jaTaxas,
                  accent: "#0ea5e9",
                  bg: "#e0f2fe",
                  prefix: "(−) ",
                },
                {
                  label: "Custo de peças vendidas",
                  total: calc.custo,
                  jaAcertado: calc.acertadoCusto,
                  accent: "#16a34a",
                  bg: "#dcfce7",
                  prefix: "(−) ",
                },
                {
                  label: "Despesa de viagem",
                  total: calc.despesasViagem,
                  jaAcertado: calc.jaDespesaViagem,
                  accent: "#a855f7",
                  bg: "#f3e8ff",
                  prefix: "(−) ",
                },
                {
                  label: "Despesa da empresa",
                  total: calc.despesasEmpresa,
                  jaAcertado: calc.jaDespesaEmpresa,
                  accent: "#64748b",
                  bg: "#f8fafc",
                  prefix: "(−) ",
                },
                {
                  label: `Investimento (${savedPct}%)`,
                  total: calc.reserva,
                  jaAcertado: calc.jaReserva,
                  accent: "#0d7377",
                  bg: "#f0fdfa",
                  prefix: "(−) ",
                },
                {
                  label: "Lucro líquido",
                  total: calc.lucroLiquido,
                  jaAcertado: calc.acertadoLucro,
                  accent: "#f97316",
                  bg: "#ffedd5",
                  prefix: "= ",
                  bold: true,
                },
              ]}
            />
          </SectionBlock>

          {/* BLOCO 1.1 — Resumo em cards (mesma base, para referência rápida) */}
          <SectionBlock title="1.1 Resumo dos cards" hint="Mesmos números do demonstrativo acima, em formato compacto">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <KpiCard label="Vendas brutas" value={brl(calc.vendasBruto)} sub={`${calc.pedidos} pedidos`} icon={Wallet} accent="#0d7377" breakdown={acertoBreakdown(calc.vendasBruto, calc.acertadoVendas)} />
              <KpiCard label="(−) Taxas de cartão" value={brl(calc.taxas)} sub="Despesa financeira" icon={AlertCircle} accent="#0ea5e9" />
              <KpiCard label="(−) Custo das peças" value={brl(calc.custo)} sub="CMV — reposição do estoque" icon={Building2} accent="#16a34a" breakdown={acertoBreakdown(calc.custo, calc.acertadoCusto)} />
              <KpiCard label="(−) Despesa de viagem" value={brl(calc.despesasViagem)} sub="Combustível, hospedagem, alimentação" icon={AlertCircle} accent="#a855f7" />
              <KpiCard label="(−) Despesa da empresa" value={brl(calc.despesasEmpresa)} sub="Operacionais fora de viagem" icon={AlertCircle} accent="#64748b" />
              <KpiCard label={`(−) Reserva (${savedPct}%)`} value={brl(calc.reserva)} sub="Investimento sobre a venda total" icon={PiggyBank} accent="#0d7377" breakdown={acertoBreakdown(calc.reserva, calc.acertadoReserva)} />
              <KpiCard
                label="= Lucro líquido"
                value={brl(calc.lucroLiquido)}
                sub="Resultado do período inteiro"
                icon={Wallet}
                accent={calc.lucroLiquido > 0 ? "#f97316" : "#94a3b8"}
                breakdown={
                  calc.temAcerto
                    ? [
                        { label: "Lucro contábil das vendas já acertadas (só cálculo)", value: brl(calc.acertadoLucro), accent: "#94a3b8" },
                        { label: "✓ Retirada que você realmente recebeu nesses acertos", value: brl(calc.jaRetirada), accent: "#0d7377" },
                        { label: "Ficou na empresa (não sobrou caixa no dia do acerto)", value: brl(Math.max(calc.acertadoLucro - calc.jaRetirada, 0)), accent: "#f59e0b" },
                        { label: "Restante a retirar (vendas em aberto)", value: brl(calc.lucroAberto), accent: calc.lucroAberto > 0 ? "#16a34a" : "#94a3b8" },
                      ]
                    : undefined
                }
              />
            </div>
          </SectionBlock>

          {/* BLOCO 2 — Situação do caixa */}
          <SectionBlock title="2. Situação do caixa" hint="Mesma base do lucro líquido: somente as vendas ainda não acertadas">
            <div className="grid gap-3 sm:grid-cols-3">
              <KpiCard label="Já recebido" value={brl(calc.realizadoAberto)} sub="PIX/Débito/Dinheiro + parcelas pagas (não acertadas)" icon={Wallet} accent={V2.TEAL} />
              <KpiCard
                label="A receber"
                value={brl(receberTotalCard)}
                sub={`${receberTodos.length} parcela(s) · clique para ver`}
                icon={Building2}
                accent="#0ea5e9"
                onClick={() => setOpenReceber(true)}
              />


              <KpiCard label="Caixa livre hoje" value={brl(calc.caixaLivreAberto)} sub="Recebido − despesas − taxas" icon={HandCoins} accent={calc.caixaLivreAberto > 0 ? "#16a34a" : "#94a3b8"} />
            </div>

          </SectionBlock>

          {/* BLOCO 2.1 — Dinheiro da empresa (vendas já acertadas) */}
          <SectionBlock
            title="2.1 Dinheiro da empresa (vendas já acertadas)"
            hint="Parcelas de vendas cujo lucro você já retirou: o que entrar aqui é da empresa."
          >
            <CompanyMoneyCards />
          </SectionBlock>



          {/* BLOCO 3 — Este acerto (o que vai ser lançado agora) */}
          <SectionBlock title="3. Este acerto (o que sai da conta hoje)" hint={`Limitado ao caixa livre de ${brl(calc.caixaLivreAberto)}. Sua retirada primeiro; o que sobra vai para a empresa (custo + reserva) e o restante fica com a empresa nas parcelas a receber.`} highlight>
            <div className="grid gap-3 sm:grid-cols-2">
              <SettlementCard
                label="Sua retirada agora"
                value={brl(calc.pendenteRetirada)}
                icon={HandCoins}
                accent={calc.pendenteRetirada > 0 ? "#16a34a" : "#94a3b8"}
                lines={[
                  `Lucro líquido das ${calc.pedidosAbertos} venda(s) não acertada(s): ${brl(calc.lucroIdeal)}`,
                  `Fica para depois (aguardando parcelas): ${brl(calc.retiradaAguardando)}`,
                  `Já retirado em acertos anteriores: ${brl(calc.jaRetirada)} (não entra aqui)`,
                ]}
              />
              <SettlementCard
                label="Empresa agora"
                value={brl(calc.pendenteEmpresa)}
                icon={Building2}
                accent={calc.pendenteEmpresa > 0 ? "#16a34a" : "#94a3b8"}
                lines={[
                  `Custo das peças ${brl(calc.custoAberto)} + reserva ${brl(calc.reservaAberto)} = ${brl(calc.empresaPeriodo)}`,
                  `Reservado de acertos anteriores: ${brl(calc.compromissoAnterior)}`,
                  `Alvo total da empresa: ${brl(calc.totalIdealEmpresa)}`,
                  `Fica reservado p/ as próximas parcelas: ${brl(calc.empresaAguardando)}`,
                ]}
              />
            </div>
            <div className="mt-3 text-xs" style={{ color: V2.MUTED }}>
              Total deste acerto: <strong>{brl(calc.pendenteEmpresa + calc.pendenteRetirada)}</strong> — nunca maior que o caixa livre ({brl(calc.caixaLivreAberto)}).
            </div>
            {calc.empresaAguardando > 0 && (
              <div
                className="mt-3 rounded-xl px-4 py-3 text-sm"
                style={{ background: "#fff7ed", border: "1px solid #fed7aa", color: "#9a3412" }}
              >
                <strong>Reservado para a empresa: {brl(calc.empresaAguardando)}</strong> — esse valor fica comprometido no
                sistema e será coberto automaticamente pelas parcelas que entrarem. Ele já entra somado no próximo acerto,
                antes de qualquer nova retirada extra.
              </div>
            )}


          </SectionBlock>


          {/* Aviso de fechamentos já feitos */}
          {fechamentosSobrepostos.length > 0 && (
            <div className="rounded-2xl border p-4 mb-4 flex items-start gap-3" style={{ borderColor: "#f59e0b", background: "#fef3c7" }}>
              <AlertCircle className="h-5 w-5 mt-0.5 shrink-0" style={{ color: "#b45309" }} />
              <div className="text-sm flex-1" style={{ color: "#78350f" }}>
                <div className="font-semibold mb-1">Este período já teve {fechamentosSobrepostos.length} fechamento(s):</div>
                <ul className="space-y-0.5">
                  {fechamentosSobrepostos.map((f) => (
                    <li key={f.id}>
                      • {new Date(f.created_at).toLocaleDateString("pt-BR")} — empresa <strong>{brl(f.valor_transferido)}</strong> ({accountNameById(f.account_id)}) + retirada <strong>{brl(Number(f.valor_retirada || 0))}</strong> ({accountNameById(f.account_id_pessoal)})
                      {" "}({brDate(f.periodo_from)} → {brDate(f.periodo_to)})
                    </li>
                  ))}
                </ul>
                <div className="mt-2">Este acerto considera apenas as <strong>{calc.pedidosAbertos} venda(s) ainda não acertada(s)</strong>: empresa {brl(calc.pendenteEmpresa)} + retirada {brl(calc.pendenteRetirada)}.</div>
              </div>
            </div>
          )}

          {/* Painel de confirmação */}
          <div className="rounded-2xl border p-5 mb-6" style={{ borderColor: V2.GRAPHITE, background: V2.SURFACE }}>
            <div className="font-semibold mb-1" style={{ color: V2.TEXT }}>Confirmar fechamento</div>
            <div className="text-xs mb-3" style={{ color: V2.MUTED }}>
              Este passo efetiva o acerto: credita <strong>custo + reserva</strong> na conta da empresa e a sua <strong>retirada</strong> (lucro líquido − reserva) na conta pessoal.
            </div>
            <div className="grid gap-3 md:grid-cols-2 mb-3">
              <div>
                <div className="text-xs mb-1" style={{ color: V2.MUTED }}>Conta da empresa (custo + reserva)</div>
                <Select value={accountId} onValueChange={setAccountId}>
                  <SelectTrigger><SelectValue placeholder="Selecione a conta" /></SelectTrigger>
                  <SelectContent>
                    {bankAccounts.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.nome} — saldo atual {brl(a.saldo)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <div className="text-xs mb-1" style={{ color: V2.MUTED }}>Conta pessoal (sua retirada)</div>
                <Select value={accountIdPessoal} onValueChange={setAccountIdPessoal}>
                  <SelectTrigger><SelectValue placeholder="Selecione a conta pessoal" /></SelectTrigger>
                  <SelectContent>
                    {bankAccounts.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.nome} — saldo atual {brl(a.saldo)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="mb-3">
              <div className="text-xs mb-1" style={{ color: V2.MUTED }}>Observação (opcional)</div>
              <Textarea rows={2} value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Ex: Viagem Uberlândia → Barretos" />
            </div>

            {calc.lucroAberto <= 0 && (
              <div className="rounded-lg border p-3 mb-3 text-sm" style={{ borderColor: "#ef4444", background: "#fee2e2", color: "#991b1b" }}>
                <strong>Sem retirada pessoal:</strong> as vendas ainda não acertadas fecharam com lucro {brl(calc.lucroAberto)}. Não há como registrar retirada até que o resultado seja positivo.
              </div>
            )}
            {calc.lucroAberto > 0 && calc.retiradaIdeal <= 0 && (
              <div className="rounded-lg border p-3 mb-3 text-sm" style={{ borderColor: "#f59e0b", background: "#fef3c7", color: "#78350f" }}>
                <strong>Reserva consome todo o lucro:</strong> com {savedPct}% sobre a venda, a reserva ({brl(calc.reserva)}) é maior ou igual ao lucro das vendas não acertadas ({brl(calc.lucroAberto)}). Diminua a % para liberar retirada.
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t" style={{ borderColor: V2.GRAPHITE }}>
              <div className="text-sm space-y-0.5" style={{ color: V2.MUTED }}>
                <div>Empresa: <strong style={{ color: V2.TEXT }}>{brl(calc.pendenteEmpresa)}</strong></div>
                <div>Retirada: <strong style={{ color: V2.TEXT }}>{brl(calc.pendenteRetirada)}</strong></div>
              </div>
              <Button
                size="lg"
                onClick={() => confirmar.mutate()}
                disabled={
                  confirmar.isPending ||
                  !accountId ||
                  calc.lucroAberto <= 0 ||
                  calc.retiradaIdeal <= 0 ||
                  (calc.pendenteEmpresa <= 0 && calc.pendenteRetirada <= 0)
                }
                style={{ background: V2.SUCCESS, color: "#fff" }}
                className="shadow-lg hover:shadow-xl transition-all hover:brightness-105"
              >
                <CheckCircle2 className="h-5 w-5 mr-2" />
                {confirmar.isPending ? "Registrando..." : "Confirmar fechamento"}
              </Button>
            </div>
          </div>

          {/* Histórico */}
          <div className="rounded-2xl border overflow-hidden" style={{ borderColor: V2.GRAPHITE, background: V2.SURFACE }}>
            <div className="px-4 py-3 border-b font-semibold flex items-center justify-between" style={{ borderColor: V2.GRAPHITE, color: V2.TEXT }}>
              <span>Histórico de fechamentos</span>
              <span className="text-xs font-normal" style={{ color: V2.MUTED }}>{historico.length} registro(s)</span>
            </div>
            {historico.length === 0 ? (
              <div className="p-8 text-center text-sm" style={{ color: V2.MUTED }}>Nenhum fechamento registrado ainda.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left border-b" style={{ borderColor: V2.GRAPHITE, color: V2.MUTED }}>
                      <th className="px-4 py-2">Registrado em</th>
                      <th className="px-4 py-2">Período</th>
                      <th className="px-4 py-2 text-right">Vendas</th>
                      <th className="px-4 py-2 text-right">Custo</th>
                      <th className="px-4 py-2 text-right">Reserva</th>
                      <th className="px-4 py-2 text-right">Empresa</th>
                      <th className="px-4 py-2 text-right">Retirada</th>
                      <th className="px-4 py-2">Contas</th>
                      <th className="px-4 py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {historico.map((f) => (
                      <tr key={f.id} className="border-b" style={{ borderColor: V2.GRAPHITE }}>
                        <td className="px-4 py-2" style={{ color: V2.TEXT }}>{new Date(f.created_at).toLocaleDateString("pt-BR")}</td>
                        <td className="px-4 py-2" style={{ color: V2.TEXT }}>
                          {brDate(f.periodo_from)} → {brDate(f.periodo_to)}
                        </td>
                        <td className="px-4 py-2 text-right" style={{ color: V2.TEXT }}>{brl(Number(f.vendas_periodo))}</td>
                        <td className="px-4 py-2 text-right" style={{ color: V2.MUTED }}>{brl(Number(f.custo_pecas_periodo))}</td>
                        <td className="px-4 py-2 text-right" style={{ color: V2.MUTED }}>{brl(Number(f.valor_reserva))} <span className="text-xs">({Number(f.pct_reserva)}%)</span></td>
                        <td className="px-4 py-2 text-right font-semibold" style={{ color: "#16a34a" }}>{brl(Number(f.valor_transferido))}</td>
                        <td className="px-4 py-2 text-right font-semibold" style={{ color: "#16a34a" }}>{brl(Number(f.valor_retirada || 0))}</td>
                        <td className="px-4 py-2 text-xs" style={{ color: V2.TEXT }}>
                          <div>Emp: {accountNameById(f.account_id)}</div>
                          {f.account_id_pessoal && <div>Pes: {accountNameById(f.account_id_pessoal)}</div>}
                        </td>
                        <td className="px-4 py-2 text-right">
                          <Button
                            variant="ghost" size="sm"
                            onClick={() => {
                              if (confirm("Remover este fechamento? Os valores serão estornados dos saldos.")) remover.mutate(f.id);
                            }}
                            className="text-xs"
                          >
                            Remover
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      <Dialog open={openReceber} onOpenChange={setOpenReceber}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>A receber — {brl(calc.aReceber + outrasReceberTotal)} · {receberTodos.length} parcela(s)</DialogTitle>
          </DialogHeader>
          {receberTodos.length === 0 ? (
            <div className="p-6 text-center text-sm" style={{ color: V2.MUTED }}>Nenhuma parcela pendente.</div>
          ) : (
            <div className="max-h-[60vh] overflow-y-auto divide-y" style={{ borderColor: V2.GRAPHITE }}>
              {receberTodos.map((r) => (
                <div key={r.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate" style={{ color: V2.TEXT }}>
                      {r.descricao ?? "Recebível"}
                    </div>
                    <div className="text-xs mt-0.5" style={{ color: V2.MUTED }}>
                      Vence em <strong style={{ color: V2.TEXT }}>{formatDate(r.vencimento)}</strong>
                      {r.parcelas_total && r.parcelas_total > 1 ? ` · parcela ${r.parcela_num}/${r.parcelas_total}` : ""}
                      {r.bandeira ? ` · ${r.bandeira}` : ""}
                      {r.anterior ? (
                        <span className="ml-1 px-1.5 py-0.5 rounded" style={{ background: "#f59e0b22", color: "#b45309" }}>
                          acerto anterior
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <div className="text-sm font-semibold shrink-0" style={{ color: V2.TEXT }}>{brl(Number(r.valor || 0))}</div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </V2InternalShell>
  );
}

function ClosingStatement({
  rows,
}: {
  rows: {
    label: string;
    total: number;
    jaAcertado: number;
    accent: string;
    bg: string;
    prefix: string;
    bold?: boolean;
  }[];
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {rows.map((r) => {
        const restante = Math.max(r.total - r.jaAcertado, 0);
        return (
          <div
            key={r.label}
            className="rounded-2xl border p-4"
            style={{ borderColor: V2.GRAPHITE, background: r.bg }}
          >
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="text-sm" style={{ color: V2.TEXT, fontWeight: r.bold ? 700 : 500 }}>
                <span style={{ color: "#64748b" }}>{r.prefix}</span>
                {r.label}
              </div>
              <div className="h-7 w-7 rounded-full grid place-items-center shrink-0" style={{ background: `${r.accent}22`, color: r.accent }}>
                <div className="h-2.5 w-2.5 rounded-full" style={{ background: r.accent }} />
              </div>
            </div>

            <div className="text-2xl font-semibold tabular-nums mb-3" style={{ color: V2.TEXT }}>
              {brl(r.total)}
            </div>

            <div className="grid grid-cols-2 gap-3 pt-3 border-t" style={{ borderColor: `${r.accent}30` }}>
              <div>
                <div className="text-[11px] mb-0.5" style={{ color: "#94a3b8" }}>Já acertado</div>
                <div className="font-semibold tabular-nums text-sm" style={{ color: r.accent }}>{brl(r.jaAcertado)}</div>
              </div>
              <div>
                <div className="text-[11px] mb-0.5" style={{ color: "#94a3b8" }}>Restante</div>
                <div className="font-semibold tabular-nums text-sm" style={{ color: restante > 0 ? "#16a34a" : "#94a3b8" }}>{brl(restante)}</div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function KpiCard({ label, value, sub, icon: Icon, accent, onClick, breakdown }: { label: string; value: string; sub?: string; icon: typeof Wallet; accent: string; onClick?: () => void; breakdown?: { label: string; value: string; accent?: string }[] }) {
  const clickable = !!onClick;
  return (
    <div
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      onClick={onClick}
      onKeyDown={clickable ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick!(); } } : undefined}
      className={`rounded-2xl border p-4 ${clickable ? "cursor-pointer hover:brightness-105 transition" : ""}`}
      style={{ borderColor: V2.GRAPHITE, background: V2.SURFACE }}
    >
      <div className="flex items-center gap-2 mb-2">
        <div className="h-8 w-8 rounded-lg grid place-items-center" style={{ background: `${accent}22`, color: accent }}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="text-xs" style={{ color: V2.MUTED }}>{label}</div>
      </div>
      <div className="text-xl font-bold" style={{ color: V2.TEXT }}>{value}</div>
      {sub && <div className="text-xs mt-0.5" style={{ color: V2.MUTED }}>{sub}</div>}
      {breakdown && breakdown.length > 0 && (
        <div className="mt-3 pt-2 space-y-1 border-t" style={{ borderColor: V2.GRAPHITE }}>
          {breakdown.map((b) => (
            <div key={b.label} className="flex items-center justify-between gap-2 text-[11px]">
              <span style={{ color: V2.MUTED }}>{b.label}</span>
              <span className="font-semibold" style={{ color: b.accent ?? V2.TEXT }}>{b.value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


function SectionBlock({ title, hint, highlight, children }: { title: string; hint?: string; highlight?: boolean; children: React.ReactNode }) {
  return (
    <div
      className="rounded-2xl border p-4 mb-4"
      style={{
        borderColor: highlight ? V2.SUCCESS : V2.GRAPHITE,
        background: highlight ? "#f0fdf4" : "transparent",
      }}
    >
      <div className="mb-3">
        <div className="text-sm font-semibold" style={{ color: V2.TEXT }}>{title}</div>
        {hint && <div className="text-[11px] mt-0.5" style={{ color: V2.MUTED }}>{hint}</div>}
      </div>
      {children}
    </div>
  );
}

function SettlementCard({ label, value, lines, icon: Icon, accent }: { label: string; value: string; lines: string[]; icon: typeof Wallet; accent: string }) {
  return (
    <div className="rounded-2xl border p-5" style={{ borderColor: V2.GRAPHITE, background: V2.SURFACE }}>
      <div className="flex items-center gap-2 mb-2">
        <div className="h-8 w-8 rounded-lg grid place-items-center" style={{ background: `${accent}22`, color: accent }}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="text-xs" style={{ color: V2.MUTED }}>{label}</div>
      </div>
      <div className="text-3xl font-bold leading-tight" style={{ color: accent }}>{value}</div>
      <div className="mt-2 space-y-0.5">
        {lines.map((l) => (
          <div key={l} className="text-[11px]" style={{ color: V2.MUTED }}>{l}</div>
        ))}
      </div>
    </div>
  );
}
