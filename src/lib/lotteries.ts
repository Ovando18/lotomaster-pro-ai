/**
 * Matrizes oficiais das modalidades CAIXA suportadas.
 * Preços de referência: reajuste CAIXA de julho/2025. Confirme no app oficial,
 * os valores podem mudar. Altere aqui se houver novo reajuste.
 */

export type LotteryId =
  | "lotofacil"
  | "megasena"
  | "quina"
  | "maismilionaria"
  | "lotomania"
  | "diadesorte";

export interface FilterConfig {
  /** quantidade de pares permitida [min, max] */
  even?: [number, number];
  /** soma permitida [min, max]; se ausente usa a faixa central da Gaussiana (sumZ) */
  sum?: [number, number];
  /** largura da faixa central da soma em desvios-padrão */
  sumZ?: number;
  /** maior sequência de números consecutivos permitida */
  maxConsecutive?: number;
  /** dezenas repetidas do concurso anterior [min, max] */
  repeatLast?: [number, number];
  /** números primos [min, max] */
  primes?: [number, number];
  /** dezenas na moldura do volante [min, max] (Lotofácil) */
  frame?: [number, number];
  /** dezenas por linha do volante [min, max] */
  row?: [number, number];
  /** dezenas por coluna do volante [min, max] */
  col?: [number, number];
}

export interface PrizeTier {
  label: string;
  hits: number;
  /** acertos de trevos aceitos nesta faixa (+Milionária) */
  extraHits?: number[];
  /** faixa do Mês de Sorte (Dia de Sorte) */
  month?: boolean;
  /** prêmio fixo de referência quando a API não traz rateio */
  fixedPrize?: number;
}

export interface ExtraConfig {
  kind: "trevos" | "mes";
  label: string;
  /** 1..count */
  count: number;
  /** quantidade mínima por aposta */
  pick: number;
  /** máximo permitido por aposta */
  maxPick: number;
  drawSize: number;
  names?: string[];
}

export interface LotteryConfig {
  id: LotteryId;
  name: string;
  short: string;
  /** cor principal (hex) para as bolinhas */
  color: string;
  minNumber: number;
  maxNumber: number;
  totalNumbers: number;
  /** dezenas da aposta simples */
  pick: number;
  /** máximo de dezenas por aposta permitido pela CAIXA */
  maxPick: number;
  /** dezenas sorteadas */
  drawSize: number;
  /** colunas no volante */
  gridCols: number;
  /** tamanhos de grupo suportados no fechamento */
  closureSizes: number[];
  /** garantias de fechamento oferecidas (acertos) */
  closureGuarantees: number[];
  basePrice: number;
  /** preço fixo (Lotomania: sempre 50 dezenas) */
  fixedPick?: boolean;
  extra?: ExtraConfig;
  tiers: PrizeTier[];
  filters: FilterConfig;
}

export const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

export const LOTTERIES: Record<LotteryId, LotteryConfig> = {
  lotofacil: {
    id: "lotofacil",
    name: "Lotofácil",
    short: "LF",
    color: "#a21caf",
    minNumber: 1,
    maxNumber: 25,
    totalNumbers: 25,
    pick: 15,
    maxPick: 20,
    drawSize: 15,
    gridCols: 5,
    closureSizes: [17, 18, 19, 20],
    closureGuarantees: [11, 12, 13, 14],
    basePrice: 3.5,
    tiers: [
      { label: "15 acertos", hits: 15 },
      { label: "14 acertos", hits: 14 },
      { label: "13 acertos", hits: 13, fixedPrize: 35 },
      { label: "12 acertos", hits: 12, fixedPrize: 14 },
      { label: "11 acertos", hits: 11, fixedPrize: 7 },
    ],
    filters: {
      even: [7, 8],
      sumZ: 1.3,
      maxConsecutive: 6,
      repeatLast: [8, 10],
      primes: [4, 7],
      frame: [8, 11],
      row: [1, 5],
      col: [1, 5],
    },
  },
  megasena: {
    id: "megasena",
    name: "Mega-Sena",
    short: "MS",
    color: "#16a34a",
    minNumber: 1,
    maxNumber: 60,
    totalNumbers: 60,
    pick: 6,
    maxPick: 20,
    drawSize: 6,
    gridCols: 10,
    closureSizes: [8, 9, 10, 12],
    closureGuarantees: [4, 5],
    basePrice: 6,
    tiers: [
      { label: "Sena", hits: 6 },
      { label: "Quina", hits: 5 },
      { label: "Quadra", hits: 4 },
    ],
    filters: {
      even: [2, 4],
      sumZ: 1.3,
      maxConsecutive: 2,
      repeatLast: [0, 1],
      primes: [0, 3],
      row: [0, 3],
      col: [0, 2],
    },
  },
  quina: {
    id: "quina",
    name: "Quina",
    short: "QN",
    color: "#2563eb",
    minNumber: 1,
    maxNumber: 80,
    totalNumbers: 80,
    pick: 5,
    maxPick: 15,
    drawSize: 5,
    gridCols: 10,
    closureSizes: [7, 8, 10],
    closureGuarantees: [3, 4],
    basePrice: 3,
    tiers: [
      { label: "Quina", hits: 5 },
      { label: "Quadra", hits: 4 },
      { label: "Terno", hits: 3 },
      { label: "Duque", hits: 2 },
    ],
    filters: {
      even: [1, 4],
      sumZ: 1.3,
      maxConsecutive: 2,
      repeatLast: [0, 1],
      primes: [0, 3],
      row: [0, 2],
      col: [0, 2],
    },
  },
  maismilionaria: {
    id: "maismilionaria",
    name: "+Milionária",
    short: "+M",
    color: "#ca8a04",
    minNumber: 1,
    maxNumber: 50,
    totalNumbers: 50,
    pick: 6,
    maxPick: 12,
    drawSize: 6,
    gridCols: 10,
    closureSizes: [8, 9, 10, 12],
    closureGuarantees: [4, 5],
    basePrice: 6,
    extra: { kind: "trevos", label: "Trevos", count: 6, pick: 2, maxPick: 6, drawSize: 2 },
    tiers: [
      { label: "6 + 2 trevos", hits: 6, extraHits: [2] },
      { label: "6 + 1/0 trevo", hits: 6, extraHits: [0, 1] },
      { label: "5 + 2 trevos", hits: 5, extraHits: [2] },
      { label: "5 + 1/0 trevo", hits: 5, extraHits: [0, 1] },
      { label: "4 + 2 trevos", hits: 4, extraHits: [2] },
      { label: "4 + 1/0 trevo", hits: 4, extraHits: [0, 1] },
      { label: "3 + 2 trevos", hits: 3, extraHits: [2] },
      { label: "3 + 1 trevo", hits: 3, extraHits: [1] },
      { label: "2 + 2 trevos", hits: 2, extraHits: [2] },
      { label: "2 + 1 trevo", hits: 2, extraHits: [1] },
    ],
    filters: {
      even: [2, 4],
      sumZ: 1.3,
      maxConsecutive: 2,
      repeatLast: [0, 1],
      primes: [0, 3],
      row: [0, 3],
      col: [0, 2],
    },
  },
  lotomania: {
    id: "lotomania",
    name: "Lotomania",
    short: "LM",
    color: "#ea580c",
    minNumber: 0,
    maxNumber: 99,
    totalNumbers: 100,
    pick: 50,
    maxPick: 50,
    drawSize: 20,
    gridCols: 10,
    closureSizes: [],
    closureGuarantees: [],
    basePrice: 3,
    fixedPick: true,
    tiers: [
      { label: "20 acertos", hits: 20 },
      { label: "19 acertos", hits: 19 },
      { label: "18 acertos", hits: 18 },
      { label: "17 acertos", hits: 17 },
      { label: "16 acertos", hits: 16 },
      { label: "15 acertos", hits: 15 },
      { label: "0 acertos", hits: 0 },
    ],
    filters: {
      even: [22, 28],
      sumZ: 1.3,
      maxConsecutive: 8,
      row: [2, 8],
      col: [2, 8],
    },
  },
  diadesorte: {
    id: "diadesorte",
    name: "Dia de Sorte",
    short: "DS",
    color: "#b45309",
    minNumber: 1,
    maxNumber: 31,
    totalNumbers: 31,
    pick: 7,
    maxPick: 15,
    drawSize: 7,
    gridCols: 7,
    closureSizes: [9, 10, 12],
    closureGuarantees: [5, 6],
    basePrice: 2.5,
    extra: { kind: "mes", label: "Mês de Sorte", count: 12, pick: 1, maxPick: 1, drawSize: 1, names: MONTHS },
    tiers: [
      { label: "7 acertos", hits: 7 },
      { label: "6 acertos", hits: 6 },
      { label: "5 acertos", hits: 5 },
      { label: "4 acertos", hits: 4 },
      { label: "Mês de Sorte", hits: -1, month: true },
    ],
    filters: {
      even: [2, 5],
      sumZ: 1.3,
      maxConsecutive: 3,
      repeatLast: [0, 2],
      primes: [1, 4],
      row: [0, 4],
      col: [0, 3],
    },
  },
};

export const LOTTERY_LIST = Object.values(LOTTERIES);

export function getLottery(id: string): LotteryConfig {
  const cfg = LOTTERIES[id as LotteryId];
  if (!cfg) throw new Error(`Modalidade desconhecida: ${id}`);
  return cfg;
}

export function formatNumber(cfg: LotteryConfig, n: number): string {
  return String(n).padStart(2, "0");
}
