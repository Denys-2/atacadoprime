import { useEffect, useState } from "react";
import { Bell, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePush } from "@/hooks/use-push";
import { toast } from "sonner";

const DISMISS_KEY = "push_banner_dismissed_at";
const REAPPEAR_MS = 1000 * 60 * 60 * 24 * 7; // 7 dias

export function PushOptInBanner() {
  const { state, busy, subscribe } = usePush();
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    const raw = typeof window !== "undefined" ? localStorage.getItem(DISMISS_KEY) : null;
    if (!raw) return setDismissed(false);
    const ts = Number(raw);
    setDismissed(Number.isFinite(ts) && Date.now() - ts < REAPPEAR_MS);
  }, []);

  if (dismissed) return null;
  if (state !== "prompt") return null; // subscribed/denied/unsupported => nada

  return (
    <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border-b border-primary/20">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-2.5 flex items-center gap-3">
        <div className="hidden sm:grid place-items-center h-9 w-9 rounded-full bg-primary text-primary-foreground shrink-0">
          <Bell className="w-4 h-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] sm:text-sm font-semibold text-foreground truncate">
            Receba ofertas exclusivas em primeira mão
          </p>
          <p className="text-[11px] sm:text-xs text-muted-foreground truncate">
            Ative as notificações e não perca promoções da sua região.
          </p>
        </div>
        <Button
          size="sm"
          disabled={busy}
          onClick={async () => {
            try {
              await subscribe();
              toast.success("Pronto! Você receberá ofertas no navegador.");
            } catch (e: any) {
              toast.error(e?.message || "Não foi possível ativar");
            }
          }}
        >
          <Bell className="w-4 h-4" /> Ativar
        </Button>
        <button
          aria-label="Dispensar"
          className="p-1.5 rounded-md hover:bg-muted text-muted-foreground"
          onClick={() => {
            localStorage.setItem(DISMISS_KEY, String(Date.now()));
            setDismissed(true);
          }}
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
