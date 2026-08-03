import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { useAuth, useProfile } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Configurações — Atacado" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const { user } = useAuth();
  const { data: profile } = useProfile(user);
  const qc = useQueryClient();
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [pwd, setPwd] = useState("");

  useEffect(() => {
    if (profile) { setFullName(profile.full_name ?? ""); setPhone(profile.phone ?? ""); }
  }, [profile]);

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from("profiles").update({ full_name: fullName, phone }).eq("id", user.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Perfil atualizado");
    qc.invalidateQueries({ queryKey: ["profile", user.id] });
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.auth.updateUser({ password: pwd });
    if (error) { toast.error(error.message); return; }
    toast.success("Senha atualizada");
    setPwd("");
  }

  return (
    <AppShell title="Configurações" description="Atualize seus dados pessoais e segurança.">
      <div className="grid gap-6 max-w-2xl">
        <form onSubmit={saveProfile} className="bg-card border border-border rounded-xl p-6 shadow-soft space-y-4">
          <h2 className="font-semibold">Perfil</h2>
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" value={user?.email ?? ""} disabled />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="full_name">Nome completo</Label>
            <Input id="full_name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="phone">Telefone</Label>
            <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />} Salvar
            </Button>
          </div>
        </form>

        <form onSubmit={changePassword} className="bg-card border border-border rounded-xl p-6 shadow-soft space-y-4">
          <h2 className="font-semibold">Senha</h2>
          <div className="space-y-1.5">
            <Label htmlFor="new_pwd">Nova senha</Label>
            <Input id="new_pwd" type="password" minLength={8} value={pwd} onChange={(e) => setPwd(e.target.value)} required />
          </div>
          <div className="flex justify-end"><Button type="submit">Atualizar senha</Button></div>
        </form>
      </div>
    </AppShell>
  );
}
