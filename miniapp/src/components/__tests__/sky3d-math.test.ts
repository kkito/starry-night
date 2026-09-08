import { describe, expect, it, vi } from 'vitest';

vi.mock('@tarojs/components', () => ({ Canvas: 'canvas', View: 'div', Text: 'span' }));
vi.mock('@tarojs/taro', () => ({ createSelectorQuery: vi.fn() }));

import { dragDeltaToYawPitch, pinchDistToFov, YAW_PER_PX, PITCH_PER_PX } from '../sky3d-math';

describe('Sky3D camera math (pure, testable part)', () => {
  it('drag right decreases yaw, drag down increases pitch (matches Web Sky3D factors)', () => {
    const start = { yaw: Math.PI, pitch: 0.4 };
    const r = dragDeltaToYawPitch(100, 50, start.yaw, start.pitch);
    expect(YAW_PER_PX).toBe(0.003);
    expect(PITCH_PER_PX).toBe(0.002);
    expect(r.yaw).toBeCloseTo(Math.PI - 100 * 0.003, 10);
    expect(r.pitch).toBeCloseTo(0.4 + 50 * 0.002, 10);
  });

  it('pitch clamps to [-0.05, 1.2] (Web Sky3D bounds)', () => {
    expect(dragDeltaToYawPitch(0, 10000, 0, 0.5).pitch).toBe(1.2);
    expect(dragDeltaToYawPitch(0, -10000, 0, 0.5).pitch).toBe(-0.05);
  });

  it('pinch out (spread) narrows fov, pinch in widens, clamped to [30, 100]', () => {
    const base = 65;
    expect(pinchDistToFov(base, 100, 120)).toBeLessThan(base);
    expect(pinchDistToFov(base, 120, 100)).toBeGreaterThan(base);
    expect(pinchDistToFov(35, 10, 1000)).toBe(30);
    expect(pinchDistToFov(95, 1000, 10)).toBe(100);
  });

  it('same pinch distance keeps fov', () => {
    expect(pinchDistToFov(65, 100, 100)).toBe(65);
  });
});
