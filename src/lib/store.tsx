"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { FilterConfig, LotteryId } from "./lotteries";
import { DEFAULT_WEIGHTS, type Draw, type Weights } from "./lotteryEngine";
import { uid } from "./utils";

export interface BetResult {
  hits: number;
  extraHits: number;
  prize: number;
  prizeUnknown: boolean;
  labels: string[];
  checkedAt: string;
}

export interface SavedBet {
  id: string;
  lottery: LotteryId;
  contest: number;
  numbers: number[];
  extras?: number[];
  cost: number;
  strategy?: string;
  createdAt: string;
  updatedAt: string;
  deleted?: boolean;
  result?: BetResult;
}

export interface AppState {
  lottery: LotteryId;
  bets: SavedBet[];
  weights: Partial<Record<LotteryId, Weights>>;
  filters: Partial<Record<LotteryId, FilterConfig>>;
  /** resultados digitados manualmente: chave "lottery:contest" */
  manualDraws: Record<string, Draw>;
  /** concursos cujo diagnóstico já ajustou os pesos */
  learned: string[];
  syncCode?: string;
  updatedAt: string;
}

const KEY = "lotomaster:v1";

const initial: AppState = {
  lottery: "lotofacil",
  bets: [],
  weights: {},
  filters: {},
  manualDraws: {},
  learned: [],
  updatedAt: new Date(0).toISOString(),
};

interface Store {
  state: AppState;
  hydrated: boolean;
  setLottery: (id: LotteryId) => void;
  addBets: (bets: Omit<SavedBet, "id" | "createdAt" | "updatedAt">[]) => void;
  updateBet: (id: string, patch: Partial<SavedBet>) => void;
  removeBet: (id: string) => void;
  setWeights: (id: LotteryId, w: Weights) => void;
  getWeights: (id: LotteryId) => Weights;
  setFilters: (id: LotteryId, f: FilterConfig | undefined) => void;
  saveManualDraw: (id: LotteryId, d: Draw) => void;
  markLearned: (key: string) => void;
  setSyncCode: (code: string | undefined) => void;
  replaceState: (s: AppState) => void;
}

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(initial);
  const [hydrated, setHydrated] = useState(false);
  const first = useRef(true);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setState({ ...initial, ...JSON.parse(raw) });
    } catch {
      /* storage indisponível */
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (!hydrated) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      /* cheio ou bloqueado */
    }
  }, [state, hydrated]);

  const touch = (s: AppState): AppState => ({ ...s, updatedAt: new Date().toISOString() });

  const setLottery = useCallback((id: LotteryId) => setState((s) => ({ ...s, lottery: id })), []);
  const addBets = useCallback<Store["addBets"]>((bets) => {
    const now = new Date().toISOString();
    setState((s) => touch({ ...s, bets: [...bets.map((b) => ({ ...b, id: uid(), createdAt: now, updatedAt: now })), ...s.bets] }));
  }, []);
  const updateBet = useCallback<Store["updateBet"]>((id, patch) => {
    setState((s) => touch({ ...s, bets: s.bets.map((b) => (b.id === id ? { ...b, ...patch, updatedAt: new Date().toISOString() } : b)) }));
  }, []);
  // exclusão lógica para a sincronização propagar entre aparelhos
  const removeBet = useCallback((id: string) => updateBet(id, { deleted: true }), [updateBet]);
  const setWeights = useCallback((id: LotteryId, w: Weights) => setState((s) => touch({ ...s, weights: { ...s.weights, [id]: w } })), []);
  const getWeights = useCallback((id: LotteryId) => state.weights[id] ?? DEFAULT_WEIGHTS, [state.weights]);
  const setFilters = useCallback((id: LotteryId, f: FilterConfig | undefined) => {
    setState((s) => {
      const filters = { ...s.filters };
      if (f) filters[id] = f;
      else delete filters[id];
      return touch({ ...s, filters });
    });
  }, []);
  const saveManualDraw = useCallback((id: LotteryId, d: Draw) => {
    setState((s) => touch({ ...s, manualDraws: { ...s.manualDraws, [`${id}:${d.contest}`]: d } }));
  }, []);
  const markLearned = useCallback((key: string) => setState((s) => touch({ ...s, learned: [...new Set([...s.learned, key])] })), []);
  const setSyncCode = useCallback((code: string | undefined) => setState((s) => ({ ...s, syncCode: code })), []);
  const replaceState = useCallback((s: AppState) => setState({ ...initial, ...s }), []);

  const value = useMemo<Store>(
    () => ({ state, hydrated, setLottery, addBets, updateBet, removeBet, setWeights, getWeights, setFilters, saveManualDraw, markLearned, setSyncCode, replaceState }),
    [state, hydrated, setLottery, addBets, updateBet, removeBet, setWeights, getWeights, setFilters, saveManualDraw, markLearned, setSyncCode, replaceState]
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore() {
  const s = useContext(Ctx);
  if (!s) throw new Error("useStore fora do StoreProvider");
  return s;
}

/** Mescla dois estados (local x nuvem) apostas por id usando updatedAt. */
export function mergeStates(local: AppState, remote: AppState): AppState {
  const byId = new Map<string, SavedBet>();
  for (const b of [...remote.bets, ...local.bets]) {
    const cur = byId.get(b.id);
    if (!cur || cur.updatedAt < b.updatedAt) byId.set(b.id, b);
  }
  const newer = local.updatedAt >= remote.updatedAt ? local : remote;
  return {
    ...newer,
    lottery: local.lottery,
    syncCode: local.syncCode,
    bets: [...byId.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    manualDraws: { ...remote.manualDraws, ...local.manualDraws },
    learned: [...new Set([...(remote.learned ?? []), ...(local.learned ?? [])])],
    updatedAt: new Date().toISOString(),
  };
}
