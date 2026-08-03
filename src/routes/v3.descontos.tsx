import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Check, Sparkles, TrendingUp, Trophy } from "lucide-react";
import brandLogo from "@/assets/brand-logo.png.asset.json";

const BG = "#faf8f5";
const SURFACE = "#ffffff";
const SURFACE_2 = "#f5f0e8";
const BORDER = "#e8e2d8";
const ORANGE = "#c9a96e";
const TEXT = "#3d2b1f";
const MUTED = "#8b7355";

export const Route = createFileRoute("/v3/descontos")({
  head: () => ({
    meta: [
      { title: "Como funcionam nossos descontos — Atacado Prime" },
      {
        name: "description",
        content:
          "Entenda de um jeito simples as três tabelas de desconto do Atacado Prime. Quanto mais você compra, mais barato fica cada peça.",
      },
      { property: "og:title", content: "Como funcionam nossos descontos — Atacado Prime" },
      {
        property: "og:description",
        content:
          "Três tabelas de desconto pensadas para o lojista. Veja exemplos reais com capa, chave e controle.",
      },
      { property: "og:type", content: "website" },
    ],
  }),
  component: DescontosPage,
});

type Tier = {
  key: "t1" | "t2" | "t3";
  nome: string;
  faixa: string;
  descricao: string;
  cor: string;
  icone: typeof Sparkles;
  capa: number;
  chave: number;
  controle: number;
};

const TIERS: Tier[] = [
  {
    key: "t1",
    nome: "Tabela de Desconto 1",
    faixa: "Compras até R$ 499",
    descricao: "Ideal para começar. Preço já pensado para o revendedor.",
    cor: "#8b7355",
    icone: Sparkles,
    capa: 4.5,
    chave: 45,
    controle: 35,
  },
  {
    key: "t2",
    nome: "Tabela de Desconto 2",
    faixa: "Compras de R$ 500 a R$ 999",
    descricao: "Passou de R$ 500 no carrinho? Todas as peças ficam mais baratas.",
    cor: "#a67c52",
    icone: TrendingUp,
    capa: 4.3,
    chave: 43,
    controle: 33,
  },
  {
    key: "t3",
    nome: "Tabela de Desconto 3",
    faixa: "Compras a partir de R$ 1.000",
    descricao: "O melhor preço da casa. É o preço que também vale nos pacotes fechados.",
    cor: "#c9a96e",
    icone: Trophy,
    capa: 4.0,
    chave: 40,
    controle: 30,
  },
];

function money(n: number) {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function DescontosPage() {
  return (
    <div style={{ background: BG, color: TEXT, minHeight: "100vh" }}>
      {/* Header simples */}
      <header
        className="sticky top-0 z-30 border-b backdrop-blur"
        style={{ background: "rgba(255,255,255,0.85)", borderColor: BORDER }}
      >
        <div className="max-w-5xl mx-auto h-14 px-4 flex items-center justify-between">
          <Link to="/v3" className="flex items-center gap-2" aria-label="Voltar para a home">
            <img src="/brand-logo.png" alt="Prime Automotive" className="h-10 w-10 object-contain" />
            <span className="text-sm font-semibold" style={{ color: TEXT }}>
              Atacado Prime
            </span>
          </Link>
          <Link
            to="/v3"
            className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 h-9 rounded-full border"
            style={{ borderColor: BORDER, color: TEXT }}
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Voltar
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-5xl mx-auto px-4 pt-10 pb-6 text-center">
        <span
          className="inline-block text-[11px] font-black tracking-[0.25em] uppercase px-3 py-1.5 rounded-full mb-4"
          style={{ background: ORANGE, color: "#fff" }}
        >
          Como você economiza
        </span>
        <h1
          className="text-3xl sm:text-5xl font-black leading-[1.05] mb-4"
          style={{ color: TEXT, letterSpacing: "-0.02em" }}
        >
          Quanto mais você leva, <span style={{ color: ORANGE }}>mais barato fica.</span>
        </h1>
        <p className="text-base sm:text-lg max-w-2xl mx-auto" style={{ color: MUTED }}>
          Nosso preço muda automaticamente conforme o valor total do seu pedido. Sem cupom,
          sem cadastro especial, sem letrinha miúda.
        </p>
      </section>

      {/* Regra em 3 passos */}
      <section className="max-w-5xl mx-auto px-4 pb-4">
        <div
          className="rounded-3xl p-6 sm:p-8 grid gap-4 sm:grid-cols-3"
          style={{ background: SURFACE, border: `1px solid ${BORDER}` }}
        >
          {[
            { n: 1, t: "Você monta seu pedido", d: "Escolhe as peças que quer levar." },
            { n: 2, t: "O sistema soma tudo", d: "Somamos o valor total do carrinho pra você." },
            { n: 3, t: "O preço cai sozinho", d: "Cada peça passa para a tabela correspondente." },
          ].map((p) => (
            <div key={p.n} className="flex gap-3">
              <span
                className="h-10 w-10 flex-shrink-0 grid place-items-center rounded-full font-black"
                style={{ background: SURFACE_2, color: ORANGE }}
              >
                {p.n}
              </span>
              <div>
                <div className="font-bold text-sm">{p.t}</div>
                <div className="text-xs mt-0.5" style={{ color: MUTED }}>
                  {p.d}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* As 3 tabelas */}
      <section className="max-w-5xl mx-auto px-4 py-8">
        <h2 className="text-xl sm:text-2xl font-black mb-1">As três tabelas de desconto</h2>
        <p className="text-sm mb-6" style={{ color: MUTED }}>
          Exemplo real com uma <b>capa</b>, uma <b>chave</b> e um <b>controle</b>:
        </p>

        <div className="grid gap-4 sm:grid-cols-3">
          {TIERS.map((t) => {
            const Icon = t.icone;
            return (
              <div
                key={t.key}
                className="rounded-3xl p-6 flex flex-col"
                style={{
                  background: SURFACE,
                  border: `2px solid ${t.key === "t3" ? ORANGE : BORDER}`,
                  boxShadow: t.key === "t3" ? "0 20px 40px -20px rgba(201,169,110,0.4)" : undefined,
                }}
              >
                <div className="flex items-center gap-2 mb-3">
                  <span
                    className="h-10 w-10 grid place-items-center rounded-xl"
                    style={{ background: `${t.cor}20`, color: t.cor }}
                  >
                    <Icon className="h-5 w-5" />
                  </span>
                  {t.key === "t3" && (
                    <span
                      className="text-[10px] font-black tracking-widest uppercase px-2 py-0.5 rounded-full"
                      style={{ background: ORANGE, color: "#fff" }}
                    >
                      Melhor preço
                    </span>
                  )}
                </div>
                <div className="text-lg font-black">{t.nome}</div>
                <div className="text-xs font-semibold mt-1" style={{ color: t.cor }}>
                  {t.faixa}
                </div>
                <p className="text-xs mt-2 mb-5" style={{ color: MUTED }}>
                  {t.descricao}
                </p>

                <div
                  className="rounded-2xl p-4 space-y-3 mt-auto"
                  style={{ background: SURFACE_2 }}
                >
                  {[
                    { label: "Capa", v: t.capa },
                    { label: "Chave", v: t.chave },
                    { label: "Controle", v: t.controle },
                  ].map((row) => (
                    <div key={row.label} className="flex items-center justify-between">
                      <span className="text-xs font-semibold" style={{ color: MUTED }}>
                        {row.label}
                      </span>
                      <span className="text-base font-black" style={{ color: TEXT }}>
                        {money(row.v)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Exemplo prático */}
      <section className="max-w-5xl mx-auto px-4 pb-8">
        <div
          className="rounded-3xl p-6 sm:p-8"
          style={{ background: SURFACE, border: `1px solid ${BORDER}` }}
        >
          <h2 className="text-xl sm:text-2xl font-black mb-2">Um exemplo pra ficar fácil</h2>
          <p className="text-sm mb-5" style={{ color: MUTED }}>
            Digamos que você monte um pedido com <b>10 chaves</b>:
          </p>

          <div className="grid gap-3 sm:grid-cols-3">
            <ExampleBox
              titulo="Só 10 chaves"
              subtitulo="Total do pedido: R$ 450"
              tabela="Tabela 1"
              preco="R$ 45,00 cada"
              destaque={false}
            />
            <ExampleBox
              titulo="Adicionou mais 2 chaves"
              subtitulo="Total do pedido: R$ 516"
              tabela="Tabela 2"
              preco="R$ 43,00 cada"
              destaque
            />
            <ExampleBox
              titulo="Fechou 25 chaves"
              subtitulo="Total do pedido: R$ 1.000"
              tabela="Tabela 3"
              preco="R$ 40,00 cada"
              destaque
            />

          </div>

          <div
            className="mt-6 rounded-2xl p-4 flex gap-3 items-start"
            style={{ background: SURFACE_2 }}
          >
            <Check className="h-5 w-5 flex-shrink-0 mt-0.5" style={{ color: ORANGE }} />
            <p className="text-sm" style={{ color: TEXT }}>
              <b>Não precisa recalcular nada.</b> Enquanto você monta o carrinho, o próprio sistema
              troca o preço de todas as peças assim que o total do pedido chega em uma nova tabela.
            </p>
          </div>
        </div>
      </section>

      {/* Pacote fechado */}
      <section className="max-w-5xl mx-auto px-4 pb-10">
        <div
          className="rounded-3xl p-6 sm:p-8"
          style={{ background: SURFACE_2, border: `1px solid ${BORDER}` }}
        >
          <div className="flex items-center gap-2 mb-2">
            <Trophy className="h-5 w-5" style={{ color: ORANGE }} />
            <h2 className="text-lg sm:text-xl font-black">E os pacotes fechados?</h2>
          </div>
          <p className="text-sm mb-4" style={{ color: TEXT }}>
            Toda peça vendida em <b>pacote fechado</b> já sai direto no preço da{" "}
            <b>Tabela de Desconto 3</b> — o melhor preço da casa. É a forma mais rápida de garantir
            o menor valor por peça.
          </p>
          <div className="grid sm:grid-cols-3 gap-3">
            <div className="rounded-2xl p-4" style={{ background: SURFACE, border: `1px solid ${BORDER}` }}>
              <div className="text-xs uppercase tracking-wider font-bold" style={{ color: MUTED }}>Capas</div>
              <div className="text-2xl font-black mt-1" style={{ color: ORANGE }}>Pacote com 10</div>
              <div className="text-xs mt-1" style={{ color: MUTED }}>do mesmo modelo</div>
            </div>
            <div className="rounded-2xl p-4" style={{ background: SURFACE, border: `1px solid ${BORDER}` }}>
              <div className="text-xs uppercase tracking-wider font-bold" style={{ color: MUTED }}>Controles</div>
              <div className="text-2xl font-black mt-1" style={{ color: ORANGE }}>Pacote com 10</div>
              <div className="text-xs mt-1" style={{ color: MUTED }}>do mesmo modelo</div>
            </div>
            <div className="rounded-2xl p-4" style={{ background: SURFACE, border: `1px solid ${BORDER}` }}>
              <div className="text-xs uppercase tracking-wider font-bold" style={{ color: MUTED }}>Chaves</div>
              <div className="text-2xl font-black mt-1" style={{ color: ORANGE }}>Pacote com 5</div>
              <div className="text-xs mt-1" style={{ color: MUTED }}>do mesmo modelo</div>
            </div>
          </div>
          <p className="text-xs mt-4" style={{ color: MUTED }}>
            * Pacotes são sempre do <b>mesmo modelo</b> — não é possível misturar modelos diferentes dentro de um mesmo pacote.
          </p>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-5xl mx-auto px-4 pb-16 text-center">
        <Link
          to="/v3"
          className="inline-flex items-center gap-2 h-12 px-8 rounded-full text-sm font-black"
          style={{ background: ORANGE, color: "#fff" }}
        >
          Montar meu pedido agora
        </Link>
        <p className="mt-3 text-xs" style={{ color: MUTED }}>
          Dúvidas? Fale com a gente: (34) 99865-1112
        </p>
      </section>
    </div>
  );
}

function ExampleBox({
  titulo,
  subtitulo,
  tabela,
  preco,
  destaque,
}: {
  titulo: string;
  subtitulo: string;
  tabela: string;
  preco: string;
  destaque: boolean;
}) {
  return (
    <div
      className="rounded-2xl p-4"
      style={{
        background: destaque ? "#fff" : SURFACE_2,
        border: `1px solid ${destaque ? ORANGE : BORDER}`,
      }}
    >
      <div className="text-sm font-bold">{titulo}</div>
      <div className="text-xs mt-1" style={{ color: MUTED }}>
        {subtitulo}
      </div>
      <div
        className="inline-block mt-3 text-[10px] font-black tracking-widest uppercase px-2 py-1 rounded-full"
        style={{ background: destaque ? ORANGE : BORDER, color: destaque ? "#fff" : TEXT }}
      >
        {tabela}
      </div>
      <div className="text-lg font-black mt-2" style={{ color: TEXT }}>
        {preco}
      </div>
    </div>
  );
}
