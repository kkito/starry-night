import { describe, it, expect } from 'vitest';
import { drawSkyScene } from '@starry/sky-core/lib/sky-scene';
import type { DrawStar } from '@starry/sky-core/lib/drawlist';
import type { StarTrack } from '@starry/sky-core/lib/track';

const star = (id: string, az: number, alt: number): DrawStar =>
  ({ id, name: id, x: 0, y: 0, rPx: 3, color: '#ffffff', label: false, az, alt, mag: 1 });

function makeCtx() {
  const calls: string[] = [];
  const gradient = { addColorStop: () => {} };
  const ctx = {
    canvas: { width: 0, height: 0 },
    createLinearGradient: () => gradient,
    fillRect: () => calls.push('fillRect'),
    beginPath: () => calls.push('beginPath'),
    arc: () => calls.push('arc'),
    fill: () => calls.push('fill'),
    stroke: () => calls.push('stroke'),
    moveTo: () => {}, lineTo: () => {}, closePath: () => {},
    ellipse: () => calls.push('ellipse'),
    fillText: () => calls.push('fillText'),
    setLineDash: () => {},
    fillStyle: '', strokeStyle: '', font: '', textAlign: '', textBaseline: '',
  };
  return { ctx: ctx as unknown as CanvasRenderingContext2D, calls };
}

const cam = { yaw: Math.PI, pitch: (25 * Math.PI) / 180, fov: 65 };

describe('drawSkyScene', () => {
  it('画出背景/辉光/星点，正前方星在返回表中且坐标居中', () => {
    const { ctx, calls } = makeCtx();
    const pos = drawSkyScene(ctx, { w: 800, h: 600, cam, stars: [star('s1', 180, 25)], track: null });
    expect(calls).toContain('fillRect');
    expect(calls).toContain('ellipse');
    expect(calls.filter((c) => c === 'arc').length).toBeGreaterThan(0);
    expect(pos.get('s1')).toBeTruthy();
    expect(Math.abs(pos.get('s1')!.x - 400)).toBeLessThan(2);
    expect(Math.abs(pos.get('s1')!.y - 300)).toBeLessThan(2);
  });
  it('背后星不画也不进表；剪影与方位文字随 yaw 出现', () => {
    const { ctx, calls } = makeCtx();
    const pos = drawSkyScene(ctx, { w: 800, h: 600, cam, stars: [star('behind', 0, 25)], track: null });
    expect(pos.size).toBe(0);
    const { ctx: ctx2, calls: calls2 } = makeCtx();
    drawSkyScene(ctx2, { w: 800, h: 600, cam, stars: [], track: null });
    expect(calls2).toContain('fillText'); // 「南」
    expect(calls2.filter((c) => c === 'fillRect').length).toBeGreaterThan(1); // 树干/楼（az200 树可见）
  });
  it('轨迹：选中星带 track 时画实线+虚线两组', () => {
    const { ctx, calls } = makeCtx();
    const track: StarTrack = {
      id: 's1',
      points: [
        { x: 0, y: 0, az: 178, alt: 24 },
        { x: 0, y: 0, az: 180, alt: 25 },
        { x: 0, y: 0, az: 182, alt: 26 },
      ],
      pastCount: 2,
    };
    drawSkyScene(ctx, { w: 800, h: 600, cam, stars: [star('s1', 180, 25)], track });
    expect(calls.filter((c) => c === 'stroke').length).toBeGreaterThan(2);
  });
});
