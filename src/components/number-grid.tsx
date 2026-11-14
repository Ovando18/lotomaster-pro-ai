"use client";

import { allNumbers, fmtNum, type LotteryConfig } from "@/lib/lotteryEngine";
import { cn } from "@/lib/utils";

export type CellState = "fixed" | "excluded" | undefined;

/** Volante interativo: toque para fixar/excluir dezenas. */
export function NumberGrid({
  cfg,
  states,
  onToggle,
  heat,
  compact,
}: {
  cfg: LotteryConfig;
  states?: Record<number, CellState>;
  onToggle?: (n: number) => void;
  /** 0..1 por dezena para mapa de calor */
  heat?: Map<number, number>;
  compact?: boolean;
}) {
  const nums = allNumbers(cfg);
  return (
    <div className="mx-auto grid gap-1 sm:gap-1.5" style={{ gridTemplateColumns: `repeat(${cfg.gridCols}, minmax(0, 1fr))`, maxWidth: cfg.gridCols * 64 }}>
      {nums.map((n) => {
        const st = states?.[n];
        const h = heat?.get(n);
        return (
          <button
            key={n}
            type="button"
            onClick={() => onToggle?.(n)}
            disabled={!onToggle}
            aria-pressed={st === "fixed"}
            aria-label={`Dezena ${fmtNum(n)}${st ? ` ${st === "fixed" ? "fixa" : "excluída"}` : ""}`}
            className={cn(
              "flex aspect-square items-center justify-center rounded-lg border text-sm font-bold tabular-nums transition-colors disabled:cursor-default",
              compact ? "text-[11px] sm:text-xs" : "min-h-9 sm:text-sm",
              !h && !st && "border-slate-800 bg-slate-950/50 text-slate-300",
              st === "fixed" && "border-emerald-400 bg-emerald-500 text-emerald-950",
              st === "excluded" && "border-rose-500/50 bg-rose-500/10 text-rose-300 line-through"
            )}
            style={
              h !== undefined && !st
                ? {
                    backgroundColor: `rgba(16, 185, 129, ${0.08 + h * 0.85})`,
                    borderColor: `rgba(16, 185, 129, ${0.2 + h * 0.6})`,
                    color: h > 0.65 ? "#022c22" : "#f8fafc",
                  }
                : undefined
            }
          >
            {fmtNum(n)}
          </button>
        );
      })}
    </div>
  );
}
