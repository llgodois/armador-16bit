Atualizar os elencos do Armador 64 (notas do NBA 2K27, 2kratings.com)

  cd tools/roster64
  bash fetch.sh        # baixa as 30 páginas de time (t_*.html) com pausa entre elas
  node parse.js        # -> raw.json (todos os jogadores com os atributos)
  node gen.mjs         # -> roster.json (quinteto por posição + 5 reservas)
  node write.mjs       # -> src/v3d/roster64.js

Os t_*.html, raw.json e roster.json são temporários (não vão para o git).
Jogadores novos sem visual: adicione em src/v3d/looks.js.
