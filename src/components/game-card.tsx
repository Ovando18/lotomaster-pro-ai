"use client";

import { Check, Copy, Ticket } from "lucide-react";
import { brl, formatGame, type Game, type LotteryConfig } from "@/lib/lotteryEngine";
import { copyText } from "@/lib/export";
import { Ball, MonthBadge, Trevo } from "./ball";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { useToast } from "./toast";
import { cn } from "@/lib/utils";

export function GameCard({
  cfg,
  game,
  index,
  saved,
  onSave,
}: {
  cfg: LotteryConfig;
  game: Game;
  index: number;
  saved?: boolean;
  onSave?: () => void;
}) {
  const toast = useToast();
  const failed = game.checks.filter((c) => !c.pass);
  const m = game.metrics;
  const big = game.numbers.length > 20;

  return (
    <div className={cn("rounded-2xl border bg-slate-900/80 p-3 sm:p-4", saved ? "border-emerald-500/50" : "border-slate-800")}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="rounded-lg bg-slate-800 px-2 py-1 text-sm font-black tabular-nums text-slate-200">#{String(index + 1).padStart(2, "0")}</span>
          <span className="text-xs text-slate-400">
            {game.numbers.length} dezenas · {brl(game.cost)}
          </span>
        </div>
        {failed.length === 0 ? (
          <Badge variant="success">
            <Check className="h-3 w-3" /> {game.checks.length}/{game.checks.length} filtros
          </Badge>
        ) : (
          <Badge variant="warning" title={failed.map((f) => f.label).join(", ")}>
            {game.checks.length - failed.length}/{game.checks.length} filtros
          </Badge>
        )}
      </div>

      <div className={cn("flex flex-wrap", big ? "gap-1" : "gap-1.5 sm:gap-2")}>
        {game.numbers.map((n) => (
          <Ball key={n} n={n} color={cfg.color} size={big ? "sm" : "md"} />
        ))}
      </div>

      {cfg.extra && game.extras && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {cfg.extra.kind === "trevos" ? game.extras.map((t) => <Trevo key={t} n={t} />) : game.extras.map((mm) => <MonthBadge key={mm} m={mm} />)}
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-1.5 text-xs">
        <Metric label="P/I" value={`${m.even}/${m.odd}`} />
        <Metric label="Soma" value={m.sum} />
        {m.repeated !== null && <Metric label="Rep." value={m.repeated} />}
        <Metric label="Primos" value={m.primes} />
        {cfg.id === "lotofacil" && <Metric label="Moldura" value={m.frame} />}
        <Metric label="Seq." value={m.maxConsecutive} />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <Button
          variant="secondary"
          size="sm"
          onClick={async () => {
            const ok = await copyText(formatGame(cfg, game));
            toast(ok ? "Jogo copiado" : "Não foi possível copiar", ok ? "ok" : "error");
          }}
        >
          <Copy /> Copiar jogo
        </Button>
        <Button variant={saved ? "outline" : "default"} size="sm" onClick={onSave} disabled={saved || !onSave}>
          {saved ? <Check /> : <Ticket />} {saved ? "Apostado" : "Marcar apostado"}
        </Button>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <span className="rounded-md bg-slate-800/80 px-2 py-1 text-slate-300">
      <span className="text-slate-500">{label}</span> <b className="tabular-nums text-slate-100">{value}</b>
    </span>
  );
}
