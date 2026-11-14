import { describe, expect, it } from "vitest";
import { LOTTERIES } from "../lotteries";
import { normalizeDraw, validateDraw } from "../normalize";

describe("normalização das APIs", () => {
  it("formato loteriascaixa-api (Lotofácil)", () => {
    const d = normalizeDraw(LOTTERIES.lotofacil, {
      loteria: "lotofacil",
      concurso: 3200,
      data: "10/10/2024",
      dezenas: ["01", "02", "04", "05", "07", "09", "10", "12", "14", "16", "18", "20", "22", "24", "25"],
      premiacoes: [
        { descricao: "15 acertos", faixa: 1, ganhadores: 2, valorPremio: 850000.5 },
        { descricao: "14 acertos", faixa: 2, ganhadores: 300, valorPremio: 1800 },
      ],
      acumulou: false,
      proximoConcurso: 3201,
      dataProximoConcurso: "11/10/2024",
      valorEstimadoProximoConcurso: 1700000,
    })!;
    expect(d.contest).toBe(3200);
    expect(d.numbers).toHaveLength(15);
    expect(d.prizes![0]).toEqual({ tier: 1, label: "15 acertos", winners: 2, value: 850000.5 });
    expect(d.nextContest).toBe(3201);
    expect(validateDraw(LOTTERIES.lotofacil, d)).toBe(true);
  });

  it("formato API oficial CAIXA (Dia de Sorte com mês por nome)", () => {
    const d = normalizeDraw(LOTTERIES.diadesorte, {
      numero: 950,
      dataApuracao: "12/10/2024",
      listaDezenas: ["03", "08", "11", "17", "22", "27", "31"],
      nomeTimeCoracaoMesSorte: "Março",
      listaRateioPremio: [{ descricaoFaixa: "7 acertos", faixa: 1, numeroDeGanhadores: 0, valorPremio: 0 }],
      acumulado: true,
    })!;
    expect(d.contest).toBe(950);
    expect(d.extras).toEqual([3]);
    expect(d.accumulated).toBe(true);
  });

  it("+Milionária com trevos e Lotomania com 00", () => {
    const m = normalizeDraw(LOTTERIES.maismilionaria, { concurso: 190, dezenas: ["05", "12", "19", "33", "41", "50"], trevos: ["2", "6"] })!;
    expect(m.extras).toEqual([2, 6]);
    const l = normalizeDraw(LOTTERIES.lotomania, {
      concurso: 2700,
      dezenas: ["00", "04", "09", "13", "21", "28", "33", "39", "45", "50", "55", "61", "68", "72", "77", "80", "86", "91", "95", "99"],
    })!;
    expect(l.numbers[0]).toBe(0);
    expect(validateDraw(LOTTERIES.lotomania, l)).toBe(true);
  });

  it("rejeita payload inválido", () => {
    expect(normalizeDraw(LOTTERIES.megasena, { erro: "não encontrado" })).toBeNull();
    const bad = normalizeDraw(LOTTERIES.megasena, { concurso: 1, dezenas: ["01", "02", "03"] })!;
    expect(validateDraw(LOTTERIES.megasena, bad)).toBe(false);
  });

  it("valores monetários em texto pt-BR", () => {
    const d = normalizeDraw(LOTTERIES.quina, { concurso: 1, dezenas: ["1", "2", "3", "4", "5"], premiacoes: [{ faixa: 1, valorPremio: "R$ 1.234.567,89" }] })!;
    expect(d.prizes![0].value).toBeCloseTo(1234567.89, 2);
  });
});
