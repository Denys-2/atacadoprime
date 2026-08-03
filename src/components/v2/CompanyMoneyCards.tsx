import { useState } from "react";
import { Building2, PiggyBank } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { V2 } from "@/components/v2/theme";
import { brl, formatDate } from "@/lib/format";
import { useCompanyMoney, type CompanyMoneyRow } from "@/hooks/use-company-money";

type CardProps = {
  label: string;
  value: string;
  sub: string;
  icon: typeof Building2;
  accent: string;
  onClick?: () => void;
};

function MoneyCard({ label, value, sub, icon: Icon, accent, onClick }: CardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-2xl border p-4 text-left transition hover:shadow-sm w-full"
      style={{ borderColor: V2.GRAPHITE, background: V2.SURFACE }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs" style={{ color: V2.MUTED }}>{label}</div>
          <div className="text-xl font-semibold mt-1" style={{ color: accent }}>{value}</div>
          <div className="text-[11px] mt-1" style={{ color: V2.MUTED }}>{sub}</div>
        </div>
        <span className="rounded-xl p-2 shrink-0" style={{ background: `${accent}1a`, color: accent }}>
          <Icon className="h-4 w-4" />
        </span>
      </div>
    </button>
  );
}

function RowsDialog({
  open,
  onOpenChange,
  title,
  rows,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  rows: CompanyMoneyRow[];
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-auto -mx-2 px-2">
          {rows.length === 0 ? (
            <div className="text-sm py-8 text-center" style={{ color: V2.MUTED }}>
              Nenhuma parcela nesta situação.
            </div>
          ) : (
            <ul className="space-y-2">
              {rows.map((r) => (
                <li
                  key={r.id}
                  className="rounded-xl border p-3 flex items-center justify-between gap-3"
                  style={{ borderColor: V2.GRAPHITE }}
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate" style={{ color: V2.TEXT }}>
                      {r.codigo} · {r.cliente}
                    </div>
                    <div className="text-[11px]" style={{ color: V2.MUTED }}>
                      {r.parcela_num && r.parcelas_total ? `Parcela ${r.parcela_num}/${r.parcelas_total} · ` : ""}
                      {r.status === "PAGO"
                        ? `Recebido em ${formatDate(r.pagamento)}`
                        : `Vence em ${formatDate(r.vencimento)}`}
                      {r.acerto_em ? ` · acerto de ${formatDate(r.acerto_em)}` : ""}
                    </div>
                  </div>
                  <div className="text-sm font-semibold shrink-0" style={{ color: V2.TEXT }}>{brl(r.valor)}</div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Cards do dinheiro da empresa vindo de parcelas de vendas já acertadas. */
export function CompanyMoneyCards({ compact = false }: { compact?: boolean }) {
  const { data } = useCompanyMoney();
  const [openTransferir, setOpenTransferir] = useState(false);
  const [openReservado, setOpenReservado] = useState(false);

  const rowsTransferir = data?.rowsTransferir ?? [];
  const rowsReservado = data?.rowsReservado ?? [];
  const totalTransferir = data?.totalTransferir ?? 0;
  const totalReservado = data?.totalReservado ?? 0;

  return (
    <div className={compact ? "" : "mb-4"}>
      <div className="grid gap-3 sm:grid-cols-2">
        <MoneyCard
          label="A transferir para a conta da empresa"
          value={brl(totalTransferir)}
          sub={`${rowsTransferir.length} parcela(s) já recebida(s) após o acerto · clique para ver`}
          icon={Building2}
          accent="#0ea5e9"
          onClick={() => setOpenTransferir(true)}
        />
        <MoneyCard
          label="Já reservado (a vencer)"
          value={brl(totalReservado)}
          sub={`${rowsReservado.length} parcela(s) de vendas já acertadas · clique para ver`}
          icon={PiggyBank}
          accent="#f59e0b"
          onClick={() => setOpenReservado(true)}
        />
      </div>
      {!compact && (
        <div className="text-[11px] mt-2 px-1" style={{ color: V2.MUTED }}>
          Esses valores já tiveram o lucro retirado em acertos anteriores — quando entrarem, pertencem 100% à empresa
          (custo das peças + reserva de reinvestimento).
        </div>
      )}

      <RowsDialog
        open={openTransferir}
        onOpenChange={setOpenTransferir}
        title={`A transferir para a empresa — ${brl(totalTransferir)}`}
        rows={rowsTransferir}
      />
      <RowsDialog
        open={openReservado}
        onOpenChange={setOpenReservado}
        title={`Já reservado (a vencer) — ${brl(totalReservado)}`}
        rows={rowsReservado}
      />
    </div>
  );
}
