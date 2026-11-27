const fs = require('fs');
const out = {};
for (const f of fs.readdirSync('.').filter((f) => f.startsWith('h_'))) {
  const slug = f.slice(2, -5);
  const s = fs.readFileSync(f, 'utf8');
  const rows = s.split('<tr data-shot-3pt=').slice(1);
  const players = [];
  for (const r0 of rows) {
    const r = r0.split('</tr>')[0];
    const attrs = {};
    const head = 'data-shot-3pt=' + r.split('>')[0];
    for (const m of head.matchAll(/data-([a-z0-9-]+)="([^"]*)"/g)) attrs[m[1]] = isNaN(+m[2]) ? m[2] : +m[2];
    const name = (r.match(/data-full="([^"]+)"/) || [])[1];
    const href = (r.match(/<a href="https:\/\/www\.2kratings\.com\/([a-z0-9-]+)"/) || [])[1];
    const pos = [...r.matchAll(/href="\/lists\/(point-guard|shooting-guard|small-forward|power-forward|center)" title="[^"]+">([A-Z]+)</g)].map((m) => m[2]);
    const h = r.match(/(\d)&apos;(\d+)&quot;/);
    const cm = h ? Math.round((+h[1] * 12 + +h[2]) * 2.54) : null;
    const ovr = +((r.split('</td>')[2] || '').match(/data-sort="(\d+)"/) || [])[1];
    const arch = ((r.match(/optional-info">\s*\|\s*([^<]+)</) || [])[1] || '').trim();
    if (name) players.push({ name: name.replace(/&#039;|&apos;|&#8217;/g, "'").replace(/&amp;/g, '&'), href, pos, cm, ovr, arch, a: attrs });
  }
  out[slug] = players;
}
fs.writeFileSync('rawh.json', JSON.stringify(out));
for (const [k, v] of Object.entries(out)) console.log(k, v.length, v.slice(0, 6).map((p) => `${p.name} ${p.pos.join('/')} ${p.cm} ${p.ovr}`).join(' | '));
