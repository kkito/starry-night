import { describe, it, expect } from 'vitest';
import { computeTrackAround } from '../../src/lib/track';
import { computeStarPosition } from '../../src/core/sky';
import { loadCatalog } from '../../src/core/catalog';
import { projectAltAz } from '../../src/lib/project';

const opts = { lat: 31.2304, lon: 121.4737, rx: 270, ry: 270 };

describe('computeTrackAround', () => {
  it('恒星：73 个采样点，当前时刻下标 36', () => {
    const track = computeTrackAround('Sirius', { ...opts, date: new Date('2026-09-06T12:00:00Z') })!;
    expect(track.id).toBe('Sirius');
    expect(track.points).toHaveLength(73);
    expect(track.pastCount).toBe(36);
  });

  it('当前时刻点与 computeStarPosition 的投影一致', () => {
    const date = new Date('2026-09-06T12:00:00Z');
    const track = computeTrackAround('Sirius', { ...opts, date })!;
    const star = loadCatalog().find((s) => s.id === 'Sirius')!;
    const p = computeStarPosition(star, { lat: opts.lat, lon: opts.lon, date });
    const pr = projectAltAz(p.alt, p.az, opts.rx, opts.ry);
    expect(track.points[36]!.x).toBeCloseTo(pr.x, 6);
    expect(track.points[36]!.y).toBeCloseTo(pr.y, 6);
    expect(track.points[36]!.alt).toBeCloseTo(p.alt, 6);
  });

  it('前后端点位置不同（天球旋转产生轨迹）', () => {
    const track = computeTrackAround('Sirius', { ...opts, date: new Date('2026-09-06T12:00:00Z') })!;
    const a = track.points[0]!;
    const b = track.points[72]!;
    expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(1);
  });

  it('太阳系天体（月亮）同样可算轨迹', () => {
    const track = computeTrackAround('moon', { ...opts, date: new Date('2026-09-06T12:00:00Z') })!;
    expect(track.points).toHaveLength(73);
    expect(track.pastCount).toBe(36);
  });

  it('未知 id 返回 null', () => {
    expect(computeTrackAround('no-such-star', { ...opts, date: new Date() })).toBeNull();
  });
});
