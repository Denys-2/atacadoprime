import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
  useDroppable,
  useDraggable,
} from "@dnd-kit/core";
import { toast } from "sonner";
import {
  Plus,
  Phone,
  MessageCircle,
  MapPin,
  Search,
  UserPlus,
  Handshake,
  Users,
  TrendingUp,
  Percent,
  ClipboardList,
  ChevronDown,
} from "lucide-react";
import { V2InternalShell } from "@/components/v2/InternalShell";
import { V2 } from "@/components/v2/theme";
import {
  LEAD_STAGES,
  SEGMENTOS,
  useCreateLead,
  useCrmStats,
  useLeads,
  useUpdateLead,
  useConvertToClient,
  type Lead,
  type LeadSegmento,
  type LeadStatus,
} from "@/hooks/use-crm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { NearMeRouteDialog } from "@/components/crm/near-me-route-dialog";

export const Route = createFileRoute("/_authenticated/v3/crm/")({
  head: () => ({ meta: [{ title: "CRM — Prime Automotive" }] }),
  component: V2CrmKanbanPage,
});

function V2CrmKanbanPage() {
  const [search, setSearch] = useState("");
  const [cidade, setCidade] = useState<string>("__all__");
  const { data: leads = [] } = useLeads(search);
  const { data: stats } = useCrmStats();
  const updateLead = useUpdateLead();
  const convertToClient = useConvertToClient();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
  );

  const cidades = useMemo(() => {
    const set = new Set<string>();
    leads.forEach((l) => { if (l.cidade) set.add(l.cidade); });
    return Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [leads]);

  const filtered = useMemo(
    () => (cidade === "__all__" ? leads : leads.filter((l) => l.cidade === cidade)),
    [leads, cidade],
  );

  const grouped = useMemo(() => {
    const map = new Map<LeadStatus, Lead[]>();
    LEAD_STAGES.forEach((s) => map.set(s.id, []));
    filtered.forEach((l) => map.get(l.status)?.push(l));
    return map;
  }, [filtered]);

  function onDragEnd(e: DragEndEvent) {
    const leadId = String(e.active.id);
    const newStatus = e.over?.id as LeadStatus | undefined;
    if (!newStatus) return;
    const lead = leads.find((l) => l.id === leadId);
    if (!lead) return;
    if (newStatus === "CLIENTE") {
      if (lead.status === "CLIENTE" && lead.company_id) return;
      convertToClient.mutate(lead, {
        onSuccess: () => toast.success(`${lead.empresa} cadastrado como cliente`),
        onError: (err: any) => toast.error(err?.message || "Erro ao converter em cliente"),
      });
      return;
    }
    if (lead.status === newStatus) return;
    updateLead.mutate(
      { id: leadId, patch: { status: newStatus } },
      { onSuccess: () => toast.success(`Movido para ${LEAD_STAGES.find((s) => s.id === newStatus)?.label}`) },
    );
  }

  return (
    <V2InternalShell
      eyebrow="CRM"
      title="Funil comercial"
      description="Arraste os leads entre as etapas para atualizar o status em tempo real."
      actions={
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild style={{ borderColor: V2.LIGHT_BORDER }}>
            <Link to="/v3/crm/agenda">Agenda</Link>
          </Button>
          <NearMeRouteDialog leads={filtered} cidade={cidade} />
          <NewLeadDialog />
        </div>
      }
    >
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <V2Stat label="Novos" value={stats?.novos ?? 0} icon={UserPlus} />
          <V2Stat label="Negociação" value={stats?.negociando ?? 0} icon={Handshake} />
          <V2Stat label="Clientes" value={stats?.clientes ?? 0} icon={Users} />
          <V2Stat label="Convers. mês" value={stats?.conversoesMes ?? 0} icon={TrendingUp} />
          <V2Stat label="Taxa conv." value={`${stats?.taxa ?? 0}%`} icon={Percent} />
          <V2Stat label="Tarefas" value={stats?.pendentes ?? 0} icon={ClipboardList} />
        </div>

        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: V2.LIGHT_MUTED }} />
            <Input
              placeholder="Buscar empresa, contato, WhatsApp, cidade..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
              style={{ background: V2.LIGHT_SURFACE, borderColor: V2.LIGHT_BORDER }}
            />
          </div>
          <Select value={cidade} onValueChange={setCidade}>
            <SelectTrigger className="w-full sm:w-56" style={{ background: V2.LIGHT_SURFACE, borderColor: V2.LIGHT_BORDER }}>
              <MapPin className="w-4 h-4 mr-1" style={{ color: V2.LIGHT_MUTED }} />
              <SelectValue placeholder="Cidade" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todas as cidades</SelectItem>
              {cidades.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 pb-4">
            {LEAD_STAGES.map((stage) => (
              <Column key={stage.id} stage={stage} leads={grouped.get(stage.id) ?? []} />
            ))}
          </div>
        </DndContext>
      </div>
    </V2InternalShell>
  );
}

function V2Stat({ label, value, icon: Icon }: { label: string; value: string | number; icon: typeof UserPlus }) {
  return (
    <div className="rounded-2xl border p-4" style={{ background: V2.LIGHT_SURFACE, borderColor: V2.LIGHT_BORDER }}>
      <div className="flex items-center justify-between">
        <span className="text-[11px] uppercase tracking-widest font-semibold" style={{ color: V2.LIGHT_MUTED }}>{label}</span>
        <Icon className="w-4 h-4" style={{ color: V2.TEAL }} />
      </div>
      <div className="mt-2 text-2xl font-semibold" style={{ color: V2.LIGHT_TEXT }}>{value}</div>
    </div>
  );
}

function Column({ stage, leads }: { stage: (typeof LEAD_STAGES)[number]; leads: Lead[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });
  const [limit, setLimit] = useState(10);
  const visible = leads.slice(0, limit);
  const remaining = leads.length - visible.length;
  return (
    <div
      ref={setNodeRef}
      className="min-w-0 w-full rounded-2xl border flex flex-col transition"
      style={{
        background: V2.LIGHT_SURFACE_2,
        borderColor: isOver ? V2.TEAL : V2.LIGHT_BORDER,
        boxShadow: isOver ? `0 0 0 2px ${V2.TEAL}33` : undefined,
      }}
    >
      <div className="p-3 border-b flex items-center justify-between" style={{ borderColor: V2.LIGHT_BORDER }}>
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs font-semibold uppercase tracking-wide truncate" style={{ color: V2.LIGHT_TEXT }}>{stage.label}</span>
          <span className="text-[11px] px-1.5 rounded-full" style={{ background: V2.TEAL_LIGHT, color: V2.TEAL_DARK }}>{leads.length}</span>
        </div>
      </div>
      <div className="p-2 space-y-2 flex-1 min-h-32">
        {visible.map((l) => (
          <LeadCard key={l.id} lead={l} />
        ))}
        {leads.length === 0 && (
          <p className="text-xs text-center py-6" style={{ color: V2.LIGHT_MUTED }}>Vazio</p>
        )}
        {remaining > 0 && (
          <Button variant="ghost" size="sm" className="w-full text-xs" onClick={() => setLimit((n) => n + 10)}>
            <ChevronDown className="w-3.5 h-3.5 mr-1" /> Ver mais ({remaining})
          </Button>
        )}
        {limit > 10 && remaining === 0 && (
          <Button variant="ghost" size="sm" className="w-full text-xs" onClick={() => setLimit(10)}>
            Ver menos
          </Button>
        )}
      </div>
    </div>
  );
}

function LeadCard({ lead }: { lead: Lead }) {
  const router = useRouter();
  const updateLead = useUpdateLead();
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: lead.id });
  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, opacity: isDragging ? 0.5 : 1 }
    : undefined;
  return (
    <div
      ref={setNodeRef}
      style={{ ...style, background: V2.LIGHT_SURFACE, borderColor: V2.LIGHT_BORDER }}
      {...attributes}
      {...listeners}
      onClick={() => router.navigate({ to: "/crm/$id", params: { id: lead.id } })}
      className="p-3 rounded-xl border cursor-grab active:cursor-grabbing hover:shadow-sm transition"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="font-medium text-sm truncate" style={{ color: V2.LIGHT_TEXT }}>{lead.empresa}</p>
        <div className="flex items-center gap-1 shrink-0">
          {lead.company_id && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold" style={{ background: V2.TEAL_LIGHT, color: V2.TEAL_DARK }}>CLIENTE</span>
          )}
          <span className="text-[10px] px-1.5 py-0.5 rounded-full border" style={{ borderColor: V2.LIGHT_BORDER, color: V2.LIGHT_MUTED }}>{lead.score}</span>
        </div>
      </div>
      <p className="text-xs mt-0.5 truncate" style={{ color: V2.LIGHT_MUTED }}>{lead.contato}</p>
      {(lead.cidade || lead.estado) && (
        <p className="text-xs flex items-center gap-1 mt-1" style={{ color: V2.LIGHT_MUTED }}>
          <MapPin className="w-3 h-3" />
          {lead.cidade}{lead.estado ? ` / ${lead.estado}` : ""}
        </p>
      )}
      <div className="flex items-center gap-2 mt-2" onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
        {lead.whatsapp && (
          <a
            href={`https://wa.me/${lead.whatsapp.replace(/\D/g, "")}`}
            target="_blank"
            rel="noreferrer"
            className="p-1.5 rounded-md"
            style={{ background: V2.TEAL_LIGHT, color: V2.TEAL_DARK }}
          >
            <MessageCircle className="w-3.5 h-3.5" />
          </a>
        )}
        {lead.telefone && (
          <a
            href={`tel:${lead.telefone}`}
            className="p-1.5 rounded-md"
            style={{ background: V2.TEAL_LIGHT, color: V2.TEAL_DARK }}
          >
            <Phone className="w-3.5 h-3.5" />
          </a>
        )}
      </div>
      <div className="mt-2" onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
        <Select
          value={lead.status}
          onValueChange={(v) =>
            updateLead.mutate(
              { id: lead.id, patch: { status: v as LeadStatus } },
              { onSuccess: () => toast.success(`Movido para ${LEAD_STAGES.find((s) => s.id === v)?.label}`) },
            )
          }
        >
          <SelectTrigger className="h-7 text-xs" style={{ background: V2.LIGHT_SURFACE_2, borderColor: V2.LIGHT_BORDER }}>
            <SelectValue placeholder="Mover para..." />
          </SelectTrigger>
          <SelectContent>
            {LEAD_STAGES.map((s) => (
              <SelectItem key={s.id} value={s.id} className="text-xs">{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

function NewLeadDialog() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    empresa: "",
    contato: "",
    whatsapp: "",
    telefone: "",
    email: "",
    cidade: "",
    estado: "",
    segmento: "OUTRO" as LeadSegmento,
    observacoes: "",
  });
  const create = useCreateLead();

  function submit() {
    if (!form.empresa || !form.contato) {
      toast.error("Empresa e contato são obrigatórios");
      return;
    }
    create.mutate(form, {
      onSuccess: () => {
        toast.success("Lead criado");
        setOpen(false);
        setForm({ empresa: "", contato: "", whatsapp: "", telefone: "", email: "", cidade: "", estado: "", segmento: "OUTRO", observacoes: "" });
      },
      onError: (e) => toast.error(e.message),
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button style={{ background: V2.TEAL, color: "#fff" }}>
          <Plus className="w-4 h-4 mr-1" /> Novo lead
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Novo lead</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Empresa *" className="col-span-2">
            <Input value={form.empresa} onChange={(e) => setForm({ ...form, empresa: e.target.value })} />
          </Field>
          <Field label="Contato *">
            <Input value={form.contato} onChange={(e) => setForm({ ...form, contato: e.target.value })} />
          </Field>
          <Field label="WhatsApp">
            <Input value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} />
          </Field>
          <Field label="Telefone">
            <Input value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} />
          </Field>
          <Field label="Email">
            <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </Field>
          <Field label="Cidade">
            <Input className="uppercase" value={form.cidade} onChange={(e) => setForm({ ...form, cidade: e.target.value.toUpperCase() })} />
          </Field>
          <Field label="Estado">
            <Input maxLength={2} value={form.estado} onChange={(e) => setForm({ ...form, estado: e.target.value.toUpperCase() })} />
          </Field>
          <Field label="Segmento" className="col-span-2">
            <Select value={form.segmento} onValueChange={(v) => setForm({ ...form, segmento: v as LeadSegmento })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {SEGMENTOS.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Observações" className="col-span-2">
            <Textarea rows={3} value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={create.isPending} style={{ background: V2.TEAL, color: "#fff" }}>
            {create.isPending ? "Criando..." : "Criar lead"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={className}>
      <Label className="text-xs mb-1 block" style={{ color: V2.LIGHT_MUTED }}>{label}</Label>
      {children}
    </div>
  );
}
