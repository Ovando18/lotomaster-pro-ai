"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCheck, Copy, FileDown, FileText, Loader2, MessageCircle, Sheet, ShieldCheck, Sparkles, Trash2 } from "lucide-react";
import {
  STRATEGIES,
  binomial,
  brl,
  formatGame,
  generateGames,
  type GenerationResult,
  type LotteryConfig,
  type Stats,
  type Strategy,
} from "@/lib/lotteryEngine";
import { useStore } from "@/lib/store";
import { copyText, exportCsv, exportPdf, exportTxt, whatsappUrl } from "@/lib/export";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Input, Label, Select, Switch } from "./ui/field";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { NumberGrid, type CellState } from "./number-grid";
import { GameCard } from "./game-card";
import { useToast } from "./toast";

export interface GeneratorOutput {
  result: GenerationResult;
  contest: number;
  strategy: Strategy;
  saved: Set<number>;
}

export function GeneratorPanel({
  cfg,
  stats,
  nextContest,
  output,
  setOutput,
}: {
  cfg: LotteryConfig;
  stats: Stats | null;
  nextContest?: number;
  output: GeneratorOutput | null;
  setOutput: (o: GeneratorOutput | null) => void;
}) {
  const { state, addBets, getWeights } = useStore();
  const toast = useToast();
  const hasClosure = cfg.closureSizes.length > 0;
  const strategies = STRATEGIES.filter((s) => s.id !== "fechamento" || hasClosure).map((s) =>
    s.id === "ciclo" && cfg.id !== "lotofacil" ? { ...s, label: "Tática Ciclo das Dezenas" } : s
  );

  const [contest, setContest] = useState<number | "">(nextContest ?? "");
  const [count, setCount] = useState(cfg.id === "lotomania" ? 4 : 10);
  const [strategy, setStrategy] = useState<Strategy>("equilibrado");
  const [perGame, setPerGame] = useState(cfg.pick);
  const [extrasPerGame, setExtrasPerGame] = useState(cfg.extra?.pick ?? 0);
  const [closureSize, setClosureSize] = useState(cfg.closureSizes[1] ?? cfg.closureSizes[0] ?? 0);
  const [guarantee, setGuarantee] = useState(cfg.closureGuarantees[cfg.closureGuarantees.length - 1] ?? 0);
  const [cells, setCells] = useState<Record<number, CellState>>({});
  const [applyFilters, setApplyFilters] = useState(true);
  const [mirror, setMirror] = useState(cfg.id === "lotomania");
  const [busy, setBusy] = useState(false);
  const resultsRef = useRef<HTMLDivElement>(null);

  // troca de modalidade: reseta campos dependentes
  useEffect(() => {
    setPerGame(cfg.pick);
    setExtrasPerGame(cfg.extra?.pick ?? 0);
    setClosureSize(cfg.closureSizes[1] ?? cfg.closureSizes[0] ?? 0);
    setGuarantee(cfg.closureGuarantees[cfg.closureGuarantees.length - 1] ?? 0);
    setCells({});
    setMirror(cfg.id === "lotomania");
    setCount(cfg.id === "lotomania" ? 4 : 10);
    if (!cfg.closureSizes.length) setStrategy((s) => (s === "fechamento" ? "equilibrado" : s));
  }, [cfg]);

  useEffect(() => {
    if (nextContest) setContest(nextContest);
  }, [nextContest]);

  const fixed = Object.entries(cells).filter(([, s]) => s === "fixed").map(([n]) => +n);
  const excluded = Object.entries(cells).filter(([, s]) => s === "excluded").map(([n]) => +n);
  const [pickMode, setPickMode] = useState<"fixed" | "excluded">("fixed");

  const toggle = (n: number) =>
    setCells((c) => {
      const next = { ...c };
      if (next[n] === pickMode) delete next[n];
      else next[n] = pickMode;
      return next;
    });

  const isClosure = strategy === "fechamento";
  const filters = state.filters[cfg.id] ?? cfg.filters;

  const estimate = useMemo(() => {
    if (isClosure) return `C(${closureSize},${cfg.pick}) = ${binomial(closureSize, cfg.pick).toLocaleString("pt-BR")} combinações no grupo`;
    return null;
  }, [isClosure, closureSize, cfg.pick]);

  const run = () => {
    setBusy(true);
    // deixa o spinner renderizar antes do cálculo pesado
    setTimeout(() => {
      try {
        const result = generateGames(cfg, {
          strategy,
          count,
          fixed,
          excluded,
          numbersPerGame: perGame,
          extrasPerGame,
          closureSize,
          guarantee,
          filters,
          applyFilters,
          stats,
          weights: getWeights(cfg.id),
          mirror,
        });
        setOutput({ result, contest: Number(contest) || 0, strategy, saved: new Set() });
        if (result.games.length === 0) toast("Nenhum jogo gerado: afrouxe os filtros", "error");
        // no celular os resultados ficam abaixo do formulário: rola até eles
        if (window.innerWidth < 1024) setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
      } catch (e) {
        toast((e as Error).message, "error");
      } finally {
        setBusy(false);
      }
    }, 30);
  };

  const saveGames = (idx: number[]) => {
    if (!output) return;
    if (!output.contest) {
      toast("Informe o número do concurso alvo", "error");
      return;
    }
    const strategyLabel = STRATEGIES.find((s) => s.id === output.strategy)?.label;
    addBets(
      idx.map((i) => {
        const g = output.result.games[i];
        return { lottery: cfg.id, contest: output.contest, numbers: g.numbers, extras: g.extras, cost: g.cost, strategy: strategyLabel };
      })
    );
    setOutput({ ...output, saved: new Set([...output.saved, ...idx]) });
    toast(`${idx.length} jogo(s) salvos em Minhas Apostas`);
  };

  const games = output?.result.games ?? [];
  const pending = games.map((_, i) => i).filter((i) => !output?.saved.has(i));
  const sizeOptions = cfg.fixedPick ? [cfg.pick] : Array.from({ length: Math.min(cfg.maxPick, cfg.pick + 6) - cfg.pick + 1 }, (_, i) => cfg.pick + i);

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(340px,420px)_1fr] lg:items-start">
      <Card className="lg:sticky lg:top-4">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-emerald-400" /> Gerador {cfg.name}
          </CardTitle>
          <CardDescription>{STRATEGIES.find((s) => s.id === strategy)?.hint}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Concurso alvo</Label>
              <Input inputMode="numeric" value={contest} onChange={(e) => setContest(e.target.value ? Number(e.target.value.replace(/\D/g, "")) : "")} placeholder="ex: 3500" />
            </div>
            <div>
              <Label hint={isClosure ? "automático" : undefined}>Qtd. jogos</Label>
              <Input
                inputMode="numeric"
                type="number"
                min={1}
                max={200}
                disabled={isClosure}
                value={isClosure ? "" : count}
                placeholder={isClosure ? "pela garantia" : ""}
                onChange={(e) => setCount(Math.max(1, Math.min(200, Number(e.target.value) || 1)))}
              />
            </div>
          </div>

          <div>
            <Label>Estratégia</Label>
            <Select value={strategy} onChange={(e) => setStrategy(e.target.value as Strategy)}>
              {strategies.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </Select>
          </div>

          {isClosure ? (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Grupo de dezenas</Label>
                <Select value={closureSize} onChange={(e) => setClosureSize(Number(e.target.value))}>
                  {cfg.closureSizes.map((s) => (
                    <option key={s} value={s}>
                      {s} dezenas
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label>Garantia</Label>
                <Select value={guarantee} onChange={(e) => setGuarantee(Number(e.target.value))}>
                  {cfg.closureGuarantees.map((g) => (
                    <option key={g} value={g}>
                      {g} acertos
                    </option>
                  ))}
                </Select>
              </div>
              <p className="col-span-2 text-xs text-slate-400">
                {estimate}. Garantia válida se as {cfg.drawSize} sorteadas estiverem dentro do grupo.
                {cfg.id === "lotofacil" && closureSize === 20 && guarantee === 14 && " ⚠️ Gera ~500 jogos."}
              </p>
            </div>
          ) : (
            !cfg.fixedPick && (
              <div>
                <Label hint={perGame > cfg.pick ? `${binomial(perGame, cfg.pick)} apostas simples` : undefined}>Dezenas por volante</Label>
                <Select value={perGame} onChange={(e) => setPerGame(Number(e.target.value))}>
                  {sizeOptions.map((s) => (
                    <option key={s} value={s}>
                      {s} dezenas
                    </option>
                  ))}
                </Select>
              </div>
            )
          )}

          {cfg.extra?.kind === "trevos" && (
            <div>
              <Label hint={`${binomial(extrasPerGame, 2)} pares de trevos`}>Trevos por volante (fechamento de trevos)</Label>
              <Select value={extrasPerGame} onChange={(e) => setExtrasPerGame(Number(e.target.value))}>
                {[2, 3, 4, 5, 6].map((t) => (
                  <option key={t} value={t}>
                    {t} trevos
                  </option>
                ))}
              </Select>
            </div>
          )}

          {(strategy === "manual" || isClosure || fixed.length > 0 || excluded.length > 0) && (
            <div>
              <div className="mb-2 flex items-center justify-between gap-2">
                <Label className="mb-0">
                  Volante: {fixed.length} fixas · {excluded.length} excluídas
                </Label>
                <div className="flex rounded-lg border border-slate-700 p-0.5 text-xs">
                  {(["fixed", "excluded"] as const).map((m) => (
                    <button
                      key={m}
                      onClick={() => setPickMode(m)}
                      className={`rounded-md px-2.5 py-1.5 font-semibold ${pickMode === m ? (m === "fixed" ? "bg-emerald-500 text-emerald-950" : "bg-rose-500 text-white") : "text-slate-400"}`}
                    >
                      {m === "fixed" ? "Fixar" : "Excluir"}
                    </button>
                  ))}
                </div>
              </div>
              <NumberGrid cfg={cfg} states={cells} onToggle={toggle} compact={cfg.totalNumbers > 60} />
              {Object.keys(cells).length > 0 && (
                <button className="mt-2 flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200" onClick={() => setCells({})}>
                  <Trash2 className="h-3 w-3" /> limpar volante
                </button>
              )}
            </div>
          )}
          {strategy !== "manual" && !isClosure && fixed.length === 0 && excluded.length === 0 && (
            <button className="text-xs font-semibold text-emerald-400" onClick={() => setStrategy("manual")}>
              + Fixar minhas dezenas da sorte
            </button>
          )}

          <div className="space-y-2">
            {!isClosure && <Switch checked={applyFilters} onChange={setApplyFilters} label="Aplicar filtros estatísticos (quality gates)" />}
            {cfg.id === "lotomania" && <Switch checked={mirror} onChange={setMirror} label="Gerar Aposta Espelho (complemento)" />}
          </div>

          <Button size="lg" className="hidden w-full lg:flex" onClick={run} disabled={busy}>
            {busy ? <Loader2 className="animate-spin" /> : <Sparkles />} Gerar jogos
          </Button>
        </CardContent>
      </Card>

      {/* Barra de ação fixa no polegar (mobile) */}
      <div className="fixed inset-x-0 bottom-[68px] z-30 border-t border-slate-800 bg-slate-950/95 px-4 py-2.5 backdrop-blur lg:hidden">
        <Button size="lg" className="w-full" onClick={run} disabled={busy}>
          {busy ? <Loader2 className="animate-spin" /> : <Sparkles />} Gerar jogos
        </Button>
      </div>

      <div ref={resultsRef} className="scroll-mt-32 space-y-4">
        {!output && (
          <Card className="border-dashed">
            <CardContent className="py-12 text-center text-slate-400">
              <Sparkles className="mx-auto mb-3 h-10 w-10 text-emerald-500/60" />
              Configure e toque em <b className="text-slate-200">Gerar jogos</b>.
              {!stats && <p className="mt-2 text-xs">Sem histórico carregado: estratégias ponderadas usarão pesos uniformes.</p>}
            </CardContent>
          </Card>
        )}

        {output && (
          <>
            <Card>
              <CardContent className="space-y-3 pt-4 sm:pt-5">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="success">{games.length} jogos</Badge>
                  <Badge>Total {brl(output.result.totalCost)}</Badge>
                  {output.contest > 0 && <Badge>Concurso {output.contest}</Badge>}
                  {output.result.rejected > 0 && <Badge variant="warning">{output.result.rejected.toLocaleString("pt-BR")} descartados pelos filtros</Badge>}
                  {output.result.closure && (
                    <Badge variant={output.result.closure.verified ? "success" : "danger"}>
                      <ShieldCheck className="h-3 w-3" /> Garantia {output.result.closure.guaranteed} pts verificada · −{Math.round(output.result.closure.reduction * 100)}% volantes
                    </Badge>
                  )}
                </div>
                {output.result.pool && (
                  <div>
                    <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">Grupo do fechamento</p>
                    <p className="font-mono text-base font-bold tracking-wide text-slate-100">{output.result.pool.map((n) => String(n).padStart(2, "0")).join(" ")}</p>
                  </div>
                )}
                {output.result.warnings.map((w, i) => (
                  <p key={i} className="rounded-lg bg-slate-950/60 p-2.5 text-xs text-slate-400">
                    {w}
                  </p>
                ))}
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
                  <Button size="sm" onClick={() => saveGames(pending)} disabled={!pending.length}>
                    <CheckCheck /> Apostar todos
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={async () => {
                      await copyText(games.map((g, i) => `${String(i + 1).padStart(2, "0")}) ${formatGame(cfg, g)}`).join("\n"));
                      toast("Todos os jogos copiados");
                    }}
                  >
                    <Copy /> Copiar todos
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => exportCsv(cfg, games, output.contest)}>
                    <Sheet /> CSV
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => exportTxt(cfg, games, output.contest)}>
                    <FileText /> TXT
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => exportPdf(cfg, games, output.contest)}>
                    <FileDown /> PDF volante
                  </Button>
                  <a className="contents" href={whatsappUrl(cfg, games, output.contest)} target="_blank" rel="noreferrer">
                    <Button size="sm" variant="secondary" className="w-full">
                      <MessageCircle /> WhatsApp
                    </Button>
                  </a>
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
              {games.slice(0, 300).map((g, i) => (
                <GameCard key={g.numbers.join("-") + i} cfg={cfg} game={g} index={i} saved={output.saved.has(i)} onSave={() => saveGames([i])} />
              ))}
            </div>
            {games.length > 300 && <p className="text-center text-sm text-slate-400">Mostrando 300 de {games.length}. Use a exportação para ver todos.</p>}
          </>
        )}
      </div>
    </div>
  );
}
