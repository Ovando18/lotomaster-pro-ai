/**
 * LotoMaster Pro AI: motor matemático.
 *
 * Contém:
 *  - combinatória básica (C(n,k), hipergeométrica, enumeração por bitmask)
 *  - fechamentos combinatórios (Covering / Lotto Designs) com verificação exata
 *  - filtros estatísticos eliminatórios (quality gates)
 *  - estatísticas de histórico (frequência, atraso, ciclo das dezenas)
 *  - geração de jogos (Equilibrado, Manual + IA, Surpresinha, Ciclo, Fechamento)
 *  - conferência com desdobramento de apostas múltiplas, ROI e diagnóstico
 *  - ajuste adaptativo de pesos por retroalimentação
 *
 * Aviso estatístico: cada sorteio é independente e equiprovável. Filtros e pesos
 * moldam *quais* combinações você joga (evitando padrões raros, organizando
 * custo e cobertura), mas não aumentam a probabilidade de uma combinação
 * específica ser sorteada. Já a garantia de um fechamento é matemática e
 * verificada exaustivamente aqui, mas ela vale somente se as dezenas
 * sorteadas estiverem dentro do grupo escolhido.
 */

import {
  FilterConfig,
  LotteryConfig,
  PrizeTier,
} from "./lotteries";

export * from "./lotteries";

/* ------------------------------------------------------------------ */
/* Tipos                                                               */
/* ------------------------------------------------------------------ */

export interface Draw {
  contest: number;
  date: string;
  numbers: number[];
  /** trevos (+Milionária) ou mês (Dia de Sorte, 1..12) */
  extras?: number[];
  prizes?: { tier: number; label: string; winners: number; value: number }[];
  accumulated?: boolean;
  nextContest?: number;
  nextDate?: string;
  nextEstimate?: number;
}

export interface GameMetrics {
  even: number;
  odd: number;
  sum: number;
  repeated: number | null;
  primes: number;
  frame: number;
  maxConsecutive: number;
}

export interface FilterCheck {
  key: keyof FilterConfig | "sum";
  label: string;
  value: number;
  range: [number, number];
  pass: boolean;
}

export interface Game {
  numbers: number[];
  extras?: number[];
  metrics: GameMetrics;
  checks: FilterCheck[];
  cost: number;
}

export interface Weights {
  hot: number;
  late: number;
  cycle: number;
  neutral: number;
}

export const DEFAULT_WEIGHTS: Weights = { hot: 1, late: 1, cycle: 1, neutral: 1 };

export type Strategy = "equilibrado" | "manual" | "surpresinha" | "ciclo" | "fechamento";

export const STRATEGIES: { id: Strategy; label: string; hint: string }[] = [
  { id: "equilibrado", label: "Equilibrado (Padrão Ouro)", hint: "Mistura quentes, atrasadas e neutras, com filtros." },
  { id: "manual", label: "Manual + Completar com IA", hint: "Suas dezenas fixas + preenchimento ponderado." },
  { id: "surpresinha", label: "Surpresinha Otimizada", hint: "Aleatório uniforme passando pelos filtros." },
  { id: "ciclo", label: "Tática Ciclo + Moldura", hint: "Força dezenas que faltam no ciclo atual." },
  { id: "fechamento", label: "Fechamento (Covering Design)", hint: "Grupo de N dezenas com garantia mínima." },
];

/* ------------------------------------------------------------------ */
/* PRNG e utilidades                                                   */
/* ------------------------------------------------------------------ */

export type Rng = () => number;

/** mulberry32: PRNG rápido e determinístico (bom para testes reprodutíveis). */
export function createRng(seed = Date.now() ^ Math.floor(Math.random() * 1e9)): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randInt(rng: Rng, n: number) {
  return Math.floor(rng() * n);
}

function shuffle<T>(arr: T[], rng: Rng): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = randInt(rng, i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function range(min: number, max: number): number[] {
  const out: number[] = [];
  for (let i = min; i <= max; i++) out.push(i);
  return out;
}

export function allNumbers(cfg: LotteryConfig): number[] {
  return range(cfg.minNumber, cfg.maxNumber);
}

const sortAsc = (a: number, b: number) => a - b;

/* ------------------------------------------------------------------ */
/* Combinatória                                                        */
/* ------------------------------------------------------------------ */

export function binomial(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  k = Math.min(k, n - k);
  let r = 1;
  for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i;
  return Math.round(r);
}

/** P(acertar exatamente j) com aposta de k dezenas, N no volante, d sorteadas. */
export function hypergeometric(N: number, d: number, k: number, j: number): number {
  return (binomial(d, j) * binomial(N - d, k - j)) / binomial(N, k);
}

/** "1 em X" para acertar exatamente j. */
export function oddsOneIn(cfg: LotteryConfig, k: number, j: number): number {
  const p = hypergeometric(cfg.totalNumbers, cfg.drawSize, k, j);
  return p > 0 ? 1 / p : Infinity;
}

export function popcount(x: number): number {
  x = x - ((x >>> 1) & 0x55555555);
  x = (x & 0x33333333) + ((x >>> 2) & 0x33333333);
  return (((x + (x >>> 4)) & 0x0f0f0f0f) * 0x01010101) >>> 24;
}

/** Enumera todos os subconjuntos de tamanho k de {0..v-1} como bitmasks (v ≤ 31). */
export function enumerateMasks(v: number, k: number): Uint32Array {
  if (v > 31) throw new Error("v máximo para bitmask é 31");
  const total = binomial(v, k);
  const out = new Uint32Array(total);
  const idx = range(0, k - 1);
  let p = 0;
  while (true) {
    let m = 0;
    for (const i of idx) m |= 1 << i;
    out[p++] = m >>> 0;
    let i = k - 1;
    while (i >= 0 && idx[i] === v - k + i) i--;
    if (i < 0) break;
    idx[i]++;
    for (let j = i + 1; j < k; j++) idx[j] = idx[j - 1] + 1;
  }
  return out;
}

export function maskToIndices(m: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < 31; i++) if (m & (1 << i)) out.push(i);
  return out;
}

export function indicesToMask(idx: number[]): number {
  let m = 0;
  for (const i of idx) m |= 1 << i;
  return m >>> 0;
}

/** Todas as k-combinações de um array (para desdobramentos pequenos). */
export function combinations<T>(arr: T[], k: number): T[][] {
  const out: T[][] = [];
  const cur: T[] = [];
  const rec = (start: number) => {
    if (cur.length === k) {
      out.push(cur.slice());
      return;
    }
    for (let i = start; i <= arr.length - (k - cur.length); i++) {
      cur.push(arr[i]);
      rec(i + 1);
      cur.pop();
    }
  };
  rec(0);
  return out;
}

/* ------------------------------------------------------------------ */
/* Fechamentos: Covering / Lotto Designs                               */
/* ------------------------------------------------------------------ */

export interface CoveringParams {
  /** tamanho do grupo de dezenas escolhidas */
  v: number;
  /** dezenas por volante */
  k: number;
  /** garantia (acertos mínimos) */
  t: number;
  /** condição: quantas sorteadas caem dentro do grupo */
  m: number;
  seed?: number;
  /** candidatos avaliados por passo da gulosa */
  candidatesPerStep?: number;
  /** reinícios aleatórios (fica com o menor fechamento) */
  restarts?: number;
}

export interface CoveringResult {
  /** volantes como índices 0..v-1 do grupo */
  tickets: number[][];
  totalCombos: number;
  targets: number;
  verified: boolean;
  /** menor acerto garantido verificado exaustivamente */
  guaranteed: number;
  reduction: number;
  ms: number;
}

/**
 * Constrói um fechamento C(v,k,t,m): conjunto de volantes de k dezenas, tirados de
 * um grupo de v, tal que para QUALQUER conjunto de m dezenas sorteadas dentro do
 * grupo existe pelo menos um volante com ≥ t acertos.
 *
 * Algoritmo: cobertura gulosa guiada por alvos não cobertos (variação do
 * algoritmo de Nurmela-Östergård / greedy set cover). A cada passo escolhe um
 * alvo descoberto, gera candidatos na vizinhança de Hamming que o cobrem e fica
 * com o que cobre mais alvos ainda descobertos. Depois remove volantes
 * redundantes. A cobertura final é verificada exaustivamente.
 */
export function buildCovering(params: CoveringParams): CoveringResult {
  const started = Date.now();
  const targets = binomial(params.v, params.m);
  const restarts = params.restarts ?? (targets <= 5000 ? 8 : targets <= 10000 ? 3 : 1);
  let best: CoveringResult | null = null;
  for (let r = 0; r < restarts; r++) {
    const res = buildCoveringOnce({ ...params, seed: (params.seed ?? 12345) + r * 7919 });
    if (!best || res.tickets.length < best.tickets.length) best = res;
  }
  return { ...(best as CoveringResult), ms: Date.now() - started };
}

function buildCoveringOnce(params: CoveringParams): CoveringResult {
  const { v, k, t, m } = params;
  const started = Date.now();
  if (!(t <= k && t <= m && k <= v && m <= v && t > 0)) {
    throw new Error(`Parâmetros inválidos para fechamento: v=${v} k=${k} t=${t} m=${m}`);
  }
  const rng = createRng(params.seed ?? 12345);
  const perStep = params.candidatesPerStep ?? 48;
  const targets = enumerateMasks(v, m);
  if (targets.length > 400_000) throw new Error("Fechamento grande demais para o navegador");

  const covered = new Uint8Array(targets.length);
  let uncovered: number[] = Array.from(targets.keys());
  const chosen: number[] = [];
  const chosenSet = new Set<number>();
  const universe = range(0, v - 1);

  const coversCount = (cand: number) => {
    let c = 0;
    for (let i = 0; i < uncovered.length; i++) {
      if (popcount(cand & targets[uncovered[i]]) >= t) c++;
    }
    return c;
  };

  /** volante que contém pelo menos t elementos do alvo */
  const candidateFor = (target: number): number => {
    const inT = maskToIndices(target);
    const outT = universe.filter((i) => !(target & (1 << i)));
    // quantos elementos do alvo manter: entre t e min(k, m)
    const keepMax = Math.min(k, m);
    const keep = t + randInt(rng, keepMax - t + 1);
    const kept = shuffle(inT, rng).slice(0, keep);
    const need = k - keep;
    const restPool = shuffle(
      [...outT, ...inT.filter((x) => !kept.includes(x))],
      rng
    );
    // prioriza preencher com elementos de fora do alvo para diversificar
    const fill = need > 0 ? restPool.slice(0, need) : [];
    return indicesToMask([...kept, ...fill]);
  };

  while (uncovered.length > 0) {
    const target = targets[uncovered[randInt(rng, uncovered.length)]];
    let best = -1;
    let bestCount = -1;
    // candidato "canônico": o próprio alvo quando k == m
    const cands: number[] = [];
    if (k === m) cands.push(target);
    for (let i = 0; i < perStep; i++) cands.push(candidateFor(target));
    for (const c of cands) {
      if (chosenSet.has(c)) continue;
      const cnt = coversCount(c);
      if (cnt > bestCount) {
        bestCount = cnt;
        best = c;
      }
    }
    if (best < 0) best = cands[0];
    chosen.push(best);
    chosenSet.add(best);
    const next: number[] = [];
    for (const i of uncovered) {
      if (popcount(best & targets[i]) >= t) covered[i] = 1;
      else next.push(i);
    }
    uncovered = next;
  }

  // Remoção de redundâncias: contador de cobertura por alvo
  const coverCount = new Uint16Array(targets.length);
  for (const c of chosen) {
    for (let i = 0; i < targets.length; i++) if (popcount(c & targets[i]) >= t) coverCount[i]++;
  }
  const final: number[] = [];
  // tenta remover primeiro os volantes que cobrem menos alvos
  const order = chosen
    .map((c) => ({ c, n: 0 }))
    .map((o) => {
      let n = 0;
      for (let i = 0; i < targets.length; i++) if (popcount(o.c & targets[i]) >= t) n++;
      return { c: o.c, n };
    })
    .sort((a, b) => a.n - b.n);
  const removed = new Set<number>();
  for (const { c } of order) {
    let redundant = true;
    for (let i = 0; i < targets.length; i++) {
      if (popcount(c & targets[i]) >= t && coverCount[i] < 2) {
        redundant = false;
        break;
      }
    }
    if (redundant) {
      removed.add(c);
      for (let i = 0; i < targets.length; i++) if (popcount(c & targets[i]) >= t) coverCount[i]--;
    }
  }
  for (const c of chosen) if (!removed.has(c)) final.push(c);

  const tickets = final.map(maskToIndices);
  const check = verifyCovering(tickets, v, m);
  const totalCombos = binomial(v, k);
  return {
    tickets,
    totalCombos,
    targets: targets.length,
    verified: check.guaranteed >= t,
    guaranteed: check.guaranteed,
    reduction: 1 - tickets.length / totalCombos,
    ms: Date.now() - started,
  };
}

/**
 * Verificação exaustiva: para todo conjunto de m sorteadas dentro do grupo,
 * calcula o melhor acerto entre os volantes e retorna o pior caso (= garantia real).
 */
export function verifyCovering(tickets: number[][], v: number, m: number): { guaranteed: number; checked: number } {
  const targets = enumerateMasks(v, m);
  const masks = tickets.map(indicesToMask);
  let worst = Infinity;
  for (let i = 0; i < targets.length; i++) {
    let best = 0;
    for (const t of masks) {
      const c = popcount(t & targets[i]);
      if (c > best) best = c;
    }
    if (best < worst) worst = best;
    if (worst === 0) break;
  }
  return { guaranteed: worst === Infinity ? 0 : worst, checked: targets.length };
}

/* ------------------------------------------------------------------ */
/* Métricas e filtros                                                  */
/* ------------------------------------------------------------------ */

const PRIMES = new Set([2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61, 67, 71, 73, 79, 83, 89, 97]);

export function isPrime(n: number) {
  return PRIMES.has(n);
}

export function gridPos(cfg: LotteryConfig, n: number): { row: number; col: number } {
  const i = n - cfg.minNumber;
  return { row: Math.floor(i / cfg.gridCols), col: i % cfg.gridCols };
}

export function gridRows(cfg: LotteryConfig): number {
  return Math.ceil(cfg.totalNumbers / cfg.gridCols);
}

export function isFrame(cfg: LotteryConfig, n: number): boolean {
  const { row, col } = gridPos(cfg, n);
  const rows = gridRows(cfg);
  return row === 0 || row === rows - 1 || col === 0 || col === cfg.gridCols - 1;
}

export function maxConsecutiveRun(nums: number[]): number {
  const s = nums.slice().sort(sortAsc);
  let best = s.length ? 1 : 0;
  let cur = 1;
  for (let i = 1; i < s.length; i++) {
    if (s[i] === s[i - 1] + 1) {
      cur++;
      best = Math.max(best, cur);
    } else cur = 1;
  }
  return best;
}

export function computeMetrics(cfg: LotteryConfig, nums: number[], lastDraw?: number[] | null): GameMetrics {
  const even = nums.filter((n) => n % 2 === 0).length;
  const lastSet = lastDraw ? new Set(lastDraw) : null;
  return {
    even,
    odd: nums.length - even,
    sum: nums.reduce((a, b) => a + b, 0),
    repeated: lastSet ? nums.filter((n) => lastSet.has(n)).length : null,
    primes: nums.filter(isPrime).length,
    frame: nums.filter((n) => isFrame(cfg, n)).length,
    maxConsecutive: maxConsecutiveRun(nums),
  };
}

/** Faixa central da soma pela aproximação normal da soma sem reposição. */
export function sumRange(cfg: LotteryConfig, k = cfg.pick, z = cfg.filters.sumZ ?? 1.3): [number, number] {
  const N = cfg.totalNumbers;
  const mean = (k * (cfg.minNumber + cfg.maxNumber)) / 2;
  const popVar = (N * N - 1) / 12;
  const variance = (k * popVar * (N - k)) / (N - 1);
  const sd = Math.sqrt(variance);
  return [Math.round(mean - z * sd), Math.round(mean + z * sd)];
}

/** Escala um intervalo do filtro (definido para a aposta simples) para apostas maiores. */
function scaleRange(r: [number, number], factor: number, max: number): [number, number] {
  if (factor === 1) return r;
  return [Math.floor(r[0] * factor), Math.min(max, Math.ceil(r[1] * factor))];
}

export function evaluateFilters(
  cfg: LotteryConfig,
  nums: number[],
  filters: FilterConfig = cfg.filters,
  lastDraw?: number[] | null
): FilterCheck[] {
  const k = nums.length;
  const f = k / cfg.pick;
  const m = computeMetrics(cfg, nums, lastDraw);
  const checks: FilterCheck[] = [];
  const add = (key: FilterCheck["key"], label: string, value: number, r?: [number, number]) => {
    if (!r) return;
    checks.push({ key, label, value, range: r, pass: value >= r[0] && value <= r[1] });
  };
  add("even", "Pares", m.even, filters.even && scaleRange(filters.even, f, k));
  add("sum", "Soma", m.sum, filters.sum ? scaleRange(filters.sum, f, Infinity) : sumRange(cfg, k, filters.sumZ ?? 1.3));
  if (filters.maxConsecutive !== undefined)
    add("maxConsecutive", "Sequência máx.", m.maxConsecutive, [1, Math.ceil(filters.maxConsecutive * Math.max(1, f))]);
  if (m.repeated !== null) add("repeatLast", "Repetidas", m.repeated, filters.repeatLast && scaleRange(filters.repeatLast, f, k));
  add("primes", "Primos", m.primes, filters.primes && scaleRange(filters.primes, f, k));
  if (cfg.id === "lotofacil") add("frame", "Moldura", m.frame, filters.frame && scaleRange(filters.frame, f, k));

  if (filters.row || filters.col) {
    const rows = new Array(gridRows(cfg)).fill(0);
    const cols = new Array(cfg.gridCols).fill(0);
    for (const n of nums) {
      const p = gridPos(cfg, n);
      rows[p.row]++;
      cols[p.col]++;
    }
    if (filters.row) {
      const r = scaleRange(filters.row, f, cfg.gridCols);
      const bad = rows.filter((c) => c < r[0] || c > r[1]).length;
      checks.push({ key: "row", label: "Linhas", value: bad, range: r, pass: bad === 0 });
    }
    if (filters.col) {
      const r = scaleRange(filters.col, f, gridRows(cfg));
      const bad = cols.filter((c) => c < r[0] || c > r[1]).length;
      checks.push({ key: "col", label: "Colunas", value: bad, range: r, pass: bad === 0 });
    }
  }
  return checks;
}

export function passesFilters(checks: FilterCheck[]): boolean {
  return checks.every((c) => c.pass);
}

/* ------------------------------------------------------------------ */
/* Estatísticas de histórico                                           */
/* ------------------------------------------------------------------ */

export interface NumberStat {
  n: number;
  freqAll: number;
  freqRecent: number;
  delay: number;
}

export interface Stats {
  window: number;
  recentWindow: number;
  numbers: NumberStat[];
  hot: number[];
  late: number[];
  cycle: { missing: number[]; drawnInCycle: number[]; length: number; completedCycles: number };
  extraFreq: { n: number; freq: number }[];
  lastDraw?: Draw;
}

/** draws em qualquer ordem; internamente ordena do mais antigo para o mais recente. */
export function computeStats(cfg: LotteryConfig, draws: Draw[], recentWindow = 20): Stats {
  const asc = draws.slice().sort((a, b) => a.contest - b.contest);
  const nums = allNumbers(cfg);
  const freqAll = new Map<number, number>(nums.map((n) => [n, 0]));
  const freqRecent = new Map<number, number>(nums.map((n) => [n, 0]));
  const lastSeen = new Map<number, number>();
  asc.forEach((d, i) => {
    for (const n of d.numbers) {
      freqAll.set(n, (freqAll.get(n) ?? 0) + 1);
      if (i >= asc.length - recentWindow) freqRecent.set(n, (freqRecent.get(n) ?? 0) + 1);
      lastSeen.set(n, i);
    }
  });
  const numbers: NumberStat[] = nums.map((n) => ({
    n,
    freqAll: freqAll.get(n) ?? 0,
    freqRecent: freqRecent.get(n) ?? 0,
    delay: lastSeen.has(n) ? asc.length - 1 - (lastSeen.get(n) as number) : asc.length,
  }));

  // Ciclo das dezenas: um ciclo termina quando todas as dezenas saíram ao menos uma vez.
  let inCycle = new Set<number>();
  let cycleLen = 0;
  let completed = 0;
  for (const d of asc) {
    d.numbers.forEach((n) => inCycle.add(n));
    cycleLen++;
    if (inCycle.size === cfg.totalNumbers) {
      inCycle = new Set();
      cycleLen = 0;
      completed++;
    }
  }
  const third = Math.max(1, Math.round(cfg.totalNumbers / 3));
  const hot = numbers.slice().sort((a, b) => b.freqRecent - a.freqRecent || b.freqAll - a.freqAll).slice(0, third).map((s) => s.n);
  const late = numbers.slice().sort((a, b) => b.delay - a.delay).slice(0, third).map((s) => s.n);

  let extraFreq: { n: number; freq: number }[] = [];
  if (cfg.extra) {
    const ef = new Map<number, number>(range(1, cfg.extra.count).map((n) => [n, 0]));
    asc.slice(-Math.max(recentWindow * 3, 60)).forEach((d) => d.extras?.forEach((e) => ef.set(e, (ef.get(e) ?? 0) + 1)));
    extraFreq = [...ef.entries()].map(([n, freq]) => ({ n, freq }));
  }

  return {
    window: asc.length,
    recentWindow: Math.min(recentWindow, asc.length),
    numbers,
    hot,
    late,
    cycle: {
      missing: completed > 0 || asc.length > 0 ? nums.filter((n) => !inCycle.has(n)) : [],
      drawnInCycle: [...inCycle].sort(sortAsc),
      length: cycleLen,
      completedCycles: completed,
    },
    extraFreq,
    lastDraw: asc[asc.length - 1],
  };
}

/* ------------------------------------------------------------------ */
/* Pesos e amostragem ponderada                                        */
/* ------------------------------------------------------------------ */

export function numberWeights(cfg: LotteryConfig, stats: Stats | null, w: Weights, strategy: Strategy): Map<number, number> {
  const nums = allNumbers(cfg);
  const out = new Map<number, number>();
  if (!stats || stats.window === 0 || strategy === "surpresinha") {
    nums.forEach((n) => out.set(n, 1));
    return out;
  }
  const maxF = Math.max(1, ...stats.numbers.map((s) => s.freqRecent));
  const maxD = Math.max(1, ...stats.numbers.map((s) => s.delay));
  const hot = new Set(stats.hot);
  const late = new Set(stats.late);
  const missing = new Set(stats.cycle.missing);
  for (const s of stats.numbers) {
    let x = w.neutral;
    x += w.hot * (s.freqRecent / maxF) * (hot.has(s.n) ? 1.5 : 1);
    x += w.late * (s.delay / maxD) * (late.has(s.n) ? 1.5 : 1);
    if (missing.has(s.n)) x += w.cycle * (strategy === "ciclo" ? 3 : 0.8);
    out.set(s.n, Math.max(0.05, x));
  }
  return out;
}

function weightedSample(pool: number[], weights: Map<number, number>, k: number, rng: Rng): number[] {
  // Efraimidis-Spirakis: chave = u^(1/w), pega as k maiores
  const keyed = pool.map((n) => ({ n, key: Math.pow(rng(), 1 / (weights.get(n) ?? 1)) }));
  keyed.sort((a, b) => b.key - a.key);
  return keyed.slice(0, k).map((x) => x.n);
}

function pickExtras(cfg: LotteryConfig, count: number, stats: Stats | null, rng: Rng, strategy: Strategy): number[] | undefined {
  if (!cfg.extra) return undefined;
  const pool = range(1, cfg.extra.count);
  const w = new Map<number, number>();
  pool.forEach((n) => {
    const f = stats?.extraFreq.find((e) => e.n === n)?.freq ?? 0;
    w.set(n, strategy === "surpresinha" ? 1 : 1 + f);
  });
  return weightedSample(pool, w, Math.min(count, cfg.extra.count), rng).sort(sortAsc);
}

/* ------------------------------------------------------------------ */
/* Custos                                                              */
/* ------------------------------------------------------------------ */

export function betCost(cfg: LotteryConfig, numbersCount: number, extrasCount?: number): number {
  if (cfg.fixedPick) return cfg.basePrice;
  let combos = binomial(numbersCount, cfg.pick);
  if (cfg.extra?.kind === "trevos") combos *= binomial(extrasCount ?? cfg.extra.pick, cfg.extra.pick);
  return Math.round(combos * cfg.basePrice * 100) / 100;
}

/* ------------------------------------------------------------------ */
/* Geração                                                             */
/* ------------------------------------------------------------------ */

export interface GenerateParams {
  strategy: Strategy;
  count: number;
  /** dezenas fixas do usuário */
  fixed?: number[];
  /** dezenas a excluir */
  excluded?: number[];
  /** dezenas por volante (padrão: cfg.pick) */
  numbersPerGame?: number;
  /** trevos por volante (+Milionária) */
  extrasPerGame?: number;
  /** tamanho do grupo de fechamento */
  closureSize?: number;
  /** garantia de acertos do fechamento */
  guarantee?: number;
  filters?: FilterConfig;
  applyFilters?: boolean;
  stats?: Stats | null;
  weights?: Weights;
  seed?: number;
  /** Lotomania: adiciona a aposta espelho de cada jogo */
  mirror?: boolean;
  maxAttempts?: number;
}

export interface GenerationResult {
  games: Game[];
  attempts: number;
  rejected: number;
  relaxed: boolean;
  pool?: number[];
  closure?: Omit<CoveringResult, "tickets"> & { v: number; k: number; t: number; m: number };
  totalCost: number;
  warnings: string[];
}

function makeGame(cfg: LotteryConfig, nums: number[], extras: number[] | undefined, filters: FilterConfig, last?: number[] | null): Game {
  const numbers = nums.slice().sort(sortAsc);
  return {
    numbers,
    extras,
    metrics: computeMetrics(cfg, numbers, last),
    checks: evaluateFilters(cfg, numbers, filters, last),
    cost: betCost(cfg, numbers.length, extras?.length),
  };
}

export function mirrorGame(cfg: LotteryConfig, nums: number[]): number[] {
  const s = new Set(nums);
  return allNumbers(cfg).filter((n) => !s.has(n));
}

export function generateGames(cfg: LotteryConfig, p: GenerateParams): GenerationResult {
  const rng = createRng(p.seed);
  const filters = p.filters ?? cfg.filters;
  const weights = numberWeights(cfg, p.stats ?? null, p.weights ?? DEFAULT_WEIGHTS, p.strategy);
  const last = p.stats?.lastDraw?.numbers ?? null;
  const excluded = new Set(p.excluded ?? []);
  const fixed = [...new Set(p.fixed ?? [])].filter((n) => n >= cfg.minNumber && n <= cfg.maxNumber && !excluded.has(n));
  const warnings: string[] = [];
  const extrasPerGame = cfg.extra ? Math.max(cfg.extra.pick, Math.min(cfg.extra.maxPick, p.extrasPerGame ?? cfg.extra.pick)) : 0;

  if (p.strategy === "fechamento") {
    return generateClosure(cfg, p, { rng, filters, weights, last, excluded, fixed, warnings, extrasPerGame });
  }

  const k = cfg.fixedPick ? cfg.pick : Math.max(cfg.pick, Math.min(cfg.maxPick, p.numbersPerGame ?? cfg.pick));
  if (fixed.length > k) {
    warnings.push(`Você fixou ${fixed.length} dezenas, mas o volante tem ${k}. Usando as primeiras ${k}.`);
    fixed.length = k;
  }
  const pool = allNumbers(cfg).filter((n) => !excluded.has(n) && !fixed.includes(n));
  const forced = [...fixed];
  if (p.strategy === "ciclo" && p.stats) {
    // força até metade do volante com dezenas que faltam no ciclo
    const miss = p.stats.cycle.missing.filter((n) => pool.includes(n));
    const room = Math.max(0, Math.floor(k / 2) - forced.length);
    for (const n of shuffle(miss, rng).slice(0, room)) {
      forced.push(n);
      pool.splice(pool.indexOf(n), 1);
    }
  }

  const applyFilters = p.applyFilters !== false;
  const maxAttempts = p.maxAttempts ?? 60_000;
  const seen = new Set<string>();
  const games: Game[] = [];
  const backup: Game[] = [];
  let attempts = 0;
  let rejected = 0;
  const target = p.mirror && cfg.id === "lotomania" ? Math.ceil(p.count / 2) : p.count;

  while (games.length < target && attempts < maxAttempts) {
    attempts++;
    const chosen = [...forced, ...weightedSample(pool, weights, k - forced.length, rng)];
    const key = chosen.slice().sort(sortAsc).join("-");
    if (seen.has(key)) continue;
    const extras = pickExtras(cfg, extrasPerGame, p.stats ?? null, rng, p.strategy);
    const g = makeGame(cfg, chosen, extras, filters, last);
    if (!applyFilters || passesFilters(g.checks)) {
      seen.add(key);
      games.push(g);
    } else {
      rejected++;
      if (backup.length < target * 3) backup.push(g);
    }
  }

  let relaxed = false;
  if (games.length < target) {
    // relaxa: completa com os que falharam no menor número de filtros
    relaxed = true;
    backup.sort((a, b) => a.checks.filter((c) => !c.pass).length - b.checks.filter((c) => !c.pass).length);
    for (const g of backup) {
      if (games.length >= target) break;
      const key = g.numbers.join("-");
      if (!seen.has(key)) {
        seen.add(key);
        games.push(g);
      }
    }
    warnings.push("Filtros muito restritivos para as dezenas fixas: alguns jogos foram aceitos com filtros relaxados.");
  }

  if (p.mirror && cfg.id === "lotomania") {
    const withMirror: Game[] = [];
    for (const g of games) {
      withMirror.push(g);
      if (withMirror.length < p.count) withMirror.push(makeGame(cfg, mirrorGame(cfg, g.numbers), undefined, filters, last));
    }
    games.splice(0, games.length, ...withMirror);
  }

  return {
    games,
    attempts,
    rejected,
    relaxed,
    totalCost: round2(games.reduce((a, g) => a + g.cost, 0)),
    warnings,
  };
}

function generateClosure(
  cfg: LotteryConfig,
  p: GenerateParams,
  ctx: {
    rng: Rng;
    filters: FilterConfig;
    weights: Map<number, number>;
    last: number[] | null;
    excluded: Set<number>;
    fixed: number[];
    warnings: string[];
    extrasPerGame: number;
  }
): GenerationResult {
  if (!cfg.closureSizes.length) throw new Error(`${cfg.name} não suporta fechamento.`);
  const v = p.closureSize ?? cfg.closureSizes[0];
  const k = cfg.pick;
  const m = Math.min(cfg.drawSize, v);
  const t = Math.min(p.guarantee ?? cfg.closureGuarantees[cfg.closureGuarantees.length - 1], k, m);

  const fixed = ctx.fixed.slice(0, v);
  const rest = allNumbers(cfg).filter((n) => !ctx.excluded.has(n) && !fixed.includes(n));
  const pool = [...fixed, ...weightedSample(rest, ctx.weights, v - fixed.length, ctx.rng)].sort(sortAsc);

  const cov = buildCovering({ v, k, t, m, seed: p.seed });
  const extrasFor = (i: number) => {
    if (!cfg.extra) return undefined;
    // +Milionária: todos os volantes com os mesmos trevos (fechamento de trevos);
    // Dia de Sorte: alterna os meses mais frequentes para diversificar.
    if (cfg.extra.kind === "trevos") return pickedTrevos;
    const months = (p.stats?.extraFreq ?? range(1, 12).map((n) => ({ n, freq: 0 })))
      .slice()
      .sort((a, b) => b.freq - a.freq)
      .slice(0, 3)
      .map((e) => e.n);
    return [months[i % months.length]];
  };
  const pickedTrevos = cfg.extra?.kind === "trevos" ? pickExtras(cfg, ctx.extrasPerGame, p.stats ?? null, ctx.rng, p.strategy) : undefined;
  const games = cov.tickets.map((idx, i) => makeGame(cfg, idx.map((j) => pool[j]), extrasFor(i), ctx.filters, ctx.last));
  const fullCost = betCost(cfg, v, ctx.extrasPerGame || undefined);
  const totalCost = round2(games.reduce((a, g) => a + g.cost, 0));
  ctx.warnings.push(
    `Garantia de ${cov.guaranteed} acertos (verificada em ${cov.targets.toLocaleString("pt-BR")} cenários) SE as ${m} sorteadas estiverem entre as ${v} dezenas do grupo. ` +
      `Aposta única com ${v} dezenas custaria R$ ${fullCost.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}.`
  );
  const { tickets: _t, ...info } = cov;
  return {
    games,
    attempts: 1,
    rejected: 0,
    relaxed: false,
    pool,
    closure: { ...info, v, k, t, m },
    totalCost,
    warnings: ctx.warnings,
  };
}

/* ------------------------------------------------------------------ */
/* Conferência, prêmios e ROI                                          */
/* ------------------------------------------------------------------ */

export interface TierWin {
  tier: number;
  label: string;
  count: number;
  unitPrize: number | null;
}

export interface CheckResult {
  hits: number[];
  hitCount: number;
  extraHits: number[];
  wins: TierWin[];
  prize: number;
  /** true se algum prêmio ganho não tinha valor conhecido */
  prizeUnknown: boolean;
}

function unitPrizeFor(tierIndex: number, tier: PrizeTier, draw: Draw): number | null {
  const fromApi = draw.prizes?.find((p) => p.tier === tierIndex + 1);
  if (fromApi && fromApi.value > 0) return fromApi.value;
  if (tier.fixedPrize !== undefined) return tier.fixedPrize;
  if (fromApi) return 0;
  return null;
}

/**
 * Confere uma aposta (simples ou múltipla). Apostas múltiplas são desdobradas
 * combinatoriamente: uma aposta de n dezenas com h acertos contém
 * C(h,j)·C(n−h,k−j) jogos simples com exatamente j acertos.
 */
export function checkTicket(cfg: LotteryConfig, numbers: number[], extras: number[] | undefined, draw: Draw): CheckResult {
  const drawn = new Set(draw.numbers);
  const hits = numbers.filter((n) => drawn.has(n)).sort(sortAsc);
  const h = hits.length;
  const n = numbers.length;
  const k = cfg.fixedPick ? n : cfg.pick;
  const drawnExtras = new Set(draw.extras ?? []);
  const extraHits = (extras ?? []).filter((e) => drawnExtras.has(e));
  const wins: TierWin[] = [];

  const subGames = (j: number) => (cfg.fixedPick ? (h === j ? 1 : 0) : binomial(h, j) * binomial(n - h, k - j));

  cfg.tiers.forEach((tier, i) => {
    let count = 0;
    if (tier.month) {
      if (extras?.length && extraHits.length > 0) count = binomial(n, k);
    } else if (cfg.extra?.kind === "trevos" && tier.extraHits) {
      const T = extras?.length ?? cfg.extra.pick;
      const th = extraHits.length;
      const pairsWith = (tj: number) => binomial(th, tj) * binomial(T - th, cfg.extra!.pick - tj);
      const trevoCombos = tier.extraHits.reduce((a, tj) => a + pairsWith(tj), 0);
      count = subGames(tier.hits) * trevoCombos;
    } else {
      count = subGames(tier.hits);
    }
    if (count > 0) wins.push({ tier: i + 1, label: tier.label, count, unitPrize: unitPrizeFor(i, tier, draw) });
  });

  const prizeUnknown = wins.some((w) => w.unitPrize === null);
  const prize = round2(wins.reduce((a, w) => a + w.count * (w.unitPrize ?? 0), 0));
  return { hits, hitCount: h, extraHits, wins, prize, prizeUnknown };
}

export interface RoiSummary {
  invested: number;
  won: number;
  net: number;
  roi: number;
  tickets: number;
  winningTickets: number;
  bestHits: number;
  avgHits: number;
  expectedAvgHits: number;
}

export function roiSummary(cfg: LotteryConfig, items: { numbers: number[]; extras?: number[]; cost: number }[], draw: Draw): RoiSummary {
  const results = items.map((it) => checkTicket(cfg, it.numbers, it.extras, draw));
  const invested = round2(items.reduce((a, b) => a + b.cost, 0));
  const won = round2(results.reduce((a, r) => a + r.prize, 0));
  const avgK = items.length ? items.reduce((a, b) => a + b.numbers.length, 0) / items.length : cfg.pick;
  return {
    invested,
    won,
    net: round2(won - invested),
    roi: invested > 0 ? (won - invested) / invested : 0,
    tickets: items.length,
    winningTickets: results.filter((r) => r.wins.length > 0).length,
    bestHits: Math.max(0, ...results.map((r) => r.hitCount)),
    avgHits: results.length ? results.reduce((a, r) => a + r.hitCount, 0) / results.length : 0,
    expectedAvgHits: (avgK * cfg.drawSize) / cfg.totalNumbers,
  };
}

/* ------------------------------------------------------------------ */
/* Diagnóstico e retroalimentação de pesos                             */
/* ------------------------------------------------------------------ */

export interface Diagnosis {
  groups: { key: keyof Weights; label: string; observed: number; expected: number; ratio: number }[];
  drawChecks: FilterCheck[];
  filtersMatched: number;
  newWeights: Weights;
  notes: string[];
}

/**
 * Compara o resultado oficial com as estatísticas ANTERIORES ao concurso e
 * ajusta os pesos por média móvel exponencial (learning rate lr).
 */
export function diagnoseAndAdjust(cfg: LotteryConfig, statsBefore: Stats, draw: Draw, weights: Weights, lr = 0.25): Diagnosis {
  const drawn = draw.numbers;
  const N = cfg.totalNumbers;
  const groupDefs: { key: keyof Weights; label: string; set: number[] }[] = [
    { key: "hot", label: "Quentes", set: statsBefore.hot },
    { key: "late", label: "Atrasadas", set: statsBefore.late },
    { key: "cycle", label: "Faltantes do ciclo", set: statsBefore.cycle.missing },
  ];
  const groups = groupDefs.map((g) => {
    const s = new Set(g.set);
    const observed = drawn.filter((n) => s.has(n)).length;
    const expected = (cfg.drawSize * g.set.length) / N;
    return { key: g.key, label: g.label, observed, expected, ratio: expected > 0 ? observed / expected : 1 };
  });
  const clamp = (x: number) => Math.max(0.2, Math.min(3, x));
  const newWeights: Weights = { ...weights };
  for (const g of groups) {
    if (g.expected <= 0) continue;
    newWeights[g.key] = round2(clamp(weights[g.key] * (1 + lr * (g.ratio - 1))));
  }
  const drawChecks = evaluateFilters(cfg, drawn, cfg.filters, statsBefore.lastDraw?.numbers ?? null);
  const notes: string[] = [];
  groups.forEach((g) => {
    if (g.ratio > 1.3) notes.push(`${g.label} vieram acima do esperado (${g.observed} vs ${g.expected.toFixed(1)}): peso ↑`);
    else if (g.ratio < 0.7) notes.push(`${g.label} vieram abaixo do esperado (${g.observed} vs ${g.expected.toFixed(1)}): peso ↓`);
  });
  const failed = drawChecks.filter((c) => !c.pass);
  if (failed.length) notes.push(`O resultado oficial violou: ${failed.map((c) => c.label).join(", ")}. Considere afrouxar esses filtros.`);
  else notes.push("O resultado oficial passou em todos os filtros ativos.");
  notes.push("Lembrete: sorteios são independentes; os pesos organizam seu estilo de jogo, não preveem o próximo resultado.");
  return { groups, drawChecks, filtersMatched: drawChecks.length - failed.length, newWeights, notes };
}

/* ------------------------------------------------------------------ */
/* Formatação                                                          */
/* ------------------------------------------------------------------ */

export function round2(x: number) {
  return Math.round(x * 100) / 100;
}

export function fmtNum(n: number) {
  return String(n).padStart(2, "0");
}

export function formatGame(cfg: LotteryConfig, g: { numbers: number[]; extras?: number[] }): string {
  let s = g.numbers.map(fmtNum).join(" ");
  if (cfg.extra && g.extras?.length) {
    s +=
      cfg.extra.kind === "trevos"
        ? ` | Trevos: ${g.extras.join(" ")}`
        : ` | Mês: ${g.extras.map((m) => cfg.extra!.names?.[m - 1] ?? m).join(", ")}`;
  }
  return s;
}

export function brl(x: number) {
  return x.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
