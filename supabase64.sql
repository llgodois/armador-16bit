-- =====================================================================
--  ARMADOR 64 (versão 3D) — tabelas PRÓPRIAS, separadas do 16-bit.
--  Cole no SQL Editor do Supabase e rode UMA vez (pode rodar de novo sem problema).
--  O 16-bit continua usando players / scores (supabase.sql).
-- =====================================================================
create table if not exists players64 (
  name       text primary key,
  pin_hash   text not null,
  coins      integer not null default 0,
  unlocked   text[] not null default '{}',
  best       integer not null default 0,
  games      integer not null default 0,
  team_best  jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists scores64 (
  id         bigserial primary key,
  name       text not null references players64(name),
  score      integer not null,
  baskets    integer not null default 0,
  assists    integer not null default 0,
  pg         text,
  created_at timestamptz not null default now()
);

create index if not exists scores64_rank on scores64 (score desc, created_at asc);

alter table players64 enable row level security;
alter table scores64  enable row level security;

drop policy if exists "ler jogadores 64"     on players64;
drop policy if exists "criar jogador 64"     on players64;
drop policy if exists "atualizar jogador 64" on players64;
drop policy if exists "ler ranking 64"       on scores64;
drop policy if exists "enviar pontuacao 64"  on scores64;

create policy "ler jogadores 64"     on players64 for select using (true);
create policy "criar jogador 64"     on players64 for insert with check (true);
create policy "atualizar jogador 64" on players64 for update using (true) with check (true);
create policy "ler ranking 64"       on scores64  for select using (true);
create policy "enviar pontuacao 64"  on scores64  for insert with check (score >= 0 and score < 500);

grant usage on schema public to anon, authenticated;
grant select, insert, update on public.players64 to anon, authenticated;
grant select, insert on public.scores64 to anon, authenticated;
grant usage, select on sequence public.scores64_id_seq to anon, authenticated;
