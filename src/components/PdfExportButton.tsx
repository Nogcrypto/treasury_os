"use client";

import { useState } from "react";

interface PdfData {
  orgName: string;
  reportDate: string;
  totalUsd: number;
  liquidUsd: number;
  runwayMonths: number;
  deployedUsd: number;
  deployedPct: number;
  blendedAprPct: number;
  estimatedYieldYear: number;
  complianceScore: number;
  policyPreset: string;
  policyVersion: number;
  positions: { protocol: string; asset: string; amountUsd: number; aprPct: number }[];
  violations: { message: string; severity: string }[];
  executiveSummary?: string;
}

function fmtUSD(n: number) {
  return `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

export function PdfExportButton({ data }: { data: PdfData }) {
  const [generating, setGenerating] = useState(false);

  async function generate() {
    setGenerating(true);
    try {
      // Dynamic import to avoid SSR issues
      const { default: jsPDF } = await import("jspdf");
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

      const pageW = 210;
      const margin = 20;
      const col = margin;
      let y = margin;

      // ── Header ─────────────────────────────────────────────────────────────
      doc.setFillColor(16, 17, 22); // dark bg
      doc.rect(0, 0, pageW, 32, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(18);
      doc.setFont("helvetica", "bold");
      doc.text("TreasuryOS", col, 14);
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(140, 140, 160);
      doc.text("Relatório Executivo de Tesouraria", col, 21);
      doc.text(data.orgName, col, 28);
      doc.text(data.reportDate, pageW - margin, 28, { align: "right" });

      y = 42;
      doc.setTextColor(20, 20, 30);

      // ── KPIs ───────────────────────────────────────────────────────────────
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text("Métricas-chave", col, y);
      y += 6;

      const kpis = [
        ["Total em caixa",    fmtUSD(data.totalUsd)],
        ["Caixa líquido",     fmtUSD(data.liquidUsd)],
        ["Runway líquido",    `${data.runwayMonths.toFixed(1)} meses`],
        ["Capital alocado",   `${fmtUSD(data.deployedUsd)} (${data.deployedPct.toFixed(1)}%)`],
        ["APR médio",         `${data.blendedAprPct.toFixed(2)}%`],
        ["Yield est./ano",    fmtUSD(data.estimatedYieldYear)],
        ["Compliance",        `${data.complianceScore}/100`],
        ["Política ativa",    `${data.policyPreset} v${data.policyVersion}`],
      ];

      doc.setFontSize(9);
      kpis.forEach(([label, value], i) => {
        const x = i % 2 === 0 ? col : pageW / 2;
        doc.setFont("helvetica", "normal");
        doc.setTextColor(100, 100, 120);
        doc.text(label, x, y);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(20, 20, 30);
        doc.text(value, x, y + 4);
        if (i % 2 === 1) y += 12;
      });
      if (kpis.length % 2 !== 0) y += 12;

      y += 4;
      doc.setDrawColor(220, 220, 230);
      doc.line(col, y, pageW - margin, y);
      y += 8;

      // ── Positions ──────────────────────────────────────────────────────────
      if (data.positions.length > 0) {
        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(20, 20, 30);
        doc.text("Posições alocadas", col, y);
        y += 6;

        doc.setFontSize(8);
        doc.setTextColor(100, 100, 120);
        doc.setFont("helvetica", "normal");
        doc.text("Protocolo", col, y);
        doc.text("Ativo", col + 55, y);
        doc.text("Valor", col + 90, y);
        doc.text("APR", col + 130, y);
        y += 4;
        doc.line(col, y, pageW - margin, y);
        y += 4;

        data.positions.forEach((p) => {
          doc.setTextColor(20, 20, 30);
          doc.setFont("helvetica", "normal");
          doc.text(p.protocol, col, y);
          doc.text(p.asset, col + 55, y);
          doc.text(fmtUSD(p.amountUsd), col + 90, y);
          doc.text(`${p.aprPct.toFixed(2)}%`, col + 130, y);
          y += 6;
        });

        y += 4;
        doc.line(col, y, pageW - margin, y);
        y += 8;
      }

      // ── Violations ─────────────────────────────────────────────────────────
      if (data.violations.length > 0) {
        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(180, 90, 30);
        doc.text(`Violações de política (${data.violations.length})`, col, y);
        y += 6;

        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        data.violations.forEach((v) => {
          doc.setTextColor(v.severity === "block" ? 180 : 140, 60, 30);
          doc.text(`▸ ${v.message}`, col, y, { maxWidth: pageW - margin * 2 });
          y += 5;
        });
        y += 4;
      }

      // ── Executive summary ──────────────────────────────────────────────────
      if (data.executiveSummary) {
        doc.line(col, y, pageW - margin, y);
        y += 8;
        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(20, 20, 30);
        doc.text("Resumo executivo", col, y);
        y += 6;
        doc.setFontSize(8.5);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(40, 40, 60);
        const lines = doc.splitTextToSize(data.executiveSummary, pageW - margin * 2);
        doc.text(lines, col, y);
        y += lines.length * 4.5 + 6;
      }

      // ── Footer ─────────────────────────────────────────────────────────────
      const footerY = 287;
      doc.setDrawColor(220, 220, 230);
      doc.line(col, footerY, pageW - margin, footerY);
      doc.setFontSize(7);
      doc.setTextColor(140, 140, 160);
      doc.setFont("helvetica", "normal");
      doc.text("Gerado por TreasuryOS · treasuryos.app", col, footerY + 4);
      doc.text(data.reportDate, pageW - margin, footerY + 4, { align: "right" });

      doc.save(`treasury-report-${new Date().toISOString().slice(0, 10)}.pdf`);
    } finally {
      setGenerating(false);
    }
  }

  return (
    <button
      onClick={generate}
      disabled={generating}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-line text-xs text-fg-2 hover:text-fg hover:border-accent/40 hover:bg-accent/5 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
    >
      {generating ? (
        <>
          <span className="inline-block w-3 h-3 border border-fg-3 border-t-transparent rounded-full animate-spin" />
          Gerando PDF…
        </>
      ) : (
        <>↓ Exportar PDF</>
      )}
    </button>
  );
}
