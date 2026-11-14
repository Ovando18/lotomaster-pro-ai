import { describe, expect, it } from "vitest";
import {
  LOTTERIES,
  binomial,
  hypergeometric,
  enumerateMasks,
  buildCovering,
  verifyCovering,
  evaluateFilters,
  passesFilters,
  sumRange,
  maxConsecutiveRun,
  computeMetrics,
  generateGames,
  checkTicket,
  computeStats,
  diagnoseAndAdjust,
  betCost,
  mirrorGame,
  roiSummary,
  createRng,
  DEFAULT_WEIGHTS,
  type Draw,
  type LotteryConfig,
} from "../lotteryEngine";

const LF = LOTTERIES.lotofacil;
const MS = LOTTERIES.megasena;
const QN = LOTTERIES.quina;
const MM = LOTTERIES.maismilionaria;
const LM = LOTTERIES.lotomania;
const DS = LOTTERIES.diadesorte;

/** histórico sintético reprodutível */
function fakeHistory(cfg: LotteryConfig, n: number, seed = 7): Draw[] {
  const rng = createRng(seed);
  const out: Draw[] = [];
  for (let c = 1; c <= n; c++) {
    const pool = Array.from({ length: cfg.totalNumbers }, (_, i) => i + cfg.minNumber);
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    const extras = cfg.extra ? [1 + Math.floor(rng() * cfg.extra.count)] : undefined;
    if (cfg.extra?.kind === "trevos") extras!.push(((extras![0] % 6) + 1));
    out.push({ contest: c, date: "", numbers: pool.slice(0, cfg.drawSize).sort((a, b) => a - b), extras });
  }
  return out;
}

describe("combinatória", () => {
  it("binomial", () => {
    expect(binomial(25, 15)).toBe(3268760);
    expect(binomial(60, 6)).toBe(50063860);
    expect(binomial(80, 5)).toBe(24040016);
    expect(binomial(5, 7)).toBe(0);
  });
  it("hipergeométrica soma 1 e bate com a odds oficial da Mega", () => {
    let s = 0;
    for (let j = 0; j <= 6; j++) s += hypergeometric(60, 6, 6, j);
    expect(s).toBeCloseTo(1, 10);
    expect(1 / hypergeometric(60, 6, 6, 6)).toBeCloseTo(50063860, 0);
  });
  it("enumerateMasks gera C(v,k) máscaras únicas com k bits", () => {
    const m = enumerateMasks(10, 4);
    expect(m.length).toBe(210);
    expect(new Set(m).size).toBe(210);
  });
});

describe("fechamentos (covering designs) com verificação exaustiva", () => {
  const cases: [string, number, number, number, number][] = [
    ["Lotofácil 17 dezenas, garante 14", 17, 15, 14, 15],
    ["Lotofácil 18 dezenas, garante 14", 18, 15, 14, 15],
    ["Lotofácil 18 dezenas, garante 13", 18, 15, 13, 15],
    ["Lotofácil 20 dezenas, garante 13", 20, 15, 13, 15],
    ["Mega 8 dezenas, garante quina", 8, 6, 5, 6],
    ["Mega 10 dezenas, garante quadra", 10, 6, 4, 6],
    ["Mega 12 dezenas, garante quadra", 12, 6, 4, 6],
    ["Quina 10 dezenas, garante quadra", 10, 5, 4, 5],
    ["Quina 8 dezenas, garante terno", 8, 5, 3, 5],
    ["Dia de Sorte 10 dezenas, garante 6", 10, 7, 6, 7],
  ];
  for (const [name, v, k, t, m] of cases) {
    it(name, () => {
      const r = buildCovering({ v, k, t, m, seed: 1 });
      expect(r.verified).toBe(true);
      expect(r.guaranteed).toBeGreaterThanOrEqual(t);
      // todos os volantes têm k dezenas distintas dentro do grupo
      for (const tk of r.tickets) {
        expect(tk.length).toBe(k);
        expect(new Set(tk).size).toBe(k);
        expect(Math.max(...tk)).toBeLessThan(v);
      }
      // reduz drasticamente versus jogar todas as combinações
      expect(r.tickets.length).toBeLessThan(r.totalCombos);
      expect(verifyCovering(r.tickets, v, m).guaranteed).toBeGreaterThanOrEqual(t);
    });
  }

  it("Lotofácil 18→14 reduz ao menos 90% das 816 combinações", () => {
    const r = buildCovering({ v: 18, k: 15, t: 14, m: 15, seed: 3 });
    expect(r.totalCombos).toBe(816);
    expect(r.reduction).toBeGreaterThan(0.9);
  });

  it("Lotofácil 20→14 (15.504 cenários) termina em tempo aceitável", () => {
    const r = buildCovering({ v: 20, k: 15, t: 14, m: 15, seed: 5 });
    expect(r.verified).toBe(true);
    expect(r.ms).toBeLessThan(20_000);
  });

  it("verifyCovering detecta quando a garantia NÃO vale", () => {
    // um único volante de 15 em grupo de 18: pior caso = 12 acertos
    const one = [Array.from({ length: 15 }, (_, i) => i)];
    expect(verifyCovering(one, 18, 15).guaranteed).toBe(12);
  });

  it("rejeita parâmetros inválidos", () => {
    expect(() => buildCovering({ v: 10, k: 6, t: 7, m: 6 })).toThrow();
  });
});

describe("filtros estatísticos", () => {
  it("faixa central da soma da Lotofácil ≈ 195 ± 1.3σ", () => {
    const [lo, hi] = sumRange(LF);
    expect(lo).toBeGreaterThan(165);
    expect(hi).toBeLessThan(225);
    expect((lo + hi) / 2).toBeCloseTo(195, 0);
  });
  it("sequência consecutiva", () => {
    expect(maxConsecutiveRun([1, 2, 3, 4, 5, 9])).toBe(5);
    expect(maxConsecutiveRun([10, 20, 30])).toBe(1);
  });
  it("Mega 01-02-03-04-05-06 é eliminado", () => {
    const checks = evaluateFilters(MS, [1, 2, 3, 4, 5, 6]);
    expect(passesFilters(checks)).toBe(false);
    expect(checks.find((c) => c.key === "maxConsecutive")!.pass).toBe(false);
    expect(checks.find((c) => c.key === "sum")!.pass).toBe(false);
  });
  it("Mega equilibrado passa", () => {
    const checks = evaluateFilters(MS, [5, 18, 27, 34, 43, 56]);
    expect(checks.filter((c) => !c.pass).map((c) => c.label)).toEqual([]);
  });
  it("Lotofácil: repetidas do último concurso entre 8 e 10", () => {
    const last = [1, 2, 3, 5, 6, 8, 10, 11, 13, 15, 18, 20, 22, 24, 25];
    const game = [1, 2, 3, 5, 6, 8, 10, 11, 14, 16, 17, 19, 21, 23, 4];
    const m = computeMetrics(LF, game, last);
    expect(m.repeated).toBe(8);
    const c = evaluateFilters(LF, game, LF.filters, last).find((x) => x.key === "repeatLast")!;
    expect(c.pass).toBe(true);
  });
  it("Lotofácil: moldura conta as 16 dezenas da borda", () => {
    const frame = [1, 2, 3, 4, 5, 6, 10, 11, 15, 16, 20, 21, 22, 23, 24, 25];
    expect(computeMetrics(LF, frame).frame).toBe(16);
    expect(computeMetrics(LF, [7, 8, 9, 12, 13, 14, 17, 18, 19]).frame).toBe(0);
  });
});

describe("geração de jogos", () => {
  const history = fakeHistory(LF, 120);
  const stats = computeStats(LF, history);

  for (const strategy of ["equilibrado", "surpresinha", "ciclo"] as const) {
    it(`Lotofácil ${strategy}: 10 jogos únicos que passam nos filtros`, () => {
      const r = generateGames(LF, { strategy, count: 10, stats, seed: 42 });
      expect(r.games).toHaveLength(10);
      expect(new Set(r.games.map((g) => g.numbers.join())).size).toBe(10);
      for (const g of r.games) {
        expect(g.numbers).toHaveLength(15);
        if (!r.relaxed) expect(passesFilters(g.checks)).toBe(true);
        expect(g.cost).toBe(3.5);
      }
    });
  }

  it("Manual + IA mantém as dezenas fixas", () => {
    const fixed = [1, 7, 13, 25];
    const r = generateGames(LF, { strategy: "manual", count: 5, fixed, stats, seed: 9 });
    for (const g of r.games) for (const f of fixed) expect(g.numbers).toContain(f);
  });

  it("Fechamento Lotofácil 18 dezenas mantém fixas no grupo e garante 14", () => {
    const r = generateGames(LF, { strategy: "fechamento", count: 0, closureSize: 18, guarantee: 14, fixed: [3, 9], stats, seed: 11 });
    expect(r.pool).toHaveLength(18);
    expect(r.pool).toContain(3);
    expect(r.closure!.verified).toBe(true);
    // todas as dezenas dos volantes pertencem ao grupo
    for (const g of r.games) for (const n of g.numbers) expect(r.pool).toContain(n);
  });

  it("Mega-Sena com 8 dezenas por volante custa C(8,6)·R$6", () => {
    const r = generateGames(MS, { strategy: "surpresinha", count: 3, numbersPerGame: 8, seed: 1 });
    expect(r.games[0].numbers).toHaveLength(8);
    expect(r.games[0].cost).toBe(binomial(8, 6) * 6);
  });

  it("+Milionária: trevos por volante e custo com trevos extras", () => {
    const r = generateGames(MM, { strategy: "surpresinha", count: 4, extrasPerGame: 3, seed: 2 });
    for (const g of r.games) {
      expect(g.extras).toHaveLength(3);
      g.extras!.forEach((t) => expect(t).toBeGreaterThanOrEqual(1));
    }
    expect(betCost(MM, 6, 3)).toBe(18);
  });

  it("Lotomania: aposta espelho é o complemento exato", () => {
    const r = generateGames(LM, { strategy: "surpresinha", count: 4, mirror: true, seed: 3 });
    expect(r.games).toHaveLength(4);
    const [a, b] = r.games;
    expect(a.numbers).toHaveLength(50);
    expect(b.numbers).toEqual(mirrorGame(LM, a.numbers));
    expect(new Set([...a.numbers, ...b.numbers]).size).toBe(100);
    expect(a.numbers[0]).toBeGreaterThanOrEqual(0);
  });

  it("Dia de Sorte gera mês entre 1 e 12", () => {
    const r = generateGames(DS, { strategy: "equilibrado", count: 5, stats: computeStats(DS, fakeHistory(DS, 80)), seed: 4 });
    for (const g of r.games) {
      expect(g.extras).toHaveLength(1);
      expect(g.extras![0]).toBeGreaterThanOrEqual(1);
      expect(g.extras![0]).toBeLessThanOrEqual(12);
    }
  });

  it("Quina fechamento 10 dezenas garante quadra", () => {
    const r = generateGames(QN, { strategy: "fechamento", count: 0, closureSize: 10, guarantee: 4, seed: 5 });
    expect(r.closure!.guaranteed).toBeGreaterThanOrEqual(4);
  });
});

describe("estatísticas", () => {
  it("atraso e ciclo", () => {
    const draws: Draw[] = [
      { contest: 1, date: "", numbers: [1, 2, 3, 4, 5, 6] },
      { contest: 2, date: "", numbers: [7, 8, 9, 10, 11, 12] },
    ];
    const s = computeStats(MS, draws);
    expect(s.numbers.find((x) => x.n === 1)!.delay).toBe(1);
    expect(s.numbers.find((x) => x.n === 7)!.delay).toBe(0);
    expect(s.numbers.find((x) => x.n === 60)!.delay).toBe(2);
    expect(s.cycle.missing).toHaveLength(48);
    expect(s.lastDraw!.contest).toBe(2);
  });
  it("ciclo fecha quando todas as dezenas saem", () => {
    const s = computeStats(LF, fakeHistory(LF, 60));
    expect(s.cycle.completedCycles).toBeGreaterThan(5);
  });
});

describe("conferência e ROI", () => {
  const draw: Draw = {
    contest: 3000,
    date: "",
    numbers: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
    prizes: [
      { tier: 1, label: "15", winners: 1, value: 1_500_000 },
      { tier: 2, label: "14", winners: 200, value: 1500 },
      { tier: 3, label: "13", winners: 5000, value: 35 },
      { tier: 4, label: "12", winners: 1, value: 14 },
      { tier: 5, label: "11", winners: 1, value: 7 },
    ],
  };
  it("aposta simples com 13 acertos", () => {
    const r = checkTicket(LF, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 20, 21], undefined, draw);
    expect(r.hitCount).toBe(13);
    expect(r.wins).toEqual([{ tier: 3, label: "13 acertos", count: 1, unitPrize: 35 }]);
    expect(r.prize).toBe(35);
  });
  it("aposta de 18 dezenas com 15 acertos é desdobrada nas 816 combinações", () => {
    const r = checkTicket(LF, [...draw.numbers, 20, 21, 22], undefined, draw);
    const byHits = Object.fromEntries(r.wins.map((w) => [w.label, w.count]));
    expect(byHits["15 acertos"]).toBe(1);
    expect(byHits["14 acertos"]).toBe(45);
    expect(byHits["13 acertos"]).toBe(315);
    expect(byHits["12 acertos"]).toBe(455);
    expect(r.prize).toBe(1_500_000 + 45 * 1500 + 315 * 35 + 455 * 14);
  });
  it("+Milionária: 3 trevos com os 2 sorteados", () => {
    const d: Draw = { contest: 1, date: "", numbers: [1, 2, 3, 4, 5, 6], extras: [1, 2] };
    const r = checkTicket(MM, [1, 2, 3, 4, 40, 41], [1, 2, 3], d);
    // 4 acertos: 1 par com 2 trevos (faixa 4+2) e 2 pares com 1 trevo (faixa 4+1/0)
    expect(r.wins.find((w) => w.label === "4 + 2 trevos")!.count).toBe(1);
    expect(r.wins.find((w) => w.label === "4 + 1/0 trevo")!.count).toBe(2);
  });
  it("Lotomania: 0 acertos é premiado", () => {
    const d: Draw = { contest: 1, date: "", numbers: Array.from({ length: 20 }, (_, i) => i) };
    const r = checkTicket(LM, Array.from({ length: 50 }, (_, i) => i + 50), undefined, d);
    expect(r.wins[0].label).toBe("0 acertos");
  });
  it("Dia de Sorte: Mês de Sorte", () => {
    const d: Draw = { contest: 1, date: "", numbers: [1, 2, 3, 4, 5, 6, 7], extras: [5] };
    const r = checkTicket(DS, [10, 11, 12, 13, 14, 15, 16], [5], d);
    expect(r.wins.map((w) => w.label)).toEqual(["Mês de Sorte"]);
  });
  it("ROI", () => {
    const s = roiSummary(LF, [
      { numbers: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 20, 21], cost: 3.5 },
      { numbers: [16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 1, 2, 3, 4, 5], cost: 3.5 },
    ], draw);
    expect(s.invested).toBe(7);
    expect(s.won).toBe(35);
    expect(s.roi).toBeCloseTo(4, 5);
    expect(s.winningTickets).toBe(1);
  });
});

describe("retroalimentação", () => {
  it("aumenta peso de grupo que veio acima do esperado", () => {
    const history = fakeHistory(LF, 50);
    const st = computeStats(LF, history);
    const draw: Draw = { contest: 51, date: "", numbers: st.hot.slice(0, 8).concat(st.late.filter((n) => !st.hot.includes(n)).slice(0, 7)) };
    const d = diagnoseAndAdjust(LF, st, draw, DEFAULT_WEIGHTS);
    const hot = d.groups.find((g) => g.key === "hot")!;
    expect(hot.observed).toBeGreaterThanOrEqual(8);
    expect(d.newWeights.hot).toBeGreaterThan(1);
    expect(d.notes.length).toBeGreaterThan(0);
  });
});
