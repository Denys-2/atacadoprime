import { useState } from "react";
import { HelpCircle, X, ChevronLeft, ChevronRight } from "lucide-react";
import { V2 } from "./theme";

type Step = { title: string; body: string; hint?: string };

const STEPS: Step[] = [
  {
    title: "Comece pelo Hoje",
    body: "O painel Hoje mostra a venda do dia comparada a ontem, o mês vs. mês anterior e o que precisa da sua ação agora (pedidos pendentes, estoque baixo, viagens abertas).",
    hint: "Menu → Geral → Hoje",
  },
  {
    title: "Venda no cliente",
    body: "Em Vender você tem Pedidos, Venda em visita e o PDV rápido (tablet). Toda venda em viagem aberta é vinculada automaticamente pela cidade do cliente.",
    hint: "Menu → Vender",
  },
  {
    title: "Viagens e despesas",
    body: "Abra uma viagem antes de sair. Lance despesas por categoria — combustível, alimentação, hospedagem — e adicione várias cidades num mesmo roteiro.",
    hint: "Menu → Vender → Viagens / Despesas",
  },
  {
    title: "Relatórios que decidem",
    body: "Curva ABC de produtos e clientes, projeção de lucro, giro de estoque e resultado por viagem. Tudo com filtros por período e cidade.",
    hint: "Menu → Crescer → Relatórios",
  },
  {
    title: "Cresça com automações",
    body: "WhatsApp (inbox, campanhas, pós-venda), push, promoções e banners ficam em Crescer. IA e Automação ajudam a repetir o que já funciona.",
    hint: "Menu → Crescer",
  },
];

export function GuidedTour() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  const start = () => {
    setStep(0);
    setOpen(true);
  };

  const close = () => setOpen(false);
  const next = () => setStep((s) => Math.min(s + 1, STEPS.length - 1));
  const prev = () => setStep((s) => Math.max(s - 1, 0));

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  return (
    <>
      <button
        type="button"
        onClick={start}
        className="h-10 w-10 rounded-full grid place-items-center border transition hover:opacity-80"
        style={{ background: V2.LIGHT_SURFACE, borderColor: V2.LIGHT_BORDER, color: V2.LIGHT_MUTED }}
        aria-label="Ver tour guiado"
        title="Ver tour guiado"
      >
        <HelpCircle className="h-4 w-4" />
      </button>

      {open && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Fechar tour"
            onClick={close}
            className="absolute inset-0 bg-black/60"
          />
          <div
            role="dialog"
            aria-labelledby="tour-title"
            className="relative w-full max-w-lg rounded-2xl border shadow-2xl"
            style={{ background: V2.LIGHT_SURFACE, borderColor: V2.LIGHT_BORDER, color: V2.LIGHT_TEXT }}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: V2.LIGHT_BORDER }}>
              <div className="text-[11px] font-semibold uppercase tracking-[0.15em]" style={{ color: V2.TEAL }}>
                Tour · {step + 1} de {STEPS.length}
              </div>
              <button
                type="button"
                onClick={close}
                className="h-8 w-8 rounded-lg grid place-items-center border"
                style={{ borderColor: V2.LIGHT_BORDER, color: V2.LIGHT_MUTED }}
                aria-label="Fechar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="px-5 py-6 space-y-3">
              <h2 id="tour-title" className="text-xl font-semibold tracking-tight">{current.title}</h2>
              <p className="text-sm leading-relaxed" style={{ color: V2.LIGHT_MUTED }}>{current.body}</p>
              {current.hint && (
                <div
                  className="inline-block rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-widest"
                  style={{ borderColor: V2.LIGHT_BORDER, color: V2.TEAL }}
                >
                  {current.hint}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between px-5 py-4 border-t" style={{ borderColor: V2.LIGHT_BORDER }}>
              <div className="flex gap-1.5">
                {STEPS.map((_, i) => (
                  <span
                    key={i}
                    className="h-1.5 rounded-full transition-all"
                    style={{
                      width: i === step ? 20 : 8,
                      background: i === step ? V2.TEAL : V2.LIGHT_BORDER,
                    }}
                  />
                ))}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={prev}
                  disabled={step === 0}
                  className="h-9 px-3 rounded-lg border text-sm font-medium disabled:opacity-40 inline-flex items-center gap-1"
                  style={{ borderColor: V2.LIGHT_BORDER, color: V2.LIGHT_TEXT }}
                >
                  <ChevronLeft className="h-4 w-4" /> Voltar
                </button>
                {isLast ? (
                  <button
                    type="button"
                    onClick={close}
                    className="h-9 px-4 rounded-lg text-sm font-semibold text-white"
                    style={{ background: V2.TEAL }}
                  >
                    Concluir
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={next}
                    className="h-9 px-3 rounded-lg text-sm font-semibold text-white inline-flex items-center gap-1"
                    style={{ background: V2.TEAL }}
                  >
                    Próximo <ChevronRight className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
