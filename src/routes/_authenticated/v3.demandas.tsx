import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { V2InternalShell } from "@/components/v2/InternalShell";
import { V2 } from "@/components/v2/theme";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { formatDate } from "@/lib/format";
import { Check, ClipboardList, Package, PackageSearch, Plus, Trash2, X } from "lucide-react";

export const Route = createFileRoute("/_authenticated/v3/demandas")({
  head: () => ({
    meta: [
      { title: "Demanda de produtos — Prime Automotive" },
      {
        name: "description",
        content: "Registre peças que os clientes pedem e você ainda não tem, e monte a lista de compras.",
      },
      { property: "og:title", content: "Demanda de produtos — Prime Automotive" },
      {
        property: "og:description",
        content: "Lista de produtos a comprar a partir do que os clientes procuram.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DemandasPage,
});

type ProductRow = { id: string; nome: string; sku: string | null; estoque: number | null };

type RequestRow = {
  id: string;
  product_id: string | null;
  descricao: string;
  quantidade: number;
  cliente_nome: string | null;
  cidade: string | null;
  observacao: string | null;
  prioridade: "BAIXA" | "MEDIA" | "ALTA";
  status: "PENDENTE" | "COMPRADO" | "DESCARTADO";
  created_at: string;
  products?: { nome: string; sku: string | null; estoque: number | null } | null;
};

const PRIORIDADES = [
  { value: "ALTA", label: "Alta" },
  { value: "MEDIA", label: "Média" },
  { value: "BAIXA", label: "Baixa" },
] as const;

const STATUS_LABEL: Record<RequestRow["status"], string> = {
  PENDENTE: "A comprar",
  COMPRADO: "Comprado",
  DESCARTADO: "Descartado",
};

function DemandasPage() {
  const qc = useQueryClient();
  const { user } = useAuth();

  const [modo, setModo] = useState<"CADASTRADO" | "MANUAL">("MANUAL");
  const [productId, setProductId] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [descricao, setDescricao] = useState("");
  const [quantidade, setQuantidade] = useState("1");
  const [clienteNome, setClienteNome] = useState("");
  const [cidade, setCidade] = useState("");
  const [prioridade, setPrioridade] = useState<"BAIXA" | "MEDIA" | "ALTA">("MEDIA");
  const [observacao, setObservacao] = useState("");
  const [filtro, setFiltro] = useState<"PENDENTE" | "COMPRADO" | "DESCARTADO" | "TODOS">("PENDENTE");

  const { data: products = [] } = useQuery({
    queryKey: ["demanda-products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id,nome,sku,estoque")
        .order("nome")
        .limit(1000);
      if (error) throw error;
      return (data ?? []) as ProductRow[];
    },
  });

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["product-requests", filtro],
    queryFn: async () => {
      let q = supabase
        .from("product_requests")
        .select("*, products(nome,sku,estoque)")
        .order("created_at", { ascending: false })
        .limit(300);
      if (filtro !== "TODOS") q = q.eq("status", filtro);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as RequestRow[];
    },
  });

  const filteredProducts = useMemo(() => {
    const q = productSearch.trim().toLowerCase();
    if (!q) return [];
    return products
      .filter((p) => `${p.nome} ${p.sku ?? ""}`.toLowerCase().includes(q))
      .slice(0, 8);
  }, [productSearch, products]);

  const selectedProduct = products.find((p) => p.id === productId) ?? null;

  function resetForm() {
    setProductId("");
    setProductSearch("");
    setDescricao("");
    setQuantidade("1");
    setClienteNome("");
    setCidade("");
    setPrioridade("MEDIA");
    setObservacao("");
  }

  const create = useMutation({
    mutationFn: async () => {
      const nome =
        modo === "CADASTRADO" ? (selectedProduct?.nome ?? "") : descricao.trim();
      if (!nome) throw new Error("Informe o produto ou escreva o nome do item");
      const qtd = Number(quantidade.replace(",", ".")) || 1;

      const { error } = await supabase.from("product_requests").insert({
        product_id: modo === "CADASTRADO" ? productId || null : null,
        descricao: nome,
        quantidade: qtd,
        cliente_nome: clienteNome.trim() || null,
        cidade: cidade.trim() || null,
        observacao: observacao.trim() || null,
        prioridade,
        status: "PENDENTE",
        created_by: user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Demanda registrada");
      resetForm();
      qc.invalidateQueries({ queryKey: ["product-requests"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao registrar demanda"),
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: RequestRow["status"] }) => {
      const { error } = await supabase.from("product_requests").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["product-requests"] }),
    onError: (e: any) => toast.error(e.message ?? "Erro ao atualizar"),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("product_requests").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Demanda removida");
      qc.invalidateQueries({ queryKey: ["product-requests"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Sem permissão para remover"),
  });

  const label = (t: string) => (
    <label className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: V2.MUTED }}>
      {t}
    </label>
  );
  const inputStyle = { background: V2.BG, borderColor: V2.GRAPHITE, color: V2.TEXT };

  const pendentes = rows.filter((r) => r.status === "PENDENTE");

  return (
    <V2InternalShell
      title="Demanda de produtos"
      eyebrow="Lista de compras"
      description="Registre o que os clientes procuram e você não tem em estoque. Depois use essa lista para fechar a compra com o fornecedor."
      actions={
        <Link to="/v3/compras">
          <Button variant="outline" style={{ borderColor: V2.GRAPHITE, color: V2.TEXT }}>
            Lançar compra
          </Button>
        </Link>
      }
    >
      <div className="grid gap-6">
        {/* Formulário */}
        <section
          className="rounded-2xl border p-4 lg:p-5"
          style={{ background: V2.SURFACE, borderColor: V2.GRAPHITE }}
        >
          <div className="flex items-center gap-2 mb-4">
            <div
              className="h-8 w-8 rounded-lg grid place-items-center"
              style={{ background: V2.TEAL_LIGHT, color: V2.TEAL }}
            >
              <PackageSearch className="h-4 w-4" />
            </div>
            <h3 className="text-sm font-semibold" style={{ color: V2.TEXT }}>
              Nova demanda
            </h3>
          </div>

          {/* Modo */}
          <div className="flex gap-2 mb-4">
            {(
              [
                { v: "MANUAL", t: "Escrever o item" },
                { v: "CADASTRADO", t: "Produto cadastrado" },
              ] as const
            ).map((o) => (
              <button
                key={o.v}
                type="button"
                onClick={() => setModo(o.v)}
                className="h-9 px-3 rounded-lg border text-xs font-semibold"
                style={{
                  background: modo === o.v ? V2.TEAL_LIGHT : V2.SURFACE,
                  borderColor: modo === o.v ? V2.TEAL : V2.GRAPHITE,
                  color: modo === o.v ? V2.TEAL : V2.MUTED,
                }}
              >
                {o.t}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {modo === "MANUAL" ? (
              <div className="sm:col-span-2">
                {label("Item que o cliente pediu")}
                <Input
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  placeholder="Ex.: Capa de chave Fiat Argo 3 botões"
                  className="mt-1"
                  style={inputStyle}
                />
              </div>
            ) : (
              <div className="sm:col-span-2">
                {label("Buscar produto cadastrado")}
                {selectedProduct ? (
                  <div
                    className="mt-1 flex items-center gap-2 rounded-lg border px-3 h-10"
                    style={{ borderColor: V2.GRAPHITE, background: V2.BG }}
                  >
                    <Package className="h-4 w-4" style={{ color: V2.TEAL }} />
                    <span className="text-sm truncate flex-1" style={{ color: V2.TEXT }}>
                      {selectedProduct.nome}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setProductId("");
                        setProductSearch("");
                      }}
                      aria-label="Trocar produto"
                    >
                      <X className="h-4 w-4" style={{ color: V2.MUTED }} />
                    </button>
                  </div>
                ) : (
                  <>
                    <Input
                      value={productSearch}
                      onChange={(e) => setProductSearch(e.target.value)}
                      placeholder="Nome ou SKU"
                      className="mt-1"
                      style={inputStyle}
                    />
                    {filteredProducts.length > 0 && (
                      <div
                        className="mt-1 rounded-lg border overflow-hidden"
                        style={{ borderColor: V2.GRAPHITE, background: V2.SURFACE }}
                      >
                        {filteredProducts.map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => {
                              setProductId(p.id);
                              setProductSearch("");
                            }}
                            className="w-full text-left px-3 py-2 text-sm hover:opacity-80"
                            style={{ color: V2.TEXT }}
                          >
                            {p.nome}
                            <span className="text-[11px] ml-2" style={{ color: V2.MUTED }}>
                              {p.sku ?? ""} · estoque {Number(p.estoque ?? 0)}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            <div>
              {label("Quantidade")}
              <Input
                inputMode="decimal"
                value={quantidade}
                onChange={(e) => setQuantidade(e.target.value)}
                className="mt-1"
                style={inputStyle}
              />
            </div>

            <div>
              {label("Prioridade")}
              <Select value={prioridade} onValueChange={(v) => setPrioridade(v as typeof prioridade)}>
                <SelectTrigger className="mt-1" style={inputStyle}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent style={{ background: V2.SURFACE, borderColor: V2.GRAPHITE }}>
                  {PRIORIDADES.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              {label("Cliente (opcional)")}
              <Input
                value={clienteNome}
                onChange={(e) => setClienteNome(e.target.value)}
                placeholder="Quem pediu"
                className="mt-1"
                style={inputStyle}
              />
            </div>

            <div>
              {label("Cidade (opcional)")}
              <Input
                value={cidade}
                onChange={(e) => setCidade(e.target.value)}
                placeholder="Ex.: Uberlândia"
                className="mt-1"
                style={inputStyle}
              />
            </div>

            <div className="sm:col-span-2">
              {label("Observação")}
              <Textarea
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
                placeholder="Detalhes: modelo, ano, frequência, fornecedor sugerido..."
                className="mt-1 min-h-[40px]"
                style={inputStyle}
              />
            </div>
          </div>

          <div className="mt-4 flex justify-end">
            <Button
              onClick={() => create.mutate()}
              disabled={create.isPending}
              style={{ background: V2.TEAL, color: "#fff" }}
            >
              <Plus className="h-4 w-4 mr-1" /> Adicionar à lista
            </Button>
          </div>
        </section>

        {/* Lista */}
        <section
          className="rounded-2xl border p-4 lg:p-5"
          style={{ background: V2.SURFACE, borderColor: V2.GRAPHITE }}
        >
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <div className="flex items-center gap-2">
              <div
                className="h-8 w-8 rounded-lg grid place-items-center"
                style={{ background: V2.TEAL_LIGHT, color: V2.TEAL }}
              >
                <ClipboardList className="h-4 w-4" />
              </div>
              <h3 className="text-sm font-semibold" style={{ color: V2.TEXT }}>
                Lista de compras · {pendentes.length} pendente(s)
              </h3>
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {(["PENDENTE", "COMPRADO", "DESCARTADO", "TODOS"] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFiltro(f)}
                  className="h-8 px-3 rounded-lg border text-[11px] font-semibold"
                  style={{
                    background: filtro === f ? V2.TEAL_LIGHT : V2.SURFACE,
                    borderColor: filtro === f ? V2.TEAL : V2.GRAPHITE,
                    color: filtro === f ? V2.TEAL : V2.MUTED,
                  }}
                >
                  {f === "TODOS" ? "Todos" : STATUS_LABEL[f]}
                </button>
              ))}
            </div>
          </div>

          {isLoading ? (
            <p className="text-sm" style={{ color: V2.MUTED }}>
              Carregando…
            </p>
          ) : rows.length === 0 ? (
            <p className="text-sm" style={{ color: V2.MUTED }}>
              Nenhuma demanda registrada nesse filtro.
            </p>
          ) : (
            <div className="space-y-2">
              {rows.map((r) => (
                <div
                  key={r.id}
                  className="rounded-xl border p-3 flex flex-col sm:flex-row sm:items-center gap-3"
                  style={{ background: V2.BG, borderColor: V2.GRAPHITE }}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold truncate" style={{ color: V2.TEXT }}>
                        {Number(r.quantidade)}x {r.products?.nome ?? r.descricao}
                      </span>
                      <span
                        className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                        style={{
                          background: r.prioridade === "ALTA" ? "rgba(239,68,68,0.12)" : V2.SURFACE_2,
                          color: r.prioridade === "ALTA" ? "#ef4444" : V2.MUTED,
                        }}
                      >
                        {r.prioridade}
                      </span>
                      {r.product_id ? (
                        <span className="text-[10px]" style={{ color: V2.MUTED }}>
                          cadastrado · estoque {Number(r.products?.estoque ?? 0)}
                        </span>
                      ) : (
                        <span className="text-[10px]" style={{ color: V2.MUTED }}>
                          item novo
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] mt-0.5" style={{ color: V2.MUTED }}>
                      {[r.cliente_nome, r.cidade, formatDate(r.created_at)].filter(Boolean).join(" · ")}
                      {r.status !== "PENDENTE" ? ` · ${STATUS_LABEL[r.status]}` : ""}
                    </div>
                    {r.observacao && (
                      <div className="text-[11px] mt-0.5 italic" style={{ color: V2.MUTED }}>
                        {r.observacao}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    {r.status !== "COMPRADO" && (
                      <button
                        type="button"
                        onClick={() => updateStatus.mutate({ id: r.id, status: "COMPRADO" })}
                        className="h-9 px-3 rounded-lg border text-xs font-semibold flex items-center gap-1"
                        style={{ borderColor: V2.GRAPHITE, color: V2.SUCCESS }}
                      >
                        <Check className="h-3.5 w-3.5" /> Comprado
                      </button>
                    )}
                    {r.status === "PENDENTE" && (
                      <button
                        type="button"
                        onClick={() => updateStatus.mutate({ id: r.id, status: "DESCARTADO" })}
                        className="h-9 px-3 rounded-lg border text-xs font-semibold"
                        style={{ borderColor: V2.GRAPHITE, color: V2.MUTED }}
                      >
                        Descartar
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => remove.mutate(r.id)}
                      className="h-9 w-9 rounded-lg border grid place-items-center"
                      style={{ borderColor: V2.GRAPHITE, color: "#ef4444" }}
                      aria-label="Remover"
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
    </V2InternalShell>
  );
}
