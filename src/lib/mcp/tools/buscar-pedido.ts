import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, textResult, errorResult, brl } from "../supabase";
import { orderCode } from "@/lib/order-code";

export default defineTool({
  name: "buscar_pedido",
  title: "Buscar pedido",
  description:
    "Busca pedidos pelo código curto (ex.: #JP1234) ou pelo nome do cliente, retornando itens, total, status e forma de pagamento.",
  inputSchema: {
    busca: z.string().describe("Código do pedido (#JP1234) ou nome do cliente."),
    limite: z.number().int().nullable().optional().describe("Máximo de pedidos retornados (padrão 5)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ busca, limite }, ctx) => {
    if (!ctx.isAuthenticated()) return errorResult("Não autenticado.");
    const supabase = supabaseForUser(ctx);
    const termo = busca.trim().replace(/^#/, "");
    const max = limite ?? 5;

    const { data, error } = await supabase
      .from("orders")
      .select(
        "id,total,status,created_at,companies(trade_name,legal_name,cidade),order_items(quantidade,preco_final,products(nome,sku)),payments(tipo,valor,bandeira)",
      )
      .order("created_at", { ascending: false })
      .limit(400);
    if (error) return errorResult(error.message);

    const rows = (data ?? []).map((o) => {
      const c = o.companies as { trade_name?: string; legal_name?: string; cidade?: string } | null;
      const nome = c?.trade_name || c?.legal_name || "Cliente";
      return { ...o, nome, cidade: c?.cidade ?? "—", codigo: orderCode(o.id, nome) };
    });

    const alvo = termo.toUpperCase();
    const encontrados = rows
      .filter((o) => o.codigo.toUpperCase() === alvo || o.nome.toUpperCase().includes(alvo))
      .slice(0, max);

    if (!encontrados.length) return textResult(`Nenhum pedido encontrado para "${busca}".`, { pedidos: [] });

    const texto = encontrados
      .map((o) => {
        const itens = ((o.order_items ?? []) as { quantidade: number; preco_final: number; products: { nome: string; sku: string | null } | null }[])
          .map((i) => `   · ${i.quantidade}x ${i.products?.nome ?? "item"} — ${brl(Number(i.preco_final ?? 0))}`)
          .join("\n");
        const pgto = ((o.payments ?? []) as { tipo: string; valor: number; bandeira: string | null }[])
          .map((p) => `${p.tipo}${p.bandeira ? ` (${p.bandeira})` : ""} ${brl(Number(p.valor ?? 0))}`)
          .join(", ");
        return [
          `#${o.codigo} — ${o.nome} (${o.cidade})`,
          `   Status: ${o.status} · Total: ${brl(Number(o.total ?? 0))} · ${new Date(o.created_at as string).toLocaleDateString("pt-BR")}`,
          pgto ? `   Pagamento: ${pgto}` : "   Pagamento: —",
          itens || "   (sem itens)",
        ].join("\n");
      })
      .join("\n\n");

    return textResult(texto, { pedidos: encontrados.map((o) => ({ codigo: o.codigo, id: o.id, cliente: o.nome, total: Number(o.total ?? 0), status: o.status })) });
  },
});
