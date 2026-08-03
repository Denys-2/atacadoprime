import { auth, defineMcp } from "@lovable.dev/mcp-js";
import vendasResumo from "./tools/vendas-resumo";
import clientesInativos from "./tools/clientes-inativos";
import estoqueCritico from "./tools/estoque-critico";
import resultadoPeriodo from "./tools/resultado-periodo";
import buscarPedido from "./tools/buscar-pedido";
import contextoDespesa from "./tools/contexto-despesa";
import lancarDespesa from "./tools/lancar-despesa";
import ajustarDespesa from "./tools/ajustar-despesa";
import crmLeads from "./tools/crm-leads";


// O issuer OAuth precisa ser o host direto do Supabase (o proxy .lovable.cloud é rejeitado).
// VITE_SUPABASE_PROJECT_ID é inlinado pelo Vite no build.
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "atacado-prime-mcp",
  title: "Atacado Prime",
  version: "0.1.0",
  instructions:
    "Ferramentas do ERP Atacado Prime (distribuidora de chaves, controles e alarmes automotivos). " +
    "Consulta: `vendas_resumo` (faturamento por período), `resultado_periodo` (lucro líquido), " +
    "`clientes_inativos`, `estoque_critico`, `buscar_pedido` e `crm_leads` (funil do CRM: contar/listar chaveiros por etapa do kanban, cidade e se têm WhatsApp). " +
    "Lançamento: `lancar_despesa` registra despesas e `ajustar_despesa` corrige ou apaga um lançamento. Valores informados pelo usuário são SEMPRE em reais (R$), nunca litros ou quantidade. Existem TRÊS tipos e eles nunca se misturam — " +
    "`viagem` (gasto de rua vinculado a uma viagem aberta: combustível, pedágio, hospedagem, alimentação), " +
    "`empresa` (gasto operacional debitado de uma conta bancária) e " +
    "`particular` (financeiro pessoal do usuário, fora da empresa; conta padrão DENYS - C6BANK). " +
    "Se a mensagem do usuário já trouxer tipo + valor + descrição (e viagem/conta quando necessário), grave direto com `confirmado: true` e só informe o resultado. " +
    "Se faltar algo (tipo, viagem, conta, categoria), chame com `confirmado: false`, mostre o resumo e pergunte o que falta antes de gravar. " +
    "Viagens cujo nome começa com 'Sobras' são apenas controle de estoque e NÃO aceitam despesas. " +
    "Use `contexto_despesa` para listar viagens abertas, contas e categorias. " +


    "Valores sempre em reais (BRL) e datas no formato YYYY-MM-DD.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [
    vendasResumo,
    resultadoPeriodo,
    clientesInativos,
    estoqueCritico,
    buscarPedido,
    contextoDespesa,
    lancarDespesa,
    ajustarDespesa,
    crmLeads,
  ],

});
