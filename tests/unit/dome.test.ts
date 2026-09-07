import { describe, it, expect } from 'vitest';
import { altAzToVec, pointSizeFor } from '../../src/lib/dome';
import { computeTrackAround } from '../../src/lib/track';
import { magToRadius, solarRadius } from '../../src/lib/drawlist';

describe('altAzToVec（北=-z、南=+z、东=+x、天顶=+y）', () => {
  const R = 400;
  it('天顶在 +y 轴', () => {
    const p = altAzToVec(123, 90, R);
    expect(p.x).toBeCloseTo(0, 9);
    expect(p.y).toBeCloseTo(R, 9);
    expect(p.z).toBeCloseTo(0, 9);
  });
  it('北（az=0, alt=0）在 -z', () => {
    const p = altAzToVec(0, 0, R);
    expect(p.x).toBeCloseTo(0, 9);
    expect(p.y).toBeCloseTo(0, 9);
    expect(p.z).toBeCloseTo(-R, 9);
  });
  it('南（az=180）在 +z，东（az=90）在 +x', () => {
    expect(altAzToVec(180, 0, R).z).toBeCloseTo(R, 9);
    expect(altAzToVec(90, 0, R).x).toBeCloseTo(R, 9);
    expect(altAzToVec(270, 0, R).x).toBeCloseTo(-R, 9);
  });
  it('alt=45 模长仍为 R（贴球面）', () => {
    const p = altAzToVec(30, 45, R);
    expect(Math.hypot(p.x, p.y, p.z)).toBeCloseTo(R, 9);
  });
});

describe('pointSizeFor：与 2D rPx 同序（越亮越大），太阳系天体更大', () => {
  it('rPx 越大尺寸越大', () => {
    expect(pointSizeFor(magToRadius(0))).toBeGreaterThan(pointSizeFor(magToRadius(3)));
    expect(pointSizeFor(magToRadius(3))).toBeGreaterThan(pointSizeFor(magToRadius(5)));
  });
  it('同星等下太阳系天体比恒星大', () => {
    expect(pointSizeFor(solarRadius(2))).toBeGreaterThan(pointSizeFor(magToRadius(2)));
  });
  it('保底 2px 可见', () => {
    expect(pointSizeFor(magToRadius(9))).toBeGreaterThanOrEqual(2);
  });
});

describe('computeTrackAround 回填 az', () => {
  it('points 每个点都有有限 az', () => {
    const track = computeTrackAround('Sirius', {
      lat: 31.2304, lon: 121.4737, date: new Date('2026-09-06T12:00:00Z'), rx: 270, ry: 270,
    })!;
    expect(track.points).toHaveLength(73);
    for (const p of track.points) {
      expect(Number.isFinite(p.az)).toBe(true);
      expect(p.az).toBeGreaterThanOrEqual(0);
      expect(p.az).toBeLessThan(360);
    }
  });
});
