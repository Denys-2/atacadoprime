import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, textResult, errorResult } from "../supabase";

const ETAPAS = [
  "NOVO_LEAD",
  "CONTATO_FEITO",
  "NEGOCIACAO",
  "AGUARDANDO_RETORNO",
  "CLIENTE",
  "PERDIDO",
  "PEDIDO",
] as const;

type Etapa = (typeof ETAPAS)[number];

const LABEL: Record<Etapa, string> = {
  NOVO_LEAD: "Novo lead",
  CONTATO_FEITO: "Contato feito",
  NEGOCIACAO: "Negociação",
  AGUARDANDO_RETORNO: "Aguardando retorno",
  CLIENTE: "Cliente",
  PERDIDO: "Perdido",
  PEDIDO: "Pedido",
};

function digits(v?: string | null) {
  return (v ?? "").replace(/\D/g, "");
}

export default defineTool({
  name: "crm_leads",
  title: "Leads do CRM",
  description:
    "Consulta os chaveiros/leads do funil do CRM. Permite filtrar por etapa do kanban (ex.: NOVO_LEAD = coluna 'Novo lead'), por cidade/estado e mostrar apenas quem tem WhatsApp válido. Retorna a contagem total, o resumo por etapa e a lista com nome, cidade, WhatsApp e telefone.",
  inputSchema: {
    etapa: z
      .enum(ETAPAS)
      .nullable()
      .optional()
      .describe("Coluna do kanban. Ex.: NOVO_LEAD para 'Novo lead'. Vazio = todas as etapas."),
    cidade: z.string().nullable().optional().describe("Filtra por cidade (ex.: Brasília)."),
    estado: z.string().nullable().optional().describe("Filtra por UF (ex.: DF)."),
    somente_com_whatsapp: z
      .boolean()
      .nullable()
      .optional()
      .describe("true = retorna apenas leads com WhatsApp preenchido e válido."),
    limite: z.number().int().nullable().optional().describe("Máximo de leads listados (padrão 50)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ etapa, cidade, estado, somente_com_whatsapp, limite }, ctx) => {
    if (!ctx.isAuthenticated()) return errorResult("Não autenticado.");
    const supabase = supabaseForUser(ctx);

    let q = supabase
      .from("leads")
      .select("id,empresa,contato,whatsapp,telefone,cidade,estado,status,score,ultimo_contato")
      .order("position", { ascending: true });

    if (etapa) q = q.eq("status", etapa);
    if (cidade) q = q.ilike("cidade", `%${cidade}%`);
    if (estado) q = q.ilike("estado", `%${estado}%`);

    const { data, error } = await q.limit(1000);
    if (error) return errorResult(error.message);

    const todos = (data ?? []).map((l) => {
      const wa = digits(l.whatsapp) || digits(l.telefone);
      return {
        nome: l.empresa || l.contato || "Sem nome",
        contato: l.contato ?? null,
        cidade: l.cidade ?? "—",
        estado: l.estado ?? "—",
        etapa: LABEL[(l.status as Etapa) ?? "NOVO_LEAD"] ?? l.status,
        whatsapp: wa.length >= 10 ? (l.whatsapp || l.telefone) : null,
        telefone: l.telefone ?? null,
        score: l.score ?? null,
      };
    });

    const lista = (somente_com_whatsapp ? todos.filter((l) => l.whatsapp) : todos).slice(
      0,
      limite ?? 50,
    );

    const comWa = todos.filter((l) => l.whatsapp).length;

    const porEtapa = new Map<string, number>();
    for (const l of todos) porEtapa.set(l.etapa, (porEtapa.get(l.etapa) ?? 0) + 1);

    const filtro = [
      etapa ? `etapa ${LABEL[etapa]}` : null,
      cidade ? `cidade ${cidade}` : null,
      estado ? `UF ${estado}` : null,
    ]
      .filter(Boolean)
      .join(", ");

    if (!todos.length) {
      return textResult(`Nenhum lead encontrado${filtro ? ` (${filtro})` : ""}.`, { total: 0, leads: [] });
    }

    const linhas = [
      `${todos.length} lead(s)${filtro ? ` — ${filtro}` : ""}.`,
      `Com WhatsApp: ${comWa} · Sem WhatsApp: ${todos.length - comWa}`,
      !etapa
        ? `Por etapa: ${[...porEtapa.entries()].map(([k, v]) => `${k} ${v}`).join(" · ")}`
        : null,
      "",
      ...lista.map(
        (l) =>
          `- ${l.nome} (${l.cidade}/${l.estado})${etapa ? "" : ` · ${l.etapa}`}${l.whatsapp ? ` · WhatsApp ${l.whatsapp}` : " · sem WhatsApp"}`,
      ),
      lista.length < todos.length ? `… mostrando ${lista.length} de ${todos.length}.` : null,
    ]
      .filter((l) => l !== null)
      .join("\n");

    return textResult(linhas, {
      total: todos.length,
      com_whatsapp: comWa,
      sem_whatsapp: todos.length - comWa,
      por_etapa: Object.fromEntries(porEtapa),
      leads: lista,
    });
  },
});
