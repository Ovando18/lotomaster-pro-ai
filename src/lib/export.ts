import { allNumbers, fmtNum, formatGame, gridRows, brl, type LotteryConfig } from "./lotteryEngine";

export interface ExportGame {
  numbers: number[];
  extras?: number[];
  cost?: number;
}

function download(filename: string, content: string | Blob, mime: string) {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const base = (cfg: LotteryConfig, contest?: number) => `${cfg.id}${contest ? `-concurso-${contest}` : ""}`;

export function toTxt(cfg: LotteryConfig, games: ExportGame[], contest?: number): string {
  const head = `${cfg.name}${contest ? ` · Concurso ${contest}` : ""} · ${games.length} jogo(s)`;
  const lines = games.map((g, i) => `Jogo ${String(i + 1).padStart(2, "0")}: ${formatGame(cfg, g)}`);
  const total = games.reduce((a, g) => a + (g.cost ?? 0), 0);
  return [head, "", ...lines, "", `Total: ${brl(total)}`, "Gerado por LotoMaster Pro AI"].join("\n");
}

export function toCsv(cfg: LotteryConfig, games: ExportGame[], contest?: number): string {
  const max = Math.max(...games.map((g) => g.numbers.length));
  const header = ["jogo", "concurso", ...Array.from({ length: max }, (_, i) => `d${i + 1}`)];
  if (cfg.extra) header.push(cfg.extra.kind === "trevos" ? "trevos" : "mes");
  header.push("custo");
  const rows = games.map((g, i) => {
    const r: (string | number)[] = [i + 1, contest ?? "", ...g.numbers.map(fmtNum)];
    while (r.length < max + 2) r.push("");
    if (cfg.extra) r.push((g.extras ?? []).join(" "));
    r.push((g.cost ?? 0).toFixed(2));
    return r.join(";");
  });
  return [header.join(";"), ...rows].join("\n");
}

export function exportTxt(cfg: LotteryConfig, games: ExportGame[], contest?: number) {
  download(`${base(cfg, contest)}.txt`, toTxt(cfg, games, contest), "text/plain;charset=utf-8");
}

export function exportCsv(cfg: LotteryConfig, games: ExportGame[], contest?: number) {
  // BOM para o Excel abrir acentos corretamente
  download(`${base(cfg, contest)}.csv`, "﻿" + toCsv(cfg, games, contest), "text/csv;charset=utf-8");
}

export function whatsappUrl(cfg: LotteryConfig, games: ExportGame[], contest?: number) {
  return `https://wa.me/?text=${encodeURIComponent(toTxt(cfg, games, contest))}`;
}

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** PDF no estilo volante: grade do volante com as dezenas marcadas. */
export async function exportPdf(cfg: LotteryConfig, games: ExportGame[], contest?: number) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = 210;
  const H = 297;
  const margin = 10;
  const colsPerPage = cfg.totalNumbers > 60 ? 1 : 2;
  const boxW = (W - margin * 2 - (colsPerPage - 1) * 6) / colsPerPage;
  const rows = gridRows(cfg);
  const cell = Math.min(9, (boxW - 8) / cfg.gridCols);
  const extraH = cfg.extra ? 12 : 0;
  const boxH = 14 + rows * cell + extraH + 4;
  const color = hexToRgb(cfg.color);
  const nums = allNumbers(cfg);

  let x = margin;
  let y = margin + 12;
  let col = 0;

  const header = () => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(...color);
    doc.text(`${cfg.name}${contest ? `  ·  Concurso ${contest}` : ""}`, margin, margin + 5);
    doc.setFontSize(8);
    doc.setTextColor(120);
    doc.setFont("helvetica", "normal");
    doc.text("LotoMaster Pro AI · confira sempre no app/lotérica oficial", W - margin, margin + 5, { align: "right" });
  };
  header();

  games.forEach((g, gi) => {
    if (y + boxH > H - margin) {
      doc.addPage();
      header();
      y = margin + 12;
      col = 0;
      x = margin;
    }
    const set = new Set(g.numbers);
    doc.setDrawColor(...color);
    doc.setLineWidth(0.4);
    doc.roundedRect(x, y, boxW, boxH, 2, 2);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(30);
    doc.text(`Jogo ${gi + 1}  (${g.numbers.length} dezenas)`, x + 4, y + 6);
    if (g.cost) {
      doc.setFont("helvetica", "normal");
      doc.text(brl(g.cost), x + boxW - 4, y + 6, { align: "right" });
    }
    const gx = x + (boxW - cell * cfg.gridCols) / 2;
    const gy = y + 10;
    nums.forEach((n, i) => {
      const r = Math.floor(i / cfg.gridCols);
      const c = i % cfg.gridCols;
      const cx = gx + c * cell + cell / 2;
      const cy = gy + r * cell + cell / 2;
      const marked = set.has(n);
      if (marked) {
        doc.setFillColor(...color);
        doc.circle(cx, cy, cell * 0.42, "F");
        doc.setTextColor(255);
      } else {
        doc.setDrawColor(190);
        doc.setLineWidth(0.2);
        doc.circle(cx, cy, cell * 0.42, "S");
        doc.setTextColor(140);
      }
      doc.setFont("helvetica", marked ? "bold" : "normal");
      doc.setFontSize(cell > 7 ? 8 : 6.5);
      doc.text(fmtNum(n), cx, cy + 1.1, { align: "center" });
    });
    if (cfg.extra && g.extras?.length) {
      doc.setTextColor(30);
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      const label =
        cfg.extra.kind === "trevos"
          ? `Trevos: ${g.extras.join("  ")}`
          : `Mês de Sorte: ${g.extras.map((m) => cfg.extra!.names?.[m - 1]).join(", ")}`;
      doc.text(label, x + 4, gy + rows * cell + 7);
    }
    col++;
    if (col >= colsPerPage) {
      col = 0;
      x = margin;
      y += boxH + 5;
    } else {
      x += boxW + 6;
    }
  });
  download(`${base(cfg, contest)}.pdf`, doc.output("blob"), "application/pdf");
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  }
}
