import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { V2 } from "@/components/v2/theme";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/format";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { DollarSign } from "lucide-react";

export const Route = createFileRoute("/_authenticated/pos/caixa")({
  head: () => ({ meta: [{ title: "Caixa — POS Prime" }] }),
  component: PosCaixa,
});

type CaixaState = {
  aberto: boolean;
  operador: string;
  valorInicial: number;
  abertoEm: string | null;
  fechadoEm: string | null;
  valorFinal: number | null;
};

const KEY = "pos.caixa.v1";
const brl = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

function load(): CaixaState {
  if (typeof window === "undefined") return blank();
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as CaixaState;
  } catch {}
  return blank();
}
function blank(): CaixaState {
  return { aberto: false, operador: "", valorInicial: 0, abertoEm: null, fechadoEm: null, valorFinal: null };
}

function PosCaixa() {
  const [state, setState] = useState<CaixaState>(blank());
  const [operador, setOperador] = useState("");
  const [inicial, setInicial] = useState("");
  const [final, setFinal] = useState("");

  useEffect(() => setState(load()), []);

  function save(next: CaixaState) {
    localStorage.setItem(KEY, JSON.stringify(next));
    setState(next);
  }

  function abrir() {
    if (!operador.trim()) { toast.error("Informe o operador"); return; }
    save({
      aberto: true,
      operador: operador.trim(),
      valorInicial: Number(inicial) || 0,
      abertoEm: new Date().toISOString(),
      fechadoEm: null,
      valorFinal: null,
    });
    toast.success("Caixa aberto");
  }

  function fechar() {
    const valorFinal = Number(final) || 0;
    save({ ...state, aberto: false, fechadoEm: new Date().toISOString(), valorFinal });
    toast.success("Caixa fechado");
  }

  const { data: summary } = useQuery({
    queryKey: ["pos", "caixa-summary"],
    queryFn: async () => {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const { data, error } = await supabase
        .from("orders")
        .select("total, pagamento:payments(tipo)")
        .eq("status", "PAGO")
        .gte("created_at", today.toISOString());
      if (error) throw error;
      const rows = (data ?? []) as { total: number; pagamento: { tipo: string }[] }[];
      const total = rows.reduce((s, r) => s + Number(r.total ?? 0), 0);
      const dinheiro = rows.filter((r) => r.pagamento?.[0]?.tipo === "DINHEIRO").reduce((s, r) => s + Number(r.total ?? 0), 0);
      const cartao = rows.filter((r) => r.pagamento?.[0]?.tipo === "CARTAO").reduce((s, r) => s + Number(r.total ?? 0), 0);
      const pix = rows.filter((r) => r.pagamento?.[0]?.tipo === "PIX").reduce((s, r) => s + Number(r.total ?? 0), 0);
      return { vendas: rows.length, total, dinheiro, cartao, pix };
    },
  });

  return (
    <div className="p-3 space-y-3">
      <h1 className="text-lg font-bold">Caixa</h1>

      {!state.aberto ? (
        <div className="rounded-lg border p-4 space-y-3" style={{ background: V2.LIGHT_SURFACE, borderColor: V2.LIGHT_BORDER }}>
          <div className="text-sm font-semibold">Abrir caixa</div>
          <Input placeholder="Operador" value={operador} onChange={(e) => setOperador(e.target.value)} className="h-11" />
          <Input
            placeholder="Valor inicial (troco)"
            type="number"
            inputMode="decimal"
            value={inicial}
            onChange={(e) => setInicial(e.target.value)}
            className="h-11"
          />
          <Button onClick={abrir} className="w-full h-12 font-semibold" style={{ background: V2.TEAL, color: "#fff" }}>
            Abrir caixa
          </Button>
          {state.fechadoEm && (
            <div className="text-xs" style={{ color: V2.LIGHT_MUTED }}>
              Último fechamento: {formatDateTime(state.fechadoEm)} · {brl(state.valorFinal ?? 0)}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="rounded-lg border p-4" style={{ background: V2.LIGHT_SURFACE, borderColor: V2.LIGHT_BORDER }}>
            <div className="text-xs" style={{ color: V2.LIGHT_MUTED }}>Operador</div>
            <div className="text-sm font-semibold">{state.operador}</div>
            <div className="text-xs mt-2" style={{ color: V2.LIGHT_MUTED }}>Aberto em</div>
            <div className="text-sm">{state.abertoEm && formatDateTime(state.abertoEm)}</div>
            <div className="text-xs mt-2" style={{ color: V2.LIGHT_MUTED }}>Valor inicial</div>
            <div className="text-lg font-bold" style={{ color: V2.TEAL }}>{brl(state.valorInicial)}</div>
          </div>

          {/* Resumo do dia */}
          <div className="rounded-lg border p-4 space-y-3" style={{ background: V2.LIGHT_SURFACE, borderColor: V2.LIGHT_BORDER }}>
            <div className="text-sm font-semibold flex items-center gap-2">
              <DollarSign className="h-4 w-4" style={{ color: V2.TEAL }} /> Vendas de hoje
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg p-3" style={{ background: V2.LIGHT_BG }}>
                <div className="text-xs" style={{ color: V2.LIGHT_MUTED }}>Vendas</div>
                <div className="text-lg font-bold" style={{ color: V2.LIGHT_TEXT }}>{summary?.vendas ?? 0}</div>
              </div>
              <div className="rounded-lg p-3" style={{ background: V2.LIGHT_BG }}>
                <div className="text-xs" style={{ color: V2.LIGHT_MUTED }}>Total</div>
                <div className="text-lg font-bold" style={{ color: V2.TEAL }}>{brl(summary?.total ?? 0)}</div>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span style={{ color: V2.LIGHT_MUTED }}>Dinheiro</span>
                <span className="font-semibold" style={{ color: V2.LIGHT_TEXT }}>{brl(summary?.dinheiro ?? 0)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span style={{ color: V2.LIGHT_MUTED }}>Cartão</span>
                <span className="font-semibold" style={{ color: V2.LIGHT_TEXT }}>{brl(summary?.cartao ?? 0)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span style={{ color: V2.LIGHT_MUTED }}>PIX</span>
                <span className="font-semibold" style={{ color: V2.LIGHT_TEXT }}>{brl(summary?.pix ?? 0)}</span>
              </div>
            </div>
          </div>

          <div className="rounded-lg border p-4 space-y-3" style={{ background: V2.LIGHT_SURFACE, borderColor: V2.LIGHT_BORDER }}>
            <div className="text-sm font-semibold">Fechar caixa</div>
            <Input
              placeholder="Valor contado em dinheiro"
              type="number"
              inputMode="decimal"
              value={final}
              onChange={(e) => setFinal(e.target.value)}
              className="h-11"
            />
            <Button onClick={fechar} className="w-full h-12 font-semibold" style={{ background: V2.TEAL, color: "#fff" }}>
              Fechar caixa
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
