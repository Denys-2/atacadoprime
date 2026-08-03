import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { V2InternalShell } from "@/components/v2/InternalShell";
import { Button } from "@/components/ui/button";
import {
  Search, Download, MapPin, Phone, Star, ExternalLink, Loader2,
  Radar, CheckCircle2, Users, Zap,
} from "lucide-react";
import { toast } from "sonner";
import { prospectSearch, importProspectAsLead, type ProspectResult } from "@/lib/prospecting.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/v3/prospeccao")({
  component: ProspeccaoPage,
});

function ProspeccaoPage() {
  const [cidade, setCidade] = useState("");
  const [estado, setEstado] = useState("");
  const [useGoogle, setUseGoogle] = useState(true);
  const [useChaveirosNet, setUseChaveirosNet] = useState(true);
  const [results, setResults] = useState<ProspectResult[]>([]);
  const [imported, setImported] = useState<Record<string, string>>({});

  const searchFn = useServerFn(prospectSearch);
  const importFn = useServerFn(importProspectAsLead);

  const search = useMutation({
    mutationFn: async () => {
      const sources: ("google_maps" | "chaveiros_net")[] = [];
      if (useGoogle) sources.push("google_maps");
      if (useChaveirosNet) sources.push("chaveiros_net");
      if (!sources.length) throw new Error("Selecione ao menos uma fonte");
      return searchFn({ data: { cidade, estado, sources } });
    },
    onSuccess: (data) => {
      setResults(data.results);
      setImported({});
      toast.success(`${data.results.length} resultado(s) encontrado(s)`);
    },
    onError: (e: { message?: string }) => toast.error(e?.message || "Falha na busca"),
  });

  const importOne = useMutation({
    mutationFn: async (p: ProspectResult) => importFn({ data: { prospect: p } }),
    onSuccess: (res, p) => {
      setImported((m) => ({ ...m, [p.external_id]: res.id }));
      toast.success(`${p.empresa} importado como lead`);
    },
    onError: (e: { message?: string }) => toast.error(e?.message || "Falha ao importar"),
  });

  const importedCount = Object.keys(imported).length;
  const canSearch = !search.isPending && cidade.length > 0 && estado.length === 2 && (useGoogle || useChaveirosNet);

  return (
    <V2InternalShell title="Prospecção de — Chaveiros" description="Inteligência geográfica para expansão de mercado em tempo real.">
      <div>
        {/* Split-view responsivo: empilha em mobile, 5/7 em tablet (md),
            4/8 em desktop (lg). Antes: só lg dividia, iPad ficava com scroll. */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          <div className="md:col-span-5 lg:col-span-4 flex flex-col gap-5">

            <div className="bg-white p-6 lg:p-7 rounded-3xl border border-slate-200 shadow-[0_8px_30px_rgb(0,0,0,0.04)] relative overflow-hidden">
              <div className="absolute -top-12 -right-12 w-32 h-32 bg-[#c9a96e]/[0.04] rounded-full" />

              <div className="relative space-y-5">
                <div>
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-3 block">
                    Filtro de Localização
                  </label>
                  <div className="flex gap-3">
                    <input
                      value={cidade}
                      onChange={(e) => setCidade(e.target.value)}
                      placeholder="Ex: Curitiba"
                      className="flex-1 px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl text-slate-900 text-sm font-medium placeholder:text-slate-300 hover:bg-white focus:bg-white focus:border-[#c9a96e] outline-none transition-all"
                    />
                    <input
                      value={estado}
                      onChange={(e) => setEstado(e.target.value.toUpperCase().slice(0, 2))}
                      placeholder="UF"
                      maxLength={2}
                      className="w-20 px-3 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl text-slate-900 text-sm font-bold text-center uppercase placeholder:text-slate-300 hover:bg-white focus:bg-white focus:border-[#c9a96e] outline-none transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-3 block">
                    Fontes de Dados Ativas
                  </label>
                  <div className="space-y-2.5">
                    <SourceToggle
                      checked={useGoogle}
                      onChange={setUseGoogle}
                      title="Google Maps Engine"
                      subtitle="Geolocalização e avaliações"
                    />
                    <SourceToggle
                      checked={useChaveirosNet}
                      onChange={setUseChaveirosNet}
                      title="Chaveiros.net Global"
                      subtitle="Diretório especializado B2B"
                    />
                  </div>
                </div>

                <button
                  onClick={() => search.mutate()}
                  disabled={!canSearch}
                  className={cn(
                    "w-full text-white py-4 px-6 rounded-2xl font-bold text-sm uppercase tracking-wider flex items-center justify-center gap-3 transition-all",
                    "bg-[#c9a96e] hover:bg-[#b5935a] shadow-[0_10px_24px_rgba(201,169,110,0.35)] active:scale-[0.97]",
                    "disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none disabled:hover:bg-[#c9a96e]",
                  )}
                >
                  {search.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" strokeWidth={2.5} />}
                  {search.isPending ? "Varrendo…" : "Executar varredura"}
                </button>
              </div>
            </div>

            {/* KPIs pequenos */}
            <div className="grid grid-cols-2 gap-4">
              <MiniStat icon={Users} tone="indigo" value={results.length} label="Leads encontrados" />
              <MiniStat icon={CheckCircle2} tone="emerald" value={importedCount} label="Importados" />
            </div>
          </div>

          {/* === Coluna direita: painel dark com radar OU resultados === */}
          <div className="md:col-span-7 lg:col-span-8 rounded-[2rem] relative overflow-hidden min-h-[520px] md:min-h-[600px] bg-white border border-slate-200 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
            {/* Grid sutil de fundo (claro) */}
            <div
              className="absolute inset-0 opacity-[0.5] pointer-events-none"
              style={{
                backgroundImage:
                  "linear-gradient(#f1ece3 1px, transparent 1px), linear-gradient(90deg, #f1ece3 1px, transparent 1px)",
                backgroundSize: "40px 40px",
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-b from-[#c9a96e]/[0.06] via-transparent to-transparent pointer-events-none" />


            {/* Conteúdo */}
            {results.length === 0 || search.isPending ? (
              <EmptyRadar pending={search.isPending} useGoogle={useGoogle} useChaveirosNet={useChaveirosNet} />
            ) : (
              <ResultsPanel
                results={results}
                imported={imported}
                onImport={(p) => importOne.mutate(p)}
                onImportAll={async () => {
                  const pending = results.filter(
                    (r) => !imported[r.external_id] && (!r.match || r.match === "new"),
                  );
                  for (const p of pending) {
                    try { await importOne.mutateAsync(p); } catch { /* continua */ }
                  }
                }}
                importing={importOne.isPending}
                importingId={importOne.variables?.external_id}
              />
            )}

            {/* Glow inferior */}
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-full h-1/3 bg-gradient-to-t from-[#c9a96e]/[0.07] to-transparent pointer-events-none" />

          </div>
        </div>
      </div>
    </V2InternalShell>
  );
}

// ============================================================================
// Subcomponentes
// ============================================================================

function SourceToggle({ checked, onChange, title, subtitle }: {
  checked: boolean; onChange: (v: boolean) => void; title: string; subtitle: string;
}) {
  return (
    <label
      className={cn(
        "flex items-center gap-3.5 p-3.5 rounded-2xl border-2 cursor-pointer transition-all group",
        checked
          ? "border-[#c9a96e]/30 bg-[#c9a96e]/[0.04]"
          : "border-slate-100 bg-slate-50/60 hover:border-slate-200 hover:bg-white",
      )}
    >
      <span className="relative flex items-center justify-center shrink-0">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="peer appearance-none w-5 h-5 rounded-md border-2 border-slate-200 checked:bg-[#c9a96e] checked:border-[#c9a96e] transition-all cursor-pointer"
        />
        <svg className="absolute w-3 h-3 text-white opacity-0 peer-checked:opacity-100 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M5 13l4 4L19 7" />
        </svg>
      </span>
      <span className="flex flex-col min-w-0">
        <span className="text-sm font-bold text-slate-800 truncate">{title}</span>
        <span className="text-[11px] text-slate-400 font-medium truncate">{subtitle}</span>
      </span>
    </label>
  );
}

function MiniStat({ icon: Icon, tone, value, label }: {
  icon: typeof Users; tone: "indigo" | "emerald"; value: number; label: string;
}) {
  const tones = {
    indigo: { bg: "bg-orange-50", text: "text-orange-700" },
    emerald: { bg: "bg-orange-50", text: "text-orange-600" },
  } as const;
  return (
    <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm">
      <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center mb-3", tones[tone].bg)}>
        <Icon className={cn("w-5 h-5", tones[tone].text)} strokeWidth={2.4} />
      </div>
      <div className="text-2xl font-extrabold text-slate-900 tabular-nums">{value.toLocaleString("pt-BR")}</div>
      <div className="text-[10px] uppercase font-bold text-slate-400 tracking-widest mt-1">{label}</div>
    </div>
  );
}

function EmptyRadar({ pending, useGoogle, useChaveirosNet }: { pending: boolean; useGoogle: boolean; useChaveirosNet: boolean }) {
  return (
    <div className="relative z-10 flex flex-col items-center text-center px-8 py-16 min-h-[600px] justify-center">
      {/* Radar animado */}
      <div className="w-48 h-48 mb-10 relative flex items-center justify-center">
        <div className="absolute inset-0 rounded-full border border-[#c9a96e]/40 animate-ping" style={{ animationDuration: "3s" }} />
        <div className="absolute inset-6 rounded-full border border-[#c9a96e]/30 animate-ping" style={{ animationDuration: "4s" }} />
        <div className="absolute inset-0 rounded-full border border-slate-200" />
        {/* Sweep girando */}
        <div
          className="absolute inset-0 rounded-full animate-spin"
          style={{
            animationDuration: "4s",
            background: "conic-gradient(from 0deg, transparent 0deg, rgba(201,169,110,0.30) 60deg, transparent 90deg)",
            WebkitMaskImage: "radial-gradient(circle, black 60%, transparent 62%)",
            maskImage: "radial-gradient(circle, black 60%, transparent 62%)",
          }}
        />

        <div className="relative bg-[#faf8f5] border border-slate-200 rounded-full w-32 h-32 flex items-center justify-center shadow-[0_10px_30px_rgba(201,169,110,0.18)]">
          <Radar
            className={cn("w-14 h-14 text-[#c9a96e]", pending && "animate-pulse")}
            strokeWidth={1.4}
          />
        </div>
      </div>

      <h3 className="text-2xl lg:text-3xl font-bold text-slate-900 tracking-tight mb-3">
        {pending ? "Varrendo o mercado…" : "Radar em standby"}
      </h3>
      <p className="text-slate-500 max-w-md text-base leading-relaxed mb-10">
        {pending
          ? "Conectando às fontes ativas e extraindo leads qualificados na região selecionada."
          : "Defina cidade e UF à esquerda para iniciar a varredura geoespacial e identificar chaveiros na região."}
      </p>

      <div className="flex flex-wrap justify-center gap-3">
        <StatusPill active={useGoogle} label="Maps Cloud Link" />
        <StatusPill active={useChaveirosNet} label="Chaveiros.net Sync" />
      </div>
    </div>
  );
}

function StatusPill({ active, label }: { active: boolean; label: string }) {
  return (
    <span className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full bg-slate-50 border border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-widest">
      <span
        className={cn(
          "w-2 h-2 rounded-full",
          active ? "bg-[#c9a96e] shadow-[0_0_8px_rgba(201,169,110,0.6)]" : "bg-slate-300",
        )}
      />
      {label}
    </span>
  );
}


function ResultsPanel({
  results, imported, onImport, onImportAll, importing, importingId,
}: {
  results: ProspectResult[];
  imported: Record<string, string>;
  onImport: (p: ProspectResult) => void;
  onImportAll: () => void;
  importing: boolean;
  importingId?: string;
}) {
  const importedCount = Object.keys(imported).length;
  const allDone = importedCount === results.length;

  return (
    <div className="relative z-10 flex flex-col h-full max-h-[720px]">
      {/* Header da lista */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-5 border-b border-slate-200 bg-white/70 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#c9a96e]/10 border border-[#c9a96e]/25 grid place-items-center">
            <Zap className="w-4 h-4 text-[#c9a96e]" />
          </div>
          <div>
            <p className="text-slate-900 font-bold text-sm tracking-tight">
              {results.length} chaveiro{results.length !== 1 ? "s" : ""} mapeado{results.length !== 1 ? "s" : ""}
            </p>
            <p className="text-slate-400 text-[11px] uppercase tracking-widest font-bold">
              {importedCount} importado{importedCount !== 1 ? "s" : ""} ao CRM
            </p>
          </div>
        </div>
        <Button
          size="sm"
          onClick={onImportAll}
          disabled={importing || allDone}
          className="bg-[#c9a96e] text-white hover:bg-[#b5935a] font-bold shadow-sm disabled:opacity-40"
        >
          {importing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
          {allDone ? "Tudo importado" : "Importar todos"}
        </Button>
      </div>

      {/* Lista */}
      <div className="flex-1 overflow-y-auto px-4 lg:px-6 py-4 space-y-3">
        {results.map((r) => {
          const importedId = imported[r.external_id];
          const isImporting = importing && importingId === r.external_id;
          return (
            <div
              key={`${r.source}-${r.external_id}`}
              className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm hover:border-[#c9a96e]/40 hover:shadow-md transition-all"
            >

              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="font-bold text-slate-900 truncate">{r.empresa}</h4>
                    <span
                      className={cn(
                        "text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border",
                        r.source === "google_maps"
                          ? "bg-blue-50 text-blue-700 border-blue-200"
                          : "bg-[#c9a96e]/10 text-[#8a6f38] border-[#c9a96e]/30",
                      )}
                    >
                      {r.source === "google_maps" ? "Google Maps" : "Chaveiros.net"}
                    </span>
                    {r.match === "client" && (
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border bg-emerald-50 text-emerald-700 border-emerald-200">
                        Já é cliente
                      </span>
                    )}
                    {r.match === "lead" && (
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border bg-amber-50 text-amber-700 border-amber-200">
                        Lead existente
                      </span>
                    )}
                    {(!r.match || r.match === "new") && (
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border bg-sky-50 text-sky-700 border-sky-200">
                        Novo
                      </span>
                    )}
                    {r.rating != null && (
                      <span className="inline-flex items-center gap-1 text-xs text-amber-600 font-semibold">
                        <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                        {r.rating}
                      </span>
                    )}
                  </div>
                  {r.endereco && (
                    <p className="text-xs text-slate-600 inline-flex items-start gap-1.5">
                      <MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0 text-slate-400" /> {r.endereco}
                    </p>
                  )}
                  {r.telefone && (
                    <p className="text-xs text-slate-600 inline-flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-slate-400" /> {r.telefone}
                    </p>
                  )}
                  {r.url && (
                    <a
                      href={r.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[11px] text-[#c9a96e] hover:text-[#8a6f38] inline-flex items-center gap-1 hover:underline"
                    >
                      <ExternalLink className="w-3 h-3" /> Ver na fonte
                    </a>
                  )}
                </div>
                <div className="shrink-0">
                  {r.match === "client" ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Cliente
                    </span>
                  ) : r.match === "lead" ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-50 text-amber-700 border border-amber-200 text-xs font-bold">
                      <CheckCircle2 className="w-3.5 h-3.5" /> No CRM
                    </span>
                  ) : importedId ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Importado
                    </span>
                  ) : (
                    <Button
                      size="sm"
                      onClick={() => onImport(r)}
                      disabled={isImporting}
                      className="bg-[#c9a96e] text-white hover:bg-[#b5935a] font-bold"
                    >
                      {isImporting ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Download className="w-4 h-4 mr-1.5" />}
                      Importar
                    </Button>
                  )}

                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
