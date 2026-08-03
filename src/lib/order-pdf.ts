import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { brl } from "./format";

type Item = {
  nome: string;
  sku?: string | null;
  tipo_compra: string;
  quantidade: number;
  preco_final: number | string;
  subtotal: number | string;
};

type Address = {
  street?: string | null;
  number?: string | null;
  district?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
};

type Company = {
  legal_name?: string | null;
  trade_name?: string | null;
  tax_id?: string | null;
  email?: string | null;
  phone?: string | null;
};

export type OrderPdfInput = {
  id: string;
  created_at: string;
  subtotal: number | string;
  frete: number | string;
  desconto?: number | string;
  total: number | string;
  observacao?: string | null;
  status: string;
  company?: Company | null;
  address?: Address | null;
  items: Item[];
  payment?: { tipo?: string | null; status?: string | null; payment_link?: string | null } | null;
  brandName?: string;
  brandTagline?: string;
};

export function buildOrderPdf(o: OrderPdfInput) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 14;

  // Header
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(20, 20, 20);
  doc.text(o.brandName ?? "Atacado Prime", margin, 18);
  if (o.brandTagline) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(120);
    doc.text(o.brandTagline, margin, 23);
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(20);
  doc.text("RESUMO DO PEDIDO", pageW - margin, 18, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(90);
  doc.text(`Nº #${o.id.slice(0, 8).toUpperCase()}`, pageW - margin, 23, { align: "right" });
  doc.text(`Data: ${new Date(o.created_at).toLocaleString("pt-BR")}`, pageW - margin, 28, { align: "right" });

  doc.setDrawColor(220);
  doc.line(margin, 32, pageW - margin, 32);

  // Cliente
  let y = 40;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(20);
  doc.text("DADOS DO CLIENTE", margin, y);
  y += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(60);
  const c = o.company ?? {};
  const lines = [
    `Nome: ${c.legal_name ?? c.trade_name ?? "—"}`,
    c.tax_id ? `CNPJ: ${c.tax_id}` : null,
    c.phone ? `Telefone: ${c.phone}` : null,
    c.email ? `Email: ${c.email}` : null,
    o.address
      ? `Endereço: ${o.address.street ?? ""}${o.address.number ? ", " + o.address.number : ""} — ${o.address.district ?? ""}, ${o.address.city ?? ""}/${o.address.state ?? ""} · CEP ${o.address.zip ?? ""}`
      : null,
  ].filter(Boolean) as string[];
  for (const l of lines) {
    const wrapped = doc.splitTextToSize(l, pageW - margin * 2);
    doc.text(wrapped, margin, y);
    y += wrapped.length * 4.2;
  }

  // Itens
  y += 4;
  autoTable(doc, {
    startY: y,
    head: [["Produto", "SKU", "Qtd", "Preço un.", "Subtotal"]],
    body: o.items.map((it) => [
      it.nome,
      it.sku ?? "—",
      String(it.quantidade) + (it.tipo_compra === "PACOTE" ? " (pacote)" : ""),
      brl(Number(it.preco_final)),
      brl(Number(it.subtotal)),
    ]),
    styles: { fontSize: 9, cellPadding: 2.5 },
    headStyles: { fillColor: [30, 41, 59], textColor: 255, fontStyle: "bold" },
    columnStyles: {
      2: { halign: "center" },
      3: { halign: "right" },
      4: { halign: "right" },
    },
    margin: { left: margin, right: margin },
  });

  // Totais
  // @ts-expect-error lastAutoTable injected
  y = doc.lastAutoTable.finalY + 6;
  const totalsX = pageW - margin;
  const labelX = pageW - margin - 50;
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(60);
  doc.text("Subtotal", labelX, y);
  doc.text(brl(Number(o.subtotal)), totalsX, y, { align: "right" });
  y += 5;
  doc.text("Frete", labelX, y);
  doc.text(brl(Number(o.frete)), totalsX, y, { align: "right" });
  if (Number(o.desconto ?? 0) > 0) {
    y += 5;
    doc.text("Desconto", labelX, y);
    doc.text("- " + brl(Number(o.desconto)), totalsX, y, { align: "right" });
  }
  y += 2;
  doc.setDrawColor(180);
  doc.line(labelX, y, totalsX, y);
  y += 5;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(20);
  doc.text("TOTAL GERAL", labelX, y);
  doc.text(brl(Number(o.total)), totalsX, y, { align: "right" });

  // Pagamento
  if (o.payment) {
    y += 10;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("FORMA DE PAGAMENTO", margin, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(60);
    doc.text(`${o.payment.tipo ?? "—"} · ${o.payment.status ?? "—"}`, margin, y);
    if (o.payment.payment_link) {
      y += 5;
      doc.setTextColor(30, 64, 175);
      const link = doc.splitTextToSize(`Link: ${o.payment.payment_link}`, pageW - margin * 2);
      doc.textWithLink(link[0], margin, y, { url: o.payment.payment_link });
      for (let i = 1; i < link.length; i++) {
        y += 4;
        doc.text(link[i], margin, y);
      }
    }
  }

  // Observação
  if (o.observacao) {
    y += 10;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(20);
    doc.text("OBSERVAÇÃO", margin, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(60);
    const obs = doc.splitTextToSize(o.observacao, pageW - margin * 2);
    doc.text(obs, margin, y);
  }

  // Footer
  const footY = doc.internal.pageSize.getHeight() - 10;
  doc.setFontSize(8);
  doc.setTextColor(140);
  doc.text(
    "Documento gerado automaticamente · Confirme o pedido com nosso atendimento.",
    pageW / 2,
    footY,
    { align: "center" },
  );

  return doc;
}

export function generateOrderPdf(o: OrderPdfInput) {
  const doc = buildOrderPdf(o);
  doc.save(`pedido-${o.id.slice(0, 8)}.pdf`);
}
