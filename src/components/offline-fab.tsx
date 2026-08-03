import { useEffect, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { CloudOff } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Botão flutuante persistente que leva direto para o Modo Venda Offline.
 * Fica visível em qualquer tela; muda de cor quando o dispositivo está offline.
 * Oculto quando já estamos em rotas offline-safe.
 */
export function OfflineFab() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [online, setOnline] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (typeof navigator === "undefined") return;
    setOnline(navigator.onLine);
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
    };
  }, []);

  if (!mounted) return null;

  const hiddenRoutes = ["/vendas-offline", "/field/venda-offline", "/offline-pendentes", "/offline-route", "/whatsapp"];
  if (hiddenRoutes.some((r) => pathname.startsWith(r))) return null;

  return (
    <Link
      to="/vendas-offline"
      aria-label="Entrar no Modo Venda Offline"
      className={cn(
        "fixed z-50 flex items-center gap-2 rounded-full px-4 py-3 shadow-lg transition-all",
        "bottom-[calc(16px+var(--app-safe-bottom,0px))] right-4",
        "text-white font-medium text-sm",
        online
          ? "bg-primary hover:bg-primary/90"
          : "bg-amber-500 hover:bg-amber-600 animate-pulse",
      )}
    >
      <CloudOff className="h-5 w-5" />
      <span className="hidden sm:inline">
        {online ? "Modo Offline" : "Sem internet — entrar Offline"}
      </span>
    </Link>
  );
}
