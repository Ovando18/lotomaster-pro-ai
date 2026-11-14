import "server-only";
import { getLottery, type LotteryConfig } from "../lotteries";
import type { Draw } from "../lotteryEngine";
import { normalizeDraw, validateDraw } from "../normalize";

/**
 * Fontes de dados em ordem de prioridade. As URLs podem ser sobrescritas por
 * variáveis de ambiente, caso alguma API mude de endereço.
 */
const PRIMARY = process.env.LOTTERY_API_PRIMARY ?? "https://loteriascaixa-api.herokuapp.com/api";
const FALLBACK = process.env.LOTTERY_API_FALLBACK ?? "https://lotogestao.com.br/v1";
const CAIXA = process.env.LOTTERY_API_CAIXA ?? "https://servicodados.caixa.gov.br/portaldeloterias/api";

const TTL_MS = 10 * 60 * 1000;
const memo = new Map<string, { at: number; data: unknown }>();

async function getJson(url: string, timeoutMs = 9000): Promise<unknown> {
  const hit = memo.get(url);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.data;
  const res = await fetch(url, {
    cache: "no-store",
    signal: AbortSignal.timeout(timeoutMs),
    headers: { accept: "application/json", "user-agent": "LotoMasterProAI/1.0" },
  });
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  const data = await res.json();
  memo.set(url, { at: Date.now(), data });
  return data;
}

function unwrap(x: unknown): unknown {
  if (x && typeof x === "object" && !Array.isArray(x)) {
    const o = x as Record<string, unknown>;
    return o.data ?? o.result ?? o.resultado ?? x;
  }
  return x;
}

export async function fetchDraw(lotteryId: string, contest?: number): Promise<{ draw: Draw; source: string }> {
  const cfg = getLottery(lotteryId);
  const key = contest ? String(contest) : "latest";
  const attempts: [string, string][] = [
    ["loteriascaixa-api", `${PRIMARY}/${cfg.id}/${key}`],
    ["lotogestao", `${FALLBACK}/${cfg.id}/${key === "latest" ? "ultimo" : key}`],
    ["caixa", `${CAIXA}/${cfg.id}${contest ? `/${contest}` : ""}`],
  ];
  const errors: string[] = [];
  for (const [source, url] of attempts) {
    try {
      const d = normalizeDraw(cfg, unwrap(await getJson(url)));
      if (d && validateDraw(cfg, d) && (!contest || d.contest === contest)) return { draw: d, source };
      errors.push(`${source}: formato inesperado`);
    } catch (e) {
      errors.push(`${source}: ${(e as Error).message}`);
    }
  }
  throw new Error(`Resultado indisponível (${errors.join(" | ")})`);
}

export async function fetchHistory(lotteryId: string, limit = 300): Promise<{ draws: Draw[]; source: string }> {
  const cfg: LotteryConfig = getLottery(lotteryId);
  // 1) histórico completo em uma chamada
  for (const [source, url] of [
    ["loteriascaixa-api", `${PRIMARY}/${cfg.id}`],
    ["lotogestao", `${FALLBACK}/${cfg.id}`],
  ] as const) {
    try {
      const raw = unwrap(await getJson(url, 15000));
      if (Array.isArray(raw)) {
        const draws = raw
          .map((r) => normalizeDraw(cfg, r))
          .filter((d): d is Draw => !!d && validateDraw(cfg, d))
          .sort((a, b) => b.contest - a.contest)
          .slice(0, limit);
        if (draws.length) return { draws, source };
      }
    } catch {
      /* tenta a próxima */
    }
  }
  // 2) fallback: concurso a concurso (limitado) a partir do último
  const { draw: latest, source } = await fetchDraw(lotteryId);
  const n = Math.min(limit, 60);
  const draws: Draw[] = [latest];
  const contests = Array.from({ length: n - 1 }, (_, i) => latest.contest - 1 - i).filter((c) => c > 0);
  for (let i = 0; i < contests.length; i += 6) {
    const batch = await Promise.allSettled(contests.slice(i, i + 6).map((c) => fetchDraw(lotteryId, c)));
    batch.forEach((b) => b.status === "fulfilled" && draws.push(b.value.draw));
  }
  return { draws: draws.sort((a, b) => b.contest - a.contest), source: `${source} (parcial)` };
}
