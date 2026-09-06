import { describe, it, expect } from 'vitest';
import { loadCatalog } from '../../src/core/catalog';

describe('loadCatalog', () => {
  it('默认裁剪到 5.0 等，数量在 1200–2200 之间', () => {
    const stars = loadCatalog();
    expect(stars.length).toBeGreaterThan(1200);
    expect(stars.length).toBeLessThan(2200);
    expect(stars.every((s) => s.mag <= 5.0)).toBe(true);
  });

  it('magLimit 收紧后数量变少', () => {
    expect(loadCatalog(3.0).length).toBeLessThan(loadCatalog(5.0).length);
  });

  it('magLimit 超出星表上限抛 RangeError', () => {
    expect(() => loadCatalog(6.0)).toThrow(RangeError);
  });

  it('每次返回新数组（调用方可自由过滤不污染缓存）', () => {
    const a = loadCatalog();
    a.pop();
    expect(loadCatalog().length).toBeGreaterThan(a.length);
  });
});
