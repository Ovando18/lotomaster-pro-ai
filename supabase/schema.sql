-- LotoMaster Pro AI: sincronização PC <-> celular (Supabase gratuito)
-- Cole no Supabase: SQL Editor -> New query -> Run.
--
-- Modelo de segurança: a tabela NÃO é exposta diretamente (RLS sem políticas).
-- O acesso acontece só por duas funções que exigem o código de sincronização
-- (gerado aleatoriamente no app). Quem não tem o código não lista nem lê nada.

create table if not exists public.lotomaster_sync (
  sync_code  text primary key check (length(sync_code) >= 16),
  data       jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.lotomaster_sync enable row level security;
-- (nenhuma policy = nenhum acesso direto via anon key)

create or replace function public.lotomaster_pull(p_code text)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select data from public.lotomaster_sync where sync_code = p_code;
$$;

create or replace function public.lotomaster_push(p_code text, p_data jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if length(p_code) < 16 then
    raise exception 'codigo invalido';
  end if;
  if pg_column_size(p_data) > 2000000 then
    raise exception 'payload muito grande';
  end if;
  insert into public.lotomaster_sync (sync_code, data, updated_at)
  values (p_code, p_data, now())
  on conflict (sync_code) do update set data = excluded.data, updated_at = now();
end;
$$;

revoke all on function public.lotomaster_pull(text) from public;
revoke all on function public.lotomaster_push(text, jsonb) from public;
grant execute on function public.lotomaster_pull(text) to anon, authenticated;
grant execute on function public.lotomaster_push(text, jsonb) to anon, authenticated;
