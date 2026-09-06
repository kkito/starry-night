import { describe, it, expect } from 'vitest';
import { computeSky, computeTrack, computeStarPosition } from '../../src/core/sky';
import { loadCatalog } from '../../src/core/catalog';

const BJ = { lat: 39.9, lon: 116.4 };

describe('computeSky', () => {
  it('非法输入抛 RangeError', () => {
    expect(() => computeSky({ ...BJ, lat: 91, date: new Date() })).toThrow(RangeError);
    expect(() => computeSky({ ...BJ, lon: 200, date: new Date() })).toThrow(RangeError);
    expect(() => computeSky({ ...BJ, date: new Date('bad') })).toThrow(RangeError);
    expect(() => computeTrack({ ...BJ, start: new Date(), end: new Date(), stepMinutes: 0 })).toThrow(RangeError);
  });

  it('按 mag 升序、全部在地平线上', () => {
    // 6 月下旬天狼星接近合日、北京不可见，故选冬季时刻使其在地平线上
    const { stars } = computeSky({ ...BJ, date: new Date('2026-01-01T16:00:00Z') });
    expect(stars.length).toBeGreaterThan(100);
    for (let i = 1; i < stars.length; i++) {
      expect(stars[i]!.mag).toBeGreaterThanOrEqual(stars[i - 1]!.mag);
      expect(stars[i]!.alt).toBeGreaterThan(0);
    }
    expect(stars[0]!.id).toBe('Sirius'); // 全天最亮恒星（在地平线上时必排第一）
  });

  it('北极星高度 ≈ 纬度（±1.5°）', () => {
    const polaris = loadCatalog().find((s) => s.name === 'Polaris')!;
    const p = computeStarPosition(polaris, { ...BJ, date: new Date('2026-03-20T12:00:00Z') });
    expect(Math.abs(p.alt - BJ.lat)).toBeLessThan(1.5);
  });

  it('同一天顶距的天狼星，南半球可见而北京不可见（抽样时刻）', () => {
    // 天狼星 dec≈-16.7，北京最高 33°；选其在北京地平线下的时刻
    // 6 月下旬天狼星接近合日、南北半球均不可见，改选其西天时刻：悉尼可见而北京已落下
    const date = new Date('2026-01-01T10:00:00Z');
    const sirius = loadCatalog().find((s) => s.name === 'Sirius')!;
    const inBeijing = computeStarPosition(sirius, { ...BJ, date });
    const inSydney = computeStarPosition(sirius, { lat: -33.87, lon: 151.2, date });
    expect(inBeijing.alt).toBeLessThan(0);
    expect(inSydney.alt).toBeGreaterThan(0);
  });

  it('结果确定（同输入两次调用一致）', () => {
    const a = computeSky({ ...BJ, date: new Date('2026-01-01T00:00:00Z') });
    const b = computeSky({ ...BJ, date: new Date('2026-01-01T00:00:00Z') });
    expect(a).toEqual(b);
  });
});

describe('computeTrack', () => {
  it('时间点数量与步长正确', () => {
    const start = new Date('2026-03-20T00:00:00Z');
    const { times, tracks } = computeTrack({ ...BJ, start, end: new Date('2026-03-20T02:00:00Z'), stepMinutes: 30 });
    expect(times.length).toBe(5); // 0,30,60,90,120
    expect(times[0]!.getTime()).toBe(start.getTime());
    const first = Object.values(tracks)[0]!;
    expect(first.length).toBe(5);
  });

  it('恒星轨迹向西移动：az 随时间增大（北半球东天→西天）', () => {
    const vega = loadCatalog().find((s) => s.name === 'Vega')!;
    const { tracks } = computeTrack({ ...BJ, start: new Date('2026-03-20T12:00:00Z'), end: new Date('2026-03-20T16:00:00Z'), stepMinutes: 60 });
    const t = tracks[vega.id]!;
    expect(t[0]!.az).toBeLessThan(t[t.length - 1]!.az);
  });
});
