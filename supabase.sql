-- =====================================================================
--  ARMADOR 16-BIT — tabelas do modo competitivo (cole no SQL Editor do Supabase e rode)
-- =====================================================================
create table if not exists players (
  name       text primary key,
  pin_hash   text not null,
  coins      integer not null default 0,
  unlocked   text[] not null default '{}',
  best       integer not null default 0,
  games      integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists scores (
  id         bigserial primary key,
  name       text not null references players(name),
  score      integer not null,
  baskets    integer not null default 0,
  assists    integer not null default 0,
  pg         text,
  created_at timestamptz not null default now()
);

create index if not exists scores_rank on scores (score desc, created_at asc);

-- Acesso pela chave pública (anon). Simples, pensado para jogar em família:
-- qualquer um com o site pode ler o ranking, criar conta e salvar o próprio progresso.
alter table players enable row level security;
alter table scores  enable row level security;

drop policy if exists "ler jogadores"      on players;
drop policy if exists "criar jogador"      on players;
drop policy if exists "atualizar jogador"  on players;
drop policy if exists "ler ranking"        on scores;
drop policy if exists "enviar pontuacao"   on scores;

create policy "ler jogadores"     on players for select using (true);
create policy "criar jogador"     on players for insert with check (true);
create policy "atualizar jogador" on players for update using (true) with check (true);
create policy "ler ranking"       on scores  for select using (true);
create policy "enviar pontuacao"  on scores  for insert with check (score >= 0 and score < 500);

-- Permissões para a chave pública do jogo (projetos novos do Supabase não dão sozinhos)
grant usage on schema public to anon, authenticated;
grant select, insert, update on public.players to anon, authenticated;
grant select, insert on public.scores to anon, authenticated;
grant usage, select on sequence public.scores_id_seq to anon, authenticated;
