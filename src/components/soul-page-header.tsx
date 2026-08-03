/**
 * SoulPageHeader — header padrão de TODAS as páginas autenticadas.
 *
 * Mesma alma da página /crm/prospeccao:
 *   • Barra lateral navy (#2b3a8c) à esquerda
 *   • Título em maiúsculas itálico extrabold
 *   • Última palavra (ou trecho após " — ") em destaque navy não-itálico
 *   • Subtítulo cinza-slate
 *
 * Uso transparente: AppShell já injeta este header a partir das props
 * `title` e `description`. Nenhuma página precisa importar diretamente.
 */
export function SoulPageHeader({ title, description }: { title: string; description?: string }) {
  // Permite duas formas de destacar a palavra-âncora:
  //   "Radar de — Oportunidades"  → "Radar de" + "Oportunidades"
  //   "Visão Geral"               → última palavra vira o accent
  let lead = title;
  let accent = "";
  if (title.includes(" — ")) {
    const [a, b] = title.split(" — ");
    lead = a;
    accent = b;
  } else {
    const parts = title.trim().split(/\s+/);
    if (parts.length > 1) {
      accent = parts.pop()!;
      lead = parts.join(" ");
    } else {
      accent = title;
      lead = "";
    }
  }

  return (
    <div className="border-l-4 border-[#2b3a8c] pl-5">
      <h1 className="text-2xl lg:text-3xl font-extrabold uppercase italic tracking-tight text-slate-900 leading-none">
        {lead && <>{lead} </>}
        <span className="not-italic text-[#2b3a8c]">{accent}</span>
      </h1>
      {description && (
        <p className="text-sm text-slate-500 font-medium mt-2 max-w-2xl">{description}</p>
      )}
    </div>
  );
}
