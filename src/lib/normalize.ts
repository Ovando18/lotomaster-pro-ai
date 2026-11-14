import { MONTHS, type LotteryConfig } from "./lotteries";
import type { Draw } from "./lotteryEngine";

/* eslint-disable @typescript-eslint/no-explicit-any */

const toInt = (x: unknown) => {
  const n = parseInt(String(x), 10);
  return Number.isFinite(n) ? n : NaN;
};

function parseMonth(x: unknown): number | undefined {
  if (x === null || x === undefined || x === "") return undefined;
  const n = toInt(x);
  if (!Number.isNaN(n) && n >= 1 && n <= 12) return n;
  const s = String(x).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
  const idx = MONTHS.findIndex((m) => m.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase() === s);
  return idx >= 0 ? idx + 1 : undefined;
}

function parseMoney(x: unknown): number {
  if (typeof x === "number") return x;
  if (typeof x !== "string") return 0;
  const clean = x.replace(/[^\d,.-]/g, "");
  // "1.234,56" -> 1234.56
  if (clean.includes(",")) return parseFloat(clean.replace(/\./g, "").replace(",", ".")) || 0;
  return parseFloat(clean) || 0;
}

/**
 * Normaliza respostas de diferentes APIs (loteriascaixa-api, API oficial CAIXA,
 * lotogestao e formatos similares) para o tipo Draw.
 */
export function normalizeDraw(cfg: LotteryConfig, raw: any): Draw | null {
  if (!raw || typeof raw !== "object") return null;
  const contest = toInt(raw.concurso ?? raw.numero ?? raw.contest ?? raw.numeroConcurso);
  const numsRaw: unknown[] = raw.dezenas ?? raw.listaDezenas ?? raw.numbers ?? raw.dezenasSorteadasOrdemSorteio ?? [];
  if (!Number.isFinite(contest) || !Array.isArray(numsRaw) || numsRaw.length === 0) return null;
  const numbers = numsRaw.map(toInt).filter((n) => !Number.isNaN(n)).sort((a, b) => a - b);

  let extras: number[] | undefined;
  if (cfg.extra?.kind === "trevos") {
    const t = raw.trevos ?? raw.trevosSorteados ?? raw.listaTrevos ?? [];
    extras = (Array.isArray(t) ? t : []).map(toInt).filter((n: number) => !Number.isNaN(n));
  } else if (cfg.extra?.kind === "mes") {
    const m = parseMonth(raw.mesSorte ?? raw.nomeTimeCoracaoMesSorte ?? raw.mes ?? raw.month);
    extras = m ? [m] : [];
  }

  const rawPrizes: any[] = raw.premiacoes ?? raw.listaRateioPremio ?? raw.prizes ?? [];
  const prizes = Array.isArray(rawPrizes)
    ? rawPrizes.map((p, i) => ({
        tier: toInt(p.faixa ?? p.tier ?? i + 1) || i + 1,
        label: String(p.descricao ?? p.descricaoFaixa ?? p.label ?? ""),
        winners: toInt(p.ganhadores ?? p.numeroDeGanhadores ?? p.winners ?? 0) || 0,
        value: parseMoney(p.valorPremio ?? p.value ?? 0),
      }))
    : [];

  return {
    contest,
    date: String(raw.data ?? raw.dataApuracao ?? raw.date ?? ""),
    numbers,
    extras,
    prizes,
    accumulated: Boolean(raw.acumulou ?? raw.acumulado ?? false),
    nextContest: toInt(raw.proximoConcurso ?? raw.numeroConcursoProximo) || contest + 1,
    nextDate: raw.dataProximoConcurso ?? undefined,
    nextEstimate: parseMoney(raw.valorEstimadoProximoConcurso ?? 0) || undefined,
  };
}

export function validateDraw(cfg: LotteryConfig, d: Draw): boolean {
  if (d.numbers.length !== cfg.drawSize) return false;
  if (new Set(d.numbers).size !== d.numbers.length) return false;
  return d.numbers.every((n) => n >= cfg.minNumber && n <= cfg.maxNumber);
}
