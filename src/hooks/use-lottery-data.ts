"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { computeStats, getLottery, type Draw, type LotteryId } from "@/lib/lotteryEngine";
import { useStore } from "@/lib/store";

const TTL = 30 * 60 * 1000;
const cacheKey = (id: string) => `lotomaster:hist:${id}`;

interface Cached {
  at: number;
  source: string;
  draws: Draw[];
}

function readCache(id: string): Cached | null {
  try {
    const raw = localStorage.getItem(cacheKey(id));
    return raw ? (JSON.parse(raw) as Cached) : null;
  } catch {
    return null;
  }
}

export function useLotteryData(id: LotteryId) {
  const { state } = useStore();
  const [data, setData] = useState<Cached | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (force = false) => {
      const cached = readCache(id);
      if (cached) setData(cached);
      if (!force && cached && Date.now() - cached.at < TTL) return;
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/history/${id}?limit=300`);
        const json = await res.json();
        if (!res.ok || !json.draws?.length) throw new Error(json.error ?? "Sem dados");
        const next: Cached = { at: Date.now(), source: json.source, draws: json.draws };
        setData(next);
        try {
          localStorage.setItem(cacheKey(id), JSON.stringify(next));
        } catch {
          /* sem espaço */
        }
      } catch (e) {
        setError(cached ? `Offline: usando cache de ${new Date(cached.at).toLocaleString("pt-BR")}` : (e as Error).message);
      } finally {
        setLoading(false);
      }
    },
    [id]
  );

  useEffect(() => {
    setData(null);
    load();
  }, [load]);

  // inclui resultados digitados manualmente que ainda não chegaram pela API
  const draws = useMemo(() => {
    const map = new Map<number, Draw>();
    (data?.draws ?? []).forEach((d) => map.set(d.contest, d));
    Object.entries(state.manualDraws).forEach(([k, d]) => {
      if (k.startsWith(`${id}:`) && !map.has(d.contest)) map.set(d.contest, d);
    });
    return [...map.values()].sort((a, b) => b.contest - a.contest);
  }, [data, state.manualDraws, id]);

  const cfg = getLottery(id);
  const stats = useMemo(() => (draws.length ? computeStats(cfg, draws) : null), [cfg, draws]);
  const latest = draws[0] ?? null;

  return { draws, latest, stats, loading, error, source: data?.source, refresh: () => load(true) };
}

/** Busca um concurso específico (API → histórico em cache → manual). */
export async function fetchContest(id: LotteryId, contest: number, known: Draw[], manual: Record<string, Draw>): Promise<Draw | null> {
  const local = known.find((d) => d.contest === contest) ?? manual[`${id}:${contest}`];
  if (local && local.prizes?.length) return local;
  try {
    const res = await fetch(`/api/results/${id}?contest=${contest}`);
    if (res.ok) {
      const json = await res.json();
      if (json.draw) return json.draw as Draw;
    }
  } catch {
    /* offline */
  }
  return local ?? null;
}
