import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { V2InternalShell } from "@/components/v2/InternalShell";
import { V2 } from "@/components/v2/theme";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useBankAccounts } from "@/hooks/use-bank-accounts";
import { toast } from "sonner";
import { Building2, Calendar, Minus, Plus, Receipt, Search, Trash2 } from "lucide-react";
import { brl, formatDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/v3/despesa-empresa")({
  head: () => ({ meta: [{ title: "Despesa da empresa — Prime Automotive" }] }),
  component: CompanyExpensePage,
});

type Category = { id: string; nome: string; tipo: string };

function CompanyExpensePage() {
  const qc = useQueryClient();
  const { data: accounts = [] } = useBankAccounts();
  const [search, setSearch] = useState("");
  const [period, setPeriod] = useState<string>("all");
  const [form, setForm] = useState({
    descricao: "",
    categoria_id: "",
    valor: "",
    data: new Date().toISOString().slice(0, 10),
    account_id: "",
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["fin-categories-despesa"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financial_categories")
        .select("id,nome,tipo")
        .eq("tipo", "DESPESA")
        .order("nome");
      if (error) throw error;
      return (data ?? []) as Category[];
    },
  });

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ["company-expenses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financial_entries")
        .select("id,descricao,valor,data,tipo,account_id,categoria_id,financial_categories(nome),bank_accounts(nome,cor)")
        .eq("tipo", "DESPESA")
        .is("trip_expense_id", null)
        .order("data", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const addExpense = useMutation({
    mutationFn: async () => {
      if (!form.descricao) throw new Error("Informe a descrição");
      if (!form.valor || Number(form.valor) <= 0) throw new Error("Informe um valor válido");
      if (!form.account_id) throw new Error("Escolha a conta");
      const { error } = await supabase.from("financial_entries").insert({
        descricao: form.descricao,
        valor: Number(form.valor),
        tipo: "DESPESA",
        data: form.data,
        account_id: form.account_id,
        categoria_id: form.categoria_id || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Despesa da empresa registrada");
      setForm({ descricao: "", categoria_id: "", valor: "", data: new Date().toISOString().slice(0, 10), account_id: "" });
      qc.invalidateQueries({ queryKey: ["company-expenses"] });
      qc.invalidateQueries({ queryKey: ["fin-entries"] });
      qc.invalidateQueries({ queryKey: ["bank-accounts-balances"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const removeExpense = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("financial_entries").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Despesa removida");
      qc.invalidateQueries({ queryKey: ["company-expenses"] });
      qc.invalidateQueries({ queryKey: ["fin-entries"] });
      qc.invalidateQueries({ queryKey: ["bank-accounts-balances"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const months = useMemo(() => {
    const set = new Set<string>();
    entries.forEach((e) => set.add(e.data.slice(0, 7)));
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [entries]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return entries.filter((e) => {
      const matchesSearch =
        !q ||
        `${e.descricao} ${e.financial_categories?.nome ?? ""} ${e.bank_accounts?.nome ?? ""}`.toLowerCase().includes(q);
      const matchesPeriod = period === "all" || e.data.startsWith(period);
      return matchesSearch && matchesPeriod;
    });
  }, [entries, search, period]);

  const total = useMemo(() => filtered.reduce((s, e) => s + Number(e.valor || 0), 0), [filtered]);

  return (
    <V2InternalShell
      title="Despesa da empresa"
      eyebrow="Fora de viagem"
      description="Lance contas operacionais: aluguel, energia, internet, marketing, impostos, material de escritório etc."
      actions={
        <Link to="/v3/financeiro">
          <Button variant="outline" style={{ borderColor: V2.GRAPHITE, color: V2.TEXT }}>
            Ver extrato completo
          </Button>
        </Link>
      }
    >
      <div className="grid gap-6">
        <section className="rounded-2xl border p-4 lg:p-5" style={{ background: V2.SURFACE, borderColor: V2.GRAPHITE }}>
          <div className="flex items-center gap-2 mb-4">
            <div className="h-8 w-8 rounded-lg grid place-items-center" style={{ background: V2.TEAL_LIGHT, color: V2.TEAL }}>
              <Building2 className="h-4 w-4" />
            </div>
            <h3 className="text-sm font-semibold" style={{ color: V2.TEXT }}>Novo lançamento operacional</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <div className="sm:col-span-2">
              <label className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: V2.MUTED }}>
                Descrição
              </label>
              <Input
                placeholder="Ex.: Aluguel do escritório"
                value={form.descricao}
                onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                className="mt-1"
                style={{ background: V2.BG, borderColor: V2.GRAPHITE, color: V2.TEXT }}
              />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: V2.MUTED }}>
                Categoria
              </label>
              <Select value={form.categoria_id} onValueChange={(v) => setForm({ ...form, categoria_id: v })}>
                <SelectTrigger className="mt-1" style={{ background: V2.BG, borderColor: V2.GRAPHITE, color: V2.TEXT }}>
                  <SelectValue placeholder="Selecionar" />
                </SelectTrigger>
                <SelectContent style={{ background: V2.SURFACE, borderColor: V2.GRAPHITE }}>
                  <SelectItem value=" ">Sem categoria</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: V2.MUTED }}>
                Valor (R$)
              </label>
              <Input
                type="number"
                step="0.01"
                placeholder="0,00"
                value={form.valor}
                onChange={(e) => setForm({ ...form, valor: e.target.value })}
                className="mt-1 tabular-nums"
                style={{ background: V2.BG, borderColor: V2.GRAPHITE, color: V2.TEXT }}
              />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: V2.MUTED }}>
                Data
              </label>
              <Input
                type="date"
                value={form.data}
                onChange={(e) => setForm({ ...form, data: e.target.value })}
                className="mt-1"
                style={{ background: V2.BG, borderColor: V2.GRAPHITE, color: V2.TEXT }}
              />
            </div>
            <div className="sm:col-span-2 lg:col-span-3">
              <label className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: V2.MUTED }}>
                Conta
              </label>
              <Select value={form.account_id} onValueChange={(v) => setForm({ ...form, account_id: v })}>
                <SelectTrigger className="mt-1" style={{ background: V2.BG, borderColor: V2.GRAPHITE, color: V2.TEXT }}>
                  <SelectValue placeholder="Conta que pagou" />
                </SelectTrigger>
                <SelectContent style={{ background: V2.SURFACE, borderColor: V2.GRAPHITE }}>
                  {accounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      <span className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full" style={{ background: a.cor }} />
                        {a.nome} {a.banco ? `· ${a.banco}` : ""}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button
                onClick={() => addExpense.mutate()}
                disabled={!form.descricao || !form.valor || !form.account_id || addExpense.isPending}
                className="w-full"
                style={{ background: V2.SUCCESS, color: "#fff" }}
              >
                <Plus className="h-4 w-4 mr-1" /> Registrar despesa
              </Button>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border p-4" style={{ background: V2.SURFACE, borderColor: V2.GRAPHITE }}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2">
              <Receipt className="h-4 w-4" style={{ color: V2.TEAL }} />
              <h3 className="text-sm font-semibold" style={{ color: V2.TEXT }}>Histórico de despesas</h3>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: V2.MUTED }} />
                <Input
                  placeholder="Buscar..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                  style={{ background: V2.BG, borderColor: V2.GRAPHITE, color: V2.TEXT }}
                />
              </div>
              <Select value={period} onValueChange={setPeriod}>
                <SelectTrigger className="w-40" style={{ background: V2.BG, borderColor: V2.GRAPHITE, color: V2.TEXT }}>
                  <SelectValue placeholder="Período" />
                </SelectTrigger>
                <SelectContent style={{ background: V2.SURFACE, borderColor: V2.GRAPHITE }}>
                  <SelectItem value="all">Todos os períodos</SelectItem>
                  {months.map((m) => (
                    <SelectItem key={m} value={m}>{m.slice(5, 7)}/{m.slice(0, 4)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {isLoading ? (
            <p className="text-sm py-8 text-center" style={{ color: V2.MUTED }}>Carregando...</p>
          ) : filtered.length === 0 ? (
            <div className="text-center py-10 border-2 border-dashed rounded-xl" style={{ borderColor: V2.GRAPHITE }}>
              <Minus className="h-8 w-8 mx-auto mb-2" style={{ color: V2.MUTED }} />
              <p className="text-sm" style={{ color: V2.MUTED }}>Nenhuma despesa operacional encontrada</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map((e) => (
                <div
                  key={e.id}
                  className="flex items-center justify-between gap-3 p-3 rounded-xl border"
                  style={{ background: V2.BG, borderColor: V2.GRAPHITE }}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold truncate" style={{ color: V2.TEXT }}>{e.descricao}</span>
                      {e.financial_categories?.nome && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full border" style={{ borderColor: V2.GRAPHITE, color: V2.MUTED }}>
                          {e.financial_categories.nome}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-[11px]" style={{ color: V2.MUTED }}>
                      <Calendar className="h-3 w-3" />
                      {formatDate(e.data)}
                      <span className="w-1 h-1 rounded-full" style={{ background: V2.MUTED }} />
                      {e.bank_accounts?.nome ?? "—"}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold tabular-nums" style={{ color: "#dc2626" }}>{brl(e.valor)}</span>
                    <button
                      onClick={() => removeExpense.mutate(e.id)}
                      className="p-2 rounded-lg transition hover:opacity-80"
                      style={{ color: "#dc2626", background: "#dc262612" }}
                      aria-label="Remover"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
              <div className="flex items-center justify-between pt-3 border-t" style={{ borderColor: V2.GRAPHITE }}>
                <span className="text-[11px] uppercase tracking-wider font-semibold" style={{ color: V2.MUTED }}>
                  Total filtrado
                </span>
                <span className="text-base font-semibold tabular-nums" style={{ color: V2.TEXT }}>{brl(total)}</span>
              </div>
            </div>
          )}
        </section>
      </div>
    </V2InternalShell>
  );
}
