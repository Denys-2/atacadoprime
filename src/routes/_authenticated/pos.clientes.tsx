import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useSellerSession, type SellerCustomer } from "@/hooks/use-seller-session";
import { V2 } from "@/components/v2/theme";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, UserPlus, Loader2, Building2, MapPin, Phone, ShoppingBag, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/pos/clientes")({
  head: () => ({ meta: [{ title: "Clientes — POS Prime" }] }),
  component: PosClientes,
});

type Row = {
  id: string;
  legal_name: string;
  trade_name: string | null;
  tax_id: string | null;
  phone: string | null;
  cidade: string | null;
  estado: string | null;
};

function PosClientes() {
  const [q, setQ] = useState("");
  const [novo, setNovo] = useState(false);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const setCustomer = useSellerSession((s) => s.setCustomer);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["pos-clientes", q],
    queryFn: async () => {
      let query = supabase
        .from("companies")
        .select("id, legal_name, trade_name, tax_id, phone, cidade, estado")
        .eq("status", "approved")
        .order("legal_name")
        .limit(80);
      if (q.trim().length >= 2) {
        const term = `%${q.trim()}%`;
        query = query.or(
          `legal_name.ilike.${term},trade_name.ilike.${term},tax_id.ilike.${term},cidade.ilike.${term}`,
        );
      }
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  function venderPara(c: SellerCustomer) {
    setCustomer(c);
    toast.success(`Cliente: ${c.trade_name ?? c.legal_name}`);
    navigate({ to: "/pos/vender" });
  }

  if (novo) {
    return (
      <div className="p-3">
        <button
          className="flex items-center gap-1 text-sm mb-3"
          style={{ color: V2.LIGHT_MUTED }}
          onClick={() => setNovo(false)}
        >
          <ArrowLeft className="h-4 w-4" /> Voltar à lista
        </button>
        <NovoClienteForm
          onCancel={() => setNovo(false)}
          onCreated={(c) => {
            qc.invalidateQueries({ queryKey: ["pos-clientes"] });
            qc.invalidateQueries({ queryKey: ["pos-customers"] });
            setNovo(false);
            venderPara(c);
          }}
        />
      </div>
    );
  }

  return (
    <div className="p-3 space-y-3">
      <div className="relative">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 opacity-60" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar nome, CNPJ ou cidade"
          className="pl-8 h-12 text-base"
        />
      </div>

      <Button
        className="w-full h-12 font-semibold"
        style={{ background: V2.TEAL, color: "#fff" }}
        onClick={() => setNovo(true)}
      >
        <UserPlus className="h-4 w-4 mr-2" /> Cadastrar novo cliente
      </Button>

      {isLoading && (
        <div className="flex items-center gap-2 text-sm py-6 justify-center" style={{ color: V2.LIGHT_MUTED }}>
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
        </div>
      )}

      {!isLoading && rows.length === 0 && (
        <p className="text-sm text-center py-6" style={{ color: V2.LIGHT_MUTED }}>
          Nenhum cliente encontrado.
        </p>
      )}

      <div className="space-y-2">
        {rows.map((c) => (
          <div
            key={c.id}
            className="p-3 rounded-lg border"
            style={{ background: V2.LIGHT_SURFACE, borderColor: V2.LIGHT_BORDER }}
          >
            <div className="flex items-start gap-2">
              <Building2 className="h-4 w-4 mt-0.5 shrink-0" style={{ color: V2.TEAL }} />
              <div className="min-w-0 flex-1">
                <div className="font-medium text-sm truncate">{c.trade_name ?? c.legal_name}</div>
                <div className="text-[11px] flex flex-wrap gap-x-3" style={{ color: V2.LIGHT_MUTED }}>
                  {(c.cidade || c.estado) && (
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" /> {c.cidade}
                      {c.estado ? `/${c.estado}` : ""}
                    </span>
                  )}
                  {c.phone && (
                    <a href={`tel:${c.phone}`} className="flex items-center gap-1">
                      <Phone className="h-3 w-3" /> {c.phone}
                    </a>
                  )}
                </div>
              </div>
              <Button
                size="sm"
                className="h-9 shrink-0 font-semibold"
                style={{ background: V2.TEAL, color: "#fff" }}
                onClick={() => venderPara(c)}
              >
                <ShoppingBag className="h-4 w-4 mr-1" /> Vender
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function NovoClienteForm({
  onCancel,
  onCreated,
}: {
  onCancel: () => void;
  onCreated: (c: SellerCustomer) => void;
}) {
  const { user } = useAuth();
  const [nome, setNome] = useState("");
  const [phone, setPhone] = useState("");
  const [taxId, setTaxId] = useState("");
  const [cidade, setCidade] = useState("");
  const [estado, setEstado] = useState("");
  const [saving, setSaving] = useState(false);

  async function salvar() {
    if (!user || !nome.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }
    setSaving(true);
    const name = nome.trim();
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
    setSaving(false);
    if (error || !data) {
      toast.error(error?.message ?? "Erro ao cadastrar");
      return;
    }
    toast.success("Cliente cadastrado");
    onCreated(data);
  }

  return (
    <div className="space-y-3">
      <Field label="Nome do cliente *">
        <Input value={nome} onChange={(e) => setNome(e.target.value)} className="h-12 text-base" />
      </Field>
      <Field label="Telefone / WhatsApp">
        <Input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" className="h-12 text-base" />
      </Field>
      <Field label="CNPJ / CPF">
        <Input value={taxId} onChange={(e) => setTaxId(e.target.value)} inputMode="numeric" className="h-12 text-base" />
      </Field>
      <div className="grid grid-cols-[1fr_80px] gap-2">
        <Field label="Cidade">
          <Input value={cidade} onChange={(e) => setCidade(e.target.value)} className="h-12 text-base" />
        </Field>
        <Field label="UF">
          <Input
            value={estado}
            onChange={(e) => setEstado(e.target.value)}
            maxLength={2}
            className="h-12 text-base uppercase"
          />
        </Field>
      </div>

      <div className="flex gap-2 pt-1">
        <Button variant="outline" className="h-12 flex-1" onClick={onCancel} disabled={saving}>
          Cancelar
        </Button>
        <Button
          className="h-12 flex-1 font-semibold"
          style={{ background: V2.TEAL, color: "#fff" }}
          onClick={salvar}
          disabled={saving}
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar e vender"}
        </Button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs mb-1" style={{ color: V2.LIGHT_MUTED }}>
        {label}
      </div>
      {children}
    </div>
  );
}
