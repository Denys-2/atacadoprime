export const brl = (n: number | null | undefined) =>
  (n ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const parseDate = (d: string | Date): Date => {
  if (d instanceof Date) return d;
  // Trata "YYYY-MM-DD" como data local para evitar deslocamento por fuso.
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return new Date(d);
};

export const formatDate = (d: string | Date | null | undefined) =>
  d ? parseDate(d).toLocaleDateString("pt-BR") : "—";

export const formatDateTime = (d: string | Date | null | undefined) =>
  d ? parseDate(d).toLocaleString("pt-BR") : "—";

export function stockStatus(estoque: number, minimo: number): "available" | "low" | "out" {
  if (estoque <= 0) return "out";
  if (estoque <= minimo) return "low";
  return "available";
}

export const stockLabel = { available: "Disponível", low: "Baixo estoque", out: "Esgotado" } as const;
