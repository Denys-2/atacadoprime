import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { useOfflinePending } from "@/hooks/use-offline-pending";
import { useOfflineSales } from "@/hooks/use-offline-sales";
import { RefreshCw, Trash2, RotateCcw, CheckCircle2, AlertTriangle, Clock } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/offline-pendentes")({
  component: OfflinePendentesPage,
  head: () => ({
    meta: [
      { title: "Pendentes de sincronização — Atacado Prime" },
      { name: "description", content: "Registros criados offline aguardando envio ao servidor." },
    ],
  }),
});

const KIND_LABEL: Record<string, string> = {
  lead_insert: "Novo lead",
  lead_update: "Atualização de lead",
  lead_note: "Anotação de lead",
  lead_task_insert: "Nova tarefa",
  lead_task_toggle: "Atualização de tarefa",
  lead_convert: "Conversão em cliente",
  company_insert: "Novo cliente",
  visit_checkin: "Check-in de visita",
  visit_checkout: "Check-out de visita",
  generic_insert: "Inserção",
  generic_update: "Atualização",
};

function statusPill(status: string) {
  if (status === "sent") return <span className="inline-flex items-center gap-1 text-xs font-semibold text-success"><CheckCircle2 className="h-3.5 w-3.5" />Enviado</span>;
  if (status === "error") return <span className="inline-flex items-center gap-1 text-xs font-semibold text-destructive"><AlertTriangle className="h-3.5 w-3.5" />Erro</span>;
  if (status === "sending") return <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary"><RefreshCw className="h-3.5 w-3.5 animate-spin" />Enviando…</span>;
  return <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-600"><Clock className="h-3.5 w-3.5" />Pendente</span>;
}

function OfflinePendentesPage() {
  const { list, syncing, sync, retry, remove, online } = useOfflinePending();
  const sales = useOfflineSales();

  const totalPend =
    list.filter((m) => m.status !== "sent").length +
    sales.pending.length;

  const handleSync = async () => {
    if (!online) {
      toast.error("Você está offline. Conecte-se para sincronizar.");
      return;
    }
    const r = await sync();
    if (r.sent) toast.success(`${r.sent} registro(s) enviado(s)`);
    if (r.failed) toast.error(`${r.failed} falha(s) — abra o item para ver detalhes`);
    if (!r.sent && !r.failed) toast.info("Nada para enviar");
  };

  return (
    <AppShell title="Pendentes de sincronização" description="Cadastros e ações realizadas offline aguardando envio ao servidor.">
      <div className="space-y-6">
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card p-4">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground">
              {totalPend === 0 ? "Nada pendente" : `${totalPend} registro(s) pendente(s)`}
            </p>
            <p className="text-xs text-muted-foreground">
              {online ? "Conectado — sincronização automática ativa." : "Sem internet — os dados serão enviados assim que voltar."}
            </p>
          </div>
          <Button onClick={handleSync} disabled={!online || syncing} className="gap-2">
            <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
            Sincronizar agora
          </Button>
        </div>

        {/* Vendas offline */}
        <section className="rounded-2xl border border-border bg-card">
          <header className="px-4 py-3 border-b border-border">
            <h2 className="text-sm font-semibold text-foreground">Vendas offline</h2>
            <p className="text-xs text-muted-foreground">Pedidos criados sem internet.</p>
          </header>
          <div className="divide-y divide-border">
            {sales.queue.length === 0 && (
              <p className="px-4 py-6 text-sm text-muted-foreground">Nenhuma venda na fila.</p>
            )}
            {sales.queue.map((s) => (
              <div key={s.local_id} className="px-4 py-3 flex flex-wrap items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    Pedido {s.items.length} item(ns) · R$ {s.total.toFixed(2)}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {new Date(s.created_at).toLocaleString("pt-BR")}
                    {s.error && ` · ${s.error}`}
                  </p>
                </div>
                {statusPill(s.status)}
                {s.status === "error" && (
                  <>
                    <Button size="sm" variant="outline" onClick={() => sales.update(s.local_id, { status: "pending", error: null }).then(() => sales.sync())}>
                      <RotateCcw className="h-3.5 w-3.5 mr-1" />Reenviar
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => sales.remove(s.local_id)} className="text-destructive">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </>
                )}
                {s.status === "sent" && (
                  <Button size="sm" variant="ghost" onClick={() => sales.remove(s.local_id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Cadastros / ações offline */}
        <section className="rounded-2xl border border-border bg-card">
          <header className="px-4 py-3 border-b border-border">
            <h2 className="text-sm font-semibold text-foreground">Cadastros e ações</h2>
            <p className="text-xs text-muted-foreground">Clientes, leads, visitas e anotações feitas offline.</p>
          </header>
          <div className="divide-y divide-border">
            {list.length === 0 && (
              <p className="px-4 py-6 text-sm text-muted-foreground">Nenhum item na fila.</p>
            )}
            {list.map((m) => (
              <div key={m.local_id} className="px-4 py-3 flex flex-wrap items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {KIND_LABEL[m.kind] ?? m.kind}
                    {m.label && ` · ${m.label}`}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {new Date(m.created_at).toLocaleString("pt-BR")}
                    {m.error && ` · ${m.error}`}
                  </p>
                </div>
                {statusPill(m.status)}
                {m.status === "error" && (
                  <>
                    <Button size="sm" variant="outline" onClick={() => retry(m.local_id)}>
                      <RotateCcw className="h-3.5 w-3.5 mr-1" />Tentar novamente
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => remove(m.local_id)} className="text-destructive">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </>
                )}
                {m.status === "sent" && (
                  <Button size="sm" variant="ghost" onClick={() => remove(m.local_id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
