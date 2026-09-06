import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const MAG_LIMIT = 5.0;
const raw = JSON.parse(readFileSync('data/raw/stars.6.json', 'utf8'));
const names = JSON.parse(readFileSync('data/raw/starnames.json', 'utf8'));
const stars = [];
let skipped = 0;
const seenIds = new Set();

raw.features.forEach((f, i) => {
  const p = f.properties ?? {};
  const [ra0, dec] = f.geometry.coordinates;
  // 归一化 RA 到 [0, 360)，原始数据存在少量负值
  const ra = ((ra0 % 360) + 360) % 360;
  if (typeof p.mag !== 'number' || !Number.isFinite(p.mag)) { skipped++; return; }
  if (p.mag > MAG_LIMIT) return;
  // stars.6.json 的 properties 只有 mag/bv；名称需按 Hipparcos 编号(f.id)查 starnames.json
  // starnames.json 中部分条目 name/hip 为空串，需视为缺失
  const info = f.id != null ? names[String(f.id)] : undefined;
  const name = info?.name || undefined;
  const des = info?.hip || (f.id != null ? `HIP ${f.id}` : undefined);
  let id = name ?? des ?? `star-${i}`;
  // 不同星可能共用同一专名（如 Tarazed），用 Hipparcos 编号消歧保证 id 唯一
  if (seenIds.has(id)) id = `${id} ${des ?? `star-${i}`}`;
  seenIds.add(id);
  // bv 在 stars.6.json 中为字符串（可能为空串），需转为 number；空串/NaN 视为缺失
  const bv = typeof p.bv === 'string' ? parseFloat(p.bv) : p.bv;
  stars.push({
    id,
    ...(name ? { name } : {}),
    mag: p.mag,
    ...(typeof bv === 'number' && Number.isFinite(bv) ? { bv } : {}),
    raDeg: ra,
    decDeg: dec,
  });
});

mkdirSync('data', { recursive: true });
writeFileSync(
  'data/catalog.json',
  JSON.stringify(
    { source: 'd3-celestial stars.6.json', magLimit: MAG_LIMIT, generated: new Date().toISOString(), count: stars.length, skipped, stars },
    null,
    1,
  ),
);
console.log(`stars: ${stars.length}, skipped(no mag): ${skipped}`);
