"use client";

import { useEffect, useState } from "react";
import { BarChart3, Settings2, Sparkles, Ticket, Clover } from "lucide-react";
import { LOTTERY_LIST, brl, getLottery } from "@/lib/lotteryEngine";
import { useStore } from "@/lib/store";
import { useLotteryData } from "@/hooks/use-lottery-data";
import { GeneratorPanel, type GeneratorOutput } from "./generator-panel";
import { BetsPanel } from "./bets-panel";
import { StatsPanel } from "./stats-panel";
import { SettingsPanel } from "./settings-panel";
import { cn } from "@/lib/utils";

type Tab = "gerar" | "apostas" | "stats" | "ajustes";
const TABS: { id: Tab; label: string; icon: typeof Sparkles }[] = [
  { id: "gerar", label: "Gerar", icon: Sparkles },
  { id: "apostas", label: "Apostas", icon: Ticket },
  { id: "stats", label: "Estatísticas", icon: BarChart3 },
  { id: "ajustes", label: "Ajustes", icon: Settings2 },
];

export function AppShell() {
  const { state, setLottery, hydrated } = useStore();
  const [tab, setTab] = useState<Tab>("gerar");
  const cfg = getLottery(state.lottery);
  const data = useLotteryData(cfg.id);
  const [outputs, setOutputs] = useState<Record<string, GeneratorOutput | null>>({});
  const pendingBets = state.bets.filter((b) => !b.deleted && !b.result).length;

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [tab]);

  const nextContest = data.latest ? (data.latest.nextContest ?? data.latest.contest + 1) : undefined;

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[240px_1fr]">
      {/* Sidebar desktop */}
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-slate-800 bg-slate-950/80 p-4 lg:flex">
        <Logo />
        <nav className="mt-8 space-y-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors",
                tab === t.id ? "bg-emerald-500/15 text-emerald-300" : "text-slate-400 hover:bg-slate-900 hover:text-slate-200"
              )}
            >
              <t.icon className="h-5 w-5" /> {t.label}
              {t.id === "apostas" && pendingBets > 0 && <span className="ml-auto rounded-full bg-emerald-500 px-2 text-xs text-emerald-950">{pendingBets}</span>}
            </button>
          ))}
        </nav>
        <p className="mt-auto text-[11px] leading-relaxed text-slate-600">Jogue com responsabilidade. +18. Não afiliado à CAIXA.</p>
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-20 border-b border-slate-800 bg-slate-950/90 backdrop-blur">
          <div className="flex items-center justify-between gap-3 px-4 pt-3 lg:hidden">
            <Logo />
            {data.latest && (
              <span className="text-right text-[11px] leading-tight text-slate-400">
                Último: <b className="text-slate-200">{data.latest.contest}</b>
                {data.latest.nextEstimate ? (
                  <>
                    <br />
                    Próx.: <b className="text-emerald-400">{brl(data.latest.nextEstimate)}</b>
                  </>
                ) : null}
              </span>
            )}
          </div>
          <div className="no-scrollbar flex gap-2 overflow-x-auto px-4 py-3">
            {LOTTERY_LIST.map((l) => (
              <button
                key={l.id}
                onClick={() => setLottery(l.id)}
                className={cn(
                  "flex shrink-0 items-center gap-2 rounded-full border px-3.5 py-2 text-sm font-bold transition-colors",
                  l.id === cfg.id ? "border-transparent text-white shadow-lg" : "border-slate-800 bg-slate-900 text-slate-400 hover:text-slate-200"
                )}
                style={l.id === cfg.id ? { backgroundColor: l.color } : undefined}
              >
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: l.id === cfg.id ? "white" : l.color }} />
                {l.name}
              </button>
            ))}
            {data.latest && (
              <span className="ml-auto hidden shrink-0 items-center gap-3 pl-4 text-sm text-slate-400 lg:flex">
                Último concurso <b className="text-slate-100">{data.latest.contest}</b>
                {data.latest.nextEstimate ? (
                  <>
                    · Próximo <b className="text-emerald-400">{brl(data.latest.nextEstimate)}</b>
                  </>
                ) : null}
              </span>
            )}
          </div>
        </header>

        <main className={cn("mx-auto max-w-[1600px] px-3 py-4 sm:px-4 lg:px-6 lg:py-6", tab === "gerar" ? "pb-44 lg:pb-8" : "pb-28 lg:pb-8")}>
          {!hydrated ? (
            <div className="py-20 text-center text-slate-500">Carregando…</div>
          ) : (
            <>
              {tab === "gerar" && (
                <GeneratorPanel
                  key={cfg.id}
                  cfg={cfg}
                  stats={data.stats}
                  nextContest={nextContest}
                  output={outputs[cfg.id] ?? null}
                  setOutput={(o) => setOutputs((s) => ({ ...s, [cfg.id]: o }))}
                />
              )}
              {tab === "apostas" && <BetsPanel key={cfg.id} cfg={cfg} draws={data.draws} />}
              {tab === "stats" && <StatsPanel cfg={cfg} draws={data.draws} loading={data.loading} error={data.error} source={data.source} onRefresh={data.refresh} />}
              {tab === "ajustes" && <SettingsPanel key={cfg.id} cfg={cfg} />}
            </>
          )}
        </main>
      </div>

      {/* Bottom nav (polegar) */}
      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-slate-800 bg-slate-950/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn("relative flex h-[68px] flex-col items-center justify-center gap-1 text-xs font-semibold", tab === t.id ? "text-emerald-400" : "text-slate-500")}
          >
            <t.icon className="h-6 w-6" />
            {t.label}
            {t.id === "apostas" && pendingBets > 0 && (
              <span className="absolute right-[calc(50%-22px)] top-2.5 rounded-full bg-emerald-500 px-1.5 text-[10px] text-emerald-950">{pendingBets}</span>
            )}
          </button>
        ))}
      </nav>
    </div>
  );
}

function Logo() {
  return (
    <div className="flex items-center gap-2">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 text-emerald-950 shadow-lg shadow-emerald-500/20">
        <Clover className="h-5 w-5" />
      </span>
      <span className="leading-none">
        <span className="block text-base font-black tracking-tight text-slate-50">LotoMaster</span>
        <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-400">Pro AI</span>
      </span>
    </div>
  );
}
