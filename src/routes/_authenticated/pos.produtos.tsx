import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { V2 } from "@/components/v2/theme";
import { Input } from "@/components/ui/input";
import { Search, Printer } from "lucide-react";
import { printHTML } from "@/lib/pos-printer";
import { renderLabel } from "@/lib/pos-templates";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/pos/produtos")({
  head: () => ({ meta: [{ title: "Produtos — POS Prime" }] }),
  component: PosProdutos,
});

const brl = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

function PosProdutos() {
  const [q, setQ] = useState("");
  const [copies, setCopies] = useState(1);

  const { data: products = [] } = useQuery({
    queryKey: ["pos", "produtos-lista", q],
    queryFn: async () => {
      let query = supabase
        .from("products")
        .select("id,nome,sku,ean13,preco_unitario,preco_nivel_1")
        .eq("status", true)
        .order("nome")
        .limit(500);
      if (q.trim()) query = query.or(`nome.ilike.%${q}%,sku.ilike.%${q}%`);
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });

  async function printLabel(p: any) {
    if (!p.ean13) { toast.error("Produto sem código EAN13"); return; }
    const html = renderLabel({
      nome: p.nome,
      preco: Number(p.preco_nivel_1 ?? p.preco_unitario),
      codigo: p.ean13,
      sku: p.sku,
    });
    await printHTML(html, { copies });
  }

  return (
    <div className="p-3 space-y-3">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 opacity-60" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar produto"
            className="pl-8 h-11"
          />
        </div>
        <select
          value={copies}
          onChange={(e) => setCopies(Number(e.target.value))}
          className="h-11 rounded border px-2 text-sm"
          style={{ background: V2.LIGHT_SURFACE, borderColor: V2.LIGHT_BORDER }}
          aria-label="Cópias"
        >
          {[1, 2, 5, 10].map((n) => <option key={n} value={n}>{n}x</option>)}
        </select>
      </div>

      <div className="space-y-2">
        {products.map((p: any) => (
          <div
            key={p.id}
            className="p-3 rounded-lg border flex items-center gap-3"
            style={{ background: V2.LIGHT_SURFACE, borderColor: V2.LIGHT_BORDER }}
          >
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{p.nome}</div>
              <div className="text-[11px]" style={{ color: V2.LIGHT_MUTED }}>
                {p.sku} {p.ean13 ? `· EAN ${p.ean13}` : "· sem EAN"}
              </div>
              <div className="font-bold text-sm mt-0.5" style={{ color: V2.TEAL }}>
                {brl(Number(p.preco_nivel_1 ?? p.preco_unitario))}
              </div>
            </div>
            <button
              onClick={() => printLabel(p)}
              className="h-10 px-3 rounded-lg border flex items-center gap-1.5 text-xs font-semibold"
              style={{ borderColor: V2.LIGHT_BORDER, color: V2.TEAL }}
            >
              <Printer className="h-4 w-4" /> Etiqueta
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
