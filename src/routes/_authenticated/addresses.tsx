import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { useAuth, useMyCompany } from "@/hooks/use-auth";
import { useAddresses, useCreateAddress, useDeleteAddress, type AddressInput } from "@/hooks/use-addresses";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { toast } from "sonner";
import { MapPin, Plus, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/addresses")({
  head: () => ({ meta: [{ title: "Endereços — Atacado" }] }),
  component: AddressesPage,
});

const emptyForm: AddressInput = { label: "", street: "", number: "", complement: "", district: "", city: "", state: "", zip: "" };

function AddressesPage() {
  const { user } = useAuth();
  const { data: company } = useMyCompany(user);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<AddressInput>(emptyForm);

  const { data: addresses = [] } = useAddresses(company?.id);
  const createAddress = useCreateAddress(company?.id);
  const deleteAddress = useDeleteAddress(company?.id);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!company) return;
    try {
      await createAddress.mutateAsync(form);
      toast.success("Endereço adicionado");
      setForm(emptyForm);
      setOpen(false);
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function remove(id: string) {
    try {
      await deleteAddress.mutateAsync(id);
      toast.success("Endereço removido");
    } catch (err) {
      toast.error((err as Error).message);
    }
  }


  if (!company) {
    return (
      <AppShell title="Endereços">
        <div className="bg-card border border-border rounded-xl p-8 text-center">
          <p className="text-muted-foreground">Cadastre sua empresa primeiro para gerenciar endereços.</p>
          <Button asChild className="mt-4"><Link to="/companies">Cadastrar empresa</Link></Button>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Endereços" description="Endereços de cobrança e entrega da empresa.">
      <div className="flex justify-end mb-4">
        <Button onClick={() => setOpen((s) => !s)} variant={open ? "outline" : "default"}>
          <Plus className="w-4 h-4 mr-1" /> {open ? "Cancelar" : "Adicionar endereço"}
        </Button>
      </div>

      {open && (
        <form onSubmit={add} className="bg-card border border-border rounded-xl p-6 shadow-soft mb-6 grid sm:grid-cols-2 gap-4">
          <F id="label" label="Apelido (ex: Matriz)" value={form.label} set={(v) => setForm({ ...form, label: v })} />
          <F id="zip" label="CEP *" value={form.zip} set={(v) => setForm({ ...form, zip: v })} required />
          <F id="street" label="Rua *" value={form.street} set={(v) => setForm({ ...form, street: v })} required />
          <F id="number" label="Número" value={form.number} set={(v) => setForm({ ...form, number: v })} />
          <F id="complement" label="Complemento" value={form.complement} set={(v) => setForm({ ...form, complement: v })} />
          <F id="district" label="Bairro" value={form.district} set={(v) => setForm({ ...form, district: v })} />
          <F id="city" label="Cidade *" value={form.city} set={(v) => setForm({ ...form, city: v })} required />
          <F id="state" label="UF *" value={form.state} set={(v) => setForm({ ...form, state: v })} required />
          <div className="sm:col-span-2 flex justify-end"><Button type="submit">Salvar endereço</Button></div>
        </form>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        {addresses.length === 0 ? (
          <p className="text-muted-foreground col-span-full text-center py-12">Nenhum endereço cadastrado.</p>
        ) : addresses.map((a) => (
          <div key={a.id} className="bg-card border border-border rounded-xl p-5 shadow-soft">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-md bg-primary/10 text-primary grid place-items-center"><MapPin className="w-4 h-4" /></div>
              <div className="flex-1 min-w-0">
                <p className="font-medium">{a.label || "Endereço"}</p>
                <p className="text-sm text-muted-foreground">{a.street}, {a.number} {a.complement && `- ${a.complement}`}</p>
                <p className="text-sm text-muted-foreground">{a.district && `${a.district} · `}{a.city}/{a.state} · {a.zip}</p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => remove(a.id)} aria-label="Remover">
                <Trash2 className="w-4 h-4 text-destructive" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </AppShell>
  );
}

function F({ id, label, value, set, required }: { id: string; label: string; value: string; set: (v: string) => void; required?: boolean }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} value={value} onChange={(e) => set(e.target.value)} required={required} />
    </div>
  );
}
