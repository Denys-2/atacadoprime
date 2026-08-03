import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { printerDiagnostics, scanBridgeCandidates, tryBridgePrint, type BridgeCandidate } from "@/lib/pos-printer";

export const Route = createFileRoute("/_authenticated/pos/diagnostico")({
  component: PosDiagnostico,
  head: () => ({
    meta: [
      { title: "Diagnóstico da impressora | Atacado Prime POS" },
      { name: "description", content: "Identifique o modelo da maquininha e as pontes de impressão disponíveis no terminal POS." },
      { property: "og:title", content: "Diagnóstico da impressora | Atacado Prime POS" },
      { property: "og:description", content: "Identifique o modelo da maquininha e as pontes de impressão disponíveis no terminal POS." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const TEST_TEXT = "ATACADO PRIME\nTESTE DE IMPRESSAO\n--------------------------------\nSe voce leu isto no papel,\na ponte funciona.\n\n\n";

function PosDiagnostico() {
  const [txt, setTxt] = useState("");
  const [copied, setCopied] = useState(false);
  const [candidates, setCandidates] = useState<BridgeCandidate[]>([]);
  const [log, setLog] = useState<string[]>([]);

  useEffect(() => {
    const list = scanBridgeCandidates();
    setCandidates(list);
    setTxt(JSON.stringify({ ...printerDiagnostics(), candidatos: list }, null, 2));
  }, []);

  const run = (path: string, method: string) => {
    const r = tryBridgePrint(path, method, TEST_TEXT);
    setLog((l) => [`${r.ok ? "OK" : "FALHOU"} — ${path}.${method}() → ${r.detail}`, ...l].slice(0, 30));
  };

  const runAll = () => {
    candidates.forEach((c) => c.methods.forEach((m) => run(c.path, m)));
  };

  return (
    <div className="p-3 space-y-3">
      <h1 className="text-base font-semibold text-foreground">Diagnóstico da impressora</h1>
      <p className="text-xs text-muted-foreground">
        O teste interno da máquina funciona, então o hardware está OK. Aqui procuramos qual ponte o navegador da
        maquininha expõe. Toque em testar e veja qual delas sai no papel.
      </p>

      <div className="rounded-md border border-border bg-card p-2 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-foreground">
            Pontes encontradas: {candidates.length}
          </span>
          {candidates.length > 0 && (
            <button
              type="button"
              onClick={runAll}
              className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground"
            >
              Testar todas
            </button>
          )}
        </div>
        {candidates.length === 0 && (
          <p className="text-xs text-muted-foreground">
            Nenhuma ponte de impressão exposta ao navegador. Nesse caso só um aplicativo nativo (APK) consegue usar a
            impressora interna.
          </p>
        )}
        {candidates.map((c) => (
          <div key={c.path} className="rounded border border-border p-2">
            <p className="font-mono text-[11px] text-foreground break-all">{c.path}</p>
            <div className="mt-1 flex flex-wrap gap-1">
              {c.methods.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => run(c.path, m)}
                  className="rounded border border-border bg-background px-2 py-1 font-mono text-[11px] text-foreground"
                >
                  {m}()
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {log.length > 0 && (
        <div className="rounded-md border border-border bg-card p-2">
          <p className="mb-1 text-xs font-medium text-foreground">Resultados</p>
          <ul className="space-y-1 font-mono text-[11px] text-muted-foreground">
            {log.map((l, i) => (
              <li key={i} className="break-all">{l}</li>
            ))}
          </ul>
        </div>
      )}

      <button
        type="button"
        className="w-full rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(`${txt}\n\nLOG:\n${log.join("\n")}`);
            setCopied(true);
          } catch {
            setCopied(false);
          }
        }}
      >
        {copied ? "Copiado!" : "Copiar diagnóstico"}
      </button>
      <textarea
        readOnly
        value={txt}
        className="w-full h-[45vh] rounded-md border border-border bg-card p-2 font-mono text-[11px] leading-tight text-foreground"
      />
    </div>
  );
}
