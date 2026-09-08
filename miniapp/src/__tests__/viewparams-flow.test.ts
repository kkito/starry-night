import { describe, expect, it } from 'vitest';
import { computeSky } from '../../../src/core/sky';
import { buildDrawList } from '../../../src/lib/drawlist';

const DATE = new Date('2026-09-08T20:00:00+08:00');

describe('viewparams flow (settings → recompute)', () => {
  it('topN 50→100 可见星数增加', () => {
    const { stars } = computeSky({ lat: 31.2304, lon: 121.4737, date: DATE });
    expect(stars.length).toBeGreaterThan(100);
    expect(stars.slice(0, 100).length).toBeGreaterThan(stars.slice(0, 50).length);
  });

  it('mirror 翻转 drawList x 符号翻转', () => {
    const { stars } = computeSky({ lat: 31.2304, lon: 121.4737, date: DATE });
    const top = stars.slice(0, 50);
    const normal = buildDrawList(top, 300, 300, false);
    const mirrored = buildDrawList(top, 300, 300, true);
    const pairs = normal
      .map((d, i) => ({ a: d.x, b: mirrored[i]!.x }))
      .filter(({ a }) => Math.abs(a) > 1e-9);
    expect(pairs.length).toBeGreaterThan(0);
    for (const { a, b } of pairs) {
      expect(b).toBeCloseTo(-a, 9);
    }
  });
});
