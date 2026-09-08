import { describe, expect, it } from 'vitest';
import { computeSky } from '../../../src/core/sky';
import { loadSharedCatalog } from '../shared/catalog';

describe('shared core in miniapp', () => {
  it('computeSky returns sorted visible stars for Shanghai now', () => {
    const { stars } = computeSky({ lat: 31.2304, lon: 121.4737, date: new Date('2026-09-08T20:00:00+08:00') });
    expect(stars.length).toBeGreaterThan(10);
    for (let i = 1; i < Math.min(20, stars.length); i++) {
      expect(stars[i]!.mag >= stars[i - 1]!.mag).toBe(true);
    }
  });

  it('loadSharedCatalog is the single entry to the shared catalog', () => {
    const stars = loadSharedCatalog();
    expect(stars.length).toBeGreaterThan(10);
  });
});
