// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { computeSolarBodies, SOLAR_BODIES } from '../../src/core/ephemeris';

// 参考点：北京（39.9N, 116.4E）
const OPTS = { lat: 39.9, lon: 116.4, date: new Date('2026-09-06T00:00:00Z') };

describe('computeSolarBodies', () => {
  const bodies = computeSolarBodies(OPTS);

  it('返回七颗行星 + 月亮，共 8 个（地球不在天上）', () => {
    expect(bodies.map((b) => b.id).sort()).toEqual(
      ['jupiter', 'mars', 'mercury', 'moon', 'neptune', 'saturn', 'uranus', 'venus'].sort(),
    );
    expect(bodies).toHaveLength(8);
  });

  it('每个天体的坐标与星等数值有效', () => {
    for (const b of bodies) {
      expect(b.ra).toBeGreaterThanOrEqual(0);
      expect(b.ra).toBeLessThan(360);
      expect(b.dec).toBeGreaterThanOrEqual(-90);
      expect(b.dec).toBeLessThanOrEqual(90);
      expect(Number.isFinite(b.az)).toBe(true);
      expect(Number.isFinite(b.alt)).toBe(true);
      expect(Number.isFinite(b.mag)).toBe(true);
      expect(b.distAu).toBeGreaterThan(0);
    }
  });

  it('月亮地心距离在物理范围内（0.0021–0.0029 AU）', () => {
    const moon = bodies.find((b) => b.id === 'moon')!;
    expect(moon.distAu).toBeGreaterThan(0.0021);
    expect(moon.distAu).toBeLessThan(0.0029);
  });

  it('外行星位置与 2026 年 9 月已知天象一致（宽松区间）', () => {
    // 2026-09：木星在巨蟹座（RA 约 9.16h=137°，Dec 约 +17°）；土星在双鱼座（RA 约 23.9h=359°）
    const jup = bodies.find((b) => b.id === 'jupiter')!;
    expect(jup.ra).toBeGreaterThan(130);
    expect(jup.ra).toBeLessThan(145);
    expect(jup.dec).toBeGreaterThan(12);
    expect(jup.dec).toBeLessThan(22);
    const sat = bodies.find((b) => b.id === 'saturn')!;
    expect(sat.ra).toBeGreaterThan(8);   // 双鱼座东段（约 0.9h）
    expect(sat.ra).toBeLessThan(20);
    expect(Math.abs(sat.dec)).toBeLessThan(6);
  });

  it('refraction 选项影响地平线附近的高度角', () => {
    const withR = computeSolarBodies({ ...OPTS, refraction: true });
    const noR = computeSolarBodies({ ...OPTS, refraction: false });
    for (let i = 0; i < withR.length; i++) {
      // 大气折射使视高度角抬高（接近天顶时差值趋近 0）
      expect(withR[i]!.alt).toBeGreaterThanOrEqual(noR[i]!.alt - 1e-9);
    }
  });

  it('无效参数抛出 RangeError', () => {
    expect(() => computeSolarBodies({ ...OPTS, lat: 95 })).toThrow(RangeError);
    expect(() => computeSolarBodies({ ...OPTS, lon: 200 })).toThrow(RangeError);
    expect(() => computeSolarBodies({ ...OPTS, date: new Date('bad') })).toThrow(RangeError);
  });
});
