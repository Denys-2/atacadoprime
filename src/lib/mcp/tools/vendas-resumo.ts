import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, textResult, errorResult, brl, resolvePeriodo, startOfDayIso, endOfDayIso, type Periodo } from "../supabase";

export default defineTool({
  name: "vendas_resumo",
  title: "Resumo de vendas",
  description:
    "Resumo de vendas (todos os pedidos exceto cancelados) em um período: quantidade de pedidos, faturamento total, ticket médio, divisão por forma de pagamento e divisão por cidade do cliente.",

  inputSchema: {
    periodo: z
      .enum(["hoje", "ontem", "semana", "mes", "mes_passado", "personalizado"])
      .describe("Período das vendas."),
    de: z.string().nullable().optional().describe("Data inicial YYYY-MM-DD (só para periodo=personalizado)."),
    ate: z.string().nullable().optional().describe("Data final YYYY-MM-DD (só para periodo=personalizado)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ periodo, de, ate }, ctx) => {
    if (!ctx.isAuthenticated()) return errorResult("Não autenticado.");
    try {
      const range = resolvePeriodo(periodo as Periodo, de, ate);
      const supabase = supabaseForUser(ctx);
      const { data, error } = await supabase
        .from("orders")
        .select("id,total,created_at,companies(trade_name,legal_name,cidade),payments(tipo,valor)")
        .neq("status", "CANCELADO")
        .gte("created_at", startOfDayIso(range.de))
        .lte("created_at", endOfDayIso(range.ate))
        .order("created_at", { ascending: false });
      if (error) return errorResult(error.message);

      const rows = data ?? [];
      const total = rows.reduce((s, r) => s + Number(r.total ?? 0), 0);
      const porPagamento: Record<string, number> = {};
      const porCidade: Record<string, { pedidos: number; total: number }> = {};
      for (const r of rows) {
        for (const p of (r.payments ?? []) as { tipo: string; valor: number }[]) {
          const k = p.tipo ?? "OUTRO";
          porPagamento[k] = (porPagamento[k] ?? 0) + Number(p.valor ?? 0);
        }
        const comp = r.companies as { cidade?: string | null } | null;
        const cidade = comp?.cidade?.trim() || "Sem cidade";
        const acc = porCidade[cidade] ?? { pedidos: 0, total: 0 };
        acc.pedidos += 1;
        acc.total += Number(r.total ?? 0);
        porCidade[cidade] = acc;
      }
      const ticket = rows.length ? total / rows.length : 0;
      const cidadesOrdenadas = Object.entries(porCidade).sort((a, b) => b[1].total - a[1].total);

      const linhas = [
        `Vendas (${range.label} — ${range.de} a ${range.ate})`,
        `Pedidos: ${rows.length}`,
        `Faturamento: ${brl(total)}`,
        `Ticket médio: ${brl(ticket)}`,
        `Cidades atendidas: ${cidadesOrdenadas.length}`,
        "",
        "Por forma de pagamento:",
        ...Object.entries(porPagamento).map(([k, v]) => `- ${k}: ${brl(v)}`),
      ];
      if (!Object.keys(porPagamento).length) linhas.push("- (sem pagamentos registrados)");

      linhas.push("", "Por cidade:");
      if (cidadesOrdenadas.length) {
        linhas.push(...cidadesOrdenadas.map(([c, v]) => `- ${c}: ${v.pedidos} pedido(s) · ${brl(v.total)}`));
      } else {
        linhas.push("- (sem pedidos no período)");
      }

      return textResult(linhas.join("\n"), {
        periodo: range,
        pedidos: rows.length,
        faturamento: total,
        ticket_medio: ticket,
        por_pagamento: porPagamento,
        cidades_atendidas: cidadesOrdenadas.length,
        por_cidade: Object.fromEntries(cidadesOrdenadas),
      });

    } catch (e) {
      return errorResult(e instanceof Error ? e.message : String(e));
    }
  },
});
