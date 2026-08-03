import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Printer, RefreshCw, Eye, Stethoscope, Download } from "lucide-react";
import { V2 } from "@/components/v2/theme";
import {
  POS_PRINT_VERSION,
  POS_PRINT_COLOR,
  printerDiagnostics,
  printHTML,
} from "@/lib/pos-printer";

export const Route = createFileRoute("/_authenticated/pos/teste")({
  component: PosTesteImpressao,
  head: () => ({
    meta: [
      { title: "Teste de impressão | Atacado Prime POS" },
      {
        name: "description",
        content:
          "Valide a conexão com a ponte nativa da maquininha e imprima um cupom de teste sem precisar registrar uma venda.",
      },
      { property: "og:title", content: "Teste de impressão | Atacado Prime POS" },
      {
        property: "og:description",
        content:
          "Valide a conexão com a ponte nativa da maquininha e imprima um cupom de teste sem precisar registrar uma venda.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function buildTestTicket() {
  const now = new Date().toLocaleString("pt-BR");
  return `
    <div class="center bold lg">ATACADO PRIME</div>
    <div class="center">TESTE DE IMPRESSAO</div>
    <div class="hr"></div>
    <div class="row"><span>Data</span><span>${now}</span></div>
    <div class="row"><span>Versao</span><span>${POS_PRINT_VERSION}</span></div>
    <div class="hr"></div>
    <div>ABCDEFGHIJKLMNOPQRSTUVWXYZ</div>
    <div>0123456789 .,-:/*#%</div>
    <div class="hr"></div>
    <div class="row"><span>1x Produto teste</span><span>R$ 10,00</span></div>
    <div class="row bold"><span>TOTAL</span><span>R$ 10,00</span></div>
    <div class="hr"></div>
    <div class="center">Se voce leu isto no papel,</div>
    <div class="center bold">a impressao esta OK.</div>
  `;
}

type LogLine = { ok: boolean; text: string };

function PosTesteImpressao() {
  const [diag, setDiag] = useState<ReturnType<typeof printerDiagnostics> | null>(null);
  const [log, setLog] = useState<LogLine[]>([]);
  const [busy, setBusy] = useState(false);

  const refresh = () => setDiag(printerDiagnostics());
  useEffect(refresh, []);

  const push = (ok: boolean, text: string) =>
    setLog((l) => [{ ok, text: `${new Date().toLocaleTimeString("pt-BR")} — ${text}` }, ...l].slice(0, 20));

  const ready = !!diag && diag.bridge !== "nenhuma";

  const testarNativa = async () => {
    setBusy(true);
    try {
      await printHTML(buildTestTicket(), { copies: 1 });
      push(true, "Cupom enviado à ponte nativa. Confira o papel.");
    } catch (e: unknown) {
      push(false, e instanceof Error ? e.message : "Falha ao imprimir");
    } finally {
      setBusy(false);
      refresh();
    }
  };

  const verPrevia = () => {
    printHTML(buildTestTicket(), { copies: 1, preview: true });
    push(true, "Prévia aberta na tela.");
  };

  const card = {
    background: V2.LIGHT_SURFACE,
    borderColor: V2.LIGHT_BORDER,
  } as const;

  return (
    <div className="p-3 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-base font-semibold flex items-center gap-2" style={{ color: V2.LIGHT_TEXT }}>
          <Printer className="h-4 w-4" style={{ color: V2.TEAL }} />
          Teste de impressão
        </h1>
        <button
          type="button"
          onClick={refresh}
          className="flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-semibold"
          style={{ borderColor: V2.LIGHT_BORDER, color: V2.LIGHT_MUTED }}
        >
          <RefreshCw className="h-3.5 w-3.5" /> Reverificar
        </button>
      </div>

      {/* Status da ponte */}
      <div className="rounded-lg border p-3 space-y-1" style={card}>
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium" style={{ color: V2.LIGHT_MUTED }}>
            Ponte nativa
          </span>
          <span
            className="rounded-md px-2 py-0.5 text-[11px] font-bold"
            style={{
              background: ready ? V2.TEAL : "#e5e0d8",
              color: ready ? "#fff" : V2.LIGHT_MUTED,
            }}
          >
            {ready ? `CONECTADA (${diag?.bridge})` : "NÃO DETECTADA"}
          </span>
        </div>
        <p className="text-[11px] leading-snug" style={{ color: V2.LIGHT_MUTED }}>
          {ready
            ? "A maquininha expõe a ponte de impressão. O botão abaixo imprime direto, sem diálogo."
            : "Nenhuma ponte encontrada neste navegador. Feche o Chrome e abra o aplicativo Prime Q2I v3."}
        </p>
        <div className="text-[10px] font-mono break-all pt-1" style={{ color: V2.LIGHT_MUTED }}>
          versão {POS_PRINT_VERSION} · driver {diag?.preferencia ?? "auto"} · chave {diag?.androidBridgeKey ?? "—"}
        </div>
      </div>

      {/* Ações */}
      <div className="space-y-2">
        <button
          type="button"
          disabled={busy || !ready}
          onClick={testarNativa}
          className="w-full h-12 rounded-lg text-sm font-bold text-white disabled:opacity-60 flex items-center justify-center gap-2"
          style={{ background: POS_PRINT_COLOR }}
        >
          <Printer className="h-4 w-4" />
          {busy ? "Enviando..." : `Imprimir cupom de teste · ${POS_PRINT_VERSION}`}
        </button>

        <div>
          <button
            type="button"
            onClick={verPrevia}
            className="h-11 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1"
            style={{ borderColor: V2.LIGHT_BORDER, background: V2.LIGHT_SURFACE, color: V2.LIGHT_TEXT }}
          >
            <Eye className="h-4 w-4" /> Ver prévia
          </button>
        </div>

        <Link
          to="/pos/diagnostico"
          className="h-10 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1"
          style={{ borderColor: V2.LIGHT_BORDER, color: V2.LIGHT_MUTED }}
        >
          <Stethoscope className="h-4 w-4" /> Diagnóstico avançado
        </Link>

        <Link
          to="/pos/instalar"
          className="h-10 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1"
          style={{ borderColor: V2.LIGHT_BORDER, color: V2.LIGHT_MUTED }}
        >
          <Download className="h-4 w-4" /> Instalar ícone na tela inicial
        </Link>
      </div>

      {/* Resultado */}
      <div className="rounded-lg border p-3 space-y-1" style={card}>
        <span className="text-xs font-medium" style={{ color: V2.LIGHT_MUTED }}>
          Resultado dos testes
        </span>
        {log.length === 0 ? (
          <p className="text-[11px]" style={{ color: V2.LIGHT_MUTED }}>
            Nenhum teste executado ainda.
          </p>
        ) : (
          <ul className="space-y-1">
            {log.map((l, i) => (
              <li
                key={i}
                className="text-[11px] font-mono leading-snug"
                style={{ color: l.ok ? V2.TEAL : "#b91c1c" }}
              >
                {l.ok ? "✓" : "✕"} {l.text}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
