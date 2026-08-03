import { useCallback, useEffect, useState } from "react";
import {
  enqueueOfflineSale as enqueue,
  loadSalesQueue,
  removeOfflineSale,
  updateOfflineSale,
  type OfflineSale,
} from "@/lib/offline-store";
import { syncOfflineSales } from "@/lib/offline-sync";
import { useAuth } from "@/hooks/use-auth";
import { useOnlineStatus } from "@/hooks/use-online-status";

export function useOfflineSales() {
  const { user } = useAuth();
  const online = useOnlineStatus();
  const [queue, setQueue] = useState<OfflineSale[]>([]);
  const [syncing, setSyncing] = useState(false);

  const reload = useCallback(async () => {
    setQueue(await loadSalesQueue());
  }, []);

  useEffect(() => {
    void reload();
    const on = () => void reload();
    window.addEventListener("focus", on);
    return () => window.removeEventListener("focus", on);
  }, [reload]);

  const sync = useCallback(async () => {
    if (!user) return { sent: 0, failed: 0 };
    setSyncing(true);
    try {
      const res = await syncOfflineSales(user.id);
      await reload();
      return res;
    } finally {
      setSyncing(false);
    }
  }, [user, reload]);

  // Auto-sync ao voltar online
  useEffect(() => {
    if (!online || !user) return;
    void sync();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online, user?.id]);

  const enqueueSale = useCallback(async (sale: OfflineSale) => {
    await enqueue(sale);
    await reload();
    if (online && user) void sync();
  }, [online, user, sync, reload]);

  const remove = useCallback(async (local_id: string) => {
    await removeOfflineSale(local_id);
    await reload();
  }, [reload]);

  const update = useCallback(async (local_id: string, patch: Partial<OfflineSale>) => {
    await updateOfflineSale(local_id, patch);
    await reload();
  }, [reload]);

  const pending = queue.filter((s) => s.status === "pending" || s.status === "sending" || s.status === "error");
  const sent = queue.filter((s) => s.status === "sent");

  return { queue, pending, sent, syncing, sync, enqueueSale, remove, update, online };
}
