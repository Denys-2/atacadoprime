import { cn } from "@/lib/utils";

const MAP: Record<string, string> = {
  PENDENTE: "bg-muted text-muted-foreground border-border",
  AGUARDANDO_PAGAMENTO: "bg-warning/15 text-warning border-warning/40",
  PAGO: "bg-success/15 text-success border-success/40",
  EM_SEPARACAO: "bg-primary/15 text-primary border-primary/40",
  ENVIADO: "bg-primary/15 text-primary border-primary/40",
  ENTREGUE: "bg-success/15 text-success border-success/40",
  CANCELADO: "bg-destructive/15 text-destructive border-destructive/40",
};

export function StatusPill({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium border uppercase tracking-wider",
        MAP[status] ?? MAP.PENDENTE,
      )}
    >
      {status.replace(/_/g, " ")}
    </span>
  );
}
