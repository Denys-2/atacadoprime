// Gera um código curto e amigável para o pedido no formato XX1234
// XX = iniciais do nome do cliente (ignora palavras genéricas como "CHAVEIRO")
// 1234 = 4 dígitos determinísticos derivados do UUID do pedido
const STOP_WORDS = new Set([
  "CHAVEIRO", "CHAVEIROS", "CHAVE", "CHAVES", "CHAV3IRO",
  "DE", "DA", "DO", "DAS", "DOS", "E", "&",
  "LTDA", "ME", "EIRELI", "EPP", "SA", "S/A",
  "COMERCIO", "COMÉRCIO", "AUTOMOTIVO", "AUTOMOTIVA",
]);

function normalize(txt: string): string {
  return txt
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();
}

function initialsFromName(name: string | null | undefined): string {
  if (!name) return "";
  const norm = normalize(name);
  const words = norm
    .split(/[^A-Z0-9]+/)
    .filter((w) => w && !STOP_WORDS.has(w));
  if (words.length >= 2) return (words[0][0] + words[1][0]).slice(0, 2);
  if (words.length === 1) return words[0].slice(0, 2).padEnd(2, "X");
  const fallback = norm.replace(/[^A-Z0-9]/g, "");
  return (fallback.slice(0, 2) || "XX").padEnd(2, "X");
}

function digitsFromId(id: string): string {
  const hex = (id || "").replace(/-/g, "").slice(0, 8) || "0";
  const n = Number.parseInt(hex, 16);
  const mod = Number.isFinite(n) ? Math.abs(n) % 10000 : 0;
  return String(mod).padStart(4, "0");
}

/** Retorna o código sem o "#", ex.: "JP1234". */
export function orderCode(id: string, clientName?: string | null): string {
  return `${initialsFromName(clientName)}${digitsFromId(id)}`;
}

/** Retorna o código com "#", ex.: "#JP1234". */
export function orderCodeHash(id: string, clientName?: string | null): string {
  return `#${orderCode(id, clientName)}`;
}
