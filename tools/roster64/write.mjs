import fs from 'fs';
const r = JSON.parse(fs.readFileSync(new URL('./roster.json', import.meta.url)));
const STYLE = {
  ondas: 'Chuva de 3 do Chef e muita movimentacao', astros: 'Luka comanda, Reaves pontua e Kessler protege o aro',
  fenix: 'Booker na meia distancia e muita forca fisica', trovoes: 'Campeoes: defesa sufocante e SGA cavando faltas',
  cavaleiros: 'Kyrie no drible e o fenomeno Flagg', pepitas: 'Pivo armador: tudo passa pelo Jokic',
  veleiros: 'Garland acelera, Ingram decide', foguetes: 'KD na meia e Sengun no garrafao',
  ursos: 'Elenco novo com o gigante Edey', lobos: 'Ant e LaMelo: explosao e passes de efeito',
  pelicanos: 'Zion forca o garrafao', desbravadores: 'Dame, Ja e Avdija: armacao de sobra',
  reis: 'Sabonis distribui do poste', esporas: 'O alienigena Wemby e dois armadores jovens',
  jazz: 'Jovens atletas e JJJ protegendo o aro', trevos: 'Tatum de volta e todo mundo arremessa',
  touros: 'Giddey no comando e alas longos', cervos: 'Herro pontua num time em reconstrucao',
  calor: 'Giannis e Bam: forca bruta no garrafao', falcoes: 'Longos, rapidos e muito roubo de bola',
  redes: 'Reconstrucao com MPJ e Randle', vespas: 'Knueppel e Miller chovendo de 3',
  paladinos: 'Mitchell e Harden no perimetro, gigantes atras', pistoes: 'Cade e muito contato: defesa dura e rebote',
  ritmo: 'Haliburton de volta: ritmo alucinante', metro: 'Brunson frio no fim do jogo e KAT abrindo a quadra',
  magos: 'Alas enormes e defesa fisica', fundadores: 'Maxey, Brown, LeBron e Embiid: elenco estrelado',
  raptores: 'Kawhi e Barnes: alas versateis', feiticeiros: 'Trae arma para AD e o novato Dybantsa',
};
const P = (p) => ({ name: p.name, nick: p.nick, cm: p.cm, r: Object.fromEntries(['three', 'mid', 'fin', 'pass', 'spd', 'def', 'reb'].map((k, i) => [k, p.r[i]])), x: p.x });
const data = Object.fromEntries(Object.entries(r).map(([id, t]) => [id, { style: STYLE[id], players: t.players.map(P), bench: t.bench.map((p) => ({ ...P(p), bench: true })) }]));
const head = `// =====================================================================
//  ELENCOS 2026-27 DO ARMADOR 64 (só no 64; o 16-bit continua com src/data/teams.js)
//  Gerado a partir das notas do NBA 2K27 (2kratings.com, nov/2026).
//  players: titulares na ordem PG, SG, SF, PF, C (o PG é você) · bench: reservas reais.
//  r: as 7 notas do jogo (convertidas do 2K para a escala do Armador)
//  x: atributos do 2K27 que só o 64 usa (drible, roubo, toco, força, impulsão...)
// =====================================================================
`;
fs.writeFileSync(new URL('../../src/v3d/roster64.js', import.meta.url), head + 'export const ROSTER64 = ' + JSON.stringify(data, null, 1).replace(/\n\s+(?=[\]}0-9"-])/g, (m) => (m.includes('"') ? m : ' ')) + ';\n');
console.log('ok', fs.statSync(new URL('../../src/v3d/roster64.js', import.meta.url)).size);
