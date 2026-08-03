import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  BarChart3,
  Bell,
  Boxes,
  Briefcase,
  Building2,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Cog,
  CreditCard,
  Handshake,
  Image as ImageIcon,
  LayoutGrid,
  LifeBuoy,
  Map as MapIcon,
  Megaphone,
  MessageCircle,
  MessageSquare,
  Navigation,
  PackageSearch,
  Percent,
  ScanLine,
  Search,
  ShieldCheck,
  Sparkles,
  Target,
  Truck,
  Users,
  Wallet,
  Workflow,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useBankAccounts } from "@/hooks/use-bank-accounts";
import { useConfirmPayment } from "@/hooks/use-orders";
import { brl, formatDate } from "@/lib/format";
import { orderCodeHash } from "@/lib/order-code";
import { isPendingPayment } from "@/lib/orders/status";
import { V2 } from "./theme";
import { V2InternalShell } from "./InternalShell";

export type V2ModuleKey =
  | "trips"
  | "visitSale"
  | "orders"
  | "catalogAdmin"
  | "prospecting"
  | "campaigns"
  | "whatsappCampaigns"
  | "field"
  | "routes"
  | "finance"
  | "approvals"
  | "crm"
  | "crmAgenda"
  | "whatsappInbox"
  | "whatsappTemplates"
  | "postSale"
  | "bi"
  | "ai"
  | "automation"
  | "portal"
  | "settings"
  | "inventory"
  | "inventoryAlerts"
  | "inventoryCounts"
  | "financeReconciliation"
  | "companies"
  | "adminUsers"
  | "adminPromotions"
  | "adminBanners"
  | "adminSalesTargets"
  | "adminAbandonedCarts"
  | "adminPush";

type ModuleRecord = {
  id: string;
  title: string;
  subtitle: string;
  status?: string;
  value?: string;
  date?: string;
  total?: number;
  companyId?: string | null;
};

type ModuleData = {
  stats: Array<{ label: string; value: string; helper: string }>;
  records: ModuleRecord[];
};

const MODULES: Record<V2ModuleKey, { title: string; eyebrow: string; description: string; icon: typeof Truck }> = {
  trips: { title: "Viagens", eyebrow: "Operação externa", description: "Controle real de viagens, cargas e saldo em rota.", icon: Truck },
  visitSale: { title: "Venda em visita", eyebrow: "Atendimento em campo", description: "Base real de visitas e clientes para venda presencial.", icon: Briefcase },
  orders: { title: "Pedidos", eyebrow: "Vendas & entregas", description: "Pedidos reais do sistema, com status e totais do banco.", icon: ClipboardList },
  catalogAdmin: { title: "Catálogo interno", eyebrow: "Produtos & preços", description: "Produtos reais, estoque, marcas e itens críticos.", icon: LayoutGrid },
  prospecting: { title: "Prospecção", eyebrow: "CRM comercial", description: "Leads reais por status, score e origem comercial.", icon: Briefcase },
  campaigns: { title: "Campanhas", eyebrow: "Marketing comercial", description: "Campanhas comerciais reais e suas metas.", icon: Megaphone },
  whatsappCampaigns: { title: "Campanhas WhatsApp", eyebrow: "Mensageria", description: "Disparos e campanhas WhatsApp reais.", icon: MessageSquare },
  field: { title: "Campo", eyebrow: "Equipe externa", description: "Visitas, check-ins e resultados da operação em campo.", icon: Navigation },
  routes: { title: "Rotas & mapa", eyebrow: "Planejamento", description: "Rotas reais planejadas para atendimento externo.", icon: MapIcon },
  finance: { title: "Financeiro", eyebrow: "Caixa & contas", description: "Entradas financeiras reais registradas no sistema.", icon: Wallet },
  approvals: { title: "Aprovações", eyebrow: "Governança", description: "Cadastros e pedidos pendentes de aprovação.", icon: ShieldCheck },
  crm: { title: "CRM — Leads", eyebrow: "Comercial", description: "Todos os leads com posição, etapa e responsável.", icon: Handshake },
  crmAgenda: { title: "Agenda de tarefas", eyebrow: "CRM", description: "Tarefas comerciais pendentes e agendadas.", icon: CalendarClock },
  whatsappInbox: { title: "Inbox WhatsApp", eyebrow: "Atendimento", description: "Conversas ativas do WhatsApp em tempo real.", icon: MessageCircle },
  whatsappTemplates: { title: "Templates WhatsApp", eyebrow: "Mensageria", description: "Modelos aprovados para disparos e respostas.", icon: MessageSquare },
  postSale: { title: "Pós-venda WhatsApp", eyebrow: "Retenção", description: "Mensagens agendadas de pós-venda por pedido.", icon: MessageCircle },
  bi: { title: "Business Intelligence", eyebrow: "Análises", description: "Dashboards e relatórios internos configurados.", icon: BarChart3 },
  ai: { title: "Inteligência artificial", eyebrow: "IA aplicada", description: "Recomendações, previsões e classificações do motor.", icon: Sparkles },
  automation: { title: "Automação", eyebrow: "Workflows", description: "Fluxos automatizados e histórico de execuções.", icon: Workflow },
  portal: { title: "Portal do cliente", eyebrow: "Suporte", description: "Chamados abertos e atendimentos do portal.", icon: LifeBuoy },
  settings: { title: "Configurações", eyebrow: "Sistema", description: "Ajustes globais e parâmetros do sistema.", icon: Cog },
  inventory: { title: "Estoque", eyebrow: "Inventário", description: "Visão geral de contagens, alertas e movimentações.", icon: Boxes },
  inventoryAlerts: { title: "Alertas de estoque", eyebrow: "Inventário", description: "Produtos abaixo do mínimo ou zerados.", icon: PackageSearch },
  inventoryCounts: { title: "Contagens de inventário", eyebrow: "Inventário", description: "Contagens realizadas com divergências reais.", icon: ScanLine },
  financeReconciliation: { title: "Conciliação bancária", eyebrow: "Financeiro", description: "Extratos bancários importados para conciliação.", icon: Wallet },
  companies: { title: "Clientes & empresas", eyebrow: "Base cadastral", description: "Empresas cadastradas no sistema com contato e status.", icon: Building2 },
  adminUsers: { title: "Usuários & permissões", eyebrow: "Administração", description: "Perfis e papéis atribuídos aos usuários.", icon: Users },
  adminPromotions: { title: "Promoções", eyebrow: "Administração", description: "Regras de promoção ativas no catálogo público.", icon: Percent },
  adminBanners: { title: "Banners do site", eyebrow: "Administração", description: "Banners e slides publicados no site.", icon: ImageIcon },
  adminSalesTargets: { title: "Metas de vendas", eyebrow: "Administração", description: "Metas atribuídas por vendedor ou equipe.", icon: Target },
  adminAbandonedCarts: { title: "Carrinhos abandonados", eyebrow: "Administração", description: "Carrinhos abertos sem checkout finalizado.", icon: ClipboardList },
  adminPush: { title: "Notificações push", eyebrow: "Administração", description: "Campanhas de push agendadas ou enviadas.", icon: Bell },
};

export interface V2ModulePageProps {
  moduleKey: V2ModuleKey;
}

const PAGE_SIZE = 10;

export function V2ModulePage({ moduleKey }: V2ModulePageProps) {
  const config = MODULES[moduleKey];
  const { data, isLoading, error } = useQuery({
    queryKey: ["v2-module", moduleKey],
    queryFn: () => fetchModuleData(moduleKey),
  });
  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "PENDING" | "PAGO" | "CANCELADO">("ALL");

  useEffect(() => {
    setPage(1);
    setSearchTerm("");
    setStatusFilter("ALL");
  }, [moduleKey]);

  const allRecords = data?.records ?? [];

  const filteredRecords = allRecords.filter((record) => {
    const term = searchTerm.toLowerCase().trim();
    const matchesSearch =
      !term ||
      record.title.toLowerCase().includes(term) ||
      record.subtitle.toLowerCase().includes(term) ||
      (record.status && record.status.toLowerCase().includes(term)) ||
      (record.value && record.value.toLowerCase().includes(term)) ||
      (record.date && record.date.toLowerCase().includes(term)) ||
      record.id.toLowerCase().includes(term);

    if (!matchesSearch) return false;

    if (moduleKey === "orders" && statusFilter !== "ALL") {
      const isPending = record.status ? isPendingPayment(record.status) : false;
      if (statusFilter === "PENDING") return isPending;
      if (statusFilter === "PAGO") return record.status === "PAGO";
      if (statusFilter === "CANCELADO") return record.status === "CANCELADO";
    }

    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageRecords = filteredRecords.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  return (
    <V2InternalShell
      title={config.title}
      eyebrow={config.eyebrow}
      description={config.description}
      actions={
        <Link to="/v3/hoje" className="h-11 px-5 rounded-full font-medium text-sm grid place-items-center" style={{ background: V2.TEAL, color: "#fff" }}>
          Voltar ao Hoje
        </Link>
      }
    >
      {error ? (
        <StateCard title="Não foi possível carregar" description={error instanceof Error ? error.message : "Falha ao buscar os dados reais."} />
      ) : isLoading || !data ? (
        <StateCard title="Carregando dados reais" description="Consultando o banco de dados do sistema." />
      ) : (
        <div className="grid gap-6">
          <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {data.stats.map((stat) => (
              <div key={stat.label} className="rounded-2xl p-5 border shadow-sm" style={{ background: V2.LIGHT_SURFACE, borderColor: V2.LIGHT_BORDER }}>
                <div className="text-[10px] uppercase tracking-[0.2em] font-semibold" style={{ color: V2.LIGHT_MUTED }}>{stat.label}</div>
                <div className="mt-2 text-2xl font-semibold" style={{ color: V2.LIGHT_TEXT }}>{stat.value}</div>
                <div className="mt-1 text-xs" style={{ color: V2.LIGHT_MUTED }}>{stat.helper}</div>
              </div>
            ))}
          </section>

          <section className="rounded-2xl border shadow-sm overflow-hidden" style={{ background: V2.LIGHT_SURFACE, borderColor: V2.LIGHT_BORDER }}>
            <div className="p-5 border-b space-y-4" style={{ borderColor: V2.LIGHT_BORDER }}>
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl grid place-items-center" style={{ background: V2.TEAL_LIGHT, color: V2.TEAL }}>
                    <config.icon className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="font-semibold text-lg">Registros</h2>
                    <p className="text-xs" style={{ color: V2.LIGHT_MUTED }}>
                      {filteredRecords.length > 0
                        ? `${filteredRecords.length} de ${allRecords.length} registro(s) · página ${currentPage} de ${totalPages}`
                        : "Lista gerada somente com dados do banco."}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
                <div className="relative flex-1">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: V2.LIGHT_MUTED }} />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
                    placeholder={moduleKey === "orders" ? "Buscar por código (#1234), cliente, valor, status..." : "Buscar registros..."}
                    className="w-full h-10 pl-10 pr-9 rounded-xl border text-sm focus:outline-none transition-colors"
                    style={{ borderColor: V2.LIGHT_BORDER, background: V2.LIGHT_SURFACE_2, color: V2.LIGHT_TEXT }}
                  />
                  {searchTerm && (
                    <button
                      type="button"
                      onClick={() => { setSearchTerm(""); setPage(1); }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-md"
                      style={{ color: V2.LIGHT_MUTED }}
                      title="Limpar busca"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {moduleKey === "orders" && (
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 text-xs">
                    <button
                      type="button"
                      onClick={() => { setStatusFilter("ALL"); setPage(1); }}
                      className={`h-9 px-3 rounded-xl font-semibold border transition-all ${statusFilter === "ALL" ? "shadow-sm" : ""}`}
                      style={{
                        background: statusFilter === "ALL" ? V2.TEAL : V2.LIGHT_SURFACE_2,
                        color: statusFilter === "ALL" ? "#fff" : V2.LIGHT_TEXT,
                        borderColor: statusFilter === "ALL" ? V2.TEAL : V2.LIGHT_BORDER,
                      }}
                    >
                      Todos
                    </button>
                    <button
                      type="button"
                      onClick={() => { setStatusFilter("PENDING"); setPage(1); }}
                      className={`h-9 px-3 rounded-xl font-semibold border transition-all ${statusFilter === "PENDING" ? "shadow-sm" : ""}`}
                      style={{
                        background: statusFilter === "PENDING" ? "#f59e0b" : V2.LIGHT_SURFACE_2,
                        color: statusFilter === "PENDING" ? "#fff" : V2.LIGHT_TEXT,
                        borderColor: statusFilter === "PENDING" ? "#f59e0b" : V2.LIGHT_BORDER,
                      }}
                    >
                      Pendentes
                    </button>
                    <button
                      type="button"
                      onClick={() => { setStatusFilter("PAGO"); setPage(1); }}
                      className={`h-9 px-3 rounded-xl font-semibold border transition-all ${statusFilter === "PAGO" ? "shadow-sm" : ""}`}
                      style={{
                        background: statusFilter === "PAGO" ? "#059669" : V2.LIGHT_SURFACE_2,
                        color: statusFilter === "PAGO" ? "#fff" : V2.LIGHT_TEXT,
                        borderColor: statusFilter === "PAGO" ? "#059669" : V2.LIGHT_BORDER,
                      }}
                    >
                      Pagos
                    </button>
                  </div>
                )}
              </div>
            </div>

            {filteredRecords.length === 0 ? (
              <div className="p-8 text-center text-sm" style={{ color: V2.LIGHT_MUTED }}>
                {searchTerm || statusFilter !== "ALL"
                  ? "Nenhum registro encontrado para esta busca."
                  : "Nenhum registro encontrado para este módulo."}
              </div>
            ) : (
              <>
                {moduleKey === "orders" ? (
                  <OrdersRecords records={pageRecords} />
                ) : (
                  <div className="divide-y" style={{ borderColor: V2.LIGHT_BORDER }}>
                    {pageRecords.map((record) => (
                      <div key={record.id} className="p-5 grid grid-cols-1 md:grid-cols-[1fr_auto_auto] gap-3 md:items-center">
                        <div className="min-w-0">
                          <p className="font-semibold truncate" style={{ color: V2.LIGHT_TEXT }}>{record.title}</p>
                          <p className="text-xs mt-0.5 truncate" style={{ color: V2.LIGHT_MUTED }}>{record.subtitle}</p>
                        </div>
                        {record.status && <span className="justify-self-start md:justify-self-end text-[10px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full border" style={{ color: V2.TEAL, borderColor: V2.TEAL, background: V2.TEAL_LIGHT }}>{record.status}</span>}
                        <div className="text-right">
                          {record.value && <p className="font-semibold text-sm" style={{ color: V2.LIGHT_TEXT }}>{record.value}</p>}
                          {record.date && <p className="text-[11px]" style={{ color: V2.LIGHT_MUTED }}>{record.date}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {totalPages > 1 && (
                  <div className="p-4 border-t flex items-center justify-between gap-3 flex-wrap" style={{ borderColor: V2.LIGHT_BORDER }}>
                    <span className="text-xs" style={{ color: V2.LIGHT_MUTED }}>
                      Mostrando {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filteredRecords.length)} de {filteredRecords.length}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setPage(Math.max(1, currentPage - 1))}
                        disabled={currentPage <= 1}
                        className="h-9 px-4 rounded-full text-xs font-semibold border disabled:opacity-40"
                        style={{ borderColor: V2.LIGHT_BORDER, color: V2.LIGHT_TEXT }}
                      >
                        Anterior
                      </button>
                      <span className="text-xs font-semibold" style={{ color: V2.LIGHT_TEXT }}>{currentPage}/{totalPages}</span>
                      <button
                        type="button"
                        onClick={() => setPage(Math.min(totalPages, currentPage + 1))}
                        disabled={currentPage >= totalPages}
                        className="h-9 px-4 rounded-full text-xs font-semibold disabled:opacity-40"
                        style={{ background: V2.TEAL, color: "#fff" }}
                      >
                        Próxima
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </section>

        </div>
      )}
    </V2InternalShell>
  );
}

function StateCard({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-2xl p-8 border text-center shadow-sm" style={{ background: V2.LIGHT_SURFACE, borderColor: V2.LIGHT_BORDER }}>
      <h2 className="font-semibold text-lg">{title}</h2>
      <p className="text-sm mt-1" style={{ color: V2.LIGHT_MUTED }}>{description}</p>
    </div>
  );
}

function OrdersRecords({ records }: { records: ModuleRecord[] }) {
  const queryClient = useQueryClient();
  const confirmPay = useConfirmPayment();
  const { data: bankAccounts = [] } = useBankAccounts();
  const [selected, setSelected] = useState<ModuleRecord | null>(null);
  const [payTipo, setPayTipo] = useState<"PIX" | "CARTAO" | "DINHEIRO">("PIX");
  const [payAccountId, setPayAccountId] = useState("");
  const [payParcelas, setPayParcelas] = useState(1);
  const [payObs, setPayObs] = useState("");

  useEffect(() => {
    if (!payAccountId && bankAccounts.length > 0) setPayAccountId(bankAccounts[0].id);
  }, [bankAccounts, payAccountId]);

  const openPayment = (record: ModuleRecord) => {
    setSelected(record);
    setPayTipo("PIX");
    setPayParcelas(1);
    setPayObs("");
  };

  const confirmSelectedPayment = () => {
    if (!selected) return;
    const account = bankAccounts.find((item) => item.id === payAccountId);
    if (!account) {
      toast.error("Selecione uma conta bancária para receber esse pagamento");
      return;
    }

    confirmPay.mutate({
      order_id: selected.id,
      company_id: selected.companyId ?? null,
      total: Number(selected.total ?? 0),
      tipo: payTipo,
      conta: account.nome,
      account_id: account.id,
      parcelas: payTipo === "CARTAO" ? payParcelas : 1,
      observacao: payObs.trim() || undefined,
    }, {
      onSuccess: () => {
        toast.success("Pagamento confirmado");
        setSelected(null);
        queryClient.invalidateQueries({ queryKey: ["v2-module", "orders"] });
      },
      onError: (error) => toast.error(error instanceof Error ? error.message : "Erro ao confirmar pagamento"),
    });
  };

  return (
    <>
      <div className="divide-y" style={{ borderColor: V2.LIGHT_BORDER }}>
        {records.map((record) => {
          const pending = record.status ? isPendingPayment(record.status) : false;
          return (
            <div key={record.id} className="p-5 grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-4 lg:items-center">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold truncate" style={{ color: V2.LIGHT_TEXT }}>{record.title}</p>
                  {record.status && (
                    <span className="text-[10px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full border" style={{ color: V2.TEAL, borderColor: V2.TEAL, background: V2.TEAL_LIGHT }}>
                      {record.status.replace(/_/g, " ")}
                    </span>
                  )}
                </div>
                <p className="text-xs mt-0.5 truncate" style={{ color: V2.LIGHT_MUTED }}>{record.subtitle}</p>
                {record.date && <p className="text-[11px] mt-1" style={{ color: V2.LIGHT_MUTED }}>{record.date}</p>}
              </div>

              <div className="flex flex-col sm:flex-row lg:justify-end gap-2 sm:items-center">
                {record.value && <p className="font-semibold text-sm sm:min-w-24 sm:text-right" style={{ color: V2.LIGHT_TEXT }}>{record.value}</p>}
                {pending && (
                  <button
                    type="button"
                    onClick={() => openPayment(record)}
                    className="h-10 px-4 rounded-full text-xs font-semibold inline-flex items-center justify-center gap-2"
                    style={{ background: V2.TEAL, color: V2.TEXT }}
                  >
                    <CheckCircle2 className="h-4 w-4" /> Confirmar pagamento
                  </button>
                )}
                <Link
                  to="/orders/$id" search={{ edit: false }}
                  params={{ id: record.id }}
                  className="h-10 px-4 rounded-full text-xs font-semibold inline-flex items-center justify-center gap-2 border"
                  style={{ borderColor: V2.LIGHT_BORDER, color: V2.LIGHT_TEXT, background: V2.LIGHT_SURFACE_2 }}
                >
                  Abrir detalhes
                </Link>
              </div>
            </div>
          );
        })}
      </div>

      <Dialog open={!!selected} onOpenChange={(open) => { if (!open) setSelected(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Confirmar pagamento — {selected ? brl(Number(selected.total ?? 0)) : ""}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-xl border p-3 text-sm" style={{ borderColor: V2.LIGHT_BORDER }}>
              <p className="font-semibold">{selected?.subtitle ?? "Cliente"}</p>
              <p className="text-xs text-muted-foreground">Pedido {selected ? orderCodeHash(selected.id, selected.subtitle) : ""}</p>
            </div>

            <div className="space-y-1.5">
              <Label>Forma de pagamento</Label>
              <Select value={payTipo} onValueChange={(value) => setPayTipo(value as "PIX" | "CARTAO" | "DINHEIRO")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="PIX">PIX</SelectItem>
                  <SelectItem value="CARTAO">Cartão</SelectItem>
                  <SelectItem value="DINHEIRO">Dinheiro</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Conta que recebeu</Label>
              {bankAccounts.length === 0 ? (
                <p className="text-sm text-muted-foreground">Cadastre uma conta bancária no Financeiro antes de confirmar.</p>
              ) : (
                <Select value={payAccountId} onValueChange={setPayAccountId}>
                  <SelectTrigger><SelectValue placeholder="Selecione a conta" /></SelectTrigger>
                  <SelectContent>
                    {bankAccounts.map((account) => (
                      <SelectItem key={account.id} value={account.id}>{account.nome}{account.banco ? ` — ${account.banco}` : ""}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {payTipo === "CARTAO" && selected && (
              <div className="space-y-1.5">
                <Label>Parcelas</Label>
                <Select value={String(payParcelas)} onValueChange={(value) => setPayParcelas(Number(value))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 12 }, (_, index) => index + 1).map((parcel) => (
                      <SelectItem key={parcel} value={String(parcel)}>{parcel}x de {brl(Number(selected.total ?? 0) / parcel)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-1.5">
              <Label>Observação</Label>
              <Input placeholder="Ex: comprovante conferido" value={payObs} onChange={(event) => setPayObs(event.target.value)} />
            </div>
          </div>

          <DialogFooter>
            <button type="button" className="h-10 px-4 rounded-md border text-sm font-medium" onClick={() => setSelected(null)}>
              Cancelar
            </button>
            <button
              type="button"
              disabled={!payAccountId || confirmPay.isPending}
              onClick={confirmSelectedPayment}
              className="h-10 px-4 rounded-md text-sm font-semibold disabled:opacity-50 inline-flex items-center justify-center gap-2"
              style={{ background: V2.TEAL, color: V2.TEXT }}
            >
              <CreditCard className="h-4 w-4" /> {confirmPay.isPending ? "Salvando…" : "Confirmar pagamento"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

async function fetchModuleData(moduleKey: V2ModuleKey): Promise<ModuleData> {
  switch (moduleKey) {
    case "trips": return fetchTripsData();
    case "visitSale": return fetchVisitSaleData();
    case "orders": return fetchOrdersData();
    case "catalogAdmin": return fetchCatalogData();
    case "prospecting": return fetchProspectingData();
    case "campaigns": return fetchCampaignsData();
    case "whatsappCampaigns": return fetchWhatsappData();
    case "field": return fetchFieldData();
    case "routes": return fetchRoutesData();
    case "finance": return fetchFinanceData();
    case "approvals": return fetchApprovalsData();
    case "crm": return fetchCrmData();
    case "crmAgenda": return fetchCrmAgendaData();
    case "whatsappInbox": return fetchWhatsappInboxData();
    case "whatsappTemplates": return fetchWhatsappTemplatesData();
    case "postSale": return fetchPostSaleData();
    case "bi": return fetchBiData();
    case "ai": return fetchAiData();
    case "automation": return fetchAutomationData();
    case "portal": return fetchPortalData();
    case "settings": return fetchSettingsData();
    case "inventory": return fetchInventoryData();
    case "inventoryAlerts": return fetchInventoryAlertsData();
    case "inventoryCounts": return fetchInventoryCountsData();
    case "financeReconciliation": return fetchFinanceReconciliationData();
    case "companies": return fetchCompaniesData();
    case "adminUsers": return fetchAdminUsersData();
    case "adminPromotions": return fetchAdminPromotionsData();
    case "adminBanners": return fetchAdminBannersData();
    case "adminSalesTargets": return fetchAdminSalesTargetsData();
    case "adminAbandonedCarts": return fetchAdminAbandonedCartsData();
    case "adminPush": return fetchAdminPushData();
  }
}

async function fetchTripsData(): Promise<ModuleData> {
  const [total, open, rows] = await Promise.all([
    supabase.from("trips").select("*", { count: "exact", head: true }),
    supabase.from("trips").select("*", { count: "exact", head: true }).eq("status", "open"),
    supabase.from("trips").select("id,nome,status,cidade,estado,opened_at,created_at").order("created_at", { ascending: false }).limit(200),
  ]);
  assertNoError(total.error ?? open.error ?? rows.error);
  const records = (rows.data ?? []).map((row) => ({ id: row.id, title: row.nome, subtitle: [row.cidade, row.estado].filter(Boolean).join(" — ") || "Sem local informado", status: row.status, date: formatDate(row.opened_at ?? row.created_at) }));
  return { stats: [{ label: "Viagens", value: countText(total.count), helper: "total cadastrado" }, { label: "Abertas", value: countText(open.count), helper: "em operação" }, { label: "Recentes", value: countText(records.length), helper: "últimos registros" }], records };
}

async function fetchVisitSaleData(): Promise<ModuleData> {
  const [visits, leads, rows] = await Promise.all([
    supabase.from("visits").select("*", { count: "exact", head: true }),
    supabase.from("leads").select("*", { count: "exact", head: true }),
    supabase.from("visits").select("id,created_at,checkin_at,checkout_at,resultado,leads(empresa,contato,cidade,estado)").order("created_at", { ascending: false }).limit(200),
  ]);
  assertNoError(visits.error ?? leads.error ?? rows.error);
  type Row = { id: string; created_at: string; checkin_at: string | null; checkout_at: string | null; resultado: string | null; leads: { empresa: string; contato: string; cidade: string | null; estado: string | null } | null };
  const records = ((rows.data ?? []) as unknown as Row[]).map((row) => ({ id: row.id, title: row.leads?.empresa ?? "Visita sem lead vinculado", subtitle: [row.leads?.contato, row.leads?.cidade, row.leads?.estado].filter(Boolean).join(" · ") || "Atendimento em visita", status: row.resultado ?? (row.checkout_at ? "finalizada" : row.checkin_at ? "em visita" : "planejada"), date: formatDate(row.created_at) }));
  return { stats: [{ label: "Visitas", value: countText(visits.count), helper: "registradas" }, { label: "Leads", value: countText(leads.count), helper: "disponíveis para venda" }, { label: "Recentes", value: countText(records.length), helper: "últimas visitas" }], records };
}

async function fetchOrdersData(): Promise<ModuleData> {
  const month = new Date(); month.setMonth(month.getMonth() - 1);
  const [total, pending, monthRows, rows] = await Promise.all([
    supabase.from("orders").select("*", { count: "exact", head: true }),
    supabase.from("orders").select("*", { count: "exact", head: true }).in("status", ["PENDENTE", "AGUARDANDO_PAGAMENTO"]),
    supabase.from("orders").select("total").gte("created_at", month.toISOString()),
    supabase.from("orders").select("id,status,total,company_id,created_at,companies(legal_name,trade_name)").order("created_at", { ascending: false }).limit(200),
  ]);
  assertNoError(total.error ?? pending.error ?? monthRows.error ?? rows.error);
  type Row = { id: string; status: string; total: number; company_id: string | null; created_at: string; companies: { legal_name: string; trade_name: string | null } | null };
  const monthTotal = (monthRows.data ?? []).reduce((sum, row) => sum + Number(row.total ?? 0), 0);
  const records = ((rows.data ?? []) as unknown as Row[]).map((row) => ({ id: row.id, title: orderCodeHash(row.id, row.companies?.trade_name ?? row.companies?.legal_name), subtitle: row.companies?.trade_name ?? row.companies?.legal_name ?? "Cliente não informado", status: row.status, value: brl(Number(row.total)), date: formatDate(row.created_at), total: Number(row.total), companyId: row.company_id }));
  return { stats: [{ label: "Pedidos", value: countText(total.count), helper: "total no sistema" }, { label: "Pendentes", value: countText(pending.count), helper: "aguardando ação" }, { label: "Últimos 30 dias", value: brl(monthTotal), helper: "faturamento bruto" }], records };
}

async function fetchCatalogData(): Promise<ModuleData> {
  const [total, active, stock, rows] = await Promise.all([
    supabase.from("products").select("*", { count: "exact", head: true }),
    supabase.from("products").select("*", { count: "exact", head: true }).eq("status", true),
    supabase.from("products").select("estoque,estoque_minimo"),
    supabase.from("products").select("id,nome,sku,estoque,estoque_minimo,preco_unitario,status").order("updated_at", { ascending: false }).limit(200),
  ]);
  assertNoError(total.error ?? active.error ?? stock.error ?? rows.error);
  const low = (stock.data ?? []).filter((row) => Number(row.estoque) > 0 && Number(row.estoque) <= Number(row.estoque_minimo)).length;
  const records = (rows.data ?? []).map((row) => ({ id: row.id, title: row.nome, subtitle: `SKU ${row.sku} · estoque ${row.estoque}`, status: row.status ? "ativo" : "inativo", value: brl(Number(row.preco_unitario)) }));
  return { stats: [{ label: "Produtos", value: countText(total.count), helper: "cadastrados" }, { label: "Ativos", value: countText(active.count), helper: "visíveis no catálogo" }, { label: "Baixo estoque", value: countText(low), helper: "abaixo do mínimo" }], records };
}

async function fetchProspectingData(): Promise<ModuleData> {
  const [total, open, rows] = await Promise.all([
    supabase.from("leads").select("*", { count: "exact", head: true }),
    supabase.from("leads").select("*", { count: "exact", head: true }).neq("status", "PEDIDO"),
    supabase.from("leads").select("id,empresa,contato,cidade,estado,status,score,created_at").order("created_at", { ascending: false }).limit(200),
  ]);
  assertNoError(total.error ?? open.error ?? rows.error);
  const records = (rows.data ?? []).map((row) => ({ id: row.id, title: row.empresa, subtitle: [row.contato, row.cidade, row.estado].filter(Boolean).join(" · "), status: row.status, value: `${row.score} pts`, date: formatDate(row.created_at) }));
  return { stats: [{ label: "Leads", value: countText(total.count), helper: "total captado" }, { label: "Em aberto", value: countText(open.count), helper: "a trabalhar" }, { label: "Recentes", value: countText(records.length), helper: "últimos cadastros" }], records };
}

async function fetchCampaignsData(): Promise<ModuleData> {
  const [total, active, rows] = await Promise.all([
    supabase.from("commercial_campaigns").select("*", { count: "exact", head: true }),
    supabase.from("commercial_campaigns").select("*", { count: "exact", head: true }).eq("status", "EM_EXECUCAO"),
    supabase.from("commercial_campaigns").select("id,nome,status,objetivo,meta_valor,created_at").order("created_at", { ascending: false }).limit(200),
  ]);
  assertNoError(total.error ?? active.error ?? rows.error);
  const records = (rows.data ?? []).map((row) => ({ id: row.id, title: row.nome, subtitle: row.objetivo ?? "Campanha comercial", status: row.status, value: row.meta_valor ? brl(Number(row.meta_valor)) : undefined, date: formatDate(row.created_at) }));
  return { stats: [{ label: "Campanhas", value: countText(total.count), helper: "total criado" }, { label: "Ativas", value: countText(active.count), helper: "em execução" }, { label: "Recentes", value: countText(records.length), helper: "últimas campanhas" }], records };
}

async function fetchWhatsappData(): Promise<ModuleData> {
  const [total, sending, rows] = await Promise.all([
    supabase.from("whatsapp_campaigns").select("*", { count: "exact", head: true }),
    supabase.from("whatsapp_campaigns").select("*", { count: "exact", head: true }).eq("status", "SENDING"),
    supabase.from("whatsapp_campaigns").select("id,nome,status,segmento,send_limit,created_at").order("created_at", { ascending: false }).limit(200),
  ]);
  assertNoError(total.error ?? sending.error ?? rows.error);
  const records = (rows.data ?? []).map((row) => ({ id: row.id, title: row.nome, subtitle: row.segmento ?? "Todos os segmentos", status: row.status, value: row.send_limit ? `${row.send_limit} envios` : undefined, date: formatDate(row.created_at) }));
  return { stats: [{ label: "Campanhas", value: countText(total.count), helper: "WhatsApp" }, { label: "Enviando", value: countText(sending.count), helper: "em processamento" }, { label: "Recentes", value: countText(records.length), helper: "últimos disparos" }], records };
}

async function fetchFieldData(): Promise<ModuleData> {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const [total, todayCount, rows] = await Promise.all([
    supabase.from("visits").select("*", { count: "exact", head: true }),
    supabase.from("visits").select("*", { count: "exact", head: true }).gte("created_at", today.toISOString()),
    supabase.from("visits").select("id,created_at,resultado,duracao_min,leads(empresa,cidade,estado)").order("created_at", { ascending: false }).limit(200),
  ]);
  assertNoError(total.error ?? todayCount.error ?? rows.error);
  type Row = { id: string; created_at: string; resultado: string | null; duracao_min: number | null; leads: { empresa: string; cidade: string | null; estado: string | null } | null };
  const records = ((rows.data ?? []) as unknown as Row[]).map((row) => ({ id: row.id, title: row.leads?.empresa ?? "Visita sem lead", subtitle: [row.leads?.cidade, row.leads?.estado].filter(Boolean).join(" — ") || "Campo", status: row.resultado ?? "registrada", value: row.duracao_min ? `${row.duracao_min} min` : undefined, date: formatDate(row.created_at) }));
  return { stats: [{ label: "Visitas", value: countText(total.count), helper: "total" }, { label: "Hoje", value: countText(todayCount.count), helper: "registradas" }, { label: "Recentes", value: countText(records.length), helper: "últimas ações" }], records };
}

async function fetchRoutesData(): Promise<ModuleData> {
  const [total, active, rows] = await Promise.all([
    supabase.from("route_plans").select("*", { count: "exact", head: true }),
    supabase.from("route_plans").select("*", { count: "exact", head: true }).neq("status", "CONCLUIDA"),
    supabase.from("route_plans").select("id,nome,status,cidade,estado,data,created_at").order("created_at", { ascending: false }).limit(200),
  ]);
  assertNoError(total.error ?? active.error ?? rows.error);
  const records = (rows.data ?? []).map((row) => ({ id: row.id, title: row.nome, subtitle: [row.cidade, row.estado].filter(Boolean).join(" — ") || "Rota planejada", status: row.status, date: formatDate(row.data ?? row.created_at) }));
  return { stats: [{ label: "Rotas", value: countText(total.count), helper: "total" }, { label: "Em aberto", value: countText(active.count), helper: "a executar" }, { label: "Recentes", value: countText(records.length), helper: "últimos planos" }], records };
}

async function fetchFinanceData(): Promise<ModuleData> {
  const month = new Date(); month.setMonth(month.getMonth() - 1);
  const [total, monthRows, rows] = await Promise.all([
    supabase.from("financial_entries").select("*", { count: "exact", head: true }),
    supabase.from("financial_entries").select("tipo,valor").gte("data", month.toISOString().slice(0, 10)),
    supabase.from("financial_entries").select("id,descricao,tipo,valor,data,created_at").order("created_at", { ascending: false }).limit(200),
  ]);
  assertNoError(total.error ?? monthRows.error ?? rows.error);
  const receitas = (monthRows.data ?? []).filter((row) => row.tipo === "RECEITA").reduce((sum, row) => sum + Number(row.valor ?? 0), 0);
  const despesas = (monthRows.data ?? []).filter((row) => row.tipo === "DESPESA").reduce((sum, row) => sum + Number(row.valor ?? 0), 0);
  const records = (rows.data ?? []).map((row) => ({ id: row.id, title: row.descricao, subtitle: row.tipo, status: row.tipo, value: brl(Number(row.valor)), date: formatDate(row.data ?? row.created_at) }));
  return { stats: [{ label: "Lançamentos", value: countText(total.count), helper: "total" }, { label: "Receitas 30d", value: brl(receitas), helper: "entradas" }, { label: "Despesas 30d", value: brl(despesas), helper: "saídas" }], records };
}

async function fetchApprovalsData(): Promise<ModuleData> {
  const [pendingCompanies, pendingOrders, rows] = await Promise.all([
    supabase.from("companies").select("*", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("orders").select("*", { count: "exact", head: true }).in("status", ["PENDENTE", "AGUARDANDO_PAGAMENTO"]),
    supabase.from("companies").select("id,legal_name,trade_name,phone,status,created_at").eq("status", "pending").order("created_at", { ascending: false }).limit(200),
  ]);
  assertNoError(pendingCompanies.error ?? pendingOrders.error ?? rows.error);
  const records = (rows.data ?? []).map((row) => ({ id: row.id, title: row.trade_name ?? row.legal_name, subtitle: row.phone, status: row.status, date: formatDate(row.created_at) }));
  return { stats: [{ label: "Empresas", value: countText(pendingCompanies.count), helper: "pendentes" }, { label: "Pedidos", value: countText(pendingOrders.count), helper: "aguardando" }, { label: "Fila", value: countText(records.length), helper: "cadastros recentes" }], records };
}

async function fetchCrmData(): Promise<ModuleData> {
  const [total, active, rows] = await Promise.all([
    supabase.from("leads").select("*", { count: "exact", head: true }),
    supabase.from("leads").select("*", { count: "exact", head: true }).not("status", "in", "(PEDIDO,CLIENTE)"),
    supabase.from("leads").select("id,empresa,contato,status,cidade,estado,score,ultimo_contato,created_at").order("updated_at", { ascending: false }).limit(10),
  ]);
  assertNoError(total.error ?? active.error ?? rows.error);
  const records = (rows.data ?? []).map((row) => ({ id: row.id, title: row.empresa, subtitle: [row.contato, row.cidade, row.estado].filter(Boolean).join(" · "), status: row.status, value: `${row.score ?? 0} pts`, date: formatDate(row.ultimo_contato ?? row.created_at) }));
  return { stats: [{ label: "Leads", value: countText(total.count), helper: "no funil" }, { label: "Em aberto", value: countText(active.count), helper: "sem pedido ainda" }, { label: "Movimentados", value: countText(records.length), helper: "recentes" }], records };
}

async function fetchCrmAgendaData(): Promise<ModuleData> {
  const [total, pending, rows] = await Promise.all([
    supabase.from("lead_tasks").select("*", { count: "exact", head: true }),
    supabase.from("lead_tasks").select("*", { count: "exact", head: true }).eq("status", "PENDENTE"),
    supabase.from("lead_tasks").select("id,titulo,data,hora,status,leads(empresa)").order("data", { ascending: true }).limit(10),
  ]);
  assertNoError(total.error ?? pending.error ?? rows.error);
  type Row = { id: string; titulo: string; data: string | null; hora: string | null; status: string; leads: { empresa: string } | null };
  const records = ((rows.data ?? []) as unknown as Row[]).map((row) => ({ id: row.id, title: row.titulo, subtitle: row.leads?.empresa ?? "Sem lead vinculado", status: row.status, date: [formatDate(row.data), row.hora].filter(Boolean).join(" · ") || undefined }));
  return { stats: [{ label: "Tarefas", value: countText(total.count), helper: "cadastradas" }, { label: "Pendentes", value: countText(pending.count), helper: "a executar" }, { label: "Próximas", value: countText(records.length), helper: "no radar" }], records };
}

async function fetchWhatsappInboxData(): Promise<ModuleData> {
  const [total, unread, rows] = await Promise.all([
    supabase.from("whatsapp_conversations").select("*", { count: "exact", head: true }),
    supabase.from("whatsapp_conversations").select("*", { count: "exact", head: true }).gt("unread_count", 0),
    supabase.from("whatsapp_conversations").select("id,phone,contact_name,last_message_preview,last_message_at,unread_count,status").order("last_message_at", { ascending: false, nullsFirst: false }).limit(10),
  ]);
  assertNoError(total.error ?? unread.error ?? rows.error);
  const records = (rows.data ?? []).map((row) => ({ id: row.id, title: row.contact_name ?? row.phone, subtitle: row.last_message_preview ?? "Sem prévia", status: row.status ?? undefined, value: row.unread_count > 0 ? `${row.unread_count} novas` : undefined, date: formatDate(row.last_message_at) }));
  return { stats: [{ label: "Conversas", value: countText(total.count), helper: "totais" }, { label: "Não lidas", value: countText(unread.count), helper: "aguardando resposta" }, { label: "Recentes", value: countText(records.length), helper: "últimos contatos" }], records };
}

async function fetchWhatsappTemplatesData(): Promise<ModuleData> {
  const [total, active, rows] = await Promise.all([
    supabase.from("whatsapp_templates").select("*", { count: "exact", head: true }),
    supabase.from("whatsapp_templates").select("*", { count: "exact", head: true }).eq("ativo", true),
    supabase.from("whatsapp_templates").select("id,nome,categoria,ativo,updated_at").order("updated_at", { ascending: false }).limit(10),
  ]);
  assertNoError(total.error ?? active.error ?? rows.error);
  const records = (rows.data ?? []).map((row) => ({ id: row.id, title: row.nome, subtitle: row.categoria ?? "Sem categoria", status: row.ativo ? "ativo" : "inativo", date: formatDate(row.updated_at) }));
  return { stats: [{ label: "Templates", value: countText(total.count), helper: "cadastrados" }, { label: "Ativos", value: countText(active.count), helper: "em uso" }, { label: "Categorias", value: countText(new Set((rows.data ?? []).map((r) => r.categoria)).size), helper: "no total" }], records };
}

async function fetchPostSaleData(): Promise<ModuleData> {
  const [total, pending, rows] = await Promise.all([
    supabase.from("post_sale_messages").select("*", { count: "exact", head: true }),
    supabase.from("post_sale_messages").select("*", { count: "exact", head: true }).eq("status", "PENDING"),
    supabase.from("post_sale_messages").select("id,phone,status,send_at,sent_at").order("send_at", { ascending: false }).limit(10),
  ]);
  assertNoError(total.error ?? pending.error ?? rows.error);
  const records = (rows.data ?? []).map((row) => ({ id: row.id, title: row.phone ?? "Sem telefone", subtitle: `Envio programado ${formatDate(row.send_at)}`, status: row.status, date: row.sent_at ? `Enviado ${formatDate(row.sent_at)}` : undefined }));
  return { stats: [{ label: "Mensagens", value: countText(total.count), helper: "no pipeline" }, { label: "Pendentes", value: countText(pending.count), helper: "aguardando envio" }, { label: "Recentes", value: countText(records.length), helper: "últimos gatilhos" }], records };
}

async function fetchBiData(): Promise<ModuleData> {
  const [total, shared, rows] = await Promise.all([
    supabase.from("dashboards").select("*", { count: "exact", head: true }),
    supabase.from("dashboards").select("*", { count: "exact", head: true }).eq("is_shared", true),
    supabase.from("dashboards").select("id,nome,tipo,is_shared,updated_at").order("updated_at", { ascending: false }).limit(10),
  ]);
  assertNoError(total.error ?? shared.error ?? rows.error);
  const records = (rows.data ?? []).map((row) => ({ id: row.id, title: row.nome, subtitle: row.tipo ?? "Dashboard", status: row.is_shared ? "compartilhado" : "privado", date: formatDate(row.updated_at) }));
  return { stats: [{ label: "Dashboards", value: countText(total.count), helper: "criados" }, { label: "Compartilhados", value: countText(shared.count), helper: "com equipe" }, { label: "Atualizados", value: countText(records.length), helper: "recentes" }], records };
}

async function fetchAiData(): Promise<ModuleData> {
  const [total, high, rows] = await Promise.all([
    supabase.from("ai_recommendations").select("*", { count: "exact", head: true }),
    supabase.from("ai_recommendations").select("*", { count: "exact", head: true }).eq("prioridade", "ALTA"),
    supabase.from("ai_recommendations").select("id,titulo,descricao,tipo,prioridade,status,created_at").order("created_at", { ascending: false }).limit(10),
  ]);
  assertNoError(total.error ?? high.error ?? rows.error);
  const records = (rows.data ?? []).map((row) => ({ id: row.id, title: row.titulo, subtitle: row.descricao ?? row.tipo, status: row.prioridade ?? row.status, date: formatDate(row.created_at) }));
  return { stats: [{ label: "Recomendações", value: countText(total.count), helper: "geradas" }, { label: "Alta prioridade", value: countText(high.count), helper: "para ação" }, { label: "Recentes", value: countText(records.length), helper: "últimas" }], records };
}

async function fetchAutomationData(): Promise<ModuleData> {
  const [total, active, rows] = await Promise.all([
    supabase.from("workflows").select("*", { count: "exact", head: true }).is("deleted_at", null),
    supabase.from("workflows").select("*", { count: "exact", head: true }).eq("status", "ATIVO").is("deleted_at", null),
    supabase.from("workflows").select("id,nome,categoria,status,execucoes_count,falhas_count,last_run_at").is("deleted_at", null).order("last_run_at", { ascending: false, nullsFirst: false }).limit(10),
  ]);
  assertNoError(total.error ?? active.error ?? rows.error);
  const records = (rows.data ?? []).map((row) => ({ id: row.id, title: row.nome, subtitle: row.categoria ?? "Workflow", status: row.status, value: `${row.execucoes_count ?? 0} execuções · ${row.falhas_count ?? 0} falhas`, date: formatDate(row.last_run_at) }));
  return { stats: [{ label: "Workflows", value: countText(total.count), helper: "cadastrados" }, { label: "Ativos", value: countText(active.count), helper: "em execução" }, { label: "Recentes", value: countText(records.length), helper: "últimas execuções" }], records };
}

async function fetchPortalData(): Promise<ModuleData> {
  const [total, open, rows] = await Promise.all([
    supabase.from("customer_support").select("*", { count: "exact", head: true }),
    supabase.from("customer_support").select("*", { count: "exact", head: true }).in("status", ["ABERTO", "EM_ANDAMENTO"]),
    supabase.from("customer_support").select("id,assunto,canal,status,prioridade,created_at").order("created_at", { ascending: false }).limit(10),
  ]);
  assertNoError(total.error ?? open.error ?? rows.error);
  const records = (rows.data ?? []).map((row) => ({ id: row.id, title: row.assunto, subtitle: `${row.canal ?? "portal"} · ${row.prioridade ?? "normal"}`, status: row.status, date: formatDate(row.created_at) }));
  return { stats: [{ label: "Chamados", value: countText(total.count), helper: "total" }, { label: "Abertos", value: countText(open.count), helper: "aguardando" }, { label: "Recentes", value: countText(records.length), helper: "últimos contatos" }], records };
}

async function fetchSettingsData(): Promise<ModuleData> {
  const [total, rows] = await Promise.all([
    supabase.from("system_settings").select("*", { count: "exact", head: true }),
    supabase.from("system_settings").select("id,categoria,chave,valor,updated_at").order("updated_at", { ascending: false }).limit(10),
  ]);
  assertNoError(total.error ?? rows.error);
  const cats = new Set((rows.data ?? []).map((r) => r.categoria)).size;
  const records = (rows.data ?? []).map((row) => ({ id: row.id, title: row.chave, subtitle: row.categoria ?? "Sistema", value: typeof row.valor === "string" ? row.valor : JSON.stringify(row.valor).slice(0, 40), date: formatDate(row.updated_at) }));
  return { stats: [{ label: "Ajustes", value: countText(total.count), helper: "cadastrados" }, { label: "Categorias", value: countText(cats), helper: "distintas" }, { label: "Recentes", value: countText(records.length), helper: "editados" }], records };
}

async function fetchInventoryData(): Promise<ModuleData> {
  const [total, adjustments, movRows] = await Promise.all([
    supabase.from("inventory_counts").select("*", { count: "exact", head: true }),
    supabase.from("inventory_counts").select("*", { count: "exact", head: true }).not("aprovado_em", "is", null),
    supabase.from("stock_movements").select("id,tipo,quantidade,motivo,created_at,products(nome)").order("created_at", { ascending: false }).limit(10),
  ]);
  assertNoError(total.error ?? adjustments.error ?? movRows.error);
  type Row = { id: string; tipo: string; quantidade: number; motivo: string | null; created_at: string; products: { nome: string } | null };
  const records = ((movRows.data ?? []) as unknown as Row[]).map((row) => ({ id: row.id, title: row.products?.nome ?? "Produto removido", subtitle: row.motivo ?? "Movimentação", status: row.tipo, value: `${row.quantidade} un`, date: formatDate(row.created_at) }));
  return { stats: [{ label: "Contagens", value: countText(total.count), helper: "registradas" }, { label: "Aprovadas", value: countText(adjustments.count), helper: "com ajuste aplicado" }, { label: "Movimentos", value: countText(records.length), helper: "recentes" }], records };
}

async function fetchInventoryAlertsData(): Promise<ModuleData> {
  const { data, error } = await supabase.from("products").select("id,nome,sku,estoque,estoque_minimo,updated_at").order("estoque", { ascending: true }).limit(200);
  assertNoError(error);
  const low = (data ?? []).filter((row) => Number(row.estoque) > 0 && Number(row.estoque) <= Number(row.estoque_minimo));
  const zero = (data ?? []).filter((row) => Number(row.estoque) <= 0);
  const combined = [...zero, ...low].slice(0, 10);
  const records = combined.map((row) => ({ id: row.id, title: row.nome, subtitle: `SKU ${row.sku} · mínimo ${row.estoque_minimo}`, status: Number(row.estoque) <= 0 ? "zerado" : "baixo", value: `${row.estoque} un`, date: formatDate(row.updated_at) }));
  return { stats: [{ label: "Zerados", value: countText(zero.length), helper: "sem estoque" }, { label: "Abaixo do mínimo", value: countText(low.length), helper: "críticos" }, { label: "Total monitorado", value: countText((data ?? []).length), helper: "produtos" }], records };
}

async function fetchInventoryCountsData(): Promise<ModuleData> {
  const [total, pending, rows] = await Promise.all([
    supabase.from("inventory_counts").select("*", { count: "exact", head: true }),
    supabase.from("inventory_counts").select("*", { count: "exact", head: true }).is("aprovado_em", null),
    supabase.from("inventory_counts").select("id,tipo,quantidade_sistema,quantidade_contada,diferenca,created_at,aprovado_em,products(nome)").order("created_at", { ascending: false }).limit(10),
  ]);
  assertNoError(total.error ?? pending.error ?? rows.error);
  type Row = { id: string; tipo: string | null; quantidade_sistema: number | null; quantidade_contada: number | null; diferenca: number | null; created_at: string; aprovado_em: string | null; products: { nome: string } | null };
  const records = ((rows.data ?? []) as unknown as Row[]).map((row) => ({ id: row.id, title: row.products?.nome ?? "Produto removido", subtitle: `${row.tipo ?? "contagem"} · sistema ${row.quantidade_sistema ?? 0} × contado ${row.quantidade_contada ?? 0}`, status: row.aprovado_em ? "aprovada" : "pendente", value: `Δ ${row.diferenca ?? 0}`, date: formatDate(row.created_at) }));
  return { stats: [{ label: "Contagens", value: countText(total.count), helper: "totais" }, { label: "Pendentes", value: countText(pending.count), helper: "sem aprovação" }, { label: "Recentes", value: countText(records.length), helper: "últimas" }], records };
}

async function fetchFinanceReconciliationData(): Promise<ModuleData> {
  const [total, notReconciled, rows] = await Promise.all([
    supabase.from("bank_statements").select("*", { count: "exact", head: true }),
    supabase.from("bank_statements").select("*", { count: "exact", head: true }).eq("conciliado", false),
    supabase.from("bank_statements").select("id,descricao,valor,tipo,data,conciliado").order("data", { ascending: false }).limit(10),
  ]);
  assertNoError(total.error ?? notReconciled.error ?? rows.error);
  const records = (rows.data ?? []).map((row) => ({ id: row.id, title: row.descricao ?? "Lançamento bancário", subtitle: row.tipo ?? "extrato", status: row.conciliado ? "conciliado" : "pendente", value: brl(Number(row.valor)), date: formatDate(row.data) }));
  return { stats: [{ label: "Extratos", value: countText(total.count), helper: "importados" }, { label: "Pendentes", value: countText(notReconciled.count), helper: "sem match" }, { label: "Recentes", value: countText(records.length), helper: "últimos lançamentos" }], records };
}

async function fetchCompaniesData(): Promise<ModuleData> {
  const [total, approved, rows] = await Promise.all([
    supabase.from("companies").select("*", { count: "exact", head: true }),
    supabase.from("companies").select("*", { count: "exact", head: true }).eq("status", "approved"),
    supabase.from("companies").select("id,legal_name,trade_name,phone,cidade,estado,status,created_at").order("created_at", { ascending: false }).limit(10),
  ]);
  assertNoError(total.error ?? approved.error ?? rows.error);
  const records = (rows.data ?? []).map((row) => ({ id: row.id, title: row.trade_name ?? row.legal_name, subtitle: [row.phone, row.cidade, row.estado].filter(Boolean).join(" · "), status: row.status, date: formatDate(row.created_at) }));
  return { stats: [{ label: "Empresas", value: countText(total.count), helper: "cadastradas" }, { label: "Aprovadas", value: countText(approved.count), helper: "ativas" }, { label: "Recentes", value: countText(records.length), helper: "últimos cadastros" }], records };
}

async function fetchAdminUsersData(): Promise<ModuleData> {
  const [total, roles, rows] = await Promise.all([
    supabase.from("profiles").select("*", { count: "exact", head: true }),
    supabase.from("user_roles").select("role,user_id"),
    supabase.from("profiles").select("id,full_name,cargo,telefone,status,created_at").order("created_at", { ascending: false }).limit(10),
  ]);
  assertNoError(total.error ?? roles.error ?? rows.error);
  const admins = (roles.data ?? []).filter((r) => r.role === "admin").length;
  const records = (rows.data ?? []).map((row) => ({ id: row.id, title: row.full_name ?? "Sem nome", subtitle: [row.cargo, row.telefone].filter(Boolean).join(" · ") || "Sem dados", status: row.status ?? undefined, date: formatDate(row.created_at) }));
  return { stats: [{ label: "Usuários", value: countText(total.count), helper: "cadastrados" }, { label: "Admins", value: countText(admins), helper: "com privilégio" }, { label: "Recentes", value: countText(records.length), helper: "últimos" }], records };
}

async function fetchAdminPromotionsData(): Promise<ModuleData> {
  const [total, active, rows] = await Promise.all([
    supabase.from("promotions").select("*", { count: "exact", head: true }),
    supabase.from("promotions").select("*", { count: "exact", head: true }).eq("ativo", true),
    supabase.from("promotions").select("id,titulo,desconto_percentual,ativo,valido_de,valido_ate").order("ordem", { ascending: true }).limit(10),
  ]);
  assertNoError(total.error ?? active.error ?? rows.error);
  const records = (rows.data ?? []).map((row) => ({ id: row.id, title: row.titulo, subtitle: `${row.desconto_percentual ?? 0}% · ${formatDate(row.valido_de)} → ${formatDate(row.valido_ate)}`, status: row.ativo ? "ativa" : "inativa" }));
  return { stats: [{ label: "Promoções", value: countText(total.count), helper: "criadas" }, { label: "Ativas", value: countText(active.count), helper: "no ar" }, { label: "Recentes", value: countText(records.length), helper: "últimas" }], records };
}

async function fetchAdminBannersData(): Promise<ModuleData> {
  const [total, active, rows] = await Promise.all([
    supabase.from("hero_slides").select("*", { count: "exact", head: true }),
    supabase.from("hero_slides").select("*", { count: "exact", head: true }).eq("ativo", true),
    supabase.from("hero_slides").select("id,titulo,subtitulo,cta_label,ativo,updated_at").order("ordem", { ascending: true }).limit(10),
  ]);
  assertNoError(total.error ?? active.error ?? rows.error);
  const records = (rows.data ?? []).map((row) => ({ id: row.id, title: row.titulo ?? "Sem título", subtitle: row.subtitulo ?? row.cta_label ?? "Banner do site", status: row.ativo ? "publicado" : "rascunho", date: formatDate(row.updated_at) }));
  return { stats: [{ label: "Banners", value: countText(total.count), helper: "cadastrados" }, { label: "Ativos", value: countText(active.count), helper: "no site" }, { label: "Recentes", value: countText(records.length), helper: "editados" }], records };
}

async function fetchAdminSalesTargetsData(): Promise<ModuleData> {
  const [total, rows] = await Promise.all([
    supabase.from("sales_targets").select("*", { count: "exact", head: true }),
    supabase.from("sales_targets").select("id,vendedor_id,mes_ref,meta_valor,meta_qtd_pedidos,observacao,created_at").order("mes_ref", { ascending: false }).limit(10),
  ]);
  assertNoError(total.error ?? rows.error);
  const vendedorIds = Array.from(new Set((rows.data ?? []).map((r) => r.vendedor_id).filter(Boolean))) as string[];
  const profilesById = new Map<string, string>();
  if (vendedorIds.length > 0) {
    const { data: profs } = await supabase.from("profiles").select("id,full_name").in("id", vendedorIds);
    (profs ?? []).forEach((p) => profilesById.set(p.id, p.full_name ?? ""));
  }
  const records = (rows.data ?? []).map((row) => ({ id: row.id, title: profilesById.get(row.vendedor_id) || "Sem vendedor", subtitle: row.observacao ?? `Meta ${row.meta_qtd_pedidos ?? 0} pedidos`, value: row.meta_valor ? brl(Number(row.meta_valor)) : undefined, date: row.mes_ref }));
  return { stats: [{ label: "Metas", value: countText(total.count), helper: "cadastradas" }, { label: "Vendedores", value: countText(new Set(records.map((r) => r.title)).size), helper: "com meta" }, { label: "Recentes", value: countText(records.length), helper: "últimas" }], records };
}

async function fetchAdminAbandonedCartsData(): Promise<ModuleData> {
  const [total, recovered, rows] = await Promise.all([
    supabase.from("abandoned_carts").select("*", { count: "exact", head: true }),
    supabase.from("abandoned_carts").select("*", { count: "exact", head: true }).not("recovered_at", "is", null),
    supabase.from("abandoned_carts").select("id,total,last_activity,recovered_at,notified_at,companies(legal_name,trade_name)").order("last_activity", { ascending: false }).limit(10),
  ]);
  assertNoError(total.error ?? recovered.error ?? rows.error);
  type Row = { id: string; total: number; last_activity: string; recovered_at: string | null; notified_at: string | null; companies: { legal_name: string; trade_name: string | null } | null };
  const records = ((rows.data ?? []) as unknown as Row[]).map((row) => ({ id: row.id, title: row.companies?.trade_name ?? row.companies?.legal_name ?? "Visitante anônimo", subtitle: row.notified_at ? `Notificado ${formatDate(row.notified_at)}` : "Sem notificação enviada", status: row.recovered_at ? "recuperado" : "aberto", value: brl(Number(row.total ?? 0)), date: formatDate(row.last_activity) }));
  return { stats: [{ label: "Carrinhos", value: countText(total.count), helper: "abandonados" }, { label: "Recuperados", value: countText(recovered.count), helper: "com pedido" }, { label: "Recentes", value: countText(records.length), helper: "últimos" }], records };
}

async function fetchAdminPushData(): Promise<ModuleData> {
  const [total, sent, rows] = await Promise.all([
    supabase.from("push_campaigns").select("*", { count: "exact", head: true }),
    supabase.from("push_campaigns").select("*", { count: "exact", head: true }).eq("status", "DONE"),
    supabase.from("push_campaigns").select("id,titulo,segmento,status,scheduled_at,sent_at,total,enviados,falhas").order("created_at", { ascending: false }).limit(10),
  ]);
  assertNoError(total.error ?? sent.error ?? rows.error);
  const records = (rows.data ?? []).map((row) => ({ id: row.id, title: row.titulo ?? "Sem título", subtitle: `${row.segmento ?? "todos"} · ${row.enviados ?? 0}/${row.total ?? 0} enviados · ${row.falhas ?? 0} falhas`, status: row.status, date: formatDate(row.sent_at ?? row.scheduled_at) }));
  return { stats: [{ label: "Campanhas", value: countText(total.count), helper: "totais" }, { label: "Enviadas", value: countText(sent.count), helper: "concluídas" }, { label: "Recentes", value: countText(records.length), helper: "últimas" }], records };
}

function countText(value: number | null | undefined) {
  return String(value ?? 0);
}

function assertNoError(error: unknown): asserts error is null | undefined {
  if (error) throw error;
}