import { defineTool } from "@lovable.dev/mcp-js";
import { supabaseForUser, textResult, errorResult } from "../supabase";

export default defineTool({
  name: "contexto_despesa",
  title: "Opções para lançar despesa",
  description:
    "Lista as viagens abertas, as contas bancárias ativas e as categorias financeiras disponíveis. " +
    "Use antes de `lancar_despesa` quando não souber em qual viagem ou conta lançar.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    if (!ctx.isAuthenticated()) return errorResult("Não autenticado.");
    const supabase = supabaseForUser(ctx);

    const [trips, accounts, cats] = await Promise.all([
      supabase
        .from("trips")
        .select("id,nome,cidade,estado,status,opened_at")
        .eq("status", "open")
        .order("opened_at", { ascending: false })
        .limit(20),
      supabase.from("bank_accounts").select("id,nome,banco").eq("ativo", true).order("nome"),
      supabase.from("financial_categories").select("id,nome,tipo").order("nome"),
    ]);

    const err = trips.error ?? accounts.error ?? cats.error;
    if (err) return errorResult(err.message);

    const norm = (s: string) =>
      s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

    const viagens = (trips.data ?? [])
      .filter((t) => !norm(t.nome ?? "").startsWith("sobras"))
      .map((t) => ({
        id: t.id,
        nome: t.nome,
        cidade: [t.cidade, t.estado].filter(Boolean).join("-") || null,
        status: t.status,
      }));
    const contas = (accounts.data ?? []).map((a) => ({ id: a.id, nome: a.nome, banco: a.banco }));
    const categorias = (cats.data ?? [])
      .filter((c) => (c.tipo ?? "").toUpperCase().includes("DESPESA") || !c.tipo)
      .map((c) => ({ id: c.id, nome: c.nome }));

    const linhas = [
      "Tipos de despesa: `viagem` (vinculada a uma viagem), `empresa` (despesa operacional, sai de uma conta) ou `particular` (financeiro pessoal do usuário). Sempre pergunte qual dos três.",
      "",
      viagens.length
        ? `Viagens abertas:\n${viagens.map((v) => `- ${v.nome}${v.cidade ? ` (${v.cidade})` : ""} — id ${v.id}`).join("\n")}`
        : "Nenhuma viagem aberta válida — viagens de 'Sobras' são só controle de estoque e não aceitam despesas.",

      "",
      contas.length
        ? `Contas ativas:\n${contas.map((c) => `- ${c.nome}${c.banco ? ` (${c.banco})` : ""} — id ${c.id}`).join("\n")}`
        : "Nenhuma conta bancária ativa.",
      "",
      categorias.length
        ? `Categorias de despesa da empresa:\n${categorias.map((c) => `- ${c.nome} — id ${c.id}`).join("\n")}`
        : "",
      "",
      "Categorias de viagem: COMBUSTIVEL, HOSPEDAGEM, ALIMENTACAO, PEDAGIO, MANUTENCAO, OUTROS.",
    ]
      .filter(Boolean)
      .join("\n");

    return textResult(linhas, { viagens, contas, categorias });
  },
});
