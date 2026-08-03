import { Bell, BellOff, BellRing } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePush } from "@/hooks/use-push";
import { toast } from "sonner";

export function PushOptIn({ compact = false }: { compact?: boolean }) {
  const { state, busy, subscribe, unsubscribe } = usePush();

  if (state === "unsupported") return null;

  if (state === "subscribed") {
    return (
      <Button
        size={compact ? "sm" : "default"}
        variant="outline"
        disabled={busy}
        onClick={async () => { await unsubscribe(); toast.success("Notificações desativadas"); }}
      >
        <BellRing className="text-primary" /> {compact ? "Ativas" : "Notificações ativas"}
      </Button>
    );
  }

  if (state === "denied") {
    return (
      <Button size={compact ? "sm" : "default"} variant="outline" disabled>
        <BellOff /> Notificações bloqueadas
      </Button>
    );
  }

  return (
    <Button
      size={compact ? "sm" : "default"}
      disabled={busy}
      onClick={async () => {
        try { await subscribe(); toast.success("Pronto! Você receberá ofertas no navegador."); }
        catch (e: any) { toast.error(e?.message || "Não foi possível ativar"); }
      }}
    >
      <Bell /> {compact ? "Ativar ofertas" : "Ativar ofertas no navegador"}
    </Button>
  );
}
