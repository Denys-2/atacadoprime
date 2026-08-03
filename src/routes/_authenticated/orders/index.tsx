import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { useMyOrders, useDeleteOrder } from "@/hooks/use-orders";
import { useAuth, useRoles } from "@/hooks/use-auth";
import { useRecomprar } from "@/hooks/use-recomprar";
import { brl, formatDate } from "@/lib/format";
import { orderCodeHash } from "@/lib/order-code";
import { isPendingPayment } from "@/lib/orders/status";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/orders/status-pill";
import { Package, ExternalLink, RotateCcw, Eye, Clock, CheckCircle2, DollarSign, Wallet, Calendar, Trash2, Search, X } from "lucide-react";
import { StatCard } from "@/components/ui/data-cards";
import { toast } from "sonner";
import { useState } from "react";


export const Route = createFileRoute("/_authenticated/orders/")({
  head: () => ({ meta: [{ title: "Meus pedidos — Atacado" }] }),
  component: OrdersPage,
});

function OrdersPage() {
  const { data: orders = [], isLoading } = useMyOrders();
  const recomprar = useRecomprar();
  const { user } = useAuth();
  const { data: roles = [] } = useRoles(user);
  const isAdmin = roles.includes("admin");
  const del = useDeleteOrder();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "PENDING" | "PAGO" | "CANCELADO">("ALL");

  const pagos = orders.filter((o) => o.status === "PAGO").length;
  const pendentes = orders.filter((o) => isPendingPayment(o.status)).length;
  const totalComprado = orders.reduce((s, o) => s + Number(o.total), 0);
  const totalPago = orders
    .filter((o) => o.status === "PAGO")
    .reduce((s, o) => s + Number(o.total), 0);
  const ultima = orders[0]?.created_at;

  const filteredOrders = orders.filter((o) => {
    const cname = (o as { companies?: { trade_name?: string | null; legal_name?: string | null } }).companies?.trade_name || (o as { companies?: { trade_name?: string | null; legal_name?: string | null } }).companies?.legal_name || "";
    const code = orderCodeHash(o.id, cname);
    const dateStr = formatDate(o.created_at);
    const totalStr = brl(Number(o.total));
    const term = search.toLowerCase().trim();

    const matchesSearch = !term ||
      code.toLowerCase().includes(term) ||
      o.id.toLowerCase().includes(term) ||
      cname.toLowerCase().includes(term) ||
      o.status.toLowerCase().includes(term) ||
      dateStr.toLowerCase().includes(term) ||
      totalStr.toLowerCase().includes(term);

    const pending = isPendingPayment(o.status);
    let matchesStatus = true;
    if (statusFilter === "PENDING") matchesStatus = pending;
    else if (statusFilter === "PAGO") matchesStatus = o.status === "PAGO";
    else if (statusFilter === "CANCELADO") matchesStatus = o.status === "CANCELADO";

    return matchesSearch && matchesStatus;
  });

  return (
    <AppShell title="Meus pedidos" description="Histórico e recompra rápida.">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
        <StatCard label="Pedidos pendentes" value={pendentes} icon={Clock} tone="orange" />
        <StatCard label="Pedidos pagos" value={pagos} icon={CheckCircle2} tone="green" />
        <StatCard label="Valor total" value={brl(totalComprado)} icon={DollarSign} tone="blue" />
        <StatCard label="Valor total pago" value={brl(totalPago)} icon={Wallet} tone="indigo" />
        <StatCard label="Última compra" value={formatDate(ultima)} icon={Calendar} tone="purple" />
      </div>

      <div className="bg-card border border-border rounded-xl p-4 mb-6 space-y-3">
        <div className="relative flex items-center">
          <Search className="absolute left-3 w-4 h-4 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por código (ex: #1234), cliente, valor, data ou status..."
            className="w-full h-10 pl-9 pr-9 bg-background border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 p-1 rounded-md text-muted-foreground hover:text-foreground"
              title="Limpar busca"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 flex-wrap text-xs">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-muted-foreground font-medium mr-1">Filtrar:</span>
            <button
              type="button"
              onClick={() => setStatusFilter("ALL")}
              className={`px-3 py-1.5 rounded-full font-medium transition-colors ${statusFilter === "ALL" ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80 text-muted-foreground"}`}
            >
              Todos ({orders.length})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("PENDING")}
              className={`px-3 py-1.5 rounded-full font-medium transition-colors ${statusFilter === "PENDING" ? "bg-amber-500 text-white" : "bg-muted hover:bg-muted/80 text-muted-foreground"}`}
            >
              Pendentes ({pendentes})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("PAGO")}
              className={`px-3 py-1.5 rounded-full font-medium transition-colors ${statusFilter === "PAGO" ? "bg-emerald-600 text-white" : "bg-muted hover:bg-muted/80 text-muted-foreground"}`}
            >
              Pagos ({pagos})
            </button>
          </div>
          {(search || statusFilter !== "ALL") && (
            <p className="text-muted-foreground">
              Mostrando <strong className="text-foreground">{filteredOrders.length}</strong> de {orders.length} pedido(s)
            </p>
          )}
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : orders.length === 0 ? (
        <div className="text-center py-16">
          <Package className="w-10 h-10 mx-auto text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">Nenhum pedido ainda.</p>
          <Button asChild className="mt-4"><Link to="/v3">Comprar agora</Link></Button>
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="text-center py-12 bg-card border border-border rounded-xl">
          <Package className="w-8 h-8 mx-auto text-muted-foreground" />
          <p className="mt-2 text-sm text-muted-foreground">Nenhum pedido encontrado para a busca especificada.</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => { setSearch(""); setStatusFilter("ALL"); }}>
            Limpar filtros
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {filteredOrders.map((o) => {
            const link = o.payments?.[0]?.payment_link;
            const pending = isPendingPayment(o.status);
            const showPay = !!link && pending;
            const itensQtd = (o.order_items ?? []).reduce((s: number, i: { quantidade: number }) => s + Number(i.quantidade), 0);
            return (
              <div key={o.id} className="bg-card border border-border rounded-xl p-4 flex flex-col gap-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-mono text-xs text-muted-foreground">{orderCodeHash(o.id, (o as { companies?: { trade_name?: string | null; legal_name?: string | null } }).companies?.trade_name || (o as { companies?: { trade_name?: string | null; legal_name?: string | null } }).companies?.legal_name)}</p>
                    <p className="text-sm mt-0.5">{formatDate(o.created_at)}</p>
                  </div>
                  <StatusPill status={o.status} />
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <Info label="Itens" value={itensQtd.toString()} />
                  <Info label="Total" value={brl(Number(o.total))} strong />
                </div>

                {showPay && (
                  <Button asChild size="sm" className="w-full h-9 text-xs font-medium">
                    <a href={link} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="w-3.5 h-3.5 mr-1.5" /> Pagar agora
                    </a>
                  </Button>
                )}

                <div className="flex flex-wrap gap-2 pt-1 border-t border-border">
                  <Button asChild variant="ghost" size="sm" className="flex-1 h-8 text-xs">
                    <Link to="/orders/$id" params={{ id: o.id }} search={{ edit: false }}>
                      <Eye className="w-3.5 h-3.5 mr-1" /> Ver
                    </Link>
                  </Button>
                  <Button variant="outline" size="sm" className="flex-1 h-8 text-xs" onClick={() => recomprar(o.id)}>
                    <RotateCcw className="w-3.5 h-3.5 mr-1" /> Recomprar
                  </Button>
                  {isAdmin && (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={del.isPending}
                      className={`h-8 text-xs ${itensQtd === 0 ? "border-destructive/40 text-destructive hover:bg-destructive/10" : "text-muted-foreground"}`}
                      title={itensQtd === 0 ? "Excluir pedido vazio" : "Excluir pedido"}
                      onClick={() => {
                        const cname = (o as { companies?: { trade_name?: string | null; legal_name?: string | null } }).companies?.trade_name || (o as { companies?: { trade_name?: string | null; legal_name?: string | null } }).companies?.legal_name;
                        const code = orderCodeHash(o.id, cname);
                        const msg = itensQtd === 0
                          ? `Excluir pedido ${code} (sem itens)?`
                          : `ATENÇÃO: excluir pedido ${code} com ${itensQtd} item(ns) por ${brl(Number(o.total))}?\n\nEsta ação é irreversível.`;
                        if (confirm(msg)) {
                          del.mutate(o.id, {
                            onSuccess: () => toast.success("Pedido excluído"),
                            onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao excluir"),
                          });
                        }
                      }}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>

              </div>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}


function Info({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="bg-muted/40 rounded-md px-2.5 py-1.5">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`mt-0.5 ${strong ? "font-semibold text-sm" : "text-xs"}`}>{value}</p>
    </div>
  );
}
