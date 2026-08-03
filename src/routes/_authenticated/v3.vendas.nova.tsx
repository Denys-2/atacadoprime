import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { V2InternalShell } from "@/components/v2/InternalShell";
import { V2 } from "@/components/v2/theme";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useSellerSession, type SellerCustomer } from "@/hooks/use-seller-session";
import { useCart } from "@/hooks/use-cart";
import { useAuth, useRoles } from "@/hooks/use-auth";
import { Building2, Search, UserCheck, ArrowRight, MapPin, UserPlus, Loader2, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { CityAutocomplete } from "@/components/v2/CityAutocomplete";

type SearchParams = { cidade?: string; estado?: string; trip?: string };

export const Route = createFileRoute("/_authenticated/v3/vendas/nova")({
  head: () => ({ meta: [{ title: "Nova venda em visita — Prime Automotive" }] }),
  validateSearch: (s: Record<string, unknown>): SearchParams => ({
    cidade: typeof s.cidade === "string" ? s.cidade : undefined,
    estado: typeof s.estado === "string" ? s.estado : undefined,
    trip: typeof s.trip === "string" ? s.trip : undefined,
  }),
  component: NovaVendaV2Page,
});

function NovaVendaV2Page() {
  const { user } = useAuth();
  const { data: roles = [] } = useRoles(user);
  const isStaff = roles.some((r) => r === "admin" || r === "vendedor" || r === "gerente");
  const isAdmin = roles.includes("admin");

  const navigate = useNavigate();
  const qc = useQueryClient();
  const { cidade, estado, trip } = Route.useSearch();
  const setCustomer = useSellerSession((s) => s.setCustomer);
  const setTripId = useSellerSession((s) => s.setTripId);
  const activeCustomer = useSellerSession((s) => s.customer);
  const clearCart = useCart((s) => s.clear);
  const [q, setQ] = useState("");
  const [cityFilter, setCityFilter] = useState(cidade ?? "");
  const [newOpen, setNewOpen] = useState(false);

  const { data: companies = [], isLoading } = useQuery({
    queryKey: ["sales-customers-v2", q, cityFilter, estado],
    enabled: isStaff,
    queryFn: async () => {
      let query = supabase
        .from("companies")
        .select("id, legal_name, trade_name, tax_id, status, cidade, estado")
        .eq("status", "approved")
        .order("legal_name", { ascending: true })
        .limit(100);
      if (cityFilter.trim().length >= 2) query = query.ilike("cidade", `%${cityFilter.trim()}%`);
      if (estado) query = query.eq("estado", estado.toUpperCase());
      if (q.trim().length >= 2) {
        const term = `%${q.trim()}%`;
        query = query.or(`legal_name.ilike.${term},trade_name.ilike.${term},tax_id.ilike.${term}`);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });

  const list = useMemo(() => companies, [companies]);

  function selecionar(c: SellerCustomer) {
    setCustomer(c);
    setTripId(trip ?? null);
    clearCart();
    toast.success(`Venda iniciada para ${c.trade_name ?? c.legal_name}${trip ? " (viagem em andamento)" : ""}`);
    navigate({ to: "/v3/pdv" });
  }

  if (!isStaff) {
    return (
      <V2InternalShell title="Nova venda em visita" eyebrow="Atendimento em campo" description="Área exclusiva da equipe de vendas.">
        <div className="rounded-2xl border p-6 text-sm" style={{ background: V2.LIGHT_SURFACE, borderColor: V2.LIGHT_BORDER, color: V2.LIGHT_TEXT }}>
          Esta área é exclusiva da equipe de vendas.
        </div>
      </V2InternalShell>
    );
  }

  return (
    <V2InternalShell
      title="Nova venda em visita"
      eyebrow="Atendimento em campo"
      description={cidade ? `Mostrando clientes em ${cidade}${estado ? `/${estado}` : ""}. Selecione ou cadastre um novo.` : "Escolha o cliente que está sendo atendido presencialmente."}
      actions={
        <Link to="/v3/hoje" className="h-11 px-5 rounded-full font-medium text-sm grid place-items-center" style={{ background: V2.TEAL, color: "#fff" }}>
          Voltar ao Hoje
        </Link>
      }
    >
      <div className="grid gap-6">
        {activeCustomer && (
          <div className="rounded-2xl border p-4 flex items-center gap-3" style={{ background: V2.TEAL_LIGHT, borderColor: V2.TEAL, color: V2.LIGHT_TEXT }}>
            <UserCheck className="h-5 w-5 shrink-0" style={{ color: V2.TEAL }} />
            <div className="flex-1 min-w-0">
              <p className="text-[10px] uppercase tracking-[0.2em] font-semibold" style={{ color: V2.TEAL }}>Venda em andamento</p>
              <p className="font-semibold truncate">{activeCustomer.trade_name ?? activeCustomer.legal_name}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link to="/v3/pdv">
                <Button size="sm" style={{ background: V2.TEAL, color: "#fff" }}>Continuar venda <ArrowRight className="h-3.5 w-3.5 ml-1" /></Button>
              </Link>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-[1fr_260px_auto] gap-3">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: V2.LIGHT_MUTED }} />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por nome, fantasia ou CNPJ…"
              className="pl-10 h-12 rounded-full border shadow-sm"
              style={{ background: V2.LIGHT_SURFACE, borderColor: V2.LIGHT_BORDER, color: V2.LIGHT_TEXT }}
              autoFocus
            />
          </div>
          <CityAutocomplete
            value={cityFilter}
            onChange={(c) => setCityFilter(c)}
            placeholder="Filtrar por cidade"
            withIcon
            inputClassName="h-12 rounded-full border shadow-sm"
            style={{ background: V2.LIGHT_SURFACE, borderColor: V2.LIGHT_BORDER, color: V2.LIGHT_TEXT }}
          />
          <Button
            onClick={() => setNewOpen(true)}
            className="h-12 px-6 rounded-full font-semibold"
            style={{ background: V2.TEAL, color: "#fff" }}
          >
            <UserPlus className="h-4 w-4 mr-2" /> Novo cliente
          </Button>
        </div>

        <div className="rounded-2xl border shadow-sm overflow-hidden" style={{ background: V2.LIGHT_SURFACE, borderColor: V2.LIGHT_BORDER }}>
          {isLoading ? (
            <div className="p-8 text-center text-sm" style={{ color: V2.LIGHT_MUTED }}>Carregando clientes…</div>
          ) : list.length === 0 ? (
            <div className="p-8 text-center text-sm space-y-3" style={{ color: V2.LIGHT_MUTED }}>
              <p>Nenhum cliente encontrado{cityFilter ? ` em "${cityFilter}"` : ""}.</p>
              <Button size="sm" onClick={() => setNewOpen(true)} style={{ background: V2.TEAL, color: "#fff" }}>
                <UserPlus className="h-4 w-4 mr-1" /> Cadastrar cliente agora
              </Button>
            </div>
          ) : (
            <div className="divide-y" style={{ borderColor: V2.LIGHT_BORDER }}>
              {list.map((c) => (
                <div
                  key={c.id}
                  className={cn("w-full flex items-center gap-4 p-5 transition-colors hover:bg-black/[0.02]")}
                  style={activeCustomer?.id === c.id ? { background: V2.TEAL_LIGHT } : undefined}
                >
                  <button
                    type="button"
                    onClick={() =>
                      selecionar({
                        id: c.id,
                        legal_name: c.legal_name,
                        trade_name: c.trade_name,
                        tax_id: c.tax_id,
                      })
                    }
                    className="flex-1 flex items-center gap-4 min-w-0 text-left"
                  >
                    <div className="h-11 w-11 rounded-xl grid place-items-center shrink-0" style={{ background: V2.TEAL_LIGHT, color: V2.TEAL }}>
                      <Building2 className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold truncate" style={{ color: V2.LIGHT_TEXT }}>{c.trade_name ?? c.legal_name}</p>
                      <p className="text-xs truncate mt-0.5" style={{ color: V2.LIGHT_MUTED }}>
                        {c.legal_name} · CNPJ {c.tax_id ?? "—"}
                        {c.cidade && ` · ${c.cidade}${c.estado ? `/${c.estado}` : ""}`}
                      </p>
                    </div>
                    <span
                      className="hidden sm:inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider px-3 py-1.5 rounded-full"
                      style={{ background: V2.TEAL, color: "#fff" }}
                    >
                      Iniciar venda <ArrowRight className="h-3 w-3" />
                    </span>
                  </button>
                  {isAdmin && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-9 w-9 p-0 shrink-0"
                      title="Excluir cliente"
                      onClick={async (e) => {
                        e.stopPropagation();
                        if (!confirm(`Excluir cliente "${c.trade_name ?? c.legal_name}"?\n\nSó funciona se o cliente não tiver pedidos vinculados.`)) return;
                        const { error } = await supabase.from("companies").delete().eq("id", c.id);
                        if (error) {
                          toast.error(
                            error.message.includes("foreign key") || error.code === "23503"
                              ? "Cliente possui pedidos vinculados. Exclua os pedidos primeiro."
                              : error.message,
                          );
                          return;
                        }
                        toast.success("Cliente excluído");
                        qc.invalidateQueries({ queryKey: ["sales-customers-v2"] });
                      }}
                    >
                      <Trash2 className="h-4 w-4" style={{ color: V2.LIGHT_MUTED }} />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <NewClientDialog
        open={newOpen}
        onOpenChange={setNewOpen}
        defaultCidade={cityFilter}
        defaultEstado={estado ?? ""}
        onCreated={(c) => {
          qc.invalidateQueries({ queryKey: ["sales-customers-v2"] });
          setNewOpen(false);
          selecionar(c);
        }}
      />
    </V2InternalShell>
  );
}

function NewClientDialog({
  open,
  onOpenChange,
  defaultCidade,
  defaultEstado,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  defaultCidade: string;
  defaultEstado: string;
  onCreated: (c: SellerCustomer) => void;
}) {
  const { user } = useAuth();
  const [tradeName, setTradeName] = useState("");
  const [taxId, setTaxId] = useState("");
  const [phone, setPhone] = useState("");
  const [cidade, setCidade] = useState(defaultCidade);
  const [estado, setEstado] = useState(defaultEstado);
  const [street, setStreet] = useState("");
  const [number, setNumber] = useState("");
  const [complement, setComplement] = useState("");
  const [district, setDistrict] = useState("");
  const [zip, setZip] = useState("");
  const [saving, setSaving] = useState(false);

  async function salvar() {
    if (!user || !tradeName.trim()) {
      toast.error("Nome fantasia é obrigatório");
      return;
    }
    setSaving(true);
    const name = tradeName.trim();
    const { data, error } = await supabase
      .from("companies")
      .insert({
        legal_name: name,
        trade_name: name,
        tax_id: taxId.trim() || null,
        phone: phone.trim(),
        cidade: cidade.trim() || null,
        estado: estado.trim().toUpperCase() || null,
        status: "approved",
        owner_id: user.id,
      })
      .select("id, legal_name, trade_name, tax_id")
      .single();
    if (error || !data) {
      setSaving(false);
      toast.error(error?.message ?? "Erro ao cadastrar");
      return;
    }

    const zipDigits = zip.replace(/\D/g, "").slice(0, 8);
    if (street.trim() && zipDigits.length === 8 && cidade.trim() && estado.trim()) {
      const { error: addrErr } = await supabase.from("addresses").insert({
        company_id: data.id,
        label: "Principal",
        street: street.trim(),
        number: number.trim() || "S/N",
        complement: complement.trim() || null,
        district: district.trim() || null,
        city: cidade.trim(),
        state: estado.trim().toUpperCase(),
        zip: `${zipDigits.slice(0, 5)}-${zipDigits.slice(5)}`,
        country: "BR",
        kind: "both",
        is_default: true,
      });
      if (addrErr) toast.warning("Cliente salvo, mas endereço não pôde ser salvo: " + addrErr.message);
    }

    setSaving(false);
    toast.success("Cliente cadastrado");
    onCreated(data);
    setTradeName(""); setTaxId(""); setPhone("");
    setStreet(""); setNumber(""); setComplement(""); setDistrict(""); setZip("");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[85dvh] overflow-y-auto top-4 translate-y-0 sm:top-1/2 sm:-translate-y-1/2"
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        <DialogHeader><DialogTitle>Novo cliente</DialogTitle></DialogHeader>
        <div
          className="space-y-3 pb-[40vh]"
          onFocusCapture={(e) => {
            const el = e.target as HTMLElement;
            if (el.tagName === "INPUT" || el.tagName === "TEXTAREA") {
              setTimeout(() => el.scrollIntoView({ block: "center", behavior: "smooth" }), 300);
            }
          }}
        >
          <div>
            <Label>Nome fantasia *</Label>
            <Input className="uppercase" value={tradeName} onChange={(e) => setTradeName(e.target.value.toUpperCase())} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>CNPJ</Label>
              <Input value={taxId} onChange={(e) => setTaxId(e.target.value)} />
            </div>
            <div>
              <Label>Telefone</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
          </div>
          <div className="pt-2 border-t border-border">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Endereço de entrega</p>
            <div className="grid grid-cols-[1fr_100px] gap-2">
              <div>
                <Label>Rua</Label>
                <Input className="uppercase" value={street} onChange={(e) => setStreet(e.target.value.toUpperCase())} />
              </div>
              <div>
                <Label>Número</Label>
                <Input value={number} onChange={(e) => setNumber(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-2">
              <div>
                <Label>Complemento</Label>
                <Input className="uppercase" value={complement} onChange={(e) => setComplement(e.target.value.toUpperCase())} />
              </div>
              <div>
                <Label>Bairro</Label>
                <Input className="uppercase" value={district} onChange={(e) => setDistrict(e.target.value.toUpperCase())} />
              </div>
            </div>
            <div className="grid grid-cols-[1fr_80px_120px] gap-2 mt-2">
              <div>
                <Label>Cidade</Label>
                <CityAutocomplete
                  value={cidade}
                  onChange={(c, uf) => { setCidade(c); if (uf) setEstado(uf); }}
                />
              </div>
              <div>
                <Label>UF</Label>
                <Input maxLength={2} value={estado} onChange={(e) => setEstado(e.target.value.toUpperCase())} />
              </div>
              <div>
                <Label>CEP</Label>
                <Input value={zip} onChange={(e) => setZip(e.target.value)} placeholder="00000-000" />
              </div>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={salvar} disabled={saving} style={{ background: V2.TEAL, color: "#fff" }}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <UserPlus className="h-4 w-4 mr-1" />}
            Cadastrar e iniciar venda
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
