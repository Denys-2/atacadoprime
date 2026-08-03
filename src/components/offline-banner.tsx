import { WifiOff, ShoppingCart } from "lucide-react";
import { useOnlineStatus } from "@/hooks/use-online-status";

export function OfflineBanner() {
  const online = useOnlineStatus();
  if (online) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[60] flex items-center gap-3 rounded-full bg-slate-900 text-white px-4 py-2 shadow-lg text-sm font-medium"
    >
      <WifiOff className="h-4 w-4" />
      <span>Offline — dados em cache</span>
      <a
        href="/vendas-offline"
        className="flex items-center gap-1 rounded-full bg-white/10 hover:bg-white/20 px-3 py-1 text-xs font-semibold transition"
      >
        <ShoppingCart className="h-3 w-3" /> Vender
      </a>
    </div>
  );
}
