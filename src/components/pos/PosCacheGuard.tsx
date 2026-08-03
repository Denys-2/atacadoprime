import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { POS_CACHE_POLL_MS, checkForNewBuild, hardReload, purgeBrowserCaches } from "@/lib/pos-cache";

export interface PosCacheGuardProps {
  className?: string;
}

/**
 * Mantém o terminal POS sempre na última versão publicada:
 * - remove service workers/caches herdados no primeiro carregamento;
 * - verifica nova build ao montar, ao voltar o foco e a cada 2 min;
 * - oferece botão manual de atualização forçada.
 */
export function PosCacheGuard({ className }: PosCacheGuardProps) {
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void purgeBrowserCaches().then(() => {
      if (!cancelled) void checkForNewBuild();
    });

    const onFocus = () => {
      if (document.visibilityState === "visible") void checkForNewBuild();
    };

    const timer = window.setInterval(() => void checkForNewBuild(), POS_CACHE_POLL_MS);
    document.addEventListener("visibilitychange", onFocus);
    window.addEventListener("online", onFocus);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onFocus);
      window.removeEventListener("online", onFocus);
    };
  }, []);

  const forceRefresh = useCallback(async () => {
    setRefreshing(true);
    await hardReload();
    setRefreshing(false);
  }, []);

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={forceRefresh}
      disabled={refreshing}
      aria-label="Atualizar versão do sistema"
      className={cn("h-8 gap-1.5 px-2 text-xs font-medium text-muted-foreground", className)}
    >
      <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} aria-hidden="true" />
      Atualizar
    </Button>
  );
}
