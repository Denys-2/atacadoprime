import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { brl } from "./format";

export type ProductPdfItem = {
  nome: string;
  sku?: string | null;
  tipo?: string | null;
  categoria?: string | null;
  marca?: string | null;
  estoque?: number | null;
  preco_unitario?: number | string | null;
  preco_pacote?: number | string | null;
};

export function generateProductsPdf(items: ProductPdfItem[], brandName = "Atacado Prime") {
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "landscape" });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 12;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(20);
  doc.text(brandName, margin, 15);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("LISTA DE PRODUTOS", pageW - margin, 15, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(90);
  doc.text(`Gerado em: ${new Date().toLocaleString("pt-BR")}`, pageW - margin, 20, { align: "right" });
  doc.text(`Total de itens: ${items.length}`, pageW - margin, 25, { align: "right" });

  doc.setDrawColor(220);
  doc.line(margin, 29, pageW - margin, 29);

  autoTable(doc, {
    startY: 33,
    head: [["Produto", "SKU", "Categoria", "Marca", "Tipo", "Estoque", "Preço un.", "Preço pct."]],
    body: items.map((p) => [
      p.nome,
      p.sku ?? "—",
      p.categoria ?? "—",
      p.marca ?? "—",
      p.tipo ?? "—",
      String(p.estoque ?? 0),
      p.preco_unitario != null ? brl(Number(p.preco_unitario)) : "—",
      p.preco_pacote != null && Number(p.preco_pacote) > 0 ? brl(Number(p.preco_pacote)) : "—",
    ]),
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [30, 41, 59], textColor: 255, fontStyle: "bold" },
    columnStyles: {
      5: { halign: "center" },
      6: { halign: "right" },
      7: { halign: "right" },
    },
    margin: { left: margin, right: margin },
    didDrawPage: () => {
      const footY = doc.internal.pageSize.getHeight() - 6;
      doc.setFontSize(8);
      doc.setTextColor(140);
      doc.text(
        `${brandName} · Lista de produtos`,
        pageW / 2,
        footY,
        { align: "center" },
      );
    },
  });

  doc.save(`produtos-${new Date().toISOString().slice(0, 10)}.pdf`);
}
