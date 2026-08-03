import { createClient } from "@supabase/supabase-js";
import type { ToolContext } from "@lovable.dev/mcp-js";
import type { Database } from "@/integrations/supabase/types";

/** Cliente Supabase agindo como o usuário autenticado via OAuth (RLS aplicada). */
export function supabaseForUser(ctx: ToolContext) {
  return createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    {
      global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
}

export function textResult(text: string, structured?: Record<string, unknown>) {
  return structured
    ? { content: [{ type: "text" as const, text }], structuredContent: structured }
    : { content: [{ type: "text" as const, text }] };
}

export function errorResult(message: string) {
  return { content: [{ type: "text" as const, text: message }], isError: true };
}

export const brl = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);

function iso(d: Date) {
  return d.toISOString().slice(0, 10);
}

export type Periodo = "hoje" | "ontem" | "semana" | "mes" | "mes_passado" | "personalizado";

/** Converte um período nomeado (ou datas explícitas) em intervalo [de, ate] inclusivo. */
export function resolvePeriodo(periodo: Periodo, de?: string | null, ate?: string | null) {
  if (periodo === "personalizado") {
    if (!de || !ate) throw new Error("Para periodo 'personalizado' informe de e ate (YYYY-MM-DD).");
    return { de, ate, label: `${de} a ${ate}` };
  }
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const y = hoje.getFullYear();
  const m = hoje.getMonth();

  switch (periodo) {
    case "hoje":
      return { de: iso(hoje), ate: iso(hoje), label: "hoje" };
    case "ontem": {
      const o = new Date(hoje);
      o.setDate(o.getDate() - 1);
      return { de: iso(o), ate: iso(o), label: "ontem" };
    }
    case "semana": {
      const ini = new Date(hoje);
      ini.setDate(ini.getDate() - ini.getDay());
      return { de: iso(ini), ate: iso(hoje), label: "esta semana" };
    }
    case "mes":
      return { de: iso(new Date(y, m, 1)), ate: iso(new Date(y, m + 1, 0)), label: "este mês" };
    case "mes_passado":
      return { de: iso(new Date(y, m - 1, 1)), ate: iso(new Date(y, m, 0)), label: "mês passado" };
  }
}

/** Offset fixo de Brasília — evita que o Postgres (UTC) puxe vendas do dia anterior. */
const BR_OFFSET = "-03:00";

/** Fim do dia (horário de Brasília) em ISO para comparar com colunas timestamptz. */
export function endOfDayIso(date: string) {
  return `${date}T23:59:59.999${BR_OFFSET}`;
}

export function startOfDayIso(date: string) {
  return `${date}T00:00:00.000${BR_OFFSET}`;
}
