import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { callAI } from "./ai.server";

// Lê um recibo/cupom fiscal a partir de uma imagem e extrai dados da despesa
export const aiExtractReceipt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { image_data_url: string }) => d)
  .handler(async ({ data }) => {
    return await callAI(
      "Você é um leitor OCR financeiro para recibos, cupons fiscais, comprovantes Pix/cartão e notas de despesas de viagem no Brasil. Leia a imagem com atenção e extraia o valor TOTAL pago, data, estabelecimento, forma de pagamento e uma categoria. Priorize campos como TOTAL, VALOR PAGO, VALOR, RECEBEMOS, DÉBITO, CRÉDITO, PIX, dinheiro. Ignore CNPJ, telefone, subtotal, troco e valores unitários quando houver total. Se a data estiver ausente, use null. Se a categoria for incerta, use Outros. Responda somente pela chamada de função.",
      [
        { type: "text", text: "Extraia os dados desta despesa de viagem. Retorne o valor em número com ponto decimal, sem R$.", },
        { type: "image_url", image_url: { url: data.image_data_url } },
      ],
      {
        type: "object",
        additionalProperties: false,
        properties: {
          valor: { type: ["number", "null"] },
          data: { type: ["string", "null"], description: "YYYY-MM-DD" },
          estabelecimento: { type: ["string", "null"] },
          categoria: { type: "string", description: "Uma destas categorias: Combustível, Hospedagem, Alimentação, Pedágio, Manutenção, Estacionamento, Outros" },
          forma_pagamento: { type: ["string", "null"], description: "Pix, Cartão, Dinheiro, etc" },
          descricao: { type: ["string", "null"] },
        },
        required: ["valor", "data", "estabelecimento", "categoria", "forma_pagamento", "descricao"],
      }
    );
  });

// Classifica mensagem WhatsApp
export const aiClassifyMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { text: string }) => d)
  .handler(async ({ data }) => {
    return await callAI(
      "Classifique mensagens de WhatsApp de clientes de distribuidor de chaves/alarmes automotivos. Retorne categoria e confiança.",
      data.text,
      {
        type: "object",
        properties: {
          categoria: { type: "string", enum: ["PEDIDO", "ORCAMENTO", "INTERESSE", "SUPORTE", "COBRANCA", "DUVIDA", "SEM_INTERESSE"] },
          confianca: { type: "number" },
          motivo: { type: "string" },
        },
        required: ["categoria", "confianca", "motivo"],
      }
    );
  });

// Sugere resposta
export const aiSuggestReply = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { conversation: string }) => d)
  .handler(async ({ data }) => {
    const result = await callAI(
      "Você é um vendedor B2B de chaves/controles/alarmes automotivos. Sugira uma resposta curta, profissional e cordial em pt-BR.",
      data.conversation,
      {
        type: "object",
        properties: { resposta: { type: "string" }, tom: { type: "string" } },
        required: ["resposta"],
      }
    );
    return result;
  });

// Extrai produtos de mensagem
export const aiExtractProducts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { text: string }) => d)
  .handler(async ({ data }) => {
    return await callAI(
      "Extraia produtos e quantidades de mensagens de pedido. Foco em chaves automotivas, controles, alarmes, baterias.",
      data.text,
      {
        type: "object",
        properties: {
          itens: {
            type: "array",
            items: {
              type: "object",
              properties: {
                produto: { type: "string" },
                quantidade: { type: "number" },
              },
              required: ["produto", "quantidade"],
            },
          },
        },
        required: ["itens"],
      }
    );
  });

// Gera recomendações analisando dados comerciais
export const aiAnalyzeOpportunities = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    // Clientes sem compra há mais tempo
    const { data: companies = [] } = await supabase
      .from("companies")
      .select("id,trade_name,legal_name,cidade,estado")
      .eq("status", "approved")
      .limit(50);
    const { data: orders = [] } = await supabase
      .from("orders")
      .select("company_id,created_at")
      .order("created_at", { ascending: false })
      .limit(500);
    const lastOrder = new Map<string, string>();
    for (const o of orders ?? []) {
      if (o.company_id && !lastOrder.has(o.company_id)) lastOrder.set(o.company_id, o.created_at);
    }
    const now = Date.now();
    const inactive = (companies ?? [])
      .map((c: any) => {
        const last = lastOrder.get(c.id);
        const days = last ? Math.floor((now - new Date(last).getTime()) / 86400000) : 999;
        return { ...c, dias_sem_compra: days };
      })
      .filter((c: any) => c.dias_sem_compra > 30)
      .sort((a: any, b: any) => b.dias_sem_compra - a.dias_sem_compra)
      .slice(0, 10);

    // Salva como recomendações
    const recs = inactive.map((c: any) => ({
      tipo: "CLIENTE_SEM_COMPRA",
      titulo: `${c.trade_name || c.legal_name} — ${c.dias_sem_compra}d sem compra`,
      descricao: `Cliente em ${c.cidade || "—"}/${c.estado || "—"} está há ${c.dias_sem_compra} dias sem comprar. Sugerir reposição via WhatsApp ou visita.`,
      prioridade: c.dias_sem_compra > 60 ? "alta" : "media",
      referencia_tipo: "company",
      referencia_id: c.id,
      payload: { dias_sem_compra: c.dias_sem_compra },
    }));
    if (recs.length) await supabase.from("ai_recommendations").insert(recs as any);

    // Leads quentes
    const { data: leads = [] } = await supabase
      .from("leads")
      .select("id,empresa,cidade,estado,lead_score,status")
      .gte("lead_score", 70)
      .limit(10);
    const leadRecs = (leads ?? []).map((l: any) => ({
      tipo: "LEAD_QUENTE",
      titulo: `${l.empresa} — score ${l.lead_score}`,
      descricao: `Lead com alta probabilidade de conversão em ${l.cidade || "—"}/${l.estado || "—"}.`,
      prioridade: l.lead_score >= 85 ? "critica" : "alta",
      referencia_tipo: "lead",
      referencia_id: l.id,
      payload: { lead_score: l.lead_score },
    }));
    if (leadRecs.length) await supabase.from("ai_recommendations").insert(leadRecs as any);

    return { created: recs.length + leadRecs.length, inactive: recs.length, hot_leads: leadRecs.length };
  });
