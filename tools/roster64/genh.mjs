// Gera src/v3d/historic64.js a partir dos times clássicos do 2K27 (rawh.json, do parseh.js).
// Uso: cd tools/roster64 && bash fetchh.sh && node parseh.js && node genh.mjs
import { TEAMS, HISTORIC } from '../../src/data/teams.js';
import fs from 'fs';

const raw = JSON.parse(fs.readFileSync(new URL('./rawh.json', import.meta.url)));
const FR = {
  'golden-state-warriors': 'ondas', 'los-angeles-lakers': 'astros', 'phoenix-suns': 'fenix', 'oklahoma-city-thunder': 'trovoes', 'seattle-supersonics': 'trovoes',
  'dallas-mavericks': 'cavaleiros', 'denver-nuggets': 'pepitas', 'los-angeles-clippers': 'veleiros', 'houston-rockets': 'foguetes', 'memphis-grizzlies': 'ursos',
  'minnesota-timberwolves': 'lobos', 'portland-trail-blazers': 'desbravadores', 'sacramento-kings': 'reis', 'san-antonio-spurs': 'esporas', 'utah-jazz': 'jazz',
  'boston-celtics': 'trevos', 'chicago-bulls': 'touros', 'milwaukee-bucks': 'cervos', 'miami-heat': 'calor', 'atlanta-hawks': 'falcoes', 'new-jersey-nets': 'redes',
  'charlotte-hornets': 'vespas', 'cleveland-cavaliers': 'paladinos', 'detroit-pistons': 'pistoes', 'indiana-pacers': 'ritmo', 'new-york-knicks': 'metro',
  'orlando-magic': 'magos', 'philadelphia-76ers': 'fundadores', 'toronto-raptors': 'raptores', 'washington-wizards': 'feiticeiros',
};
// times que jogavam com outro nome/cidade/cores
const COL = (jersey, dark, trim) => ({ jersey, dark, trim, shorts: jersey, shoes: trim });
const OVERRIDE = {
  'seattle-supersonics': { name: 'SuperSonics', city: 'Seattle', colors: COL('#00653a', '#00401f', '#ffc200') },
  'new-jersey-nets': { name: 'Nets', city: 'New Jersey', colors: COL('#002a60', '#001838', '#d21033') },
  '1999-00-toronto-raptors': { colors: COL('#5b2b82', '#3a1a55', '#bd1b21') },
  '1997-98-utah-jazz': { colors: COL('#3c2a74', '#241848', '#00a3ad') },
  '2006-07-golden-state-warriors': { colors: COL('#041e42', '#020f22', '#ff8200') },
  '1989-90-cleveland-cavaliers': { colors: COL('#1f4fa3', '#14326a', '#f58426') },
  '1985-86-atlanta-hawks': { colors: COL('#e03a3e', '#9c2028', '#fdb927') },
};
const NICK = {};
for (const t of [...TEAMS, ...HISTORIC]) for (const p of t.players) NICK[p.name.toLowerCase()] = p.nick;
Object.assign(NICK, {
  'michael jordan': 'Air Jordan', 'scottie pippen': 'Pip', 'dennis rodman': 'The Worm', 'magic johnson': 'Showtime', 'larry bird': 'Larry Legend',
  'kareem abdul-jabbar': 'Skyhook', 'wilt chamberlain': 'The Big Dipper', 'jerry west': 'The Logo', 'julius erving': 'Dr. J', 'isiah thomas': 'Zeke',
  'hakeem olajuwon': 'The Dream', "shaquille o'neal": 'Shaq', 'kobe bryant': 'Black Mamba', 'tim duncan': 'Big Fundamental', 'allen iverson': 'The Answer',
  'vince carter': 'Vinsanity', 'kevin garnett': 'The Big Ticket', 'dirk nowitzki': 'Dirk', 'steve nash': 'Nash', 'dwyane wade': 'Flash', 'gary payton': 'The Glove',
  'shawn kemp': 'Reign Man', 'karl malone': 'The Mailman', 'john stockton': 'Stockton', 'clyde drexler': 'Clyde the Glide', 'patrick ewing': 'Ewing',
  'penny hardaway': 'Penny', 'alonzo mourning': 'Zo', 'dikembe mutombo': 'Mt. Mutombo', 'yao ming': 'Yao', 'tracy mcgrady': 'T-Mac', 'derrick rose': 'D-Rose',
  'carmelo anthony': 'Melo', 'kevin durant': 'KD', 'russell westbrook': 'Russ', 'jeremy lin': 'Linsanity', 'chris paul': 'CP3', 'blake griffin': 'Blake',
  'paul pierce': 'The Truth', 'ray allen': 'Ray Ray', 'walt frazier': 'Clyde', 'oscar robertson': 'Big O', 'elgin baylor': 'Mr. Inside', 'gilbert arenas': 'Agent Zero',
  'baron davis': 'Boom Dizzle', 'chris webber': 'C-Webb', 'jason kidd': 'J-Kidd', 'muggsy bogues': 'Muggsy', 'larry johnson': 'Grandmama', 'spud webb': 'Spud',
  'dominique wilkins': 'Human Highlight Film', 'brandon roy': 'B-Roy', 'marc gasol': 'Big Spain', 'pau gasol': 'Pau', 'zach randolph': 'Z-Bo',
  'tony allen': 'Grindfather', 'kawhi leonard': 'The Klaw', 'manu ginobili': 'Manu', 'tony parker': 'TP', 'chauncey billups': 'Mr. Big Shot', 'ben wallace': 'Big Ben',
});
const S = ['PG', 'SG', 'SF', 'PF', 'C'];
const clamp = (v) => Math.max(10, Math.min(99, Math.round(v)));
const avg = (...v) => v.reduce((a, b) => a + b) / v.length;
function conv(p) {
  const a = p.a;
  const r = [
    clamp(1.46 * a['shot-3pt'] - 41), clamp(a['mid-range-shot'] - 4),
    clamp(0.5 * a.layup + 0.2 * a['close-shot'] + 0.3 * Math.max(a['driving-dunk'], a['standing-dunk'])),
    clamp(12.8 + 0.85 * avg(a['pass-accuracy'], a['pass-iq'], a['pass-vision'])), clamp(24 + 0.7 * avg(a.speed, a['speed-with-ball'])),
    clamp(18.7 + 0.91 * avg(a['perimeter-defense'], a['interior-defense'], a['help-defense-iq'], a.steal, a.block)),
    clamp(14 + 0.91 * (0.65 * a['defensive-rebound'] + 0.35 * a['offensive-rebound'])),
  ];
  const x = {
    hdl: a['ball-handle'], swb: a['speed-with-ball'], stl: a.steal, blk: a.block, str: a.strength, vrt: a.vertical, agi: a.agility, sta: a.stamina,
    ft: a['free-throw'], dnk: Math.max(a['driving-dunk'], a['standing-dunk']), lay: a.layup, cls: a['close-shot'], per: a['perimeter-defense'], int: a['interior-defense'],
    pst: a['post-control'], hok: a['post-hook'], fad: a['post-fade'], drw: a['draw-foul'], hnd: a.hands, ppc: a['pass-perception'], orb: a['offensive-rebound'],
    drb: a['defensive-rebound'], ovr: p.ovr,
  };
  const name = p.name.replace(/\s+/g, ' ');
  const last = name.replace(/ (Jr\.|Sr\.|II|III|IV)$/, '').split(' ').pop();
  return { name, nick: NICK[name.toLowerCase()] || last, cm: p.cm, r: Object.fromEntries(['three', 'mid', 'fin', 'pass', 'spd', 'def', 'reb'].map((k, i) => [k, r[i]])), x };
}
function bestFive(list) {
  const pool = list.slice(0, 11);
  if (pool.length < 5) return null;
  let best = null;
  let bestV = -1;
  const fit = (p, s) => (p.pos[0] === s ? 1.5 : p.pos.includes(s) ? 0 : -8);
  const rec = (i, used, pick, v) => {
    if (i === 5) {
      if (v > bestV) [bestV, best] = [v, pick.slice()];
      return;
    }
    for (let k = 0; k < pool.length; k++) {
      if (used & (1 << k)) continue;
      pick.push(pool[k]);
      rec(i + 1, used | (1 << k), pick, v + pool[k].ovr + fit(pool[k], S[i]));
      pick.pop();
    }
  };
  rec(0, 0, [], 0);
  return best;
}
const have = new Set(HISTORIC.map((h) => `${h.base}:${h.era}`));
const out = [];
const skipped = [];
for (const [slug, list0] of Object.entries(raw)) {
  const m = slug.match(/^(\d{4})-(\d{2})-(.+)$/);
  if (!m) continue;
  const fr = m[3];
  const base = FR[fr];
  const era = Number(m[1]) + 1;
  if (!base) {
    skipped.push(`${slug} (sem franquia)`);
    continue;
  }
  if (have.has(`${base}:${era}`)) {
    skipped.push(`${slug} (ja existe)`);
    continue;
  }
  const list = list0.filter((p) => p.ovr > 0 && p.cm).sort((a, b) => b.ovr - a.ovr);
  const five = bestFive(list);
  if (!five) {
    skipped.push(`${slug} (elenco curto)`);
    continue;
  }
  const rest = list.filter((p) => !five.includes(p));
  const bench = bestFive(rest);
  const ov = { ...(OVERRIDE[fr] || {}), ...(OVERRIDE[slug] || {}) };
  const stars = list.slice(0, 3).map((p) => conv(p).nick);
  out.push({
    base,
    era,
    season: `${m[1]}-${m[2]}`,
    style: `Temporada ${m[1]}-${m[2]}: ${stars[0]}, ${stars[1]} e ${stars[2]}`,
    ...(ov.name ? { name: ov.name } : {}),
    ...(ov.city ? { city: ov.city } : {}),
    ...(ov.colors ? { colors: ov.colors } : {}),
    players: five.map(conv),
    bench: bench ? bench.map((p) => ({ ...conv(p), bench: true })) : null,
  });
}
out.sort((a, b) => a.base.localeCompare(b.base) || b.era - a.era);
const head = `// =====================================================================
//  TIMES HISTÓRICOS A MAIS DO ARMADOR 64 (só no 64)
//  Gerado das versões clássicas do NBA 2K27 (2kratings.com, nov/2026) por tools/roster64/genh.mjs.
//  Somam-se aos históricos que o jogo já tinha (as épocas repetidas ficaram de fora).
//  era = ano em que a temporada terminou (1995-96 -> 1996).
// =====================================================================
`;
fs.writeFileSync(new URL('../../src/v3d/historic64.js', import.meta.url), head + 'export const HISTORIC64 = ' + JSON.stringify(out) + ';\n');
const per = out.reduce((a, h) => ((a[h.base] = (a[h.base] || 0) + 1), a), {});
console.log('novos:', out.length, '|', Object.entries(per).map(([k, v]) => `${k} ${v}`).join(', '));
console.log('fora:', skipped.join(' | '));
