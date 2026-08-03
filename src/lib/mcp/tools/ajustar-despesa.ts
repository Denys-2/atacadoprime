import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, textResult, errorResult, brl } from "../supabase";

const CAT_VIAGEM: Record<string, string> = {
  combustivel: "COMBUSTIVEL",
  gasolina: "COMBUSTIVEL",
  etanol: "COMBUSTIVEL",
  diesel: "COMBUSTIVEL",
  hospedagem: "HOSPEDAGEM",
  hotel: "HOSPEDAGEM",
  alimentacao: "ALIMENTACAO",
  refeicao: "ALIMENTACAO",
  almoco: "ALIMENTACAO",
  jantar: "ALIMENTACAO",
  pedagio: "PEDAGIO",
  manutencao: "MANUTENCAO",
  oficina: "MANUTENCAO",
};

const FORMA: Record<string, string> = {
  pix: "PIX",
  dinheiro: "DINHEIRO",
  especie: "DINHEIRO",
  cartao: "CARTAO",
  credito: "CARTAO",
  debito: "CARTAO",
};

const norm = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

export default defineTool({
  name: "ajustar_despesa",
  title: "Corrigir ou apagar despesa",
  description:
    "Corrige (valor, descrição, categoria, forma de pagamento, conta, data) ou apaga uma despesa já lançada. " +
    "Informe o `id` devolvido por `lancar_despesa` e o `tipo` (viagem, empresa ou particular). " +
    "Use `acao: 'excluir'` para apagar. Confirme com o usuário antes de excluir.",
  inputSchema: {
    id: z.string().describe("Id da despesa (retornado por lancar_despesa)."),
    tipo: z.enum(["viagem", "empresa", "particular"]).describe("Onde a despesa foi lançada."),
    acao: z.enum(["atualizar", "excluir"]).describe("atualizar = alterar campos; excluir = apagar o lançamento."),
    valor: z.number().nullable().optional().describe("Novo valor em REAIS."),
    descricao: z.string().nullable().optional().describe("Nova descrição."),
    categoria: z.string().nullable().optional().describe("Nova categoria."),
    forma_pagamento: z.string().nullable().optional().describe("pix, dinheiro ou cartão (somente viagem)."),
    conta: z.string().nullable().optional().describe("Nome ou id da conta bancária."),
    data: z.string().nullable().optional().describe("Nova data YYYY-MM-DD."),
  },
  annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
  handler: async (input, ctx) => {
    if (!ctx.isAuthenticated()) return errorResult("Não autenticado.");
    const supabase = supabaseForUser(ctx);
    const table =
      input.tipo === "viagem" ? "trip_expenses" : input.tipo === "particular" ? "personal_entries" : "financial_entries";

    if (input.acao === "excluir") {
      const { error } = await supabase.from(table).delete().eq("id", input.id);
      if (error) return errorResult(error.message);
      return textResult(`Despesa ${input.id} excluída.`, { id: input.id, excluida: true });
    }

    const patch: Record<string, unknown> = {};
    if (input.valor != null) {
      if (Number(input.valor) <= 0) return errorResult("Valor deve ser maior que zero.");
      patch.valor = Number(input.valor);
    }
    if (input.descricao) patch.descricao = input.descricao;
    if (input.data) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(input.data)) return errorResult("Data inválida. Use YYYY-MM-DD.");
      if (input.tipo === "particular") {
        patch.vencimento = input.data;
        patch.pagamento = input.data;
      } else {
        patch.data = input.data;
      }
    }
    if (input.conta && input.tipo !== "particular") {

      const { data: contas } = await supabase.from("bank_accounts").select("id,nome,banco").eq("ativo", true);
      const r = norm(input.conta);
      const conta = (contas ?? []).find(
        (a) => a.id.toLowerCase() === r || norm(`${a.nome} ${a.banco ?? ""}`).includes(r),
      );
      if (!conta) {
        return textResult(
          `Não encontrei a conta "${input.conta}". Contas ativas:\n` +
            (contas ?? []).map((a) => `- ${a.nome}`).join("\n"),
        );
      }
      patch.account_id = conta.id;
    }

    if (input.tipo === "viagem") {
      if (input.categoria) patch.categoria = CAT_VIAGEM[norm(input.categoria)] ?? "OUTROS";
      if (input.forma_pagamento) patch.forma_pagamento = FORMA[norm(input.forma_pagamento)] ?? "OUTRO";
    } else if (input.tipo === "particular") {
      if (input.categoria) patch.categoria = input.categoria;
    } else if (input.categoria) {
      const { data: cats } = await supabase.from("financial_categories").select("id,nome");
      const alvo = norm(input.categoria);
      const hit = (cats ?? []).find((c) => norm(c.nome).includes(alvo));
      if (!hit) return errorResult(`Categoria "${input.categoria}" não encontrada.`);
      patch.categoria_id = hit.id;
    }

    if (!Object.keys(patch).length) return errorResult("Nada para alterar. Informe ao menos um campo.");

    const { error } =
      input.tipo === "viagem"
        ? await supabase.from("trip_expenses").update(patch as never).eq("id", input.id)
        : input.tipo === "particular"
          ? await supabase.from("personal_entries").update(patch as never).eq("id", input.id)
          : await supabase.from("financial_entries").update(patch as never).eq("id", input.id);
    if (error) return errorResult(error.message);


    const resumo = Object.entries(patch)
      .map(([k, v]) => `${k}: ${k === "valor" ? brl(Number(v)) : String(v)}`)
      .join(", ");
    return textResult(`Despesa ${input.id} atualizada (${resumo}).`, { id: input.id, ...patch });
  },
});
