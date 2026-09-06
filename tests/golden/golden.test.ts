import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { computeStarPosition } from '../../src/core/sky';
import { loadCatalog } from '../../src/core/catalog';

const golden = JSON.parse(readFileSync(new URL('./golden.json', import.meta.url), 'utf8'));
const byId = new Map(loadCatalog().map((s) => [s.id, s]));

const ARCSEC = 1 / 3600;

function angDist(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

describe('golden vs astronomy-engine', () => {
  for (const c of golden.cases) {
    it(`${c.id} @ (${c.lat},${c.lon}) ${c.iso}`, () => {
      const star = byId.get(c.id);
      expect(star, `星表缺少 ${c.id}`).toBeTruthy();
      const got = computeStarPosition(star!, { lat: c.lat, lon: c.lon, date: new Date(c.iso) });
      // 视位置 RA/Dec
      expect(angDist(got.ra, c.expected.raDeg)).toBeLessThan(5 * ARCSEC);
      expect(Math.abs(got.dec - c.expected.decDeg)).toBeLessThan(5 * ARCSEC);
      // 地平坐标
      expect(Math.abs(got.alt - c.expected.altDeg)).toBeLessThan(5 * ARCSEC);
      if (c.expected.altDeg > 85) {
        // 天顶附近方位角病态，改用整体球面角距（阈值 30″）
        const altR = (x: number) => (x * Math.PI) / 180;
        const sep =
          Math.acos(
            Math.sin(altR(got.alt)) * Math.sin(altR(c.expected.altDeg)) +
            Math.cos(altR(got.alt)) * Math.cos(altR(c.expected.altDeg)) *
            Math.cos(altR(got.az) - altR(c.expected.azDeg)),
          ) * (180 / Math.PI);
        expect(sep).toBeLessThan(30 * ARCSEC);
      } else {
        expect(angDist(got.az, c.expected.azDeg)).toBeLessThan(5 * ARCSEC);
      }
    });
  }
});
