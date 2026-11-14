"use client";

import { useEffect, useMemo, useState } from "react";
import { BrainCircuit, Download, Loader2, PenLine, Plus, Search, Trash2, TrendingDown, TrendingUp } from "lucide-react";
import {
  betCost,
  brl,
  checkTicket,
  computeStats,
  diagnoseAndAdjust,
  roiSummary,
  type Draw,
  type LotteryConfig,
} from "@/lib/lotteryEngine";
import { useStore, type SavedBet } from "@/lib/store";
import { fetchContest } from "@/hooks/use-lottery-data";
import { exportCsv, exportPdf } from "@/lib/export";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Input, Label, Select } from "./ui/field";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Ball, MonthBadge, Trevo } from "./ball";
import { useToast } from "./toast";
import { cn } from "@/lib/utils";

function parseNums(text: string): number[] {
  return [...new Set((text.match(/\d+/g) ?? []).map(Number))].sort((a, b) => a - b);
}

function validateNums(cfg: LotteryConfig, nums: number[], exact?: number): string | null {
  if (nums.some((n) => n < cfg.minNumber || n > cfg.maxNumber)) return `Dezenas devem estar entre ${cfg.minNumber} e ${cfg.maxNumber}`;
  if (exact !== undefined) return nums.length === exact ? null : `Informe exatamente ${exact} dezenas (recebi ${nums.length})`;
  if (cfg.fixedPick && nums.length !== cfg.pick) return `A ${cfg.name} exige ${cfg.pick} dezenas`;
  if (nums.length < cfg.pick || nums.length > cfg.maxPick) return `Informe de ${cfg.pick} a ${cfg.maxPick} dezenas (recebi ${nums.length})`;
  return null;
}

function parseExtras(cfg: LotteryConfig, text: string): number[] | undefined {
  if (!cfg.extra) return undefined;
  const e = parseNums(text).filter((n) => n >= 1 && n <= cfg.extra!.count);
  return e;
}

export function BetsPanel({ cfg, draws }: { cfg: LotteryConfig; draws: Draw[] }) {
  const { state, addBets, updateBet, removeBet, saveManualDraw, setWeights, getWeights, markLearned } = useStore();
  const toast = useToast();
  const bets = useMemo(() => state.bets.filter((b) => b.lottery === cfg.id && !b.deleted), [state.bets, cfg.id]);
  const contests = useMemo(() => [...new Set(bets.map((b) => b.contest))].sort((a, b) => b - a), [bets]);
  const [contest, setContest] = useState<number | null>(null);
  const [draw, setDraw] = useState<Draw | null>(null);
  const [loading, setLoading] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [showManual, setShowManual] = useState(false);

  useEffect(() => {
    if (contest === null || !contests.includes(contest)) setContest(contests[0] ?? null);
  }, [contests, contest]);

  // resultado já conhecido (histórico ou manual) para o concurso selecionado
  useEffect(() => {
    if (contest === null) return setDraw(null);
    const known = draws.find((d) => d.contest === contest) ?? state.manualDraws[`${cfg.id}:${contest}`] ?? null;
    setDraw(known);
  }, [contest, draws, state.manualDraws, cfg.id]);

  const contestBets = bets.filter((b) => b.contest === contest);

  const applyResults = (d: Draw, list: SavedBet[]) => {
    for (const b of list) {
      const r = checkTicket(cfg, b.numbers, b.extras, d);
      updateBet(b.id, {
        result: {
          hits: r.hitCount,
          extraHits: r.extraHits.length,
          prize: r.prize,
          prizeUnknown: r.prizeUnknown,
          labels: r.wins.map((w) => (w.count > 1 ? `${w.count}× ${w.label}` : w.label)),
          checkedAt: new Date().toISOString(),
        },
      });
    }
  };

  const conferir = async () => {
    if (contest === null) return;
    setLoading(true);
    const d = await fetchContest(cfg.id, contest, draws, state.manualDraws);
    setLoading(false);
    if (!d) {
      setShowManual(true);
      toast("Resultado ainda não disponível. Digite manualmente.", "error");
      return;
    }
    setDraw(d);
    applyResults(d, contestBets);
    toast(`Concurso ${contest} conferido`);
  };

  const summary = draw && contestBets.length ? roiSummary(cfg, contestBets, draw) : null;

  const diagnosis = useMemo(() => {
    if (!draw) return null;
    const before = draws.filter((d) => d.contest < draw.contest);
    if (before.length < 10) return null;
    return diagnoseAndAdjust(cfg, computeStats(cfg, before), draw, getWeights(cfg.id));
  }, [draw, draws, cfg, getWeights]);
  const learnedKey = draw ? `${cfg.id}:${draw.contest}` : "";

  // desempenho por estratégia (todas as apostas conferidas)
  const byStrategy = useMemo(() => {
    const m = new Map<string, { n: number; hits: number; cost: number; prize: number }>();
    for (const b of bets) {
      if (!b.result) continue;
      const k = b.strategy ?? "Manual";
      const cur = m.get(k) ?? { n: 0, hits: 0, cost: 0, prize: 0 };
      cur.n++;
      cur.hits += b.result.hits;
      cur.cost += b.cost;
      cur.prize += b.result.prize;
      m.set(k, cur);
    }
    return [...m.entries()];
  }, [bets]);

  const totals = useMemo(() => {
    const checked = bets.filter((b) => b.result);
    const cost = checked.reduce((a, b) => a + b.cost, 0);
    const prize = checked.reduce((a, b) => a + (b.result?.prize ?? 0), 0);
    return { cost, prize, n: checked.length };
  }, [bets]);

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(320px,400px)_1fr] lg:items-start">
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Minhas Apostas &amp; Refinamento</CardTitle>
            <CardDescription>
              {bets.length} aposta(s) na {cfg.name}. Histórico: investido {brl(totals.cost)} · ganho {brl(totals.prize)}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {contests.length > 0 ? (
              <div>
                <Label>Concurso</Label>
                <Select value={contest ?? ""} onChange={(e) => setContest(Number(e.target.value))}>
                  {contests.map((c) => (
                    <option key={c} value={c}>
                      Concurso {c} · {bets.filter((b) => b.contest === c).length} jogo(s)
                    </option>
                  ))}
                </Select>
              </div>
            ) : (
              <p className="text-sm text-slate-400">Nenhuma aposta ainda. Gere jogos e toque em &quot;Marcar apostado&quot;, ou registre abaixo.</p>
            )}
            <div className="grid grid-cols-2 gap-2">
              <Button onClick={conferir} disabled={contest === null || loading}>
                {loading ? <Loader2 className="animate-spin" /> : <Search />} Conferir
              </Button>
              <Button variant="secondary" onClick={() => setShowManual((v) => !v)} disabled={contest === null}>
                <PenLine /> Resultado manual
              </Button>
              <Button variant="outline" className="col-span-2" onClick={() => setShowAdd((v) => !v)}>
                <Plus /> Registrar aposta feita
              </Button>
            </div>
          </CardContent>
        </Card>

        {showAdd && <AddBetForm cfg={cfg} defaultContest={contest ?? (draws[0]?.contest ?? 0) + 1} onAdd={(b) => { addBets([b]); setContest(b.contest); toast("Aposta registrada"); }} />}

        {showManual && contest !== null && (
          <ManualResultForm
            cfg={cfg}
            contest={contest}
            onSave={(d) => {
              saveManualDraw(cfg.id, d);
              setDraw(d);
              applyResults(d, contestBets);
              setShowManual(false);
              toast(`Resultado do concurso ${contest} salvo e conferido`);
            }}
          />
        )}

        {byStrategy.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Desempenho por estratégia</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {byStrategy.map(([k, v]) => (
                <div key={k} className="flex items-center justify-between gap-2 rounded-lg bg-slate-950/50 px-3 py-2 text-sm">
                  <span className="truncate text-slate-300">{k}</span>
                  <span className="shrink-0 tabular-nums text-slate-400">
                    {v.n} jogos · média <b className="text-slate-100">{(v.hits / v.n).toFixed(2)}</b> pts · {brl(v.prize - v.cost)}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>

      <div className="space-y-4">
        {draw && (
          <Card>
            <CardHeader>
              <CardTitle className="flex flex-wrap items-center gap-2">
                Resultado · Concurso {draw.contest}
                {draw.date && <span className="text-sm font-normal text-slate-400">{draw.date}</span>}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-1.5">
                {draw.numbers.map((n) => (
                  <Ball key={n} n={n} color={cfg.color} />
                ))}
              </div>
              {cfg.extra && draw.extras && (
                <div className="mt-2 flex gap-1.5">
                  {cfg.extra.kind === "trevos" ? draw.extras.map((t) => <Trevo key={t} n={t} />) : draw.extras.map((m) => <MonthBadge key={m} m={m} />)}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {summary && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Kpi label="Investido" value={brl(summary.invested)} />
            <Kpi
              label="Prêmios"
              value={brl(summary.won)}
              tone={summary.won > 0 ? "good" : undefined}
              sub={contestBets.some((b) => b.result?.prizeUnknown) ? "parcial: faixas com rateio ainda não divulgado" : undefined}
            />
            <Kpi label="ROI" value={`${(summary.roi * 100).toFixed(1)}%`} tone={summary.roi >= 0 ? "good" : "bad"} icon={summary.roi >= 0 ? TrendingUp : TrendingDown} />
            <Kpi label="Média de acertos" value={`${summary.avgHits.toFixed(2)}`} sub={`esperado ao acaso ${summary.expectedAvgHits.toFixed(2)} · melhor ${summary.bestHits}`} />
          </div>
        )}

        {diagnosis && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <BrainCircuit className="h-5 w-5 text-emerald-400" /> Diagnóstico de desempenho
              </CardTitle>
              <CardDescription>
                O resultado oficial passou em {diagnosis.filtersMatched}/{diagnosis.drawChecks.length} filtros ativos.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-2 sm:grid-cols-3">
                {diagnosis.groups.map((g) => (
                  <div key={g.key} className="rounded-xl bg-slate-950/50 p-3">
                    <p className="text-xs text-slate-400">{g.label}</p>
                    <p className="text-lg font-bold tabular-nums">
                      {g.observed} <span className="text-sm font-normal text-slate-500">/ {g.expected.toFixed(1)} esp.</span>
                    </p>
                    <p className="text-xs text-slate-400">
                      peso {getWeights(cfg.id)[g.key].toFixed(2)} → <b className="text-emerald-300">{diagnosis.newWeights[g.key].toFixed(2)}</b>
                    </p>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {diagnosis.drawChecks.map((c) => (
                  <Badge key={c.key} variant={c.pass ? "success" : "danger"}>
                    {c.label}: {c.value} {c.key === "row" || c.key === "col" ? "fora" : `[${c.range[0]}-${c.range[1]}]`}
                  </Badge>
                ))}
              </div>
              <ul className="list-disc space-y-1 pl-5 text-sm text-slate-300">
                {diagnosis.notes.map((n, i) => (
                  <li key={i}>{n}</li>
                ))}
              </ul>
              <Button
                className="w-full sm:w-auto"
                disabled={state.learned.includes(learnedKey)}
                onClick={() => {
                  setWeights(cfg.id, diagnosis.newWeights);
                  markLearned(learnedKey);
                  toast("Pesos atualizados para as próximas gerações");
                }}
              >
                <BrainCircuit /> {state.learned.includes(learnedKey) ? "Ajuste já aplicado" : "Aplicar ajuste de pesos"}
              </Button>
            </CardContent>
          </Card>
        )}

        {contestBets.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" onClick={() => exportCsv(cfg, contestBets, contest ?? undefined)}>
              <Download /> CSV do concurso
            </Button>
            <Button size="sm" variant="secondary" onClick={() => exportPdf(cfg, contestBets, contest ?? undefined)}>
              <Download /> PDF volantes
            </Button>
          </div>
        )}

        <div className="grid gap-3 md:grid-cols-2">
          {contestBets.map((b, i) => (
            <BetCard key={b.id} cfg={cfg} bet={b} index={i} draw={draw} onRemove={() => removeBet(b.id)} />
          ))}
        </div>
      </div>
    </div>
  );
}

function Kpi({ label, value, sub, tone, icon: Icon }: { label: string; value: string; sub?: string; tone?: "good" | "bad"; icon?: typeof TrendingUp }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-3 sm:p-4">
      <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
      <p className={cn("mt-1 flex items-center gap-1 text-xl font-black tabular-nums", tone === "good" && "text-emerald-400", tone === "bad" && "text-rose-400")}>
        {Icon && <Icon className="h-5 w-5" />} {value}
      </p>
      {sub && <p className="mt-0.5 text-[11px] leading-tight text-slate-500">{sub}</p>}
    </div>
  );
}

function BetCard({ cfg, bet, index, draw, onRemove }: { cfg: LotteryConfig; bet: SavedBet; index: number; draw: Draw | null; onRemove: () => void }) {
  const drawn = new Set(draw?.numbers ?? []);
  const drawnExtras = new Set(draw?.extras ?? []);
  const r = bet.result;
  const won = (r?.prize ?? 0) > 0 || (r?.labels.length ?? 0) > 0;
  return (
    <div className={cn("rounded-2xl border bg-slate-900/80 p-3", won ? "border-emerald-500/60" : "border-slate-800")}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-sm font-bold text-slate-200">
          Jogo {index + 1} <span className="font-normal text-slate-500">· {bet.numbers.length} dez. · {brl(bet.cost)}</span>
        </span>
        <div className="flex items-center gap-1">
          {r && <Badge variant={won ? "success" : "default"}>{r.hits} acertos</Badge>}
          <button aria-label="Remover aposta" className="rounded-lg p-2 text-slate-500 hover:bg-slate-800 hover:text-rose-400" onClick={onRemove}>
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {bet.numbers.map((n) => (
          <Ball key={n} n={n} color={cfg.color} size={bet.numbers.length > 20 ? "sm" : "md"} hit={drawn.has(n)} miss={!!draw && !drawn.has(n)} />
        ))}
      </div>
      {cfg.extra && bet.extras && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {cfg.extra.kind === "trevos"
            ? bet.extras.map((t) => <Trevo key={t} n={t} size="sm" hit={drawnExtras.has(t)} />)
            : bet.extras.map((m) => <MonthBadge key={m} m={m} hit={drawnExtras.has(m)} />)}
        </div>
      )}
      {r && (
        <div className="mt-2 text-sm">
          {r.labels.length ? (
            <p className="font-semibold text-emerald-300">
              🏆 {r.labels.join(" · ")} {r.prize > 0 && `= ${brl(r.prize)}`}
              {r.prizeUnknown && <span className="font-normal text-slate-400"> (rateio ainda não divulgado)</span>}
            </p>
          ) : (
            <p className="text-slate-500">Sem premiação</p>
          )}
        </div>
      )}
      {bet.strategy && <p className="mt-1 text-[11px] text-slate-500">{bet.strategy}</p>}
    </div>
  );
}

function AddBetForm({ cfg, defaultContest, onAdd }: { cfg: LotteryConfig; defaultContest: number; onAdd: (b: Omit<SavedBet, "id" | "createdAt" | "updatedAt">) => void }) {
  const [contest, setContest] = useState(defaultContest || "");
  const [nums, setNums] = useState("");
  const [extras, setExtras] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const submit = () => {
    const n = parseNums(nums);
    const e = validateNums(cfg, n);
    if (e) return setErr(e);
    const ex = parseExtras(cfg, extras);
    if (cfg.extra && (!ex || ex.length < cfg.extra.pick || ex.length > cfg.extra.maxPick))
      return setErr(`Informe ${cfg.extra.pick}${cfg.extra.maxPick > cfg.extra.pick ? ` a ${cfg.extra.maxPick}` : ""} ${cfg.extra.label.toLowerCase()} (1 a ${cfg.extra.count})`);
    if (!contest) return setErr("Informe o concurso");
    setErr(null);
    onAdd({ lottery: cfg.id, contest: Number(contest), numbers: n, extras: ex, cost: betCost(cfg, n.length, ex?.length), strategy: "Manual" });
    setNums("");
  };
  return (
    <Card>
      <CardContent className="space-y-3 pt-4">
        <div>
          <Label>Concurso</Label>
          <Input inputMode="numeric" value={contest} onChange={(e) => setContest(Number(e.target.value.replace(/\D/g, "")) || "")} />
        </div>
        <div>
          <Label hint={`${cfg.pick}${cfg.fixedPick ? "" : `-${cfg.maxPick}`} dezenas`}>Dezenas apostadas</Label>
          <Input inputMode="numeric" value={nums} onChange={(e) => setNums(e.target.value)} placeholder="01 05 12 ..." />
        </div>
        {cfg.extra && (
          <div>
            <Label hint={cfg.extra.kind === "mes" ? "1=Jan ... 12=Dez" : "1 a 6"}>{cfg.extra.label}</Label>
            <Input inputMode="numeric" value={extras} onChange={(e) => setExtras(e.target.value)} placeholder={cfg.extra.kind === "mes" ? "ex: 5" : "ex: 2 5"} />
          </div>
        )}
        {err && <p className="text-sm text-rose-400">{err}</p>}
        <Button className="w-full" onClick={submit}>
          <Plus /> Salvar aposta
        </Button>
      </CardContent>
    </Card>
  );
}

function ManualResultForm({ cfg, contest, onSave }: { cfg: LotteryConfig; contest: number; onSave: (d: Draw) => void }) {
  const [nums, setNums] = useState("");
  const [extras, setExtras] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const submit = () => {
    const n = parseNums(nums);
    const e = validateNums(cfg, n, cfg.drawSize);
    if (e) return setErr(e);
    const ex = parseExtras(cfg, extras);
    if (cfg.extra && ex?.length !== cfg.extra.drawSize) return setErr(`Informe ${cfg.extra.drawSize} ${cfg.extra.label.toLowerCase()}`);
    onSave({ contest, date: new Date().toLocaleDateString("pt-BR"), numbers: n, extras: ex, prizes: [] });
  };
  return (
    <Card className="border-amber-500/30">
      <CardHeader>
        <CardTitle className="text-base">Resultado manual · Concurso {contest}</CardTitle>
        <CardDescription>Use quando o sorteio acabou de acontecer. Prêmios variáveis aparecem quando a API divulgar o rateio.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <Label hint={`${cfg.drawSize} dezenas`}>Dezenas sorteadas</Label>
          <Input inputMode="numeric" value={nums} onChange={(e) => setNums(e.target.value)} placeholder="01 02 03 ..." />
        </div>
        {cfg.extra && (
          <div>
            <Label>{cfg.extra.kind === "trevos" ? "Trevos sorteados" : "Mês sorteado (1-12)"}</Label>
            <Input inputMode="numeric" value={extras} onChange={(e) => setExtras(e.target.value)} />
          </div>
        )}
        {err && <p className="text-sm text-rose-400">{err}</p>}
        <Button className="w-full" onClick={submit}>
          Salvar e conferir
        </Button>
      </CardContent>
    </Card>
  );
}
