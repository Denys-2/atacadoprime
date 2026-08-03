import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, textResult, errorResult, brl } from "../supabase";

export default defineTool({
  name: "estoque_critico",
  title: "Estoque crítico",
  description:
    "Lista produtos ativos com estoque igual ou abaixo do estoque mínimo, com preço de venda, custo e margem.",
  inputSchema: {
    limite: z.number().int().nullable().optional().describe("Máximo de produtos retornados (padrão 30)."),
    busca: z.string().nullable().optional().describe("Filtra por nome ou SKU do produto."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limite, busca }, ctx) => {
    if (!ctx.isAuthenticated()) return errorResult("Não autenticado.");
    const supabase = supabaseForUser(ctx);

    let q = supabase
      .from("products")
      .select("nome,sku,estoque,estoque_minimo,preco_unitario,preco_custo,localizacao")
      .eq("status", true);
    if (busca) q = q.or(`nome.ilike.%${busca}%,sku.ilike.%${busca}%`);
    const { data, error } = await q.order("estoque", { ascending: true }).limit(500);
    if (error) return errorResult(error.message);

    const lista = (data ?? [])
      .filter((p) => Number(p.estoque ?? 0) <= Number(p.estoque_minimo ?? 0))
      .slice(0, limite ?? 30)
      .map((p) => {
        const venda = Number(p.preco_unitario ?? 0);
        const custo = Number(p.preco_custo ?? 0);
        const margem = venda > 0 ? ((venda - custo) / venda) * 100 : 0;
        return {
          nome: p.nome,
          sku: p.sku,
          estoque: Number(p.estoque ?? 0),
          estoque_minimo: Number(p.estoque_minimo ?? 0),
          preco_unitario: venda,
          preco_custo: custo,
          margem_percentual: Number(margem.toFixed(1)),
        };
      });

    if (!lista.length) return textResult("Nenhum produto abaixo do estoque mínimo.", { produtos: [] });

    const texto = [
      `${lista.length} produto(s) em estoque crítico:`,
      ...lista.map(
        (p) =>
          `- ${p.nome} (${p.sku ?? "s/ SKU"}) — ${p.estoque}/${p.estoque_minimo} un · venda ${brl(p.preco_unitario)} · custo ${brl(p.preco_custo)} · margem ${p.margem_percentual}%`,
      ),
    ].join("\n");

    return textResult(texto, { produtos: lista });
  },
});
