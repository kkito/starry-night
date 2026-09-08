import { describe, expect, it, vi } from 'vitest';

vi.mock('@tarojs/taro', () => ({
  getSystemInfoSync: vi.fn(),
  createSelectorQuery: vi.fn(),
  createOffscreenCanvas: vi.fn(),
}));

import * as Taro from '@tarojs/taro';
import { clampPixelRatio, getViewport, nextFrame } from '../web-env';

describe('web-env', () => {
  it('clamps pixelRatio to 2', () => {
    expect(clampPixelRatio(3)).toBe(2);
    expect(clampPixelRatio(1.5)).toBe(1.5);
  });
  it('clamps degenerate input to 1', () => {
    expect(clampPixelRatio(0)).toBe(1);
    expect(clampPixelRatio(-1)).toBe(1);
    expect(clampPixelRatio(NaN)).toBe(1);
  });
  it('viewport has positive dims', () => {
    vi.spyOn(Taro, 'getSystemInfoSync').mockReturnValue({
      windowWidth: 390,
      windowHeight: 844,
      pixelRatio: 3,
    } as any);
    const vp = getViewport();
    expect(vp.width).toBeGreaterThan(0);
    expect(vp.pixelRatio).toBeLessThanOrEqual(2);
    expect(vp).toEqual({ width: 390, height: 844, pixelRatio: 2 });
  });
  it('viewport falls back to defaults', () => {
    vi.spyOn(Taro, 'getSystemInfoSync').mockReturnValue({} as any);
    expect(getViewport()).toEqual({ width: 375, height: 667, pixelRatio: 2 });
  });
  it('nextFrame fires handle and cancel stops it', async () => {
    let calls = 0;
    const cancel = nextFrame(() => { calls += 1; });
    cancel();
    await new Promise((r) => setTimeout(r, 50));
    expect(calls).toBe(0);
    nextFrame(() => { calls += 1; });
    await new Promise((r) => setTimeout(r, 50));
    expect(calls).toBe(1);
  });
});
