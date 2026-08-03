import jsPDF from "jspdf";
import QRCode from "qrcode";
import { brl } from "./format";
import { BRAND_LOGO_DATA_URL } from "./brand-logo";



export type CatalogPdfItem = {
  nome: string;
  sku?: string | null;
  tipo?: string | null;
  categoria?: string | null;
  marca?: string | null;
  descricao_curta?: string | null;
  preco_unitario?: number | string | null;
  preco_pacote?: number | string | null;
  quantidade_pacote?: number | null;
  imagem?: string | null;
};

export type CatalogPdfOptions = {
  brandName?: string;
  brandTagline?: string;
  contact?: string;
  phone?: string;
  website?: string;
};


type LoadedImage = { data: string; format: "PNG" | "JPEG"; w: number; h: number };

async function loadImage(url: string): Promise<LoadedImage | null> {
  try {
    const res = await fetch(url, { mode: "cors" });
    if (!res.ok) return null;
    const blob = await res.blob();
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.onerror = reject;
      r.readAsDataURL(blob);
    });
    const dims = await new Promise<{ w: number; h: number }>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
      img.onerror = reject;
      img.src = dataUrl;
    });
    const format = /image\/png/i.test(blob.type) ? "PNG" : "JPEG";
    return { data: dataUrl, format, w: dims.w, h: dims.h };
  } catch {
    return null;
  }
}

/* ============================================================
   PALETA — editorial premium (azul-marinho + dourado + neutros)
   ============================================================ */
const C = {
  ink:        [11, 18, 32] as const,      // fundo escuro (capa/rodapés)
  inkSoft:    [26, 36, 54] as const,
  paper:      [253, 252, 249] as const,   // creme claro (páginas)
  paperAlt:   [246, 244, 239] as const,
  line:       [222, 217, 208] as const,
  hair:       [232, 228, 220] as const,
  fg:         [17, 24, 39] as const,
  sub:        [96, 105, 122] as const,
  muted:      [140, 148, 165] as const,
  gold:       [176, 141, 62] as const,    // acento dourado
  goldSoft:   [242, 232, 208] as const,


  accent:     [37, 99, 235] as const,     // azul da marca
  red:        [178, 34, 52] as const,
  redSoft:    [250, 234, 236] as const,
  green:      [21, 87, 68] as const,
  greenSoft:  [232, 244, 238] as const,
  white:      [255, 255, 255] as const,
};

const set = (doc: jsPDF, kind: "fill" | "draw" | "text", rgb: readonly number[]) => {
  const [r, g, b] = rgb;
  if (kind === "fill") doc.setFillColor(r, g, b);
  else if (kind === "draw") doc.setDrawColor(r, g, b);
  else doc.setTextColor(r, g, b);
};

/* Rótulos e ordem editorial das seções.
   Prioridade pedida: Capas → Controles → Chaves → demais. */
const TIPO_LABEL: Record<string, string> = {
  carcaca: "Capas",
  controle: "Controles",
  chave: "Chaves",
  transponder: "Transponders",
  lamina: "Lâminas",
  bateria: "Baterias",
  alarme: "Alarmes",
  modulo: "Módulos",
  acessorio: "Acessórios",
};
const TIPO_ORDER = [
  "carcaca", "controle", "chave",
  "transponder", "lamina", "bateria",
  "alarme", "modulo", "acessorio",
];
function tipoKey(t?: string | null) {
  const k = (t ?? "").toLowerCase().trim();
  return TIPO_ORDER.includes(k) ? k : "_outros";
}
function tipoLabel(k: string) {
  return TIPO_LABEL[k] ?? "Outros";
}
function tipoRank(k: string) {
  const i = TIPO_ORDER.indexOf(k);
  return i === -1 ? 999 : i;
}

export async function generateCatalogPdf(items: CatalogPdfItem[], opts: CatalogPdfOptions = {}) {
  const {
    brandName = "Atacado Prime",
    brandTagline = "Catálogo Oficial",
    contact,
    phone = "(34) 99865-1112",
    website = "primeautomotive.app",
  } = opts;


  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 14;
  const year = new Date().getFullYear();
  const dateStr = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });

  /* -------------- helpers -------------- */
  const fillPage = (rgb: readonly number[]) => {
    set(doc, "fill", rgb);
    doc.rect(0, 0, pageW, pageH, "F");
  };
  const hairline = (x1: number, y1: number, x2: number, y2: number, rgb: readonly number[] = C.line) => {
    set(doc, "draw", rgb);
    doc.setLineWidth(0.2);
    doc.line(x1, y1, x2, y2);
  };
  const centerText = (
    text: string,
    y: number,
    opts: {
      size?: number;
      style?: "normal" | "bold" | "italic" | "bolditalic";
      color?: readonly number[];
      charSpace?: number;
    } = {},
  ) => {
    const { size = 10, style = "normal", color = C.fg, charSpace = 0 } = opts;
    doc.setFont("helvetica", style);
    doc.setFontSize(size);
    set(doc, "text", color);
    doc.setCharSpace(charSpace);
    const baseWidth = doc.getTextWidth(text);
    const extra = charSpace * Math.max(0, text.length - 1);
    const x = (pageW - baseWidth - extra) / 2;
    doc.text(text, x, y);
    doc.setCharSpace(0);
  };

  /* ============ CAPA ============ */
  fillPage(C.ink);

  // Área útil dentro da moldura
  const cx = pageW / 2;
  const safeTop = margin + 6;
  const safeBottom = pageH - margin - 6;

  // Moldura dourada dupla
  set(doc, "draw", C.gold);
  doc.setLineWidth(0.6);
  doc.rect(margin - 4, margin - 4, pageW - (margin - 4) * 2, pageH - (margin - 4) * 2);
  doc.setLineWidth(0.2);
  doc.rect(margin - 2, margin - 2, pageW - (margin - 2) * 2, pageH - (margin - 2) * 2);

  // -------- TOPO: logo da marca --------
  const logoSize = 30;
  const logoY = safeTop - 1;
  const cardPad = 4;

  // cartão claro atrás da logo (a marca oficial é escura e some no fundo ink)
  set(doc, "fill", C.paper);
  doc.roundedRect(
    cx - logoSize / 2 - cardPad,
    logoY - cardPad,
    logoSize + cardPad * 2,
    logoSize + cardPad * 2,
    4,
    4,
    "F",
  );

  try {
    doc.addImage(
      BRAND_LOGO_DATA_URL,
      "PNG",
      cx - logoSize / 2,
      logoY,
      logoSize,
      logoSize,
      undefined,
      "FAST",
    );
  } catch {
    /* logo ausente — segue sem fallback visual */
  }




  centerText("EDIÇÃO OFICIAL", safeTop + 32, {
    size: 8,
    color: [200, 194, 178],
    charSpace: 3,
  });
  set(doc, "fill", C.gold);
  doc.rect(cx - 12, safeTop + 35, 24, 0.5, "F");

  // -------- CENTRO: título + tagline + ano --------
  const coverMidY = pageH / 2 - 6;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(46);
  set(doc, "text", C.white);
  doc.text(brandName.toUpperCase(), cx, coverMidY - 8, { align: "center" });

  centerText(brandTagline.toUpperCase(), coverMidY + 2, {
    size: 11,
    color: C.gold,
    charSpace: 2,
  });

  const yearY = coverMidY + 22;
  hairline(cx - 38, yearY, cx - 12, yearY, [110, 92, 52]);
  hairline(cx + 12, yearY, cx + 38, yearY, [110, 92, 52]);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(24);
  set(doc, "text", C.gold);
  doc.text(String(year), cx, yearY + 3, { align: "center" });




  // -------- RODAPÉ: bloco de contato --------
  const footTop = safeBottom - 34;
  hairline(cx - 60, footTop, cx + 60, footTop, [110, 92, 52]);

  centerText("VENDAS DIRETAS", footTop + 7, {
    size: 8,
    color: C.gold,
    charSpace: 2.4,
  });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  set(doc, "text", C.white);
  doc.text(phone, cx, footTop + 18, { align: "center" });

  centerText(website.toUpperCase(), footTop + 26, {
    size: 8.5,
    color: [200, 194, 178],
    charSpace: 1.6,
  });



  /* ============ Preload imagens ============ */
  const urls = Array.from(new Set(items.map((i) => i.imagem).filter(Boolean) as string[]));
  const cache = new Map<string, LoadedImage | null>();
  const CONC = 6;
  for (let i = 0; i < urls.length; i += CONC) {
    const batch = urls.slice(i, i + CONC);
    const loaded = await Promise.all(batch.map((u) => loadImage(u)));
    batch.forEach((u, idx) => cache.set(u, loaded[idx]));
  }

  /* ============ Agrupar por TIPO (ordem editorial) ============ */
  const grouped = new Map<string, CatalogPdfItem[]>();
  for (const it of items) {
    const k = tipoKey(it.tipo);
    if (!grouped.has(k)) grouped.set(k, []);
    grouped.get(k)!.push(it);
  }
  const secoes = Array.from(grouped.keys()).sort((a, b) => tipoRank(a) - tipoRank(b));
  // dentro de cada seção: por marca depois nome
  for (const k of secoes) {
    grouped.get(k)!.sort((a, b) => {
      const ma = (a.marca ?? "").localeCompare(b.marca ?? "", "pt-BR");
      if (ma !== 0) return ma;
      return a.nome.localeCompare(b.nome, "pt-BR");
    });
  }

  /* Grid 1 × 3 — otimizado para leitura em mobile (cards largos) */
  const cols = 1;
  const rows = 3;
  const gap = 7;
  const headerH = 22;
  const footerH = 24;

  const gridW = pageW - margin * 2;
  const gridH = pageH - margin - headerH - footerH;
  const cardW = (gridW - gap * (cols - 1)) / cols;
  const cardH = (gridH - gap * (rows - 1)) / rows;
  const perPage = cols * rows;

  /* ============ Sumário ============ */
  doc.addPage();
  fillPage(C.paper);
  // header do sumário
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setCharSpace(2);
  set(doc, "text", C.gold);
  doc.text("SUMÁRIO", margin, margin + 10);
  doc.setCharSpace(0);
  hairline(margin, margin + 13, margin + 28, margin + 13, C.gold);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(44);
  set(doc, "text", C.fg);
  doc.text("Índice", margin, margin + 40);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10.5);
  set(doc, "text", C.sub);
  doc.text(
    "Um guia rápido para navegar por toda a coleção deste volume.",
    margin, margin + 48,
  );

  // linhas do sumário — números de página estimados
  let cursorY = margin + 70;
  // Página atual do documento: capa (1) + sumário (2). Divisórias e páginas começam em 3.
  let pageCursor = 3;
  const rowH = 12;
  doc.setFontSize(11);
  for (const k of secoes) {
    const list = grouped.get(k)!;
    const pagesForSection = Math.max(1, Math.ceil(list.length / perPage)) + 1; // +1 divisória
    const divisor = pageCursor;

    set(doc, "text", C.fg);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12.5);
    doc.text(tipoLabel(k), margin, cursorY);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    set(doc, "text", C.muted);
    doc.text(`${list.length} ${list.length === 1 ? "peça" : "peças"}`, margin + 60, cursorY);

    // dots
    const dotsStart = margin + 90;
    const dotsEnd = pageW - margin - 18;
    set(doc, "draw", C.line);
    doc.setLineWidth(0.15);
    doc.setLineDashPattern([0.6, 1.6], 0);
    doc.line(dotsStart, cursorY - 1.5, dotsEnd, cursorY - 1.5);
    doc.setLineDashPattern([], 0);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    set(doc, "text", C.gold);
    doc.text(String(divisor).padStart(2, "0"), pageW - margin, cursorY, { align: "right" });

    cursorY += rowH;
    pageCursor += pagesForSection;
    if (cursorY > pageH - margin - 30) break;
  }

  // Rodapé do sumário
  hairline(margin, pageH - margin - 10, pageW - margin, pageH - margin - 10);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  set(doc, "text", C.muted);
  doc.text(brandName, margin, pageH - margin - 4);
  doc.text("02", pageW - margin, pageH - margin - 4, { align: "right" });

  /* ============ Helpers de página de seção ============ */
  function drawSectionDivider(secKey: string, index: number, total: number, pageNo: number) {
    doc.addPage();
    fillPage(C.ink);

    // eyebrow
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setCharSpace(2.2);
    set(doc, "text", C.gold);
    doc.text(`SEÇÃO ${String(index).padStart(2, "0")} / ${String(total).padStart(2, "0")}`, margin, margin + 20);
    doc.setCharSpace(0);
    hairline(margin, margin + 24, margin + 28, margin + 24, C.gold);

    // Título gigante
    doc.setFont("helvetica", "bold");
    doc.setFontSize(96);
    set(doc, "text", C.white);
    const label = tipoLabel(secKey);
    doc.text(label, margin, pageH / 2 + 6);

    // Subtítulo
    doc.setFont("helvetica", "normal");
    doc.setFontSize(13);
    set(doc, "text", [210, 200, 178]);
    const count = grouped.get(secKey)!.length;
    doc.text(`${count} ${count === 1 ? "peça catalogada" : "peças catalogadas"}`, margin, pageH / 2 + 20);

    // linha dourada decorativa
    set(doc, "fill", C.gold);
    doc.rect(margin, pageH / 2 + 30, 40, 0.6, "F");

    // Rodapé
    hairline(margin, pageH - margin - 12, pageW - margin, pageH - margin - 12, [80, 70, 46]);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setCharSpace(1.4);
    set(doc, "text", [200, 194, 178]);
    doc.text(brandName.toUpperCase(), margin, pageH - margin - 5);
    doc.text(String(pageNo).padStart(2, "0"), pageW - margin, pageH - margin - 5, { align: "right" });
    doc.setCharSpace(0);
  }

  function drawGridHeader(secLabel: string, page: number, total: number, pageNo: number) {
    // eyebrow discreto
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setCharSpace(1.8);
    set(doc, "text", C.gold);
    doc.text(secLabel.toUpperCase(), margin, margin + 6);
    doc.setCharSpace(0);
    // Título de seção fino à esquerda
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    set(doc, "text", C.fg);
    doc.text(secLabel, margin, margin + 14);
    // paginação à direita
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    set(doc, "text", C.muted);
    doc.text(`${page} / ${total}`, pageW - margin, margin + 6, { align: "right" });
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    set(doc, "text", C.fg);
    doc.text(String(pageNo).padStart(2, "0"), pageW - margin, margin + 14, { align: "right" });
    // Linha divisória
    hairline(margin, margin + 18, pageW - margin, margin + 18);
  }

  function drawGridFooter(pageNo: number) {
    hairline(margin, pageH - margin - 8, pageW - margin, pageH - margin - 8);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    set(doc, "text", C.muted);
    doc.text(brandName, margin, pageH - margin - 3);
    if (contact) doc.text(contact, pageW / 2, pageH - margin - 3, { align: "center" });
    doc.text(String(pageNo).padStart(2, "0"), pageW - margin, pageH - margin - 3, { align: "right" });
  }

  function drawCard(p: CatalogPdfItem, x: number, y: number) {
    // sombra suave
    set(doc, "fill", [235, 231, 222]);
    doc.roundedRect(x + 0.8, y + 1.2, cardW, cardH, 3, 3, "F");
    // card (fundo branco)
    set(doc, "fill", C.white);
    set(doc, "draw", C.hair);
    doc.setLineWidth(0.25);
    doc.roundedRect(x, y, cardW, cardH, 3, 3, "FD");

    /* Layout horizontal — imagem grande à esquerda, conteúdo à direita.
       Otimizado para leitura em mobile: card ocupa toda a largura da página. */
    const imgColW = cardW * 0.34;
    // divisor vertical entre imagem e conteúdo
    hairline(x + imgColW, y + 6, x + imgColW, y + cardH - 6, C.hair);

    // Imagem — contida com respiração
    const img = p.imagem ? cache.get(p.imagem) : null;
    if (img) {
      const boxW = imgColW - 10;
      const boxH = cardH - 12;
      const ratio = img.w / img.h;
      let w = boxW, h = w / ratio;
      if (h > boxH) { h = boxH; w = h * ratio; }
      const ix = x + (imgColW - w) / 2;
      const iy = y + (cardH - h) / 2;
      try { doc.addImage(img.data, img.format, ix, iy, w, h, undefined, "FAST"); } catch { /* noop */ }
    } else {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      set(doc, "text", C.muted);
      doc.text("sem imagem", x + imgColW / 2, y + cardH / 2, { align: "center" });
    }

    // Área de conteúdo (direita)
    const padX = 8;
    const textX = x + imgColW + padX;
    const textW = cardW - imgColW - padX * 2;

    // Bloco de preços — fixado no rodapé do card
    const pzH = 22;
    const pzBottom = 6;
    const pzY = y + cardH - pzH - pzBottom;

    const textTop = y + 9;
    const textBottom = pzY - 5;
    let cy = textTop;

    // Marca (eyebrow dourado)
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setCharSpace(1.4);
    set(doc, "text", C.gold);
    doc.text((p.marca ?? "SEM MARCA").toUpperCase(), textX, cy);
    doc.setCharSpace(0);
    cy += 5;

    // Nome — até 3 linhas
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    set(doc, "text", C.fg);
    const nomeLH = 5.6;
    const availLines = Math.max(1, Math.floor((textBottom - cy - 5) / nomeLH));
    const maxLines = Math.min(3, availLines);
    const nomeAll = doc.splitTextToSize(p.nome, textW);
    const nome = nomeAll.slice(0, maxLines);
    if (nomeAll.length > maxLines && nome.length > 0) {
      const last = String(nome[nome.length - 1]).replace(/[\s.]+$/, "");
      nome[nome.length - 1] = last + "…";
    }
    doc.text(nome, textX, cy);
    cy += nome.length * nomeLH;

    // SKU + categoria
    const meta: string[] = [];
    if (p.sku) meta.push(`SKU ${p.sku}`);
    if (p.categoria) meta.push(p.categoria);
    if (meta.length && cy + 4 <= textBottom) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      set(doc, "text", C.muted);
      doc.text(meta.join("  ·  "), textX, cy + 1);
    }

    // Linha divisória acima do bloco de preços
    hairline(textX, pzY - 3, textX + textW, pzY - 3, C.hair);

    const preco = p.preco_unitario != null ? Number(p.preco_unitario) : null;
    const hasPkg = p.preco_pacote != null && Number(p.preco_pacote) > 0;

    if (hasPkg) {
      const colW = (textW - 6) / 2;
      // Unitário
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setCharSpace(1.2);
      set(doc, "text", C.sub);
      doc.text("UNITÁRIO", textX, pzY + 3);
      doc.setCharSpace(0);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(17);
      set(doc, "text", C.fg);
      doc.text(preco != null ? brl(preco) : "—", textX, pzY + 13);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      set(doc, "text", C.muted);
      doc.text("preço à vista", textX, pzY + 19);

      // Divisor vertical
      set(doc, "draw", C.hair);
      doc.setLineWidth(0.2);
      doc.line(textX + colW + 3, pzY + 1, textX + colW + 3, pzY + 21);

      // Pacote (destaque)
      const px = textX + colW + 8;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.setCharSpace(1.2);
      set(doc, "text", C.red);
      doc.text(`PACOTE${p.quantidade_pacote ? ` · ${p.quantidade_pacote}UN` : ""}`, px, pzY + 3);
      doc.setCharSpace(0);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(17);
      set(doc, "text", C.red);
      doc.text(brl(Number(p.preco_pacote)), px, pzY + 13);
      if (p.quantidade_pacote && Number(p.preco_pacote) > 0) {
        const un = Number(p.preco_pacote) / p.quantidade_pacote;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        set(doc, "text", C.muted);
        doc.text(`${brl(un)} /un`, px, pzY + 19);
      }
    } else {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setCharSpace(1.2);
      set(doc, "text", C.sub);
      doc.text("PREÇO À VISTA", textX, pzY + 3);
      doc.setCharSpace(0);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(22);
      set(doc, "text", C.fg);
      doc.text(preco != null ? brl(preco) : "sob consulta", textX, pzY + 14);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      set(doc, "text", C.muted);
      doc.text("valores em real (BRL)", textX, pzY + 20);
    }
  }


  /* ============ Renderiza cada seção ============ */
  let pageNo = 3; // já usamos capa (1) e sumário (2)
  const totalSecoes = secoes.length;
  for (let s = 0; s < secoes.length; s++) {
    const key = secoes[s];
    const list = grouped.get(key)!;
    const label = tipoLabel(key);

    drawSectionDivider(key, s + 1, totalSecoes, pageNo);
    pageNo += 1;

    const totalPages = Math.max(1, Math.ceil(list.length / perPage));
    for (let page = 0; page < totalPages; page++) {
      doc.addPage();
      fillPage(C.paper);
      drawGridHeader(label, page + 1, totalPages, pageNo);
      const slice = list.slice(page * perPage, (page + 1) * perPage);
      slice.forEach((p, i) => {
        const c = i % cols;
        const r = Math.floor(i / cols);
        const x = margin + c * (cardW + gap);
        const y = margin + headerH + r * (cardH + gap);
        drawCard(p, x, y);
      });
      drawGridFooter(pageNo);
      pageNo += 1;
    }
  }

  /* ============ Contracapa ============ */
  doc.addPage();
  fillPage(C.ink);

  const bcx = pageW / 2;

  // Moldura dourada dupla (idêntica à capa)
  set(doc, "draw", C.gold);
  doc.setLineWidth(0.6);
  doc.rect(margin - 4, margin - 4, pageW - (margin - 4) * 2, pageH - (margin - 4) * 2);
  doc.setLineWidth(0.2);
  doc.rect(margin - 2, margin - 2, pageW - (margin - 2) * 2, pageH - (margin - 2) * 2);

  // -------- TOPO: eyebrow --------
  centerText("OBRIGADO PELA PREFERÊNCIA", margin + 16, {
    size: 8,
    color: [200, 194, 178],
    charSpace: 2.6,
  });
  set(doc, "fill", C.gold);
  doc.rect(bcx - 12, margin + 20, 24, 0.5, "F");

  // -------- CHAMADA PRINCIPAL --------
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  set(doc, "text", C.white);
  doc.text("FALE COM A EQUIPE", bcx, margin + 48, { align: "center" });
  doc.text("DE VENDAS", bcx, margin + 58, { align: "center" });

  // -------- BLOCO DO TELEFONE --------
  const phoneBoxW = 130;
  const phoneBoxH = 36;
  const phoneX = (pageW - phoneBoxW) / 2;
  const phoneY = margin + 68;
  set(doc, "draw", C.gold);
  doc.setLineWidth(0.5);
  doc.rect(phoneX, phoneY, phoneBoxW, phoneBoxH);

  centerText("TELEFONE · WHATSAPP", phoneY + 8, {
    size: 7.5,
    color: C.gold,
    charSpace: 2.4,
  });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  set(doc, "text", C.white);
  doc.text(phone, bcx, phoneY + 22, { align: "center" });

  centerText("ATENDIMENTO SEGUNDA A SÁBADO", phoneY + 30, {
    size: 7.5,
    color: [200, 194, 178],
    charSpace: 1.2,
  });

  // -------- SITE --------
  const siteY = phoneY + phoneBoxH + 10;
  centerText(website.toUpperCase(), siteY, {
    size: 10,
    style: "bold",
    color: C.gold,
    charSpace: 1.6,
  });

  // -------- QR CODE WHATSAPP --------
  const digits = phone.replace(/\D/g, "");
  const waNumber = digits.startsWith("55") ? digits : `55${digits}`;
  const waUrl = `https://wa.me/${waNumber}?text=${encodeURIComponent(
    "Olá! Vi o catálogo da Atacado Prime e gostaria de fazer um pedido.",
  )}`;
  try {
    const qrDataUrl = await QRCode.toDataURL(waUrl, {
      errorCorrectionLevel: "M",
      margin: 1,
      scale: 8,
      color: { dark: "#0b1220", light: "#ffffff" },
    });
    const qrSize = 34;
    const qrX = (pageW - qrSize) / 2;
    const qrY = siteY + 10;

    // Placa branca com moldura dourada
    set(doc, "fill", C.white);
    doc.roundedRect(qrX - 4, qrY - 4, qrSize + 8, qrSize + 8, 2, 2, "F");
    set(doc, "draw", C.gold);
    doc.setLineWidth(0.4);
    doc.roundedRect(qrX - 4, qrY - 4, qrSize + 8, qrSize + 8, 2, 2);

    doc.addImage(qrDataUrl, "PNG", qrX, qrY, qrSize, qrSize);
    doc.link(qrX - 4, qrY - 4, qrSize + 8, qrSize + 8, { url: waUrl });

    // Legendas
    centerText("APONTE A CÂMERA", qrY + qrSize + 9, {
      size: 8,
      style: "bold",
      color: C.gold,
      charSpace: 2,
    });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    set(doc, "text", [200, 194, 178]);
    doc.text("Atendimento imediato pelo WhatsApp", bcx, qrY + qrSize + 14, {
      align: "center",
    });
  } catch {
    /* noop */
  }

  // -------- ASSINATURA DA MARCA (rodapé) --------
  const brandY = safeBottom - 26;
  set(doc, "fill", C.gold);
  doc.rect(bcx - 10, brandY - 6, 20, 0.5, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  set(doc, "text", C.white);
  doc.text(brandName, bcx, brandY, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  set(doc, "text", [200, 194, 178]);
  doc.text(
    "Peças e acessórios automotivos · atacado especializado",
    bcx,
    brandY + 5,
    { align: "center" },
  );

  hairline(bcx - 60, safeBottom - 8, bcx + 60, safeBottom - 8, [110, 92, 52]);
  centerText(
    `© ${year} ${brandName.toUpperCase()} · TODOS OS DIREITOS RESERVADOS`,
    safeBottom - 3,
    {
      size: 7,
      color: [160, 154, 138],
      charSpace: 1.4,
    },
  );



  doc.save(`catalogo-${new Date().toISOString().slice(0, 10)}.pdf`);
}
