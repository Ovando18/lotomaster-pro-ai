"use client";

import { useMemo, useState } from "react";
import { Flame, Hourglass, RefreshCw, RotateCw, Trophy } from "lucide-react";
import { brl, computeStats, oddsOneIn, MONTHS, type Draw, type LotteryConfig } from "@/lib/lotteryEngine";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Ball, MonthBadge, Trevo } from "./ball";
import { NumberGrid } from "./number-grid";
import { cn } from "@/lib/utils";

type Mode = "freq" | "delay" | "cycle";

export function StatsPanel({
  cfg,
  draws,
  loading,
  error,
  source,
  onRefresh,
}: {
  cfg: LotteryConfig;
  draws: Draw[];
  loading: boolean;
  error: string | null;
  source?: string;
  onRefresh: () => void;
}) {
  const [windowSize, setWindowSize] = useState(20);
  const [mode, setMode] = useState<Mode>("freq");
  const stats = useMemo(() => (draws.length ? computeStats(cfg, draws, windowSize) : null), [cfg, draws, windowSize]);
  const latest = draws[0];

  const heat = useMemo(() => {
    if (!stats) return undefined;
    const m = new Map<number, number>();
    if (mode === "freq") {
      const max = Math.max(1, ...stats.numbers.map((s) => s.freqRecent));
      const min = Math.min(...stats.numbers.map((s) => s.freqRecent));
      stats.numbers.forEach((s) => m.set(s.n, max === min ? 0.5 : (s.freqRecent - min) / (max - min)));
    } else if (mode === "delay") {
      const max = Math.max(1, ...stats.numbers.map((s) => s.delay));
      stats.numbers.forEach((s) => m.set(s.n, s.delay / max));
    } else {
      const miss = new Set(stats.cycle.missing);
      stats.numbers.forEach((s) => m.set(s.n, miss.has(s.n) ? 1 : 0.05));
    }
    return m;
  }, [stats, mode]);

  const sorted = (key: "freqRecent" | "delay") => (stats ? stats.numbers.slice().sort((a, b) => b[key] - a[key]).slice(0, 10) : []);
  const prizeTiers = cfg.tiers.filter((t) => !t.month && !(t.extraHits && !t.extraHits.includes(2)) && t.hits >= 0);

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_minmax(320px,420px)] lg:items-start">
      <div className="space-y-4">
        <Card>
          <CardHeader className="flex-row items-start justify-between gap-2">
            <div>
              <CardTitle>Mapa de calor do volante</CardTitle>
              <CardDescription>
                {stats ? `${stats.window} concursos carregados${source ? ` · fonte: ${source}` : ""}` : loading ? "Carregando histórico..." : "Sem histórico"}
              </CardDescription>
            </div>
            <Button variant="ghost" size="icon" onClick={onRefresh} aria-label="Atualizar">
              <RefreshCw className={cn(loading && "animate-spin")} />
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {error && <p className="rounded-lg bg-amber-500/10 p-2.5 text-xs text-amber-300">{error}</p>}
            <div className="flex flex-wrap gap-2">
              <Seg value={mode} onChange={setMode} options={[["freq", "Frequência"], ["delay", "Atraso"], ["cycle", "Ciclo"]]} />
              {mode === "freq" && <Seg value={windowSize} onChange={setWindowSize} options={[[10, "10"], [20, "20"], [50, "50"], [100, "100"]]} />}
            </div>
            <NumberGrid cfg={cfg} heat={heat} compact={cfg.totalNumbers > 60} />
            <p className="text-xs text-slate-500">
              {mode === "freq" && `Quanto mais verde, mais vezes saiu nos últimos ${windowSize} concursos.`}
              {mode === "delay" && "Quanto mais verde, há mais concursos sem sair."}
              {mode === "cycle" && stats && `Ciclo atual: ${stats.cycle.length} concurso(s), faltam ${stats.cycle.missing.length} dezenas (em verde). Ciclos completos no histórico: ${stats.cycle.completedCycles}.`}
            </p>
          </CardContent>
        </Card>

        {stats && (
          <div className="grid gap-4 md:grid-cols-3">
            <TopList title="Mais sorteadas" icon={Flame} cfg={cfg} items={sorted("freqRecent").map((s) => [s.n, `${s.freqRecent}×`])} />
            <TopList title="Mais atrasadas" icon={Hourglass} cfg={cfg} items={sorted("delay").map((s) => [s.n, `${s.delay} conc.`])} />
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <RotateCw className="h-4 w-4 text-emerald-400" /> Faltam no ciclo
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-1.5">
                {stats.cycle.missing.length ? stats.cycle.missing.map((n) => <Ball key={n} n={n} color={cfg.color} size="sm" />) : <p className="text-sm text-slate-400">Ciclo acabou de fechar.</p>}
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      <div className="space-y-4">
        {latest && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="h-5 w-5 text-amber-400" /> Concurso {latest.contest}
              </CardTitle>
              <CardDescription>
                {latest.date}
                {latest.accumulated && " · ACUMULOU"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-1.5">
                {latest.numbers.map((n) => (
                  <Ball key={n} n={n} color={cfg.color} size={cfg.drawSize > 15 ? "sm" : "md"} />
                ))}
              </div>
              {cfg.extra && latest.extras && (
                <div className="flex gap-1.5">{cfg.extra.kind === "trevos" ? latest.extras.map((t) => <Trevo key={t} n={t} />) : latest.extras.map((m) => <MonthBadge key={m} m={m} />)}</div>
              )}
              {!!latest.prizes?.length && (
                <div className="space-y-1 text-sm">
                  {latest.prizes.map((p) => (
                    <div key={p.tier} className="flex justify-between gap-2 border-b border-slate-800/80 py-1 last:border-0">
                      <span className="text-slate-400">{p.label || cfg.tiers[p.tier - 1]?.label}</span>
                      <span className="tabular-nums text-slate-200">
                        {p.winners} × {brl(p.value)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              {latest.nextEstimate ? (
                <p className="rounded-xl bg-emerald-500/10 p-3 text-sm text-emerald-300">
                  Próximo concurso {latest.nextContest}
                  {latest.nextDate && ` (${latest.nextDate})`}: estimativa <b>{brl(latest.nextEstimate)}</b>
                </p>
              ) : null}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Probabilidades reais (aposta simples)</CardTitle>
            <CardDescription>Distribuição hipergeométrica: nenhum filtro altera esses números.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            {prizeTiers.map((t) => (
              <div key={t.label} className="flex justify-between border-b border-slate-800/80 py-1.5 last:border-0">
                <span className="text-slate-300">{t.extraHits ? `${t.hits} acertos` : t.label}</span>
                <span className="tabular-nums text-slate-400">1 em {Math.round(oddsOneIn(cfg, cfg.pick, t.hits)).toLocaleString("pt-BR")}</span>
              </div>
            ))}
            {cfg.extra?.kind === "trevos" && <p className="pt-1 text-xs text-slate-500">Acertar os 2 trevos: 1 em 15. As faixas combinam dezenas e trevos.</p>}
          </CardContent>
        </Card>

        {cfg.extra && stats && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{cfg.extra.kind === "trevos" ? "Frequência dos trevos" : "Frequência dos meses"}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5">
              {stats.extraFreq
                .slice()
                .sort((a, b) => b.freq - a.freq)
                .map((e) => {
                  const max = Math.max(1, ...stats.extraFreq.map((x) => x.freq));
                  return (
                    <div key={e.n} className="flex items-center gap-2 text-sm">
                      <span className="w-20 shrink-0 text-slate-300">{cfg.extra!.kind === "trevos" ? `Trevo ${e.n}` : MONTHS[e.n - 1].slice(0, 3)}</span>
                      <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-800">
                        <span className="block h-full rounded-full bg-emerald-500" style={{ width: `${(e.freq / max) * 100}%` }} />
                      </span>
                      <span className="w-8 text-right tabular-nums text-slate-400">{e.freq}</span>
                    </div>
                  );
                })}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function Seg<T extends string | number>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: [T, string][] }) {
  return (
    <div className="flex rounded-xl border border-slate-700 p-0.5 text-sm">
      {options.map(([v, l]) => (
        <button key={String(v)} onClick={() => onChange(v)} className={cn("min-h-9 rounded-lg px-3 font-semibold", value === v ? "bg-emerald-500 text-emerald-950" : "text-slate-400")}>
          {l}
        </button>
      ))}
    </div>
  );
}

function TopList({ title, icon: Icon, cfg, items }: { title: string; icon: typeof Flame; cfg: LotteryConfig; items: [number, string][] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Icon className="h-4 w-4 text-emerald-400" /> {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-1.5">
        {items.map(([n, label]) => (
          <div key={n} className="flex items-center gap-2 rounded-lg bg-slate-950/50 px-2 py-1">
            <Ball n={n} color={cfg.color} size="sm" />
            <span className="text-xs tabular-nums text-slate-400">{label}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

