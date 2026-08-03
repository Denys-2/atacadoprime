import { createFileRoute, Outlet, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { PosLogin } from "@/components/pos/PosLogin";
import { hasTerminalToken, restoreTerminalSession } from "@/lib/pos-terminal";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { user, loading } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const posAccess = pathname === "/pos" || pathname.startsWith("/pos/");
  const offlineVenda =
    pathname === "/field/venda-offline" &&
    typeof navigator !== "undefined" &&
    !navigator.onLine;

  // Terminal pareado: restaura a sessão salva sem pedir login.
  const [restoring, setRestoring] = useState(() => posAccess && hasTerminalToken());

  useEffect(() => {
    if (!posAccess || loading || user) return;
    if (!hasTerminalToken()) {
      setRestoring(false);
      return;
    }
    let active = true;
    setRestoring(true);
    void restoreTerminalSession().finally(() => {
      if (active) setRestoring(false);
    });
    return () => {
      active = false;
    };
  }, [posAccess, loading, user]);

  useEffect(() => {
    if (!loading && !user && !offlineVenda && !posAccess) {
      const back = window.location.pathname + window.location.search;
      const qs = back && back !== "/" ? `?redirect=${encodeURIComponent(back)}` : "";
      window.location.replace(`/auth${qs}`);
    }
  }, [loading, user, offlineVenda, posAccess]);

  if (offlineVenda) {
    return <Outlet />;
  }

  if (!loading && !user && posAccess && !restoring) {
    return <PosLogin />;
  }

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-background text-muted-foreground grid place-items-center">
        <div className="flex items-center gap-2 text-sm">
          <Loader2 className="h-4 w-4 animate-spin" />
          Carregando…
        </div>
      </div>
    );
  }

  return <Outlet />;
}
