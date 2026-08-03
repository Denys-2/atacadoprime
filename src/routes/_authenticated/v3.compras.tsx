import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { V2InternalShell } from "@/components/v2/InternalShell";
import { V2 } from "@/components/v2/theme";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useBankAccounts } from "@/hooks/use-bank-accounts";
import { toast } from "sonner";
import { brl, formatDate } from "@/lib/format";
import { Boxes, Calendar, Package, Plus, ShoppingCart, Trash2, Truck } from "lucide-react";
import { deletePurchaseOrder } from "@/lib/purchase.functions";

export const Route = createFileRoute("/_authenticated/v3/compras")({

  head: () => ({ meta: [{ title: "Compra de material — Prime Automotive" }] }),
  component: PurchasePage,
});

type ProductRow = { id: string; nome: string; sku: string | null; estoque: number | null; preco_custo: number | null };
type CartLine = { product_id: string; nome: string; quantidade: string; custo: string };

const todayISO = () => new Date().toISOString().slice(0, 10);
const plusDays = (days: number) => new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);

function PurchasePage() {
  const qc = useQueryClient();
  const { data: accounts = [] } = useBankAccounts();

  const [supplierId, setSupplierId] = useState("");
  const [data, setData] = useState(todayISO());
  const [condicao, setCondicao] = useState<"AVISTA" | "PRAZO">("AVISTA");
  const [accountId, setAccountId] = useState("");
  const [vencimento, setVencimento] = useState(plusDays(30));
  const [frete, setFrete] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [lines, setLines] = useState<CartLine[]>([]);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  const { data: suppliers = [] } = useQuery({
    queryKey: ["purchase-suppliers"],

    queryFn: async () => {
      const { data, error } = await supabase.from("suppliers").select("id,razao_social,nome_fantasia").order("razao_social");
      if (error) throw error;
      return data ?? [];
    },
  });

  const [newSupplierOpen, setNewSupplierOpen] = useState(false);
  const [newSupplierName, setNewSupplierName] = useState("");

  const createSupplier = useMutation({
    mutationFn: async () => {
      const nome = newSupplierName.trim();
      if (!nome) throw new Error("Informe o nome do fornecedor");
      const { data, error } = await supabase
        .from("suppliers")
        .insert({ razao_social: nome, nome_fantasia: nome })
        .select("id,razao_social,nome_fantasia")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (row) => {
      qc.invalidateQueries({ queryKey: ["purchase-suppliers"] });
      setSupplierId(row.id);
      setNewSupplierName("");
      setNewSupplierOpen(false);
      toast.success("Fornecedor cadastrado");
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao cadastrar fornecedor"),
  });

  const { data: products = [] } = useQuery({
    queryKey: ["purchase-products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id,nome,sku,estoque,preco_custo")
        .order("nome")
        .limit(1000);
      if (error) throw error;
      return (data ?? []) as ProductRow[];
    },
  });

  const { data: history = [], isLoading } = useQuery({
    queryKey: ["purchase-orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("purchase_orders")
        .select("id,status,valor_total,data_emissao,observacoes,suppliers(razao_social,nome_fantasia)")
        .order("data_emissao", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const filteredProducts = useMemo(() => {
    const q = productSearch.trim().toLowerCase();
    if (!q) return [];
    return products
      .filter((p) => `${p.nome} ${p.sku ?? ""}`.toLowerCase().includes(q))
      .filter((p) => !lines.some((l) => l.product_id === p.id))
      .slice(0, 8);
  }, [products, productSearch, lines]);

  const totalItens = useMemo(
    () => lines.reduce((s, l) => s + Number(l.quantidade || 0) * Number(l.custo || 0), 0),
    [lines],
  );
  const total = totalItens + Number(frete || 0);

  function addLine(p: ProductRow) {
    setLines((prev) => [
      ...prev,
      { product_id: p.id, nome: p.nome, quantidade: "1", custo: String(p.preco_custo ?? "") },
    ]);
    setProductSearch("");
  }

  function updateLine(id: string, patch: Partial<CartLine>) {
    setLines((prev) => prev.map((l) => (l.product_id === id ? { ...l, ...patch } : l)));
  }

  const save = useMutation({
    mutationFn: async () => {
      if (lines.length === 0) throw new Error("Adicione pelo menos um produto");
      for (const l of lines) {
        if (Number(l.quantidade) <= 0) throw new Error(`Quantidade inválida em ${l.nome}`);
        if (Number(l.custo) <= 0) throw new Error(`Custo inválido em ${l.nome}`);
      }
      if (condicao === "AVISTA" && !accountId) throw new Error("Escolha a conta que pagou a compra");

      const { data: po, error: poError } = await supabase
        .from("purchase_orders")
        .insert({
          supplier_id: supplierId || null,
          status: "RECEBIDO",
          valor_total: total,
          data_emissao: data,
          data_recebimento: data,
          observacoes: observacoes || null,
        })
        .select("id")
        .single();
      if (poError) throw poError;

      const { error: itemsError } = await supabase.from("purchase_order_items").insert(
        lines.map((l) => ({
          purchase_order_id: po.id,
          product_id: l.product_id,
          quantidade: Number(l.quantidade),
          quantidade_recebida: Number(l.quantidade),
          valor_unitario: Number(l.custo),
        })),
      );
      if (itemsError) throw itemsError;

      // Entrada no estoque + atualização do custo do produto
      for (const l of lines) {
        const { error: stockError } = await supabase.rpc("stock_apply_delta", {
          _product_id: l.product_id,
          _delta: Number(l.quantidade),
          _tipo: "ENTRADA",
          _motivo: `Compra ${po.id.slice(0, 8)}`,
          _ref: po.id,
          _allow_negative: true,
        });
        if (stockError) throw stockError;
        const { error: costError } = await supabase
          .from("products")
          .update({ preco_custo: Number(l.custo) })
          .eq("id", l.product_id);
        if (costError) throw costError;
      }

      // Financeiro: contas a pagar / pagamento à vista
      const supplierName =
        suppliers.find((s: any) => s.id === supplierId)?.nome_fantasia ||
        suppliers.find((s: any) => s.id === supplierId)?.razao_social ||
        "fornecedor";
      const { error: finError } = await supabase.from("financial_transactions").insert({
        tipo: "DESPESA",
        status: condicao === "AVISTA" ? "PAGO" : "PENDENTE",
        valor: total,
        valor_bruto: total,
        vencimento: condicao === "AVISTA" ? data : vencimento,
        pagamento: condicao === "AVISTA" ? data : null,
        descricao: `Compra de mercadoria — ${supplierName}`,
        forma_pagamento: "OUTRO",
        account_id: condicao === "AVISTA" ? accountId : null,
        purchase_order_id: po.id,
      });
      if (finError) throw finError;

      return po.id;

    },
    onSuccess: () => {
      toast.success("Compra lançada: estoque e financeiro atualizados");
      setLines([]);
      setFrete("");
      setObservacoes("");
      qc.invalidateQueries({ queryKey: ["purchase-orders"] });
      qc.invalidateQueries({ queryKey: ["purchase-products"] });
      qc.invalidateQueries({ queryKey: ["fin-transactions"] });
      qc.invalidateQueries({ queryKey: ["bank-accounts-balances"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteFn = useServerFn(deletePurchaseOrder);

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await deleteFn({ data: { purchaseOrderId: id } });
    },
    onSuccess: () => {
      toast.success("Compra excluída: estoque e financeiro revertidos");
      setDeleteTargetId(null);
      qc.invalidateQueries({ queryKey: ["purchase-orders"] });
      qc.invalidateQueries({ queryKey: ["purchase-products"] });
      qc.invalidateQueries({ queryKey: ["fin-transactions"] });
      qc.invalidateQueries({ queryKey: ["bank-accounts-balances"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao excluir compra"),
  });



  const label = (t: string) => (
    <label className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: V2.MUTED }}>
      {t}
    </label>
  );
  const inputStyle = { background: V2.BG, borderColor: V2.GRAPHITE, color: V2.TEXT };

  return (
    <V2InternalShell
      title="Compra de material"
      eyebrow="Entrada de mercadoria"
      description="Lance a nota do fornecedor: dá entrada no estoque, atualiza o custo das peças e gera o financeiro."
      actions={
        <Link to="/v3/financeiro">
          <Button variant="outline" style={{ borderColor: V2.GRAPHITE, color: V2.TEXT }}>
            Ver financeiro
          </Button>
        </Link>
      }
    >
      <div className="grid gap-6">
        <section className="rounded-2xl border p-4 lg:p-5" style={{ background: V2.SURFACE, borderColor: V2.GRAPHITE }}>
          <div className="flex items-center gap-2 mb-4">
            <div className="h-8 w-8 rounded-lg grid place-items-center" style={{ background: V2.TEAL_LIGHT, color: V2.TEAL }}>
              <Truck className="h-4 w-4" />
            </div>
            <h3 className="text-sm font-semibold" style={{ color: V2.TEXT }}>Dados da compra</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="sm:col-span-2">
              <div className="flex items-center justify-between">
                {label("Fornecedor")}
                <button
                  type="button"
                  onClick={() => setNewSupplierOpen((v) => !v)}
                  className="text-xs font-medium"
                  style={{ color: V2.TEAL }}
                >
                  {newSupplierOpen ? "Cancelar" : "+ Novo fornecedor"}
                </button>
              </div>
              {newSupplierOpen ? (
                <div className="mt-1 flex gap-2">
                  <Input
                    autoFocus
                    placeholder="Nome do fornecedor"
                    value={newSupplierName}
                    onChange={(e) => setNewSupplierName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); createSupplier.mutate(); } }}
                    style={inputStyle}
                  />
                  <Button
                    type="button"
                    onClick={() => createSupplier.mutate()}
                    disabled={createSupplier.isPending || !newSupplierName.trim()}
                    style={{ background: V2.TEAL, color: "#fff" }}
                  >
                    Salvar
                  </Button>
                </div>
              ) : (
                <Select value={supplierId} onValueChange={setSupplierId}>
                  <SelectTrigger className="mt-1" style={inputStyle}>
                    <SelectValue placeholder="Selecionar fornecedor" />
                  </SelectTrigger>
                  <SelectContent style={{ background: V2.SURFACE, borderColor: V2.GRAPHITE }}>
                    {suppliers.map((s: any) => (
                      <SelectItem key={s.id} value={s.id}>{s.nome_fantasia || s.razao_social}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div>
              {label("Data da nota")}
              <Input type="date" value={data} onChange={(e) => setData(e.target.value)} className="mt-1" style={inputStyle} />
            </div>
            <div>
              {label("Frete / outros (R$)")}
              <Input
                type="number"
                step="0.01"
                placeholder="0,00"
                value={frete}
                onChange={(e) => setFrete(e.target.value)}
                className="mt-1 tabular-nums"
                style={inputStyle}
              />
            </div>
            <div>
              {label("Condição")}
              <Select value={condicao} onValueChange={(v) => setCondicao(v as "AVISTA" | "PRAZO")}>
                <SelectTrigger className="mt-1" style={inputStyle}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent style={{ background: V2.SURFACE, borderColor: V2.GRAPHITE }}>
                  <SelectItem value="AVISTA">À vista (já paguei)</SelectItem>
                  <SelectItem value="PRAZO">A prazo (conta a pagar)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {condicao === "AVISTA" ? (
              <div className="sm:col-span-2">
                {label("Conta que pagou")}
                <Select value={accountId} onValueChange={setAccountId}>
                  <SelectTrigger className="mt-1" style={inputStyle}>
                    <SelectValue placeholder="Escolher conta" />
                  </SelectTrigger>
                  <SelectContent style={{ background: V2.SURFACE, borderColor: V2.GRAPHITE }}>
                    {accounts.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        <span className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full" style={{ background: a.cor }} />
                          {a.nome}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div>
                {label("Vencimento")}
                <Input type="date" value={vencimento} onChange={(e) => setVencimento(e.target.value)} className="mt-1" style={inputStyle} />
              </div>
            )}
            <div className="sm:col-span-2 lg:col-span-1">
              {label("Observações")}
              <Input
                placeholder="Nº da nota, pedido..."
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                className="mt-1"
                style={inputStyle}
              />
            </div>
          </div>
        </section>

        <section className="rounded-2xl border p-4 lg:p-5" style={{ background: V2.SURFACE, borderColor: V2.GRAPHITE }}>
          <div className="flex items-center gap-2 mb-4">
            <div className="h-8 w-8 rounded-lg grid place-items-center" style={{ background: V2.TEAL_LIGHT, color: V2.TEAL }}>
              <Boxes className="h-4 w-4" />
            </div>
            <h3 className="text-sm font-semibold" style={{ color: V2.TEXT }}>Itens comprados</h3>
          </div>

          <div className="relative">
            <Input
              placeholder="Buscar produto por nome ou SKU..."
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
              style={inputStyle}
            />
            {filteredProducts.length > 0 && (
              <div
                className="absolute z-20 left-0 right-0 mt-1 rounded-xl border overflow-hidden"
                style={{ background: V2.SURFACE, borderColor: V2.GRAPHITE }}
              >
                {filteredProducts.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => addLine(p)}
                    className="w-full text-left px-3 py-2 text-sm transition hover:opacity-80"
                    style={{ color: V2.TEXT }}
                  >
                    <span className="font-medium">{p.nome}</span>
                    <span className="ml-2 text-[11px]" style={{ color: V2.MUTED }}>
                      SKU {p.sku ?? "—"} · estoque {p.estoque ?? 0}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {lines.length === 0 ? (
            <div className="text-center py-10 mt-4 border-2 border-dashed rounded-xl" style={{ borderColor: V2.GRAPHITE }}>
              <Package className="h-8 w-8 mx-auto mb-2" style={{ color: V2.MUTED }} />
              <p className="text-sm" style={{ color: V2.MUTED }}>Busque um produto acima para adicionar à compra</p>
            </div>
          ) : (
            <div className="space-y-2 mt-4">
              {lines.map((l) => (
                <div
                  key={l.product_id}
                  className="grid grid-cols-12 gap-2 items-center p-3 rounded-xl border"
                  style={{ background: V2.BG, borderColor: V2.GRAPHITE }}
                >
                  <span className="col-span-12 sm:col-span-5 text-sm font-medium truncate" style={{ color: V2.TEXT }}>
                    {l.nome}
                  </span>
                  <div className="col-span-4 sm:col-span-2">
                    {label("Qtd")}
                    <Input
                      type="number"
                      step="1"
                      value={l.quantidade}
                      onChange={(e) => updateLine(l.product_id, { quantidade: e.target.value })}
                      className="mt-1 tabular-nums"
                      style={inputStyle}
                    />
                  </div>
                  <div className="col-span-5 sm:col-span-2">
                    {label("Custo un.")}
                    <Input
                      type="number"
                      step="0.01"
                      value={l.custo}
                      onChange={(e) => updateLine(l.product_id, { custo: e.target.value })}
                      className="mt-1 tabular-nums"
                      style={inputStyle}
                    />
                  </div>
                  <span className="col-span-2 text-sm font-semibold tabular-nums text-right" style={{ color: V2.TEXT }}>
                    {brl(Number(l.quantidade || 0) * Number(l.custo || 0))}
                  </span>
                  <button
                    onClick={() => setLines((prev) => prev.filter((x) => x.product_id !== l.product_id))}
                    className="col-span-1 p-2 rounded-lg justify-self-end"
                    style={{ color: "#dc2626", background: "#dc262612" }}
                    aria-label="Remover item"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t" style={{ borderColor: V2.GRAPHITE }}>
                <div>
                  <p className="text-[11px] uppercase tracking-wider font-semibold" style={{ color: V2.MUTED }}>
                    Total da compra
                  </p>
                  <p className="text-xl font-semibold tabular-nums" style={{ color: V2.TEXT }}>{brl(total)}</p>
                  <p className="text-[11px]" style={{ color: V2.MUTED }}>
                    {lines.length} item(ns) · mercadoria {brl(totalItens)} + frete {brl(Number(frete || 0))}
                  </p>
                </div>
                <Button
                  onClick={() => save.mutate()}
                  disabled={save.isPending || lines.length === 0}
                  style={{ background: V2.SUCCESS, color: "#fff" }}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  {save.isPending ? "Lançando..." : "Lançar compra"}
                </Button>
              </div>
            </div>
          )}
        </section>

        <section className="rounded-2xl border p-4" style={{ background: V2.SURFACE, borderColor: V2.GRAPHITE }}>
          <div className="flex items-center gap-2 mb-4">
            <ShoppingCart className="h-4 w-4" style={{ color: V2.TEAL }} />
            <h3 className="text-sm font-semibold" style={{ color: V2.TEXT }}>Compras recentes</h3>
          </div>
          {isLoading ? (
            <p className="text-sm py-8 text-center" style={{ color: V2.MUTED }}>Carregando...</p>
          ) : history.length === 0 ? (
            <p className="text-sm py-8 text-center" style={{ color: V2.MUTED }}>Nenhuma compra registrada ainda</p>
          ) : (
            <div className="space-y-2">
              {history.map((h) => (
                <div
                  key={h.id}
                  className="flex items-center justify-between gap-3 p-3 rounded-xl border"
                  style={{ background: V2.BG, borderColor: V2.GRAPHITE }}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold truncate" style={{ color: V2.TEXT }}>
                      {h.suppliers?.nome_fantasia || h.suppliers?.razao_social || "Sem fornecedor"}
                    </p>
                    <div className="flex items-center gap-2 mt-1 text-[11px]" style={{ color: V2.MUTED }}>
                      <Calendar className="h-3 w-3" />
                      {formatDate(h.data_emissao)}
                      <span className="w-1 h-1 rounded-full" style={{ background: V2.MUTED }} />
                      {h.status}
                      {h.observacoes ? <span className="truncate">· {h.observacoes}</span> : null}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold tabular-nums" style={{ color: V2.TEXT }}>{brl(h.valor_total)}</span>
                    <button
                      onClick={() => setDeleteTargetId(h.id)}
                      className="p-2 rounded-lg"
                      style={{ color: "#dc2626", background: "#dc262612" }}
                      aria-label="Excluir compra"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <AlertDialog open={!!deleteTargetId} onOpenChange={(open) => !open && setDeleteTargetId(null)}>
        <AlertDialogContent style={{ background: V2.SURFACE, borderColor: V2.GRAPHITE }}>
          <AlertDialogHeader>
            <AlertDialogTitle style={{ color: V2.TEXT }}>Tem certeza?</AlertDialogTitle>
            <AlertDialogDescription style={{ color: V2.MUTED }}>
              Excluir esta compra reverte a entrada no estoque e remove o lançamento financeiro. Essa ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => setDeleteTargetId(null)}
              className="border"
              style={{ borderColor: V2.GRAPHITE, color: V2.TEXT, background: V2.BG }}
            >
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTargetId && deleteMutation.mutate(deleteTargetId)}
              disabled={deleteMutation.isPending}
              style={{ background: "#dc2626", color: "#fff" }}
            >
              {deleteMutation.isPending ? "Excluindo..." : "Sim, excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </V2InternalShell>
  );
}

