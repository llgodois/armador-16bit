import { TEAMS, HISTORIC } from '../../src/data/teams.js';
import fs from 'fs';
const raw = JSON.parse(fs.readFileSync(new URL('./raw.json', import.meta.url)));
const SLUG = {
  ondas: 'golden-state-warriors', astros: 'los-angeles-lakers', fenix: 'phoenix-suns', trovoes: 'oklahoma-city-thunder', cavaleiros: 'dallas-mavericks',
  pepitas: 'denver-nuggets', veleiros: 'los-angeles-clippers', foguetes: 'houston-rockets', ursos: 'memphis-grizzlies', lobos: 'minnesota-timberwolves',
  pelicanos: 'new-orleans-pelicans', desbravadores: 'portland-trail-blazers', reis: 'sacramento-kings', esporas: 'san-antonio-spurs', jazz: 'utah-jazz',
  trevos: 'boston-celtics', touros: 'chicago-bulls', cervos: 'milwaukee-bucks', calor: 'miami-heat', falcoes: 'atlanta-hawks', redes: 'brooklyn-nets',
  vespas: 'charlotte-hornets', paladinos: 'cleveland-cavaliers', pistoes: 'detroit-pistons', ritmo: 'indiana-pacers', metro: 'new-york-knicks',
  magos: 'orlando-magic', fundadores: 'philadelphia-76ers', raptores: 'toronto-raptors', feiticeiros: 'washington-wizards',
};
// apelidos já usados no jogo (mesmo nome) + alguns conhecidos
const NICK = {};
for (const t of [...TEAMS, ...HISTORIC]) for (const p of t.players) NICK[p.name.toLowerCase()] = p.nick;
Object.assign(NICK, {
  'cooper flagg': 'Flagg', 'giannis antetokounmpo': 'Greek Freak', 'kevin durant': 'KD', 'lebron james': 'King', 'anthony davis': 'AD', 'trae young': 'Ice Trae',
  'lamelo ball': 'Melo', 'ja morant': 'Ja', 'damian lillard': 'Dame', 'kawhi leonard': 'The Klaw', 'james harden': 'The Beard', 'kyrie irving': 'Uncle Drew',
  'paul george': 'PG13', 'joel embiid': 'The Process', 'jaylen brown': 'JB', 'jimmy butler': 'Jimmy Buckets', 'klay thompson': 'Klay', 'zach lavine': 'Zach',
  'demar derozan': 'DeMar', 'victor wembanyama': 'Wemby', 'shai gilgeous-alexander': 'SGA', 'nikola jokic': 'Joker', 'luka doncic': 'Luka Magic',
  'karl-anthony towns': 'KAT', 'aj dybantsa': 'AJ', 'cameron boozer': 'Boozer', 'darryn peterson': 'DP', 'caleb wilson': 'Caleb', 'zion williamson': 'Zion',
});
const S = ['PG', 'SG', 'SF', 'PF', 'C'];
const clamp = (v) => Math.max(10, Math.min(99, Math.round(v)));
const avg = (...v) => v.reduce((a, b) => a + b) / v.length;
function conv(p) {
  const a = p.a;
  const r = [
    clamp(1.46 * a['shot-3pt'] - 41),
    clamp(a['mid-range-shot'] - 4),
    clamp(0.5 * a.layup + 0.2 * a['close-shot'] + 0.3 * Math.max(a['driving-dunk'], a['standing-dunk'])),
    clamp(12.8 + 0.85 * avg(a['pass-accuracy'], a['pass-iq'], a['pass-vision'])),
    clamp(24 + 0.7 * avg(a.speed, a['speed-with-ball'])),
    clamp(18.7 + 0.91 * avg(a['perimeter-defense'], a['interior-defense'], a['help-defense-iq'], a.steal, a.block)),
    clamp(14 + 0.91 * (0.65 * a['defensive-rebound'] + 0.35 * a['offensive-rebound'])),
  ];
  // atributos do 2K27 que só o 64 usa (escala original 25-99)
  const x = {
    hdl: a['ball-handle'], swb: a['speed-with-ball'], stl: a.steal, blk: a.block, str: a.strength, vrt: a.vertical, agi: a.agility,
    sta: a.stamina, ft: a['free-throw'], dnk: Math.max(a['driving-dunk'], a['standing-dunk']), lay: a.layup, cls: a['close-shot'],
    per: a['perimeter-defense'], int: a['interior-defense'], pst: a['post-control'], hok: a['post-hook'], fad: a['post-fade'], drw: a['draw-foul'],
    hnd: a.hands, ppc: a['pass-perception'], orb: a['offensive-rebound'], drb: a['defensive-rebound'], ovr: p.ovr,
  };
  const last = p.name.replace(/ (Jr\.|Sr\.|II|III|IV)$/, '').split(' ').pop();
  return { name: p.name, nick: NICK[p.name.toLowerCase()] || last, cm: p.cm, r, x, arch: p.arch, pos: p.pos };
}
// melhor quinteto: maximiza a soma do OVR respeitando as posições (a principal vale um pouco mais)
function bestFive(list) {
  const pool = list.slice(0, 11);
  let best = null, bestV = -1;
  const fit = (p, s) => (p.pos[0] === s ? 1.5 : p.pos.includes(s) ? 0 : -8);
  const rec = (i, used, pick, v) => {
    if (i === 5) { if (v > bestV) { bestV = v; best = pick.slice(); } return; }
    for (let k = 0; k < pool.length; k++) { if (used & (1 << k)) continue; pick.push(pool[k]); rec(i + 1, used | (1 << k), pick, v + pool[k].ovr + fit(pool[k], S[i])); pick.pop(); }
  };
  rec(0, 0, [], 0);
  return best;
}
const out = {};
const rep = [];
for (const [id, slug] of Object.entries(SLUG)) {
  const list = raw[slug].filter((p) => p.ovr > 0 && p.cm).sort((a, b) => b.ovr - a.ovr);
  const five = bestFive(list);
  const rest = list.filter((p) => !five.includes(p));
  const bench = bestFive(rest);
  out[id] = { players: five.map(conv), bench: bench.map(conv) };
  rep.push(`${id.padEnd(14)} ${five.map((p, i) => `${S[i]} ${p.name} ${p.ovr}`).join(' · ')}`);
}
fs.writeFileSync(new URL('./roster.json', import.meta.url), JSON.stringify(out));
console.log(rep.join('\n'));
