import { Link } from "@tanstack/react-router";
import { CloudOff, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import {
  loadPendingMutations,
  subscribePendingMutations,
  type PendingMutation,
} from "@/lib/offline-mutations";
import { loadSalesQueue, type OfflineSale } from "@/lib/offline-store";

export function OfflinePendingBadge() {
  const [mutations, setMutations] = useState<PendingMutation[]>([]);
  const [sales, setSales] = useState<OfflineSale[]>([]);

  useEffect(() => {
    const reload = async () => {
      const [m, s] = await Promise.all([loadPendingMutations(), loadSalesQueue()]);
      setMutations(m);
      setSales(s);
    };
    void reload();
    const un = subscribePendingMutations(() => void reload());
    const onFocus = () => void reload();
    window.addEventListener("focus", onFocus);
    const t = setInterval(reload, 15000);
    return () => {
      un();
      window.removeEventListener("focus", onFocus);
      clearInterval(t);
    };
  }, []);

  const pending =
    mutations.filter((m) => m.status !== "sent").length +
    sales.filter((s) => s.status === "pending" || s.status === "sending" || s.status === "error").length;
  const hasErr =
    mutations.some((m) => m.status === "error") ||
    sales.some((s) => s.status === "error");
  const syncing =
    mutations.some((m) => m.status === "sending") ||
    sales.some((s) => s.status === "sending");

  if (pending === 0) return null;

  return (
    <Link
      to="/offline-pendentes"
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold border transition-colors ${
        hasErr
          ? "bg-destructive/10 text-destructive border-destructive/30 hover:bg-destructive/15"
          : "bg-amber-500/10 text-amber-700 border-amber-500/30 hover:bg-amber-500/15"
      }`}
      aria-label={`${pending} pendentes de sincronização`}
    >
      {syncing ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <CloudOff className="h-3.5 w-3.5" />}
      <span>{pending} pendente{pending > 1 ? "s" : ""}</span>
    </Link>
  );
}
