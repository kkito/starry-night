import { describe, it, expect } from 'vitest';
import { magToRadius, bvToColor, buildDrawList, type StarWithBv } from '../../src/lib/drawlist';

const star = (over: Partial<StarWithBv>): StarWithBv => ({
  id: 's1', ra: 0, dec: 0, az: 0, alt: 45, mag: 2, ...over,
});

describe('drawlist', () => {
  it('magToRadius 单调且 clamp', () => {
    expect(magToRadius(-1.5)).toBe(5.5);   // 天狼星级别封顶
    expect(magToRadius(0)).toBe(4.6);
    expect(magToRadius(5)).toBe(1);        // 下限
    expect(magToRadius(1)).toBeGreaterThan(magToRadius(2));
  });

  it('bvToColor 四档映射', () => {
    expect(bvToColor(-0.3)).toBe('#aabfff'); // 蓝白
    expect(bvToColor(0.2)).toBe('#f8f7ff');  // 白
    expect(bvToColor(0.6)).toBe('#ffd2a1');  // 黄
    expect(bvToColor(1.85)).toBe('#ff9d5c'); // 红（参宿四）
    expect(bvToColor(99)).toBe('#ff9d5c');   // clamp
  });

  it('buildDrawList 投影、label 阈值、bv 缺省', () => {
    const list = buildDrawList([star({ az: 0, alt: 45, mag: 0 }), star({ id: 's2', az: 90, alt: 0, mag: 2 })], 100, 200);
    expect(list[0]).toMatchObject({ x: 0, y: -100, rPx: 4.6, color: '#f8f7ff', label: true });
    expect(list[1]!).toMatchObject({ x: -100, y: 0, label: false }); // E 在左（水平半径）
    expect(list[1]!.name).toBeUndefined();
    const noBv = buildDrawList([star({ bv: undefined })], 100, 100);
    expect(noBv[0]!.color).toBe('#f8f7ff'); // bv 缺失按 0.4
  });
});
