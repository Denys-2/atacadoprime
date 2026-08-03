import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const EmailSchema = z.object({ email: z.string().email() });

/**
 * Exporta todos os dados relacionados a um email de cliente (LGPD art. 18).
 * Retorna JSON serializável.
 */
export const lgpdExportCustomerData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { email: string }) => EmailSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: isMgr } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    const { data: isGer } = await supabase.rpc("has_role", { _user_id: userId, _role: "gerente" });
    if (!isMgr && !isGer) throw new Error("Somente gerente pode exportar dados LGPD");

    const [companies, addresses, orders, financial, leads, whatsapp] = await Promise.all([
      supabase.from("companies").select("*").eq("email", data.email),
      supabase.from("addresses").select("*, companies!inner(email)").eq("companies.email", data.email),
      supabase.from("orders").select("*, companies!inner(email)").eq("companies.email", data.email),
      supabase.from("financial_transactions").select("*, orders!inner(companies!inner(email))").eq("orders.companies.email", data.email),
      supabase.from("leads").select("*").eq("email", data.email),
      supabase.from("whatsapp_conversations").select("*, companies!inner(email)").eq("companies.email", data.email),
    ]);

    return {
      exported_at: new Date().toISOString(),
      requested_by: userId,
      email: data.email,
      data: {
        companies: companies.data ?? [],
        addresses: addresses.data ?? [],
        orders: orders.data ?? [],
        financial: financial.data ?? [],
        leads: leads.data ?? [],
        whatsapp_conversations: whatsapp.data ?? [],
      },
    };
  });

/**
 * Anonimiza dados pessoais do cliente (LGPD art. 18 - direito ao esquecimento).
 * Preserva registros contábeis (obrigatórios por 5 anos) mas remove PII.
 */
export const lgpdAnonymizeCustomer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { email: string }) => EmailSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: isMgr } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!isMgr) throw new Error("Somente admin pode anonimizar dados");

    const anonEmail = `anonimizado+${Date.now()}@lgpd.local`;
    const anonPhone = "00000000000";
    const anonName = "USUÁRIO ANONIMIZADO";

    await supabase.from("companies").update({
      legal_name: anonName,
      trade_name: anonName,
      email: anonEmail,
      phone: anonPhone,
      tax_id: null,
    }).eq("email", data.email);

    await supabase.from("leads").update({
      empresa: anonName,
      contato: anonName,
      email: anonEmail,
      telefone: anonPhone,
      whatsapp: anonPhone,
    }).eq("email", data.email);


    return { ok: true, anonymized_at: new Date().toISOString(), anon_email: anonEmail };
  });
