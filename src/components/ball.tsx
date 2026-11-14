import { Clover } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtNum, MONTHS } from "@/lib/lotteryEngine";

export function Ball({
  n,
  color,
  hit,
  miss,
  size = "md",
  className,
}: {
  n: number;
  color: string;
  hit?: boolean;
  miss?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const s = size === "lg" ? "h-11 w-11 text-lg" : size === "sm" ? "h-7 w-7 text-xs" : "h-10 w-10 text-base sm:h-9 sm:w-9 sm:text-sm";
  return (
    <span
      className={cn(
        "inline-flex select-all items-center justify-center rounded-full font-bold tabular-nums shadow-inner",
        s,
        hit && "ring-2 ring-emerald-300 ring-offset-2 ring-offset-slate-900",
        miss && "opacity-35",
        className
      )}
      style={{ backgroundColor: hit ? "#10b981" : color, color: hit ? "#022c22" : "white" }}
    >
      {fmtNum(n)}
    </span>
  );
}

export function Trevo({ n, hit, size = "md" }: { n: number; hit?: boolean; size?: "sm" | "md" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border font-bold tabular-nums",
        size === "sm" ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-sm",
        hit ? "border-emerald-400 bg-emerald-500 text-emerald-950" : "border-amber-500/50 bg-amber-500/15 text-amber-200"
      )}
    >
      <Clover className="h-3.5 w-3.5" /> {n}
    </span>
  );
}

export function MonthBadge({ m, hit }: { m: number; hit?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-sm font-bold",
        hit ? "border-emerald-400 bg-emerald-500 text-emerald-950" : "border-amber-600/50 bg-amber-600/15 text-amber-200"
      )}
    >
      📅 {MONTHS[m - 1] ?? m}
    </span>
  );
}
