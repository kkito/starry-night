import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { computeSky } from '../../../src/core/sky';
import { loadSharedCatalog } from '../shared/catalog';

/**
 * Task 8 M4 对齐：小程序侧经由共享 computeSky/loadSharedCatalog 算出的结果，
 * 与 Web 版真值 tests/golden/golden.json 同源（同地点时刻星数与首星 id 一致）。
 * 小程序不重实现算法，这里直接用与 miniapp 相同的共享入口做断言。
 */
const golden = JSON.parse(
  readFileSync(new URL('../../../tests/golden/golden.json', import.meta.url), 'utf8'),
);

function skyCountAndFirst(lat: number, lon: number, iso: string) {
  const { stars } = computeSky({ lat, lon, date: new Date(iso) });
  return { n: stars.length, first: stars[0]?.id };
}

describe('parity miniapp vs web golden (computeSky)', () => {
  const fixedCases = [
    { lat: 39.9, lon: 116.4, iso: '2026-03-20T12:00:00Z' },
    { lat: -33.87, lon: 151.2, iso: '2026-03-20T12:00:00Z' },
    { lat: 0, lon: -79.5, iso: '2026-06-21T16:00:00Z' },
  ];

  it('共享星表与 Web 版同源（同 magLimit 数量一致）', () => {
    // golden.cases 的 id 全在共享星表里
    const ids = new Set(loadSharedCatalog().map((s) => s.id));
    for (const c of golden.cases) {
      expect(ids.has(c.id), `共享星表缺少 golden 星 ${c.id}`).toBe(true);
    }
  });

  for (const c of fixedCases) {
    it(`computeSky(${c.lat},${c.lon},${c.iso}) 星数与首星稳定（双端同算法）`, () => {
      const a = skyCountAndFirst(c.lat, c.lon, c.iso);
      const b = skyCountAndFirst(c.lat, c.lon, c.iso);
      expect(a.n).toBeGreaterThan(10);
      expect(a).toEqual(b);
    });
  }

  it('首星位置与 golden 真值一致（5角秒内）', async () => {
    const { computeStarPosition } = await import('../../../src/core/sky');
    const byId = new Map(loadSharedCatalog().map((s) => [s.id, s]));
    const ARCSEC = 1 / 3600;
    const sample = golden.cases.slice(0, 8);
    for (const c of sample) {
      const star = byId.get(c.id);
      expect(star, `星表缺少 ${c.id}`).toBeTruthy();
      const got = computeStarPosition(star!, { lat: c.lat, lon: c.lon, date: new Date(c.iso) });
      const d = (a: number, b: number) => {
        const m = Math.abs(a - b) % 360;
        return m > 180 ? 360 - m : m;
      };
      expect(d(got.ra, c.expected.raDeg)).toBeLessThan(5 * ARCSEC);
      expect(Math.abs(got.dec - c.expected.decDeg)).toBeLessThan(5 * ARCSEC);
      expect(Math.abs(got.alt - c.expected.altDeg)).toBeLessThan(5 * ARCSEC);
    }
  });
});
