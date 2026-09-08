import { describe, expect, it } from 'vitest';
import { belowHorizonNote, filterTableStars, formatStarMag } from '../../lib/table-format';
import type { SkyStar } from '../../../../src/core/sky';

const rows: SkyStar[] = [
  { id: 'a', name: '织女星', nameEn: 'Vega', ra: 0, dec: 0, az: 10, alt: 20, mag: 0.03 },
  { id: 'b', name: '牛郎星', nameEn: 'Altair', ra: 0, dec: 0, az: 20, alt: -5, mag: 1.9 },
  { id: 'c', ra: 0, dec: 0, az: 30, alt: 40, mag: 3.756 },
];

describe('table 星表对齐 (I3)', () => {
  it('nameEn 匹配：搜 vega 能命中织女星', () => {
    const hit = filterTableStars(rows, 'vega');
    expect(hit.map((s) => s.id)).toContain('a');
  });

  it('恒星 mag 保留两位小数展示', () => {
    expect(formatStarMag(3.756)).toBe('3.76');
    expect(formatStarMag(1.9)).toBe('1.90');
  });

  it('地平线下注记：alt<=0 标注', () => {
    expect(belowHorizonNote(-5)).toBe('（地平线下）');
    expect(belowHorizonNote(0)).toBe('（地平线下）');
    expect(belowHorizonNote(20)).toBe('');
  });
});
