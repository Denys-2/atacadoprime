// Templates HTML para cupom e etiqueta, feitos para 58mm.
// A serialização de código de barras é feita via JsBarcode no cliente
// (retornamos um <svg> serializado inline).
import JsBarcode from "jsbarcode";
import QRCode from "qrcode";

const brl = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

function esc(s: string) {
  return s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]!));
}

function barcodeSVG(code: string, opts?: { width?: number; height?: number; fontSize?: number }) {
  if (!code) return "";
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  try {
    JsBarcode(svg, code, {
      format: code.length === 13 ? "EAN13" : "CODE128",
      width: opts?.width ?? 1.6,
      height: opts?.height ?? 40,
      fontSize: opts?.fontSize ?? 12,
      margin: 0,
      displayValue: true,
    });
    return new XMLSerializer().serializeToString(svg);
  } catch {
    return `<div class="center">${esc(code)}</div>`;
  }
}

export const SITE_URL = "https://www.primeautomotive.app";

/** QR code em SVG inline (geração síncrona via callback do lib qrcode). */
function qrSVG(text: string, size = 108) {
  let out = "";
  try {
    QRCode.toString(
      text,
      { type: "svg", margin: 0, width: size, errorCorrectionLevel: "M" },
      (err: Error | null | undefined, svg?: string) => {
        if (!err && svg) out = svg;
      },
    );
  } catch {
    out = "";
  }
  if (!out) return `<div class="center">${esc(text)}</div>`;
  return out.replace("<svg", `<svg width="${size}" height="${size}"`);
}

/** Converte tipo/modalidade/parcelas em texto legível no cupom. */
export function pagamentoLabel(
  tipo?: string | null,
  opts?: { modalidade?: string | null; bandeira?: string | null; parcelas?: number | null },
) {
  const t = (tipo ?? "").toUpperCase();
  const base =
    t === "PIX" ? "PIX"
    : t === "DINHEIRO" ? "Dinheiro"
    : t === "CARTAO" || t === "CREDITO" || t === "DEBITO"
      ? (() => {
          const mod = (opts?.modalidade ?? (t === "DEBITO" ? "DEBITO" : t === "CREDITO" ? "CREDITO" : "")).toUpperCase();
          if (mod === "DEBITO") return "Cartão de débito";
          if (mod === "CREDITO") return "Cartão de crédito";
          return "Cartão";
        })()
    : t === "BOLETO" ? "Boleto"
    : t === "FATURADO" ? "Faturado"
    : t === "PRAZO" ? "A prazo"

    : tipo ? tipo : "—";
  const parcelas = opts?.parcelas && opts.parcelas > 1 ? ` ${opts.parcelas}x` : "";
  const bandeira = opts?.bandeira ? ` (${opts.bandeira})` : "";
  return `${base}${parcelas}${bandeira}`;
}

export type TicketOrder = {
  codigo: string;
  cliente?: string | null;
  vendedor?: string | null;
  data: string; // já formatada
  itens: { nome: string; qtd: number; unit: number; total: number }[];
  subtotal: number;
  desconto?: number;
  frete?: number;
  total: number;
  pagamento: string;
  observacao?: string | null;
  loja?: { nome: string; telefone?: string; endereco?: string };
};


export function renderTicket(o: TicketOrder): string {
  const loja = o.loja ?? { nome: "Atacado Prime", telefone: "(34) 99865-1112", endereco: "Uberlândia-MG" };
  const itensHtml = o.itens.map((i) => `
    <div>${esc(i.nome)}</div>
    <div class="row"><span>${i.qtd} x ${brl(i.unit)}</span><span>${brl(i.total)}</span></div>
  `).join("");

  return `
    <div class="center bold lg">${esc(loja.nome)}</div>
    ${loja.telefone ? `<div class="center">${esc(loja.telefone)}</div>` : ""}
    ${loja.endereco ? `<div class="center">${esc(loja.endereco)}</div>` : ""}
    <div class="hr"></div>
    <div class="row"><span>Pedido</span><span class="bold">${esc(o.codigo)}</span></div>
    <div class="row"><span>Data</span><span>${esc(o.data)}</span></div>
    ${o.cliente ? `<div class="row"><span>Cliente</span><span>${esc(o.cliente)}</span></div>` : ""}
    ${o.vendedor ? `<div class="row"><span>Vendedor</span><span>${esc(o.vendedor)}</span></div>` : ""}
    <div class="hr"></div>
    ${itensHtml}
    <div class="hr"></div>
    <div class="row"><span>Subtotal</span><span>${brl(o.subtotal)}</span></div>
    ${o.desconto ? `<div class="row"><span>Desconto</span><span>-${brl(o.desconto)}</span></div>` : ""}
    ${o.frete ? `<div class="row"><span>Frete</span><span>${brl(o.frete)}</span></div>` : ""}
    <div class="row bold xl"><span>TOTAL</span><span>${brl(o.total)}</span></div>
    <div class="row"><span>Pagamento</span><span>${esc(o.pagamento)}</span></div>
    ${o.observacao ? `<div class="hr"></div><div>${esc(o.observacao)}</div>` : ""}
    <div class="hr"></div>
    <div class="center">Obrigado por sua compra.</div>
    <div class="center" data-qr="${SITE_URL}" style="margin-top:4px">${qrSVG(SITE_URL, 108)}</div>
    <div class="center" style="font-size:10px">www.primeautomotive.app</div>
  `;
}

export type LabelProduct = {
  nome: string;
  preco: number;
  codigo: string; // EAN13 preferido
  sku?: string | null;
};

export function renderLabel(p: LabelProduct): string {
  return `
    <div class="center bold">${esc(p.nome.slice(0, 32))}</div>
    ${p.sku ? `<div class="center" style="font-size:9px">SKU: ${esc(p.sku)}</div>` : ""}
    <div class="center bold xl">${brl(p.preco)}</div>
    <div class="center">${barcodeSVG(p.codigo)}</div>
  `;
}
