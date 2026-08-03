import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { loadCachedCatalog, syncCatalogFromServer } from "@/lib/offline-store";
import type {
  OfflineBrand,
  OfflineCategory,
  OfflineCompany,
  OfflineLead,
  OfflineProduct,
} from "@/lib/offline-store";
import { useOnlineStatus } from "@/hooks/use-online-status";


type State = {
  products: OfflineProduct[];
  categories: OfflineCategory[];
  brands: OfflineBrand[];
  companies: OfflineCompany[];
  leads: OfflineLead[];
  syncedAt: number | null;
  loading: boolean;
  syncing: boolean;
  error: string | null;
};

export function useOfflineCatalog() {
  const online = useOnlineStatus();
  const [state, setState] = useState<State>({
    products: [],
    categories: [],
    brands: [],
    companies: [],
    leads: [],
    syncedAt: null,
    loading: true,
    syncing: false,
    error: null,
  });

  const reload = useCallback(async () => {
    const cached = await loadCachedCatalog();
    setState((s) => ({ ...s, ...cached, loading: false }));
  }, []);

  const sync = useCallback(async () => {
    setState((s) => ({ ...s, syncing: true, error: null }));
    try {
      const res = await syncCatalogFromServer();
      await reload();
      toast.success(`Catálogo sincronizado (${res.count} produtos)`);
    } catch (e: any) {
      const msg = e?.message ?? "Falha ao sincronizar";
      setState((s) => ({ ...s, error: msg }));
      toast.error(`Erro ao sincronizar: ${msg}`);
    } finally {
      setState((s) => ({ ...s, syncing: false }));
    }
  }, [reload]);


  useEffect(() => {
    void reload();
  }, [reload]);

  // Auto-sync ao conectar
  useEffect(() => {
    if (!online) return;
    // Se nunca sincronizou ou > 6h, sync automático
    const stale = !state.syncedAt || Date.now() - state.syncedAt > 6 * 3600 * 1000;
    if (stale && !state.syncing) void sync();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online, state.syncedAt]);

  return { ...state, online, sync };
}
