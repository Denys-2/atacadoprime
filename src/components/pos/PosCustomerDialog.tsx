import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useSellerSession, type SellerCustomer } from "@/hooks/use-seller-session";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { V2 } from "@/components/v2/theme";
import { Search, UserPlus, Loader2, Building2, MapPin } from "lucide-react";
import { toast } from "sonner";

export function PosCustomerDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const qc = useQueryClient();
  const setCustomer = useSellerSession((s) => s.setCustomer);
  const [q, setQ] = useState("");
  const [novo, setNovo] = useState(false);

  const { data: companies = [], isLoading } = useQuery({
    queryKey: ["pos-customers", q],
    enabled: open && !novo,
    queryFn: async () => {
      let query = supabase
        .from("companies")
        .select("id, legal_name, trade_name, tax_id, cidade, estado")
        .eq("status", "approved")
        .order("legal_name")
        .limit(60);
      if (q.trim().length >= 2) {
        const term = `%${q.trim()}%`;
        query = query.or(`legal_name.ilike.${term},trade_name.ilike.${term},tax_id.ilike.${term}`);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });

  function escolher(c: SellerCustomer) {
    setCustomer(c);
    toast.success(`Cliente: ${c.trade_name ?? c.legal_name}`);
    setNovo(false);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) setNovo(false); onOpenChange(v); }}>
      <DialogContent className="max-w-sm max-h-[calc(100vh-2rem)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{novo ? "Novo cliente" : "Selecionar cliente"}</DialogTitle>
        </DialogHeader>

        {novo ? (
          <NovoClienteForm onCancel={() => setNovo(false)} onCreated={(c) => {
            qc.invalidateQueries({ queryKey: ["pos-customers"] });
            escolher(c);
          }} />
        ) : (
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 opacity-60" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Buscar por nome ou CNPJ"
                className="pl-8 h-12 text-base"
              />
            </div>

            <Button
              variant="outline"
              className="w-full h-12"
              onClick={() => setNovo(true)}
            >
              <UserPlus className="h-4 w-4 mr-2" /> Cadastrar novo cliente
            </Button>

            <div className="space-y-2">
              {isLoading && (
                <div className="flex items-center gap-2 text-sm py-4 justify-center" style={{ color: V2.LIGHT_MUTED }}>
                  <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
                </div>
              )}
              {!isLoading && companies.length === 0 && (
                <p className="text-sm text-center py-4" style={{ color: V2.LIGHT_MUTED }}>
                  Nenhum cliente encontrado.
                </p>
              )}
              {companies.map((c) => (
                <button
                  key={c.id}
                  onClick={() => escolher(c)}
                  className="w-full text-left p-3 rounded-lg border active:scale-[.99] transition"
                  style={{ background: V2.LIGHT_SURFACE, borderColor: V2.LIGHT_BORDER }}
                >
                  <div className="flex items-start gap-2">
                    <Building2 className="h-4 w-4 mt-0.5 shrink-0" style={{ color: V2.TEAL }} />
                    <div className="min-w-0">
                      <div className="font-medium text-sm truncate">{c.trade_name ?? c.legal_name}</div>
                      {(c.cidade || c.estado) && (
                        <div className="text-[11px] flex items-center gap-1" style={{ color: V2.LIGHT_MUTED }}>
                          <MapPin className="h-3 w-3" /> {c.cidade}{c.estado ? `/${c.estado}` : ""}
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
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
    <div className="space-y-3 pb-4">
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
          <Input value={estado} onChange={(e) => setEstado(e.target.value)} maxLength={2} className="h-12 text-base uppercase" />
        </Field>
      </div>

      <DialogFooter className="gap-2">
        <Button variant="outline" className="h-12 flex-1" onClick={onCancel} disabled={saving}>Voltar</Button>
        <Button
          className="h-12 flex-1 font-semibold"
          style={{ background: V2.TEAL, color: "#fff" }}
          onClick={salvar}
          disabled={saving}
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar e usar"}
        </Button>
      </DialogFooter>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs mb-1" style={{ color: V2.LIGHT_MUTED }}>{label}</div>
      {children}
    </div>
  );
}
