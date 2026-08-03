// Fila genérica de mutações offline.
// - Formulários chamam `runOrQueue(kind, payload, onlineFn)`.
// - Se estiver online: executa direto.
// - Se estiver offline (ou a rede falhar): enfileira no IndexedDB e devolve um
//   id local (`local:xxx`) para uso otimista na UI.
// - Ao voltar a rede, `processPendingMutations()` drena a fila em ordem,
//   resolvendo referências `local:*` para os IDs reais recém-criados.

import { get, set } from "idb-keyval";
import { supabase } from "@/integrations/supabase/client";

const QUEUE_KEY = "offline:mutations:queue";
const MAP_KEY = "offline:mutations:local-map";

export type MutationKind =
  // CRM
  | "lead_insert"
  | "lead_update"
  | "lead_note"
  | "lead_task_insert"
  | "lead_task_toggle"
  | "lead_convert"
  // Empresas
  | "company_insert"
  // Campo
  | "visit_checkin"
  | "visit_checkout"
  // Genérico (última cartada)
  | "generic_insert"
  | "generic_update";

export type PendingMutation = {
  local_id: string; // sempre começa com "local:"
  kind: MutationKind;
  payload: any;
  created_at: number;
  status: "pending" | "sending" | "sent" | "error";
  error?: string | null;
  result_id?: string | null;
  attempts: number;
  label?: string; // curto, para UI
};

// ---------- Storage helpers ----------
export async function loadPendingMutations(): Promise<PendingMutation[]> {
  return (await get<PendingMutation[]>(QUEUE_KEY)) ?? [];
}
async function saveQueue(list: PendingMutation[]) {
  await set(QUEUE_KEY, list);
}
async function loadMap(): Promise<Record<string, string>> {
  return (await get<Record<string, string>>(MAP_KEY)) ?? {};
}
async function saveMap(m: Record<string, string>) {
  await set(MAP_KEY, m);
}
export async function updatePendingMutation(local_id: string, patch: Partial<PendingMutation>) {
  const list = await loadPendingMutations();
  const next = list.map((m) => (m.local_id === local_id ? { ...m, ...patch } : m));
  await saveQueue(next);
  notify();
}
export async function removePendingMutation(local_id: string) {
  const list = await loadPendingMutations();
  await saveQueue(list.filter((m) => m.local_id !== local_id));
  notify();
}
export async function clearSentMutations() {
  const list = await loadPendingMutations();
  await saveQueue(list.filter((m) => m.status !== "sent"));
  notify();
}

// ---------- Eventos ----------
type Listener = () => void;
const listeners = new Set<Listener>();
export function subscribePendingMutations(cb: Listener) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
function notify() {
  for (const l of listeners) {
    try { l(); } catch { /* noop */ }
  }
}

// ---------- Utilidades ----------
function isOnline() {
  return typeof navigator === "undefined" ? true : navigator.onLine;
}
function newLocalId() {
  const rand = Math.random().toString(36).slice(2, 10);
  return `local:${Date.now().toString(36)}:${rand}`;
}
export function isLocalId(v: unknown): v is string {
  return typeof v === "string" && v.startsWith("local:");
}
function resolveLocalRefs(payload: any, map: Record<string, string>): any {
  if (payload == null) return payload;
  if (typeof payload === "string") return map[payload] ?? payload;
  if (Array.isArray(payload)) return payload.map((v) => resolveLocalRefs(v, map));
  if (typeof payload === "object") {
    const out: any = {};
    for (const [k, v] of Object.entries(payload)) out[k] = resolveLocalRefs(v, map);
    return out;
  }
  return payload;
}

// ---------- API principal para os hooks ----------
/**
 * Executa a mutação online quando possível; caso contrário, enfileira.
 * @param kind identificador da operação (usado no dispatch de sync).
 * @param payload dados serializáveis; pode conter ids `local:*` a resolver depois.
 * @param onlineFn implementação que roda quando há rede — deve devolver o id
 *                 do registro criado (para operações de insert).
 * @param label texto curto para exibir na fila de pendentes.
 */
export async function runOrQueue<T>(
  kind: MutationKind,
  payload: any,
  onlineFn: () => Promise<T>,
  label?: string,
): Promise<{ id: string; offline: boolean; data?: T }> {
  if (isOnline()) {
    try {
      const data = await onlineFn();
      const anyData = data as any;
      const id =
        typeof anyData === "string"
          ? anyData
          : (anyData?.id as string | undefined) ?? newLocalId();
      return { id, offline: false, data };
    } catch (e: any) {
      // Só enfileira em falha de rede evidente
      const msg = String(e?.message ?? "");
      const networkLike = /fetch|network|Failed to fetch|NetworkError|timeout/i.test(msg);
      if (!networkLike) throw e;
    }
  }
  const local_id = newLocalId();
  const item: PendingMutation = {
    local_id,
    kind,
    payload,
    created_at: Date.now(),
    status: "pending",
    attempts: 0,
    label,
  };
  const list = await loadPendingMutations();
  list.push(item);
  await saveQueue(list);
  notify();
  return { id: local_id, offline: true };
}

// ---------- Handlers de sync (server-side) ----------
async function getUserId(): Promise<string> {
  const { data } = await supabase.auth.getUser();
  const uid = data.user?.id;
  if (!uid) throw new Error("Sessão expirada. Faça login para sincronizar.");
  return uid;
}

async function handleLeadInsert(payload: any): Promise<string> {
  const uid = await getUserId();
  const { data, error } = await supabase
    .from("leads")
    .insert({ ...payload, created_by: uid })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}
async function handleLeadUpdate(payload: any): Promise<string> {
  const { id, patch } = payload;
  const { error } = await supabase.from("leads").update(patch).eq("id", id);
  if (error) throw error;
  return id;
}
async function handleLeadNote(payload: any): Promise<string> {
  const uid = await getUserId();
  const { leadId, texto } = payload;
  const { error } = await supabase.from("lead_notes").insert({ lead_id: leadId, texto, created_by: uid });
  if (error) throw error;
  await supabase.from("lead_activities").insert({ lead_id: leadId, tipo: "OBSERVACAO", descricao: texto, created_by: uid });
  return leadId;
}
async function handleLeadTaskInsert(payload: any): Promise<string> {
  const uid = await getUserId();
  const { data, error } = await supabase
    .from("lead_tasks")
    .insert({ ...payload, created_by: uid })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}
async function handleLeadTaskToggle(payload: any): Promise<string> {
  const { id, status } = payload;
  const { error } = await supabase.from("lead_tasks").update({ status }).eq("id", id);
  if (error) throw error;
  return id;
}
async function handleCompanyInsert(payload: any): Promise<string> {
  const uid = await getUserId();
  const { data, error } = await supabase
    .from("companies")
    .insert({ ...payload, owner_id: payload.owner_id ?? uid })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}
async function handleLeadConvert(payload: any): Promise<string> {
  // payload = { lead, company_id? }
  // Se sem company_id, cria empresa a partir do lead.
  const uid = await getUserId();
  const lead = payload.lead;
  let companyId: string | null = payload.company_id ?? lead.company_id ?? null;
  if (!companyId) {
    const { data: comp, error: ce } = await supabase
      .from("companies")
      .insert({
        legal_name: lead.empresa,
        trade_name: lead.empresa,
        owner_id: uid,
        phone: lead.whatsapp || lead.telefone || "",
        email: lead.email,
        cidade: lead.cidade,
        estado: lead.estado,
        latitude: lead.latitude,
        longitude: lead.longitude,
        status: "approved",
      } as never)
      .select("id")
      .single();
    if (ce) throw ce;
    companyId = comp.id;
  }
  const { error } = await supabase
    .from("leads")
    .update({ status: "CLIENTE", company_id: companyId })
    .eq("id", lead.id);
  if (error) throw error;
  return companyId!;
}
async function handleVisitCheckin(payload: any): Promise<string> {
  const { data, error } = await supabase
    .from("visits")
    .insert(payload)
    .select("id")
    .single();
  if (error) throw error;
  if (payload.route_item_id) {
    await supabase
      .from("route_items")
      .update({ visit_id: data.id, visitado: true })
      .eq("id", payload.route_item_id);
  }
  return data.id;
}
async function handleVisitCheckout(payload: any): Promise<string> {
  const { visit_id, patch } = payload;
  const { error } = await supabase.from("visits").update(patch).eq("id", visit_id);
  if (error) throw error;
  return visit_id;
}
async function handleGenericInsert(payload: any): Promise<string> {
  const { table, values } = payload;
  const { data, error } = await (supabase.from(table as any) as any).insert(values).select("id").single();
  if (error) throw error;
  return (data as any).id as string;
}
async function handleGenericUpdate(payload: any): Promise<string> {
  const { table, id, patch } = payload;
  const { error } = await (supabase.from(table as any) as any).update(patch).eq("id", id);
  if (error) throw error;
  return id;
}

const HANDLERS: Record<MutationKind, (p: any) => Promise<string>> = {
  lead_insert: handleLeadInsert,
  lead_update: handleLeadUpdate,
  lead_note: handleLeadNote,
  lead_task_insert: handleLeadTaskInsert,
  lead_task_toggle: handleLeadTaskToggle,
  lead_convert: handleLeadConvert,
  company_insert: handleCompanyInsert,
  visit_checkin: handleVisitCheckin,
  visit_checkout: handleVisitCheckout,
  generic_insert: handleGenericInsert,
  generic_update: handleGenericUpdate,
};

// ---------- Sync ----------
let syncing = false;
export async function processPendingMutations(): Promise<{ sent: number; failed: number }> {
  if (syncing) return { sent: 0, failed: 0 };
  if (!isOnline()) return { sent: 0, failed: 0 };
  syncing = true;
  let sent = 0;
  let failed = 0;
  try {
    const list = await loadPendingMutations();
    const pending = list.filter((m) => m.status === "pending" || m.status === "error");
    const map = await loadMap();

    for (const m of pending) {
      await updatePendingMutation(m.local_id, { status: "sending", error: null, attempts: m.attempts + 1 });
      try {
        const resolved = resolveLocalRefs(m.payload, map);
        const handler = HANDLERS[m.kind];
        if (!handler) throw new Error(`Sem handler para ${m.kind}`);
        const realId = await handler(resolved);
        map[m.local_id] = realId;
        await updatePendingMutation(m.local_id, { status: "sent", result_id: realId, error: null });
        sent++;
      } catch (e: any) {
        await updatePendingMutation(m.local_id, {
          status: "error",
          error: e?.message ?? "Falha desconhecida",
        });
        failed++;
      }
    }
    await saveMap(map);
  } finally {
    syncing = false;
  }
  return { sent, failed };
}

// ---------- Contagens para UI ----------
export function pendingCount(list: PendingMutation[]) {
  return list.filter((m) => m.status !== "sent").length;
}
export function errorCount(list: PendingMutation[]) {
  return list.filter((m) => m.status === "error").length;
}
