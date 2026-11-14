"use client";

import { useRef, useState } from "react";
import { CloudDownload, CloudUpload, KeyRound, RotateCcw, Save, Upload, Download, ShieldAlert } from "lucide-react";
import { DEFAULT_WEIGHTS, sumRange, type FilterConfig, type LotteryConfig } from "@/lib/lotteryEngine";
import { mergeStates, useStore, type AppState } from "@/lib/store";
import { newSyncCode, pullState, pushState, syncEnabled } from "@/lib/sync";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Input, Label } from "./ui/field";
import { Button } from "./ui/button";
import { useToast } from "./toast";

type RangeKey = "even" | "sum" | "repeatLast" | "primes" | "frame" | "row" | "col";
const RANGE_FIELDS: [RangeKey, string][] = [
  ["even", "Pares (mín-máx)"],
  ["sum", "Soma (mín-máx)"],
  ["repeatLast", "Repetidas do último concurso"],
  ["primes", "Números primos"],
  ["frame", "Moldura (Lotofácil)"],
  ["row", "Dezenas por linha"],
  ["col", "Dezenas por coluna"],
];

export function SettingsPanel({ cfg }: { cfg: LotteryConfig }) {
  const { state, setFilters, setWeights, getWeights, setSyncCode, replaceState } = useStore();
  const toast = useToast();
  const current: FilterConfig = state.filters[cfg.id] ?? cfg.filters;
  const [draft, setDraft] = useState<FilterConfig>({ ...current, sum: current.sum ?? sumRange(cfg, cfg.pick, current.sumZ) });
  const [code, setCode] = useState(state.syncCode ?? "");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const w = getWeights(cfg.id);

  const fields = RANGE_FIELDS.filter(([k]) => (k === "frame" ? cfg.id === "lotofacil" : k === "repeatLast" ? !!cfg.filters.repeatLast : k === "primes" ? !!cfg.filters.primes : true));

  const setRange = (k: RangeKey, i: 0 | 1, v: number) =>
    setDraft((d) => {
      const r = [...((d[k] as [number, number] | undefined) ?? [0, 0])] as [number, number];
      r[i] = v;
      return { ...d, [k]: r };
    });

  const sync = async (dir: "push" | "pull") => {
    if (!code || code.length < 16) return toast("Gere ou cole um código de sincronização", "error");
    setBusy(true);
    try {
      setSyncCode(code);
      const remote = await pullState(code);
      const merged = remote ? mergeStates({ ...state, syncCode: code }, remote) : { ...state, syncCode: code };
      if (dir === "pull" && !remote) toast("Nada salvo na nuvem com esse código ainda", "error");
      replaceState(merged as AppState);
      await pushState(code, merged as AppState);
      toast(dir === "push" ? "Apostas enviadas para a nuvem" : "Sincronizado com a nuvem");
    } catch (e) {
      toast(`Falha na sincronização: ${(e as Error).message}`, "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
      <Card>
        <CardHeader>
          <CardTitle>Filtros eliminatórios · {cfg.name}</CardTitle>
          <CardDescription>Valores para a aposta simples de {cfg.pick} dezenas; apostas maiores são escaladas proporcionalmente.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {fields.map(([k, label]) => {
            const r = (draft[k] as [number, number] | undefined) ?? [0, 0];
            return (
              <div key={k}>
                <Label>{label}</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Input type="number" inputMode="numeric" value={r[0]} onChange={(e) => setRange(k, 0, Number(e.target.value))} aria-label={`${label} mínimo`} />
                  <Input type="number" inputMode="numeric" value={r[1]} onChange={(e) => setRange(k, 1, Number(e.target.value))} aria-label={`${label} máximo`} />
                </div>
              </div>
            );
          })}
          <div>
            <Label>Maior sequência consecutiva</Label>
            <Input type="number" inputMode="numeric" value={draft.maxConsecutive ?? ""} onChange={(e) => setDraft((d) => ({ ...d, maxConsecutive: Number(e.target.value) }))} />
          </div>
          <div className="grid grid-cols-2 gap-2 pt-1">
            <Button
              onClick={() => {
                setFilters(cfg.id, draft);
                toast("Filtros salvos");
              }}
            >
              <Save /> Salvar
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setFilters(cfg.id, undefined);
                setDraft({ ...cfg.filters, sum: sumRange(cfg) });
                toast("Filtros padrão restaurados");
              }}
            >
              <RotateCcw /> Padrão
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Pesos adaptativos</CardTitle>
            <CardDescription>Ajustados pelo Diagnóstico de Desempenho após cada conferência.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {(Object.keys(DEFAULT_WEIGHTS) as (keyof typeof DEFAULT_WEIGHTS)[]).map((k) => (
              <div key={k} className="flex items-center gap-3">
                <span className="w-24 text-sm capitalize text-slate-300">{{ hot: "Quentes", late: "Atrasadas", cycle: "Ciclo", neutral: "Neutras" }[k]}</span>
                <input
                  type="range"
                  min={0.2}
                  max={3}
                  step={0.05}
                  value={w[k]}
                  onChange={(e) => setWeights(cfg.id, { ...w, [k]: Number(e.target.value) })}
                  className="h-2 flex-1 accent-emerald-500"
                />
                <span className="w-10 text-right text-sm tabular-nums text-slate-400">{w[k].toFixed(2)}</span>
              </div>
            ))}
            <Button variant="ghost" size="sm" onClick={() => setWeights(cfg.id, DEFAULT_WEIGHTS)}>
              <RotateCcw /> Zerar pesos
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Sincronizar PC ↔ Celular</CardTitle>
            <CardDescription>
              {syncEnabled ? "Use o mesmo código nos dois aparelhos. Guarde-o: ele é a chave das suas apostas na nuvem." : "Supabase não configurado. Defina as variáveis do .env.example na Vercel para ativar. Enquanto isso, use o backup em arquivo."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {syncEnabled && (
              <>
                <div className="flex gap-2">
                  <Input value={code} onChange={(e) => setCode(e.target.value.trim())} placeholder="LM-XXXXXXXXXXXXXXXXX" className="font-mono" />
                  <Button variant="secondary" size="icon" onClick={() => setCode(newSyncCode())} aria-label="Gerar código">
                    <KeyRound />
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Button onClick={() => sync("push")} disabled={busy}>
                    <CloudUpload /> Enviar
                  </Button>
                  <Button variant="secondary" onClick={() => sync("pull")} disabled={busy}>
                    <CloudDownload /> Baixar
                  </Button>
                </div>
              </>
            )}
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
                  const a = document.createElement("a");
                  a.href = URL.createObjectURL(blob);
                  a.download = `lotomaster-backup-${new Date().toISOString().slice(0, 10)}.json`;
                  a.click();
                }}
              >
                <Download /> Backup
              </Button>
              <Button variant="outline" onClick={() => fileRef.current?.click()}>
                <Upload /> Restaurar
              </Button>
              <input
                ref={fileRef}
                type="file"
                accept="application/json"
                hidden
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  try {
                    const remote = JSON.parse(await f.text()) as AppState;
                    replaceState(mergeStates(state, remote));
                    toast("Backup restaurado e mesclado");
                  } catch {
                    toast("Arquivo inválido", "error");
                  }
                }}
              />
            </div>
          </CardContent>
        </Card>

        <Card className="border-amber-500/30">
          <CardContent className="flex gap-3 pt-4 text-sm text-slate-300 sm:pt-5">
            <ShieldAlert className="h-5 w-5 shrink-0 text-amber-400" />
            <p>
              <b>Jogo responsável.</b> Os sorteios são aleatórios e independentes: filtros, pesos e histórico não aumentam a chance de uma combinação sair. O que um fechamento garante é
              matemático e condicional (as dezenas sorteadas precisam estar no seu grupo). Aposte só o que pode perder. Proibido para menores de 18 anos.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
