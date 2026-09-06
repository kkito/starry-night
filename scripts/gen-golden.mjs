import { readFileSync, writeFileSync } from 'node:fs';
import * as A from 'astronomy-engine';

const cat = JSON.parse(readFileSync('data/catalog.json', 'utf8'));
const PICK = ['Sirius', 'Canopus', 'Rigil Kentaurus', 'Polaris', 'Vega', 'Betelgeuse', 'Aldebaran', 'Fomalhaut'];
const stars = PICK.map((name) => {
  const s = cat.stars.find((x) => x.name === name);
  if (!s) throw new Error(`星表中找不到 ${name}，请检查 name 拼写后重试`);
  return s;
});
const BODIES = [A.Body.Star1, A.Body.Star2, A.Body.Star3, A.Body.Star4, A.Body.Star5, A.Body.Star6, A.Body.Star7, A.Body.Star8];
// DefineStar 的 ra 单位是恒星时小时，星表存的是度
stars.forEach((s, i) => A.DefineStar(BODIES[i], s.raDeg / 15, s.decDeg, 100));

const SITES = [
  { lat: 39.9, lon: 116.4 },
  { lat: -33.87, lon: 151.2 },
  { lat: 78.22, lon: 15.65 },
  { lat: 0, lon: -79.5 },
];
const DATES = ['2000-01-01T12:00:00Z', '2026-03-20T12:00:00Z', '2026-06-21T16:00:00Z', '2025-12-31T23:30:00Z'];

const cases = [];
for (let i = 0; i < stars.length; i++) {
  const s = stars[i];
  for (const site of SITES) {
    for (const iso of DATES) {
      const date = new Date(iso);
      const observer = new A.Observer(site.lat, site.lon, 0);
      const equ = A.Equator(BODIES[i], date, observer, true, true); // ofdate + aberration
      const hor = A.Horizon(date, observer, equ.ra, equ.dec, null); // 不加折射，与本实现口径一致
      cases.push({
        id: s.id, lat: site.lat, lon: site.lon, iso,
        expected: {
          raDeg: (equ.ra * 15) % 360, // equ.ra 单位是恒星时小时
          decDeg: equ.dec,
          azDeg: hor.azimuth,
          altDeg: hor.altitude,
        },
      });
    }
  }
}

writeFileSync(
  'tests/golden/golden.json',
  JSON.stringify({ generated: new Date().toISOString(), reference: 'astronomy-engine', cases }, null, 1),
);
console.log(`golden cases: ${cases.length}`);
