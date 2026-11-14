"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { AppState } from "./store";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const TABLE = "lotomaster_sync";

let client: SupabaseClient | null = null;

export const syncEnabled = Boolean(URL && KEY);

function sb() {
  if (!syncEnabled) throw new Error("Supabase não configurado (veja .env.example)");
  client ??= createClient(URL!, KEY!, { auth: { persistSession: false } });
  return client;
}

/** Gera um código longo e difícil de adivinhar: ele é a "chave" do seu cofre na nuvem. */
export function newSyncCode() {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return "LM-" + Array.from(bytes, (b) => b.toString(36).padStart(2, "0")).join("").toUpperCase().slice(0, 20);
}

export async function pullState(code: string): Promise<AppState | null> {
  const { data, error } = await sb().rpc("lotomaster_pull", { p_code: code });
  if (error) throw error;
  return (data as AppState | null) ?? null;
}

export async function pushState(code: string, state: AppState): Promise<void> {
  const { syncCode: _omit, ...payload } = state;
  const { error } = await sb().rpc("lotomaster_push", { p_code: code, p_data: payload });
  if (error) throw error;
}

export { TABLE };
