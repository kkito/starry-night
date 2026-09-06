import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

describe('data/catalog.json', () => {
  const cat = JSON.parse(readFileSync(new URL('../../data/catalog.json', import.meta.url), 'utf8'));

  it('结构完整', () => {
    expect(cat.source).toContain('stars.6.json');
    expect(cat.magLimit).toBe(5.0);
    expect(cat.stars.length).toBe(cat.count);
    expect(cat.stars.length).toBeGreaterThan(1000);
  });

  it('每颗星字段合法且 id 唯一', () => {
    const ids = new Set<string>();
    for (const s of cat.stars) {
      expect(typeof s.id).toBe('string');
      expect(s.id.length).toBeGreaterThan(0);
      expect(s.mag).toBeLessThanOrEqual(5.0);
      expect(s.raDeg).toBeGreaterThanOrEqual(0);
      expect(s.raDeg).toBeLessThan(360);
      expect(s.decDeg).toBeGreaterThanOrEqual(-90);
      expect(s.decDeg).toBeLessThanOrEqual(90);
      ids.add(s.id);
    }
    expect(ids.size).toBe(cat.stars.length);
  });

  it('包含知名亮星', () => {
    const names = new Set(cat.stars.map((s: { name?: string }) => s.name));
    for (const n of ['Sirius', 'Vega', 'Canopus', 'Polaris']) expect(names).toContain(n);
  });
});
