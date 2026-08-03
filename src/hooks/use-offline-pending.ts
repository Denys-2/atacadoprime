import { useCallback, useEffect, useState } from "react";
import {
  loadPendingMutations,
  processPendingMutations,
  removePendingMutation,
  subscribePendingMutations,
  updatePendingMutation,
  type PendingMutation,
} from "@/lib/offline-mutations";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { useAuth } from "@/hooks/use-auth";
import { syncOfflineSales } from "@/lib/offline-sync";

export function useOfflinePending() {
  const online = useOnlineStatus();
  const { user } = useAuth();
  const [list, setList] = useState<PendingMutation[]>([]);
  const [syncing, setSyncing] = useState(false);

  const reload = useCallback(async () => {
    setList(await loadPendingMutations());
  }, []);

  useEffect(() => {
    void reload();
    const un = subscribePendingMutations(() => void reload());
    return () => {
      un();
    };
  }, [reload]);

  const sync = useCallback(async () => {
    setSyncing(true);
    try {
      const [muts, sales] = await Promise.all([
        processPendingMutations(),
        user ? syncOfflineSales(user.id) : Promise.resolve({ sent: 0, failed: 0 }),
      ]);
      await reload();
      return { sent: muts.sent + sales.sent, failed: muts.failed + sales.failed };
    } finally {
      setSyncing(false);
    }
  }, [reload, user]);

  // Auto-sync ao voltar online
  useEffect(() => {
    if (!online || !user) return;
    void sync();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online, user?.id]);

  const retry = useCallback(async (local_id: string) => {
    await updatePendingMutation(local_id, { status: "pending", error: null });
    void sync();
  }, [sync]);

  const remove = useCallback(async (local_id: string) => {
    await removePendingMutation(local_id);
  }, []);

  const pending = list.filter((m) => m.status !== "sent");
  const errors = list.filter((m) => m.status === "error");

  return { list, pending, errors, syncing, sync, retry, remove, online };
}
