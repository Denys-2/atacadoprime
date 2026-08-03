import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, textResult, errorResult, brl } from "../supabase";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const CAT_VIAGEM: Record<string, string> = {
  combustivel: "COMBUSTIVEL",
  gasolina: "COMBUSTIVEL",
  etanol: "COMBUSTIVEL",
  diesel: "COMBUSTIVEL",
  hospedagem: "HOSPEDAGEM",
  hotel: "HOSPEDAGEM",
  alimentacao: "ALIMENTACAO",
  comida: "ALIMENTACAO",
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
  name: "lancar_despesa",
  title: "Lançar despesa",
  description:
    "Registra uma despesa no sistema. Existem TRÊS tipos: `viagem` (vinculada a uma viagem aberta), " +
    "`empresa` (despesa operacional, debitada de uma conta bancária) e `particular` (financeiro pessoal do usuário). " +
    "SEMPRE pergunte ao usuário se a despesa é de VIAGEM, EMPRESA ou PARTICULAR quando ele não deixar claro. " +
    "IMPORTANTE: `valor` é SEMPRE dinheiro em reais (R$) — nunca litros, quantidade ou peso. " +
    "Se o usuário JÁ informou tudo na mesma mensagem (tipo, valor em R$, descrição/categoria e — quando for viagem/empresa — viagem ou conta), " +
    "pode chamar direto com `confirmado: true` e apenas relatar o que foi gravado. " +
    "Se faltar qualquer informação, chame primeiro com `confirmado: false` para receber o resumo, pergunte o que falta e só então grave. " +
    "Em `particular` a conta padrão é DENYS - C6BANK quando o usuário não disser outra. " +
    "Use `contexto_despesa` para listar viagens, contas e categorias.",
  inputSchema: {
    tipo: z
      .enum(["viagem", "empresa", "particular"])
      .describe("viagem = despesa de viagem; empresa = despesa operacional; particular = financeiro pessoal."),
    valor: z.number().describe("Valor em REAIS (R$), positivo. Nunca litros ou quantidade."),
    descricao: z.string().describe("Descrição curta da despesa."),
    confirmado: z
      .boolean()
      .describe("false = apenas simular e devolver o resumo para confirmação. true = gravar de verdade (só após o usuário confirmar)."),
    data: z.string().nullable().optional().describe("Data YYYY-MM-DD. Padrão: hoje."),
    categoria: z
      .string()
      .nullable()
      .optional()
      .describe("Viagem: combustível, hospedagem, alimentação, pedágio, manutenção ou outros. Empresa: nome ou id da categoria financeira."),
    viagem: z.string().nullable().optional().describe("Somente tipo=viagem: id ou nome/cidade da viagem."),
    conta: z
      .string()
      .nullable()
      .optional()
      .describe("Conta bancária (id ou nome). Obrigatória em tipo=empresa; opcional em tipo=viagem."),
    forma_pagamento: z.string().nullable().optional().describe("pix, dinheiro ou cartão."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  handler: async (input, ctx) => {
    if (!ctx.isAuthenticated()) return errorResult("Não autenticado.");
    const supabase = supabaseForUser(ctx);
    const valor = Number(input.valor);
    if (!valor || valor <= 0) return errorResult("Informe um valor em reais maior que zero.");
    const data = input.data || new Date().toISOString().slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return errorResult("Data inválida. Use YYYY-MM-DD.");
    const confirmado = input.confirmado === true;

    // Contas bancárias (usadas nos dois tipos)
    const { data: accounts, error: accErr } = await supabase
      .from("bank_accounts")
      .select("id,nome,banco")
      .eq("ativo", true)
      .order("nome");
    if (accErr) return errorResult(accErr.message);
    const contas = accounts ?? [];
    const listaContas = contas.map((a) => `- ${a.nome}`).join("\n");

    const resolveConta = (ref?: string | null) => {
      if (!ref) return undefined;
      const r = norm(ref);
      return contas.find((a) => a.id.toLowerCase() === r || norm(`${a.nome} ${a.banco ?? ""}`).includes(r));
    };

    const forma = input.forma_pagamento ? (FORMA[norm(input.forma_pagamento)] ?? "OUTRO") : null;

    // ---- despesa particular (financeiro pessoal) ----
    if (input.tipo === "particular") {
      // Conta padrão do financeiro pessoal: DENYS - C6BANK (pode ser trocada informando `conta`).
      const contaPessoal =
        resolveConta(input.conta) ??
        contas.find((a) => norm(`${a.nome} ${a.banco ?? ""}`).includes("c6")) ??
        null;
      if (input.conta && !resolveConta(input.conta)) {
        return textResult(`Não encontrei a conta "${input.conta}". Contas ativas:\n${listaContas}`);
      }
      const obs = [contaPessoal ? `Conta: ${contaPessoal.nome}` : null, forma ? `Pagamento: ${forma}` : null]
        .filter(Boolean)
        .join(" · ");

      if (!confirmado) {
        return textResult(
          [
            "CONFIRME COM O USUÁRIO ANTES DE GRAVAR — nada foi salvo ainda.",
            "Tipo: despesa PARTICULAR (financeiro pessoal)",
            `Valor: ${brl(valor)} (em reais)`,
            `Descrição: ${input.descricao}`,
            `Categoria: ${input.categoria ?? "— não informada"}`,
            `Conta: ${contaPessoal ? contaPessoal.nome : "— não informada"}`,
            `Forma de pagamento: ${forma ?? "— não informada"}`,
            `Data: ${data}`,
            "\nDepois da confirmação, chame lancar_despesa novamente com confirmado: true.",
          ].join("\n"),
          { preview: true, tipo: "particular", valor, data },
        );
      }

      const { data: row, error } = await supabase
        .from("personal_entries")
        .insert({
          user_id: ctx.getUserId()!,
          tipo: "DESPESA",
          descricao: input.descricao,
          valor,
          vencimento: data,
          pagamento: data,
          status: "PAGO",
          categoria: input.categoria || null,
          observacao: obs || null,
          origem: "MANUAL",
        })
        .select("id")
        .single();
      if (error) return errorResult(error.message);

      return textResult(
        `Despesa particular lançada: ${brl(valor)} — ${input.descricao} em ${data}` +
          `${contaPessoal ? ` (conta ${contaPessoal.nome})` : ""}. ` +
          `Para corrigir ou apagar use ajustar_despesa com id ${row?.id} e tipo "particular".`,
        { id: row?.id, tipo: "particular", valor, data, conta: contaPessoal?.nome ?? null },
      );
    }


    if (input.tipo === "viagem") {
      const { data: trips, error: tripErr } = await supabase
        .from("trips")
        .select("id,nome,cidade,estado,status")
        .eq("status", "open")
        .order("opened_at", { ascending: false })
        .limit(20);
      if (tripErr) return errorResult(tripErr.message);
      // Viagens "Sobras de ..." são apenas controle de estoque — não aceitam despesas.
      const abertas = (trips ?? []).filter((t) => !norm(t.nome ?? "").startsWith("sobras"));
      if (!abertas.length)
        return errorResult(
          "Não há viagem aberta válida para despesas (viagens de 'Sobras' são apenas controle de estoque). " +
            "Abra uma viagem no sistema ou lance como despesa de empresa ou particular.",
        );


      let trip = abertas.length === 1 ? abertas[0] : undefined;
      const ref = input.viagem ? norm(input.viagem) : "";
      if (ref) {
        const found = abertas.find(
          (t) => t.id.toLowerCase() === ref || norm(`${t.nome} ${t.cidade ?? ""} ${t.estado ?? ""}`).includes(ref),
        );
        if (!found) {
          return textResult(
            `Não encontrei a viagem "${input.viagem}". Viagens abertas:\n` +
              abertas.map((t) => `- ${t.nome}${t.cidade ? ` (${t.cidade})` : ""}`).join("\n"),
          );
        }
        trip = found;
      }
      if (!trip) {
        return textResult(
          "Há mais de uma viagem aberta. Pergunte ao usuário em qual lançar:\n" +
            abertas.map((t) => `- ${t.nome}${t.cidade ? ` (${t.cidade})` : ""}`).join("\n"),
        );
      }

      const catKey = input.categoria ? norm(input.categoria) : "";
      const categoria = input.categoria ? (CAT_VIAGEM[catKey] ?? "OUTROS") : null;
      const conta = resolveConta(input.conta);
      if (input.conta && !conta) {
        return textResult(`Não encontrei a conta "${input.conta}". Contas ativas:\n${listaContas}`);
      }

      const faltando: string[] = [];
      if (!categoria) faltando.push("categoria (combustível, pedágio, hospedagem, alimentação, manutenção, outros)");
      if (!forma) faltando.push("forma de pagamento (pix, dinheiro ou cartão)");
      if (!conta) faltando.push(`conta de onde saiu o dinheiro (opcional):\n${listaContas}`);

      if (!confirmado) {
        return textResult(
          [
            "CONFIRME COM O USUÁRIO ANTES DE GRAVAR — nada foi salvo ainda.",
            `Tipo: despesa de VIAGEM — "${trip.nome}"${trip.cidade ? ` (${trip.cidade})` : ""}`,
            `Valor: ${brl(valor)} (em reais)`,
            `Descrição: ${input.descricao}`,
            `Categoria: ${categoria ?? "— não informada"}`,
            `Forma de pagamento: ${forma ?? "— não informada"}`,
            `Conta: ${conta ? conta.nome : "— não informada"}`,
            `Data: ${data}`,
            faltando.length ? `\nPergunte ao usuário: ${faltando.join("; ")}.` : "",
            "\nDepois da confirmação, chame lancar_despesa novamente com confirmado: true.",
          ]
            .filter(Boolean)
            .join("\n"),
          { preview: true, tipo: "viagem", trip_id: trip.id, valor, categoria, forma, data },
        );
      }

      const { data: row, error } = await supabase
        .from("trip_expenses")
        .insert({
          trip_id: trip.id,
          categoria: categoria ?? "OUTROS",
          descricao: input.descricao || null,
          valor,
          data,
          forma_pagamento: forma,
          account_id: conta?.id ?? null,
          created_by: ctx.getUserId()!,
        })
        .select("id")
        .single();
      if (error) return errorResult(error.message);

      return textResult(
        `Despesa de viagem lançada: ${brl(valor)} — ${input.descricao} (${categoria ?? "OUTROS"}${forma ? `, ${forma}` : ""}) em ${data}, viagem "${trip.nome}". ` +
          `Para corrigir ou apagar use ajustar_despesa com id ${row?.id}.`,
        { id: row?.id, tipo: "viagem", trip_id: trip.id, valor, categoria, forma, data },
      );
    }

    // ---- despesa de empresa ----
    if (!contas.length) return errorResult("Nenhuma conta bancária ativa cadastrada.");
    const conta = resolveConta(input.conta);
    if (input.conta && !conta) {
      return textResult(`Não encontrei a conta "${input.conta}". Contas ativas:\n${listaContas}`);
    }

    let categoriaId: string | null = null;
    let categoriaNome: string | null = null;
    if (input.categoria) {
      if (UUID.test(input.categoria)) {
        categoriaId = input.categoria;
        categoriaNome = input.categoria;
      } else {
        const { data: cats } = await supabase.from("financial_categories").select("id,nome");
        const alvo = norm(input.categoria);
        const hit = (cats ?? []).find((c) => norm(c.nome).includes(alvo));
        categoriaId = hit?.id ?? null;
        categoriaNome = hit?.nome ?? null;
      }
    }

    if (!confirmado || !conta) {
      const faltando: string[] = [];
      if (!conta) faltando.push(`de qual conta sai a despesa:\n${listaContas}`);
      if (!categoriaId) faltando.push("categoria financeira");
      return textResult(
        [
          "CONFIRME COM O USUÁRIO ANTES DE GRAVAR — nada foi salvo ainda.",
          "Tipo: despesa de EMPRESA",
          `Valor: ${brl(valor)} (em reais)`,
          `Descrição: ${input.descricao}`,
          `Categoria: ${categoriaNome ?? "— não informada"}`,
          `Conta: ${conta ? conta.nome : "— não informada"}`,
          `Data: ${data}`,
          faltando.length ? `\nPergunte ao usuário: ${faltando.join("; ")}.` : "",
          "\nDepois da confirmação, chame lancar_despesa novamente com confirmado: true.",
        ]
          .filter(Boolean)
          .join("\n"),
        { preview: true, tipo: "empresa", valor, data },
      );
    }

    const { data: row, error } = await supabase
      .from("financial_entries")
      .insert({
        descricao: input.descricao,
        valor,
        tipo: "DESPESA",
        data,
        account_id: conta.id,
        categoria_id: categoriaId,
      })
      .select("id")
      .single();
    if (error) return errorResult(error.message);

    return textResult(
      `Despesa da empresa lançada: ${brl(valor)} — ${input.descricao} em ${data}, conta "${conta.nome}". ` +
        `Para corrigir ou apagar use ajustar_despesa com id ${row?.id}.`,
      { id: row?.id, tipo: "empresa", account_id: conta.id, valor, data },
    );
  },
});
