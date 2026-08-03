import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { V2InternalShell } from "@/components/v2/InternalShell";
import { V2 } from "@/components/v2/theme";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Plus, Truck, PackagePlus, Receipt, ShoppingCart, XCircle, Trash2, Search, ArrowLeft, MapPin, X } from "lucide-react";
import { toast } from "sonner";
import { CityAutocomplete } from "@/components/v2/CityAutocomplete";
import { useAuth } from "@/hooks/use-auth";
import { useSellerSession } from "@/hooks/use-seller-session";
import { brl, formatDate } from "@/lib/format";
import { orderCodeHash } from "@/lib/order-code";

export const Route = createFileRoute("/_authenticated/v3/viagens")({
  head: () => ({ meta: [{ title: "Viagens — Prime Automotive" }] }),
  component: TripsPage,
});

type Destino = { cidade: string; estado: string | null };
type Trip = {
  id: string; nome: string; status: string; cidade: string | null; estado: string | null;
  opened_at: string; closed_at: string | null; created_at: string; observacao: string | null;
  destinos?: Destino[] | null;
};

function TripsPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  return (
    <V2InternalShell
      title="Viagens"
      eyebrow="Operação externa"
      description="Cadastre viagens, carregue peças, registre despesas e vendas em rota."
    >
      {selectedId ? (
        <TripDetail tripId={selectedId} onBack={() => setSelectedId(null)} />
      ) : (
        <TripsList onOpen={setSelectedId} />
      )}
    </V2InternalShell>
  );
}

/* -------------------- LISTA + CRIAR -------------------- */

function TripsList({ onOpen }: { onOpen: (id: string) => void }) {
  const [tab, setTab] = useState<"open" | "closed">("open");
  const [createOpen, setCreateOpen] = useState(false);
  const { data: trips = [], isLoading } = useQuery({
    queryKey: ["trips-list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("trips")
        .select("id,nome,status,cidade,estado,opened_at,closed_at,created_at,observacao,destinos")
        .order("created_at", { ascending: false }).limit(200);
      if (error) throw error;
      return (data ?? []) as Trip[];
    },
  });

  const filtered = trips.filter((t) => (tab === "open" ? t.status === "open" : t.status === "closed"));

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
          <TabsList>
            <TabsTrigger value="open">Abertas ({trips.filter((t) => t.status === "open").length})</TabsTrigger>
            <TabsTrigger value="closed">Encerradas ({trips.filter((t) => t.status === "closed").length})</TabsTrigger>
          </TabsList>
        </Tabs>
        <Button onClick={() => setCreateOpen(true)} style={{ background: V2.TEAL, color: "#fff" }}>
          <Plus className="h-4 w-4 mr-1" /> Nova viagem
        </Button>
      </div>

      <div className="rounded-2xl border shadow-sm overflow-hidden" style={{ background: V2.LIGHT_SURFACE, borderColor: V2.LIGHT_BORDER }}>
        {isLoading ? (
          <div className="p-8 text-center text-sm" style={{ color: V2.LIGHT_MUTED }}>Carregando…</div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center">
            <Truck className="h-10 w-10 mx-auto mb-2" style={{ color: V2.LIGHT_MUTED }} />
            <p className="text-sm" style={{ color: V2.LIGHT_MUTED }}>
              {tab === "open" ? "Nenhuma viagem aberta. Clique em “Nova viagem”." : "Nenhuma viagem encerrada."}
            </p>
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: V2.LIGHT_BORDER }}>
            {filtered.map((t) => (
              <button key={t.id} onClick={() => onOpen(t.id)}
                className="w-full text-left p-4 hover:bg-black/[0.03] grid grid-cols-1 md:grid-cols-[1fr_auto_auto] gap-3 md:items-center">
                <div className="min-w-0">
                  <p className="font-semibold truncate" style={{ color: V2.LIGHT_TEXT }}>{t.nome}</p>
                  <p className="text-xs mt-0.5 truncate" style={{ color: V2.LIGHT_MUTED }}>
                    {[
                      [t.cidade, t.estado].filter(Boolean).join("-"),
                      ...((t.destinos ?? []).map((d) => [d.cidade, d.estado].filter(Boolean).join("-"))),
                    ].filter(Boolean).join("  →  ") || "Sem local"}
                  </p>
                </div>
                <span className="text-[10px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full border justify-self-start md:justify-self-end"
                  style={{ color: t.status === "open" ? V2.TEAL : V2.LIGHT_MUTED, borderColor: t.status === "open" ? V2.TEAL : V2.LIGHT_BORDER, background: t.status === "open" ? V2.TEAL_LIGHT : "transparent" }}>
                  {t.status === "open" ? "Aberta" : "Encerrada"}
                </span>
                <p className="text-[11px] text-right" style={{ color: V2.LIGHT_MUTED }}>{formatDate(t.opened_at ?? t.created_at)}</p>
              </button>
            ))}
          </div>
        )}
      </div>

      <CreateTripDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={onOpen} />
    </div>
  );
}

function CreateTripDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (v: boolean) => void; onCreated: (id: string) => void }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [nome, setNome] = useState("");
  const [cidade, setCidade] = useState("");
  const [estado, setEstado] = useState("");
  const [observacao, setObservacao] = useState("");

  const mut = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Não autenticado");
      if (!nome.trim()) throw new Error("Informe o nome da viagem");
      const { data, error } = await supabase.from("trips").insert({
        nome: nome.trim(),
        cidade: cidade.trim() || null,
        estado: estado.trim().toUpperCase() || null,
        observacao: observacao.trim() || null,
        vendedor_id: user.id,
        created_by: user.id,
        status: "open",
      } as any).select("id").single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: (id) => {
      toast.success("Viagem criada");
      qc.invalidateQueries({ queryKey: ["trips-list"] });
      onOpenChange(false);
      setNome(""); setCidade(""); setEstado(""); setObservacao("");
      onCreated(id);
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Nova viagem</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Nome *</Label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Uberaba - semana 30" className="mt-1" />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2">
              <Label>Cidade</Label>
              <Input value={cidade} onChange={(e) => setCidade(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label>UF</Label>
              <Input value={estado} onChange={(e) => setEstado(e.target.value.toUpperCase())} maxLength={2} className="mt-1" />
            </div>
          </div>
          <div>
            <Label>Observação</Label>
            <Textarea value={observacao} onChange={(e) => setObservacao(e.target.value)} className="mt-1" rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending} style={{ background: V2.TEAL, color: "#fff" }}>
            {mut.isPending ? "Criando…" : "Criar viagem"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* -------------------- DETALHE DA VIAGEM -------------------- */

function TripDetail({ tripId, onBack }: { tripId: string; onBack: () => void }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const setTripId = useSellerSession((s) => s.setTripId);

  const { data: trip } = useQuery({
    queryKey: ["trip", tripId],
    queryFn: async () => {
      const { data, error } = await supabase.from("trips").select("*").eq("id", tripId).single();
      if (error) throw error;
      return data as Trip;
    },
  });

  // Peças vendidas derivadas dos pedidos da viagem (estoque unificado: trip_items pode estar vazio)
  const { data: items = [] } = useQuery({
    queryKey: ["trip-sold-items", tripId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("order_items")
        .select("id,quantidade,product:products(id,nome,sku),order:orders!inner(id,trip_id,status)")
        .eq("order.trip_id", tripId)
        .neq("order.status", "CANCELADO");
      if (error) throw error;
      const map = new Map<string, { id: string; qtd_vendida: number; product: any }>();
      for (const row of (data ?? []) as any[]) {
        const pid = row.product?.id ?? row.id;
        const cur = map.get(pid) ?? { id: pid, qtd_vendida: 0, product: row.product };
        cur.qtd_vendida += Number(row.quantidade || 0);
        map.set(pid, cur);
      }
      return Array.from(map.values()).sort((a, b) => b.qtd_vendida - a.qtd_vendida);
    },
  });


  const { data: expenses = [] } = useQuery({
    queryKey: ["trip-expenses", tripId],
    queryFn: async () => {
      const { data, error } = await supabase.from("trip_expenses").select("*").eq("trip_id", tripId).order("data", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: orders = [] } = useQuery({
    queryKey: ["trip-orders", tripId],
    queryFn: async () => {
      const { data, error } = await supabase.from("orders")
        .select("id,status,total,created_at,companies(legal_name,trade_name)")
        .eq("trip_id", tripId).order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const totals = useMemo(() => {
    const despesas = expenses.reduce((s: number, e: any) => s + Number(e.valor || 0), 0);
    const vendas = orders.filter((o: any) => o.status !== "CANCELADO").reduce((s: number, o: any) => s + Number(o.total || 0), 0);
    const carregado = items.reduce((s: number, i: any) => s + Number(i.qtd_carregada || 0), 0);
    const vendido = items.reduce((s: number, i: any) => s + Number(i.qtd_vendida || 0), 0);
    return { despesas, vendas, carregado, vendido, saldo: vendas - despesas };
  }, [expenses, orders, items]);

  
  const [expenseOpen, setExpenseOpen] = useState(false);

  const closeMut = useMutation({
    mutationFn: async (returnStock: boolean) => {
      const { error } = await supabase.rpc("trip_close_v2", { _trip_id: tripId, _return_stock: returnStock });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Viagem encerrada");
      qc.invalidateQueries({ queryKey: ["trip", tripId] });
      qc.invalidateQueries({ queryKey: ["trips-list"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (!trip) return <div className="p-8 text-center text-sm" style={{ color: V2.LIGHT_MUTED }}>Carregando…</div>;

  const isOpen = trip.status === "open";

  return (
    <div className="grid gap-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <Button variant="ghost" onClick={onBack}><ArrowLeft className="h-4 w-4 mr-1" /> Voltar</Button>
        <div className="flex flex-wrap gap-2">
          {isOpen && (
            <>
              <Button variant="outline" onClick={() => setExpenseOpen(true)}><Receipt className="h-4 w-4 mr-1" /> Lançar despesa</Button>
              <Button
                onClick={() => { setTripId(tripId); navigate({ to: "/v3/vendas/nova" }); }}
                style={{ background: V2.TEAL, color: "#fff" }}
              >
                <ShoppingCart className="h-4 w-4 mr-1" /> Vender nesta viagem
              </Button>
              <Button variant="destructive" onClick={() => {
                if (confirm("Encerrar esta viagem? O estoque é único da loja, nada será movimentado.")) closeMut.mutate(true);
              }}><XCircle className="h-4 w-4 mr-1" /> Encerrar</Button>
            </>
          )}

        </div>
      </div>

      <div className="rounded-2xl p-5 border shadow-sm" style={{ background: V2.LIGHT_SURFACE, borderColor: V2.LIGHT_BORDER }}>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <h2 className="text-xl font-semibold">{trip.nome}</h2>
            <p className="text-xs mt-1" style={{ color: V2.LIGHT_MUTED }}>
              Aberta em {formatDate(trip.opened_at)}
              {trip.closed_at && ` · Encerrada em ${formatDate(trip.closed_at)}`}
            </p>
          </div>
          <span className="text-[10px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full border"
            style={{ color: isOpen ? V2.TEAL : V2.LIGHT_MUTED, borderColor: isOpen ? V2.TEAL : V2.LIGHT_BORDER, background: isOpen ? V2.TEAL_LIGHT : "transparent" }}>
            {isOpen ? "Aberta" : "Encerrada"}
          </span>
        </div>
        <DestinosManager trip={trip} canEdit={isOpen} />
      </div>

      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Peças vendidas", value: String(totals.vendido) },
          { label: "Total em vendas", value: brl(totals.vendas) },
          { label: "Despesas", value: brl(totals.despesas) },
          { label: "Resultado", value: brl(totals.saldo) },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl p-4 border shadow-sm" style={{ background: V2.LIGHT_SURFACE, borderColor: V2.LIGHT_BORDER }}>
            <div className="text-[10px] uppercase tracking-[0.2em] font-semibold" style={{ color: V2.LIGHT_MUTED }}>{s.label}</div>
            <div className="mt-1 text-lg font-semibold">{s.value}</div>
          </div>
        ))}
      </section>

      <Tabs defaultValue="items">
        <TabsList>
          <TabsTrigger value="items">Peças vendidas ({items.length})</TabsTrigger>
          <TabsTrigger value="expenses">Despesas ({expenses.length})</TabsTrigger>
          <TabsTrigger value="orders">Vendas ({orders.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="items" className="mt-3">
          <ListCard empty="Nenhuma peça vendida nesta viagem ainda.">
            {items.map((it: any) => (
              <div key={it.id} className="p-4 grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 md:items-center">
                <div className="min-w-0">
                  <p className="font-semibold truncate">{it.product?.nome ?? "—"}</p>
                  <p className="text-xs" style={{ color: V2.LIGHT_MUTED }}>SKU {it.product?.sku}</p>
                </div>
                <Cell label="Vendida" value={it.qtd_vendida} />
              </div>
            ))}
          </ListCard>
        </TabsContent>


        <TabsContent value="expenses" className="mt-3">
          <ListCard empty="Nenhuma despesa registrada.">
            {expenses.map((e: any) => (
              <div key={e.id} className="p-4 grid grid-cols-1 md:grid-cols-[1fr_auto_auto] gap-3 md:items-center">
                <div className="min-w-0">
                  <p className="font-semibold truncate">{e.categoria}{e.descricao ? ` — ${e.descricao}` : ""}</p>
                  <p className="text-xs" style={{ color: V2.LIGHT_MUTED }}>{formatDate(e.data)} {e.forma_pagamento ? `· ${e.forma_pagamento}` : ""}</p>
                </div>
                <p className="font-semibold text-right">{brl(Number(e.valor))}</p>
                <Button variant="ghost" size="icon" onClick={async () => {
                  if (!confirm("Excluir despesa?")) return;
                  const { error } = await supabase.from("trip_expenses").delete().eq("id", e.id);
                  if (error) return toast.error(error.message);
                  qc.invalidateQueries({ queryKey: ["trip-expenses", tripId] });
                }}><Trash2 className="h-4 w-4" /></Button>
              </div>
            ))}
          </ListCard>
        </TabsContent>

        <TabsContent value="orders" className="mt-3">
          <ListCard empty="Nenhuma venda vinculada a esta viagem.">
            {orders.map((o: any) => (
              <div key={o.id} className="p-4 grid grid-cols-1 md:grid-cols-[1fr_auto_auto] gap-3 md:items-center">
                <div className="min-w-0">
                  <p className="font-semibold truncate">{orderCodeHash(o.id, o.companies?.trade_name ?? o.companies?.legal_name)} · {o.companies?.trade_name ?? o.companies?.legal_name ?? "Cliente"}</p>
                  <p className="text-xs" style={{ color: V2.LIGHT_MUTED }}>{formatDate(o.created_at)} · {o.status}</p>
                </div>
                <p className="font-semibold text-right">{brl(Number(o.total))}</p>
                <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/orders/$id", params: { id: o.id }, search: { edit: false } })}>Abrir</Button>
              </div>
            ))}
          </ListCard>
        </TabsContent>
      </Tabs>

      <ExpenseDialog open={expenseOpen} onOpenChange={setExpenseOpen} tripId={tripId} />
    </div>
  );
}

function Cell({ label, value, highlight }: { label: string; value: any; highlight?: boolean }) {
  return (
    <div className="text-center">
      <div className="text-[10px] uppercase tracking-wider" style={{ color: V2.LIGHT_MUTED }}>{label}</div>
      <div className="font-semibold" style={{ color: highlight ? "#c1121f" : V2.LIGHT_TEXT }}>{value}</div>
    </div>
  );
}

function ListCard({ children, empty }: { children: React.ReactNode; empty: string }) {
  const arr = Array.isArray(children) ? children : [children];
  const hasContent = arr.length > 0 && arr.some(Boolean);
  return (
    <div className="rounded-2xl border shadow-sm overflow-hidden" style={{ background: V2.LIGHT_SURFACE, borderColor: V2.LIGHT_BORDER }}>
      {hasContent ? <div className="divide-y" style={{ borderColor: V2.LIGHT_BORDER }}>{children}</div> :
        <div className="p-8 text-center text-sm" style={{ color: V2.LIGHT_MUTED }}>{empty}</div>}
    </div>
  );
}

/* Carga de peças removida — estoque único da loja */


/* -------------------- DESPESAS -------------------- */

const EXPENSE_CATEGORIES = ["Combustível", "Hospedagem", "Alimentação", "Pedágio", "Manutenção", "Estacionamento", "Outros"];

function ExpenseDialog({ open, onOpenChange, tripId }: { open: boolean; onOpenChange: (v: boolean) => void; tripId: string }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [categoria, setCategoria] = useState("Combustível");
  const [descricao, setDescricao] = useState("");
  const [valor, setValor] = useState("");
  const [data, setData] = useState(() => new Date().toISOString().slice(0, 10));
  const [forma, setForma] = useState("");

  const mut = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Não autenticado");
      const v = Number(valor.replace(",", "."));
      if (!v || v <= 0) throw new Error("Informe um valor válido");
      const categoriaDB: Record<string, string> = {
        "Combustível": "COMBUSTIVEL",
        "Hospedagem": "HOSPEDAGEM",
        "Alimentação": "ALIMENTACAO",
        "Pedágio": "PEDAGIO",
        "Manutenção": "MANUTENCAO",
        "Estacionamento": "OUTROS",
        "Outros": "OUTROS",
      };
      const formaDB: Record<string, string> = {
        "pix": "PIX", "cartão": "CARTAO", "cartao": "CARTAO", "dinheiro": "DINHEIRO", "débito": "OUTRO", "debito": "OUTRO", "crédito": "OUTRO", "credito": "OUTRO", "boleto": "OUTRO", "transferência": "OUTRO", "transferencia": "OUTRO", "outro": "OUTRO",
      };
      const normalizedForma = forma ? (formaDB[forma.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")] ?? "OUTRO") : null;
      const { error } = await supabase.from("trip_expenses").insert({
        trip_id: tripId, categoria: categoriaDB[categoria] ?? "OUTROS", descricao: descricao || null, valor: v, data,
        forma_pagamento: normalizedForma, created_by: user.id,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Despesa lançada");
      qc.invalidateQueries({ queryKey: ["trip-expenses", tripId] });
      setDescricao(""); setValor(""); setForma("");
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Nova despesa</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Categoria *</Label>
            <Select value={categoria} onValueChange={setCategoria}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>{EXPENSE_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Valor *</Label>
              <Input value={valor} onChange={(e) => setValor(e.target.value)} placeholder="0,00" className="mt-1" />
            </div>
            <div>
              <Label>Data *</Label>
              <Input type="date" value={data} onChange={(e) => setData(e.target.value)} className="mt-1" />
            </div>
          </div>
          <div>
            <Label>Forma de pagamento</Label>
            <Input value={forma} onChange={(e) => setForma(e.target.value)} placeholder="Pix, cartão, dinheiro…" className="mt-1" />
          </div>
          <div>
            <Label>Descrição</Label>
            <Textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={2} className="mt-1" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending} style={{ background: V2.TEAL, color: "#fff" }}>
            {mut.isPending ? "Salvando…" : "Lançar despesa"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* -------------------- DESTINOS (multi-cidade) -------------------- */

function DestinosManager({ trip, canEdit }: { trip: Trip; canEdit: boolean }) {
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [cidade, setCidade] = useState("");
  const [estado, setEstado] = useState("");

  const primary: Destino | null = trip.cidade ? { cidade: trip.cidade, estado: trip.estado ?? null } : null;
  const extras: Destino[] = Array.isArray(trip.destinos) ? trip.destinos : [];
  const all: Destino[] = [...(primary ? [primary] : []), ...extras];

  const save = useMutation({
    mutationFn: async (novos: Destino[]) => {
      const patch: Record<string, unknown> = { destinos: novos };
      // Se ainda não existe cidade principal e vamos adicionar a primeira, define ela como principal
      if (!primary && novos.length > 0) {
        patch.cidade = novos[0].cidade;
        patch.estado = novos[0].estado;
        patch.destinos = novos.slice(1);
      }
      const { error } = await supabase.from("trips").update(patch as any).eq("id", trip.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["trip", trip.id] });
      qc.invalidateQueries({ queryKey: ["trips-list"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  function handleAdd() {
    const c = cidade.trim();
    if (!c) return;
    const novo: Destino = { cidade: c.toUpperCase(), estado: estado.trim().toUpperCase() || null };
    save.mutate([...extras, novo], {
      onSuccess: () => {
        setCidade(""); setEstado(""); setAdding(false);
        toast.success("Destino adicionado");
      },
    });
  }

  function handleRemove(idx: number) {
    // idx é o índice em `all`. Se remover o primário, promove o primeiro extra.
    if (idx === 0 && primary) {
      const next = extras[0] ?? null;
      supabase.from("trips").update({
        cidade: next?.cidade ?? null,
        estado: next?.estado ?? null,
        destinos: extras.slice(1),
      } as any).eq("id", trip.id).then(({ error }) => {
        if (error) toast.error(error.message);
        else {
          qc.invalidateQueries({ queryKey: ["trip", trip.id] });
          qc.invalidateQueries({ queryKey: ["trips-list"] });
        }
      });
      return;
    }
    const extraIdx = primary ? idx - 1 : idx;
    const novos = extras.filter((_, i) => i !== extraIdx);
    save.mutate(novos, { onSuccess: () => toast.success("Destino removido") });
  }

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <MapPin className="h-4 w-4" style={{ color: V2.LIGHT_MUTED }} />
      {all.length === 0 && (
        <span className="text-xs" style={{ color: V2.LIGHT_MUTED }}>Sem destinos cadastrados</span>
      )}
      {all.map((d, i) => (
        <span key={`${d.cidade}-${i}`}
          className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border"
          style={{
            borderColor: i === 0 ? V2.TEAL : V2.TEAL,
            background: i === 0 ? V2.TEAL : "V2.TEAL_LIGHT",
            color: i === 0 ? "#fff" : V2.LIGHT_TEXT,
          }}>
          {i === 0 ? "★ " : ""}{d.cidade}{d.estado ? `-${d.estado}` : ""}
          {canEdit && (
            <button type="button" onClick={() => handleRemove(i)} className="hover:opacity-70" aria-label="Remover destino" style={{ color: i === 0 ? "#fff" : V2.LIGHT_TEXT }}>
              <X className="h-3 w-3" />
            </button>
          )}
        </span>
      ))}

      {canEdit && !adding && (
        <button type="button" onClick={() => setAdding(true)}
          className="text-xs font-medium px-2.5 py-1 rounded-full border inline-flex items-center gap-1"
          style={{ borderColor: V2.TEAL, color: V2.TEAL, background: "transparent" }}>
          <Plus className="h-3 w-3" /> Adicionar destino
        </button>
      )}
      {canEdit && adding && (
        <div className="flex items-center gap-1.5">
          <CityAutocomplete
            value={cidade}
            onChange={(c, uf) => { setCidade(c); if (uf) setEstado(uf); }}
            placeholder="Cidade"
            className="w-40"
            inputClassName="h-8 text-xs"
            autoFocus
          />
          <Input value={estado} onChange={(e) => setEstado(e.target.value.toUpperCase())} maxLength={2} placeholder="UF" className="h-8 w-14 text-xs" />
          <Button size="sm" className="h-8" onClick={handleAdd} disabled={save.isPending} style={{ background: V2.TEAL, color: "#fff" }}>OK</Button>
          <Button size="sm" variant="ghost" className="h-8" onClick={() => { setAdding(false); setCidade(""); setEstado(""); }}>Cancelar</Button>
        </div>
      )}
    </div>
  );
}
