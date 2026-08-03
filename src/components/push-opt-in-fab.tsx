import { useEffect, useState } from "react";
import { Bell, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePush } from "@/hooks/use-push";
import { toast } from "sonner";

const DISMISS_KEY = "push_fab_dismissed_at";
const REAPPEAR_MS = 1000 * 60 * 60 * 24 * 3; // 3 dias

export function PushOptInFab() {
  const { state, busy, subscribe } = usePush();
  const [dismissed, setDismissed] = useState(true);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const raw = typeof window !== "undefined" ? localStorage.getItem(DISMISS_KEY) : null;
    if (!raw) return setDismissed(false);
    const ts = Number(raw);
    setDismissed(Number.isFinite(ts) && Date.now() - ts < REAPPEAR_MS);
  }, []);

  // Auto-abre o card 8s após entrar (uma vez por sessão) se ainda não decidiu
  useEffect(() => {
    if (dismissed || state !== "prompt") return;
    if (sessionStorage.getItem("push_fab_auto_opened")) return;
    const t = setTimeout(() => {
      setOpen(true);
      sessionStorage.setItem("push_fab_auto_opened", "1");
    }, 8000);
    return () => clearTimeout(t);
  }, [dismissed, state]);

  if (state !== "prompt" || dismissed) return null;

  async function activate() {
    try {
      await subscribe();
      toast.success("Pronto! Você receberá ofertas exclusivas.");
    } catch (e: any) {
      toast.error(e?.message || "Não foi possível ativar");
    }
  }

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setDismissed(true);
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 sm:bottom-6 sm:right-6">
      {open ? (
        <div className="w-[300px] rounded-2xl border border-border bg-card shadow-2xl p-4 animate-in fade-in slide-in-from-bottom-2">
          <div className="flex items-start gap-3">
            <div className="grid place-items-center h-10 w-10 rounded-full bg-primary text-primary-foreground shrink-0">
              <Bell className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-sm text-foreground">Receba ofertas em 1º lugar</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Ative as notificações do navegador e não perca promoções relâmpago.
              </p>
            </div>
            <button
              aria-label="Fechar"
              onClick={dismiss}
              className="p-1 -m-1 rounded-md text-muted-foreground hover:bg-muted"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="mt-3 flex gap-2">
            <Button size="sm" className="flex-1" disabled={busy} onClick={activate}>
              <Bell className="w-4 h-4" /> Ativar agora
            </Button>
            <Button size="sm" variant="ghost" onClick={dismiss}>Agora não</Button>
          </div>
        </div>
      ) : (
        <button
          aria-label="Ativar notificações de ofertas"
          onClick={() => setOpen(true)}
          className="group flex items-center gap-2 h-12 pl-3 pr-4 rounded-full bg-primary text-primary-foreground shadow-2xl hover:bg-primary/90 transition-all"
        >
          <span className="relative grid place-items-center h-8 w-8 rounded-full bg-primary-foreground/15">
            <Bell className="w-4 h-4" />
            <span className="absolute top-0.5 right-0.5 w-2 h-2 rounded-full bg-red-500 ring-2 ring-primary animate-pulse" />
          </span>
          <span className="text-sm font-semibold hidden sm:inline">Ativar ofertas</span>
          <span className="text-sm font-semibold sm:hidden">Ofertas</span>
        </button>
      )}
    </div>
  );
}
