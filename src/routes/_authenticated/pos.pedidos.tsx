import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { V2 } from "@/components/v2/theme";
import { Printer, Loader2, Trash2, RefreshCw, AlertTriangle, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { formatDateTime } from "@/lib/format";
import { printHTML } from "@/lib/pos-printer";
import { renderTicket, pagamentoLabel } from "@/lib/pos-templates";
import { orderCode, orderCodeHash } from "@/lib/order-code";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/pos/pedidos")({
  head: () => ({ meta: [{ title: "Pedidos — POS Prime" }] }),
  component: PosPedidos,
});

const brl = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

const PAGE_SIZE = 10;

function PosPedidos() {
  const qc = useQueryClient();
  const [toDelete, setToDelete] = useState<any | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [toPrint, setToPrint] = useState<any | null>(null);
  const [printing, setPrinting] = useState(false);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);

  const termo = q.trim();

  const { data, isLoading, error, isFetching, refetch } = useQuery({
    queryKey: ["pos", "recent-orders", termo, page],
    refetchOnMount: "always",
    staleTime: 0,
    queryFn: async () => {
      let companyIds: string[] | null = null;
      if (termo.length >= 2) {
        const like = `%${termo}%`;
        const { data: cs, error: cErr } = await supabase
          .from("companies")
          .select("id")
          .or(`legal_name.ilike.${like},trade_name.ilike.${like},tax_id.ilike.${like}`)
          .limit(200);
        if (cErr) throw cErr;
        companyIds = (cs ?? []).map((c) => c.id);
        if (companyIds.length === 0) return { rows: [] as any[], total: 0 };
      }

      let query = supabase
        .from("orders")
        .select(
          "id,total,status,created_at,company_id,companies(trade_name,legal_name),order_items(quantidade,preco_final,preco_unitario,products(nome)),payments(tipo,bandeira,valor,payload,created_at)",
          { count: "exact" },
        )
        .order("created_at", { ascending: false })
        .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
      if (companyIds) query = query.in("company_id", companyIds);

      const { data, error, count } = await query;
      if (error) throw error;
      return { rows: data ?? [], total: count ?? 0 };
    },
  });

  const orders = data?.rows ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));


  function clientName(o: any) {
    return o.companies?.trade_name ?? o.companies?.legal_name ?? "Cliente";
  }

  async function reprint(o: any) {
    const nome = clientName(o);
    const codigo = orderCode(o.id, nome);
    const itens = (o.order_items ?? []).map((it: any) => {
      const unit = Number(it.preco_final ?? it.preco_unitario ?? 0);
      const qtd = Number(it.quantidade);
      return {
        nome: it.products?.nome ?? "Item",
        qtd,
        unit,
        total: unit * qtd,
      };
    });
    const html = renderTicket({
      codigo,
      cliente: nome,
      data: formatDateTime(o.created_at),
      itens,
      subtotal: Number(o.total),
      total: Number(o.total),
      pagamento: (() => {
        const p = o.payments?.[0];
        const payload = (p?.payload ?? {}) as { modalidade?: string | null; parcelas?: number | null };
        return pagamentoLabel(p?.tipo, {
          modalidade: payload.modalidade ?? null,
          bandeira: p?.bandeira ?? null,
          parcelas: payload.parcelas ?? 1,
        });
      })(),
    });
    await printHTML(html);
  }

  async function confirmDelete() {
    if (!toDelete) return;
    setDeleting(true);
    try {
      // 1) Cancela: o banco estorna estoque, custo e receita automaticamente
      if (toDelete.status !== "CANCELADO") {
        const { error: cErr } = await supabase
          .from("orders")
          .update({ status: "CANCELADO" })
          .eq("id", toDelete.id);
        if (cErr) throw cErr;
      }
      // 2) Remove os lançamentos financeiros ligados ao pedido
      const { error: fErr } = await supabase
        .from("financial_transactions")
        .delete()
        .eq("order_id", toDelete.id);
      if (fErr) throw fErr;
      // 3) Apaga o pedido (itens e pagamentos saem em cascata)
      const { error: dErr } = await supabase.from("orders").delete().eq("id", toDelete.id);
      if (dErr) throw dErr;

      toast.success("Venda excluída, estoque e financeiro estornados");
      setToDelete(null);
      qc.invalidateQueries({ queryKey: ["pos"] });
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["orders-admin"] });
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["fin-tx"] });
      qc.invalidateQueries({ queryKey: ["bank-accounts-balances"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao excluir venda");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="p-3 space-y-2">
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-lg font-bold">Últimos pedidos</h1>
        <button
          onClick={() => refetch()}
          className="h-9 w-9 rounded-lg border flex items-center justify-center"
          style={{ borderColor: V2.LIGHT_BORDER, color: V2.TEAL }}
          aria-label="Atualizar"
        >
          <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 opacity-60" />
        <input
          value={q}
          onChange={(e) => { setQ(e.target.value); setPage(0); }}
          placeholder="Buscar cliente por nome ou CNPJ"
          className="w-full h-11 pl-8 pr-3 rounded-lg border text-sm outline-none"
          style={{ borderColor: V2.LIGHT_BORDER, background: "#fff" }}
        />
      </div>



      {isLoading && (
        <div className="flex justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      )}

      {error && (
        <div
          className="p-3 rounded-lg text-xs flex gap-2 items-start"
          style={{ background: "#fef2f2", color: "#b91c1c" }}
        >
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>Não foi possível carregar os pedidos: {(error as any)?.message}</span>
        </div>
      )}

      {orders.map((o: any) => (
        <div
          key={o.id}
          className="p-3 rounded-lg border flex items-center gap-2"
          style={{ background: V2.LIGHT_SURFACE, borderColor: V2.LIGHT_BORDER }}
        >
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold truncate">{clientName(o)}</div>
            <div className="text-[11px]" style={{ color: V2.LIGHT_MUTED }}>
              {orderCodeHash(o.id, clientName(o))} · {formatDateTime(o.created_at)} · {o.status}
            </div>
            <div className="font-bold text-sm mt-0.5" style={{ color: V2.TEAL }}>
              {brl(Number(o.total))}
            </div>
          </div>
          <button
            onClick={() => setToPrint(o)}
            className="h-10 w-10 rounded-lg border flex items-center justify-center shrink-0"
            style={{ borderColor: V2.LIGHT_BORDER, color: V2.TEAL }}
            aria-label="Reimprimir"
          >
            <Printer className="h-4 w-4" />
          </button>
          <button
            onClick={() => setToDelete(o)}
            className="h-10 w-10 rounded-lg border flex items-center justify-center shrink-0"
            style={{ borderColor: "#fecaca", color: "#dc2626" }}
            aria-label="Excluir venda"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ))}

      {!isLoading && !error && orders.length === 0 && (
        <div className="text-center py-10 text-sm" style={{ color: V2.LIGHT_MUTED }}>
          {termo ? "Nenhum pedido para esta busca." : "Nenhum pedido ainda."}
        </div>
      )}

      {!isLoading && !error && total > 0 && (
        <div className="flex items-center justify-between gap-2 pt-1">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="h-10 px-3 rounded-lg border flex items-center gap-1 text-sm disabled:opacity-40"
            style={{ borderColor: V2.LIGHT_BORDER, color: V2.TEAL }}
          >
            <ChevronLeft className="h-4 w-4" /> Anterior
          </button>
          <span className="text-[11px] text-center" style={{ color: V2.LIGHT_MUTED }}>
            Página {page + 1} de {totalPages}
            <br />
            {total} pedido{total === 1 ? "" : "s"}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            className="h-10 px-3 rounded-lg border flex items-center gap-1 text-sm disabled:opacity-40"
            style={{ borderColor: V2.LIGHT_BORDER, color: V2.TEAL }}
          >
            Próxima <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}

      <Dialog open={!!toDelete} onOpenChange={(v) => !v && setToDelete(null)}>
        <DialogContent className="max-w-[92vw] rounded-xl">
          <DialogHeader>
            <DialogTitle>Tem certeza que quer excluir esta venda?</DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-3 text-left">
                {toDelete && (
                  <div className="text-sm font-medium" style={{ color: V2.LIGHT_TEXT }}>
                    {clientName(toDelete)} · {brl(Number(toDelete.total))}
                  </div>
                )}
                <div
                  className="flex gap-2 rounded-lg p-3 text-xs leading-relaxed"
                  style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#b91c1c" }}
                >
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>
                    Atenção: a venda sai da lista, o estoque das peças volta e os lançamentos
                    financeiros (banco, taxas e recebíveis) são estornados. Esta ação não pode ser
                    desfeita.
                  </span>
                </div>
              </div>
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="gap-2">
            <Button variant="outline" className="h-11 flex-1" onClick={() => setToDelete(null)}>
              Cancelar
            </Button>
            <Button
              className="h-11 flex-1 font-semibold"
              style={{ background: "#dc2626", color: "#fff" }}
              disabled={deleting}
              onClick={confirmDelete}
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Excluir"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!toPrint} onOpenChange={(v) => !v && setToPrint(null)}>
        <DialogContent className="max-w-[92vw] rounded-xl">
          <DialogHeader>
            <DialogTitle>Imprimir este pedido?</DialogTitle>
            <DialogDescription asChild>
              <div className="text-sm" style={{ color: V2.LIGHT_TEXT }}>
                {toPrint && (
                  <>
                    {clientName(toPrint)} · {brl(Number(toPrint.total))}
                  </>
                )}
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" className="h-11 flex-1" onClick={() => setToPrint(null)}>
              Cancelar
            </Button>
            <Button
              className="h-11 flex-1 font-semibold"
              style={{ background: V2.TEAL, color: "#fff" }}
              disabled={printing}
              onClick={async () => {
                if (!toPrint) return;
                setPrinting(true);
                try {
                  await reprint(toPrint);
                  setToPrint(null);
                } catch (e: any) {
                  toast.error(e?.message ?? "Erro ao imprimir");
                } finally {
                  setPrinting(false);
                }
              }}
            >
              {printing ? <Loader2 className="h-4 w-4 animate-spin" /> : "Imprimir"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>

  );
}
