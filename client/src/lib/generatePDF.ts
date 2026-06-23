import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

function formatCurrency(value: string | number): string {
  const num = typeof value === "string" ? parseFloat(value) : value;
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(num);
}

function formatDate(ts: number | null | undefined): string {
  if (!ts) return "—";
  return format(new Date(ts), "dd/MM/yyyy", { locale: ptBR });
}

function statusLabel(status: string): string {
  if (status === "paid") return "Paga";
  if (status === "overdue") return "Em Atraso";
  return "Pendente";
}

export interface InstallmentRow {
  installmentNumber: number;
  installmentValue: string | number;
  dueDate: number;
  paidAt: number | null;
  status: string;
}

export interface ClientPDFData {
  clientName: string;
  totalFees: string | number;
  installmentCount: number;
  installmentValue: string | number;
  startDate: number;
  installments: InstallmentRow[];
}

export function generateClientPDF(client: ClientPDFData): void {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const marginX = 15;

  // ── Cabeçalho ──────────────────────────────────────────────────────────────
  // Faixa superior dourada
  doc.setFillColor(133, 100, 4); // dourado
  doc.rect(0, 0, pageWidth, 22, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("CARNÊ DE PAGAMENTO", marginX, 13);

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  const emitDate = format(new Date(), "dd/MM/yyyy", { locale: ptBR });
  doc.text(`Emitido em: ${emitDate}`, pageWidth - marginX, 13, { align: "right" });

  // ── Dados do cliente ────────────────────────────────────────────────────────
  doc.setTextColor(30, 30, 50);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(client.clientName, marginX, 34);

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(90, 90, 110);

  const paid = client.installments.filter(i => i.status === "paid").length;
  const overdue = client.installments.filter(i => i.status === "overdue").length;
  const pending = client.installments.filter(i => i.status === "pending").length;

  const infoLines = [
    [`Total dos Honorários:`, formatCurrency(client.totalFees)],
    [`Parcelas:`, `${client.installmentCount}x de ${formatCurrency(client.installmentValue)}`],
    [`Início do Carnê:`, formatDate(client.startDate)],
    [`Pagas:`, `${paid}   Em Atraso: ${overdue}   Pendentes: ${pending}`],
  ];

  let y = 42;
  for (const [label, value] of infoLines) {
    doc.setFont("helvetica", "bold");
    doc.setTextColor(60, 60, 80);
    doc.text(label, marginX, y);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(30, 30, 50);
    doc.text(value, marginX + 48, y);
    y += 6;
  }

  // Linha separadora
  doc.setDrawColor(200, 185, 140);
  doc.setLineWidth(0.4);
  doc.line(marginX, y + 2, pageWidth - marginX, y + 2);

  // ── Tabela de parcelas ──────────────────────────────────────────────────────
  const tableRows = client.installments.map((inst) => [
    `${inst.installmentNumber}ª`,
    formatCurrency(inst.installmentValue),
    formatDate(inst.dueDate),
    formatDate(inst.paidAt),
    statusLabel(inst.status),
  ]);

  autoTable(doc, {
    startY: y + 7,
    head: [["Parcela", "Valor", "Vencimento", "Pagamento", "Status"]],
    body: tableRows,
    margin: { left: marginX, right: marginX },
    headStyles: {
      fillColor: [133, 100, 4],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 9,
      halign: "center",
    },
    bodyStyles: {
      fontSize: 9,
      textColor: [30, 30, 50],
    },
    alternateRowStyles: {
      fillColor: [252, 249, 242],
    },
    columnStyles: {
      0: { halign: "center", cellWidth: 18 },
      1: { halign: "right", cellWidth: 30 },
      2: { halign: "center", cellWidth: 30 },
      3: { halign: "center", cellWidth: 30 },
      4: { halign: "center" },
    },
    didParseCell(data) {
      // Colorir linha de acordo com status
      if (data.section === "body") {
        const status = client.installments[data.row.index]?.status;
        if (status === "overdue") {
          data.cell.styles.textColor = [180, 30, 30];
          data.cell.styles.fontStyle = "bold";
        } else if (status === "paid") {
          data.cell.styles.textColor = [20, 130, 80];
        }
      }
    },
  });

  // ── Rodapé ──────────────────────────────────────────────────────────────────
  const pageCount = (doc.internal as any).getNumberOfPages?.() ?? 1;
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    const pageHeight = doc.internal.pageSize.getHeight();
    doc.setFontSize(7);
    doc.setTextColor(160, 160, 160);
    doc.setFont("helvetica", "normal");
    doc.text(
      `Documento gerado automaticamente — Controle de Pagamentos`,
      marginX,
      pageHeight - 8
    );
    doc.text(`Página ${i} de ${pageCount}`, pageWidth - marginX, pageHeight - 8, { align: "right" });
  }

  // ── Download ────────────────────────────────────────────────────────────────
  const safeName = client.clientName.replace(/[^a-zA-Z0-9À-ú\s]/g, "").trim().replace(/\s+/g, "_");
  doc.save(`carne_${safeName}.pdf`);
}
