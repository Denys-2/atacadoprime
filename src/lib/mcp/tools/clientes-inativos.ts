import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, textResult, errorResult } from "../supabase";

export default defineTool({
  name: "clientes_inativos",
  title: "Clientes sem comprar",
  description:
    "Lista clientes aprovados que estão há mais de N dias sem comprar, ordenados do mais tempo parado para o menos. Pode filtrar por cidade.",
  inputSchema: {
    dias: z.number().int().describe("Mínimo de dias sem compra (ex.: 30)."),
    cidade: z.string().nullable().optional().describe("Filtra por cidade do cliente."),
    limite: z.number().int().nullable().optional().describe("Máximo de clientes retornados (padrão 20)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ dias, cidade, limite }, ctx) => {
    if (!ctx.isAuthenticated()) return errorResult("Não autenticado.");
    const supabase = supabaseForUser(ctx);

    let q = supabase
      .from("companies")
      .select("id,trade_name,legal_name,cidade,estado,phone")
      .eq("status", "approved");
    if (cidade) q = q.ilike("cidade", `%${cidade}%`);
    const { data: companies, error } = await q.limit(500);
    if (error) return errorResult(error.message);

    const { data: orders, error: oErr } = await supabase
      .from("orders")
      .select("company_id,created_at,total")
      .eq("status", "PAGO")
      .order("created_at", { ascending: false })
      .limit(2000);
    if (oErr) return errorResult(oErr.message);

    const ultima = new Map<string, string>();
    for (const o of orders ?? []) {
      if (o.company_id && !ultima.has(o.company_id)) ultima.set(o.company_id, o.created_at as string);
    }

    const agora = Date.now();
    const lista = (companies ?? [])
      .map((c) => {
        const last = ultima.get(c.id);
        const d = last ? Math.floor((agora - new Date(last).getTime()) / 86400000) : 9999;
        return {
          nome: c.trade_name || c.legal_name,
          cidade: c.cidade ?? "—",
          estado: c.estado ?? "—",
          telefone: c.phone ?? null,
          dias_sem_compra: d,
          ultima_compra: last ?? null,
        };
      })
      .filter((c) => c.dias_sem_compra >= dias)
      .sort((a, b) => b.dias_sem_compra - a.dias_sem_compra)
      .slice(0, limite ?? 20);

    if (!lista.length) return textResult(`Nenhum cliente com ${dias}+ dias sem comprar.`, { clientes: [] });

    const texto = [
      `${lista.length} cliente(s) há ${dias}+ dias sem comprar${cidade ? ` em ${cidade}` : ""}:`,
      ...lista.map(
        (c) =>
          `- ${c.nome} (${c.cidade}/${c.estado}) — ${c.dias_sem_compra === 9999 ? "nunca comprou" : `${c.dias_sem_compra} dias`}${c.telefone ? ` · ${c.telefone}` : ""}`,
      ),
    ].join("\n");

    return textResult(texto, { clientes: lista });
  },
});
