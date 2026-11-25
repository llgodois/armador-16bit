-- =====================================================================
--  ARMADOR 16-BIT — ZERAR TUDO: apaga todas as contas, PINs e o ranking
--  e adiciona a coluna nova (recorde por time). Rode no SQL Editor.
--  ATENÇÃO: não dá para desfazer.
-- =====================================================================
alter table players add column if not exists team_best jsonb not null default '{}';
truncate table scores, players restart identity;