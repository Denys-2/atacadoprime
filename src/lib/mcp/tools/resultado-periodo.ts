import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import {
  supabaseForUser,
  textResult,
  errorResult,
  brl,
  resolvePeriodo,
  startOfDayIso,
  endOfDayIso,
  type Periodo,
} from "../supabase";

export default defineTool({
  name: "resultado_periodo",
  title: "Resultado do período",
  description:
    "Demonstrativo do período: faturamento, custo das peças vendidas, taxas de cartão, despesas de viagem e lucro líquido com margem.",
  inputSchema: {
    periodo: z
      .enum(["hoje", "ontem", "semana", "mes", "mes_passado", "personalizado"])
      .describe("Período do resultado."),
    de: z.string().nullable().optional().describe("Data inicial YYYY-MM-DD (só para periodo=personalizado)."),
    ate: z.string().nullable().optional().describe("Data final YYYY-MM-DD (só para periodo=personalizado)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ periodo, de, ate }, ctx) => {
    if (!ctx.isAuthenticated()) return errorResult("Não autenticado.");
    try {
      const range = resolvePeriodo(periodo as Periodo, de, ate);
      const supabase = supabaseForUser(ctx);
      const inicio = startOfDayIso(range.de);
      const fim = endOfDayIso(range.ate);

      const [ordersRes, taxasRes, despesasRes] = await Promise.all([
        supabase
          .from("orders")
          .select("id,total,order_items(quantidade,custo_unitario)")
          .neq("status", "CANCELADO")
          .gte("created_at", inicio)
          .lte("created_at", fim),
        supabase
          .from("financial_transactions")
          .select("taxas")
          .gte("created_at", inicio)
          .lte("created_at", fim),
        supabase
          .from("trip_expenses")
          .select("valor")
          .gte("data", range.de)
          .lte("data", range.ate),
      ]);

      if (ordersRes.error) return errorResult(ordersRes.error.message);

      const pedidos = ordersRes.data ?? [];
      const faturamento = pedidos.reduce((s, o) => s + Number(o.total ?? 0), 0);
      const custo = pedidos.reduce(
        (s, o) =>
          s +
          ((o.order_items ?? []) as { quantidade: number; custo_unitario: number | null }[]).reduce(
            (si, i) => si + Number(i.custo_unitario ?? 0) * Number(i.quantidade ?? 0),
            0,
          ),
        0,
      );
      const taxas = (taxasRes.data ?? []).reduce((s, t) => s + Number(t.taxas ?? 0), 0);
      const despesas = (despesasRes.data ?? []).reduce((s, d) => s + Number(d.valor ?? 0), 0);
      const lucro = faturamento - custo - taxas - despesas;
      const margem = faturamento > 0 ? (lucro / faturamento) * 100 : 0;

      const texto = [
        `Resultado (${range.label} — ${range.de} a ${range.ate})`,
        `Pedidos: ${pedidos.length}`,
        `(+) Faturamento: ${brl(faturamento)}`,
        `(−) Custo das peças: ${brl(custo)}`,
        `(−) Taxas de cartão: ${brl(taxas)}`,
        `(−) Despesas de viagem: ${brl(despesas)}`,
        `(=) Lucro líquido: ${brl(lucro)} (${margem.toFixed(1)}%)`,
      ].join("\n");

      return textResult(texto, {
        periodo: range,
        pedidos: pedidos.length,
        faturamento,
        custo,
        taxas,
        despesas,
        lucro,
        margem_percentual: Number(margem.toFixed(1)),
      });
    } catch (e) {
      return errorResult(e instanceof Error ? e.message : String(e));
    }
  },
});
