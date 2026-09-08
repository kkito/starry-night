import { describe, expect, it, vi } from 'vitest';

vi.mock('@tarojs/taro', () => ({
  getSystemInfoSync: vi.fn(),
  getWindowInfo: vi.fn(),
  getDeviceInfo: vi.fn(),
  createSelectorQuery: vi.fn(),
  createOffscreenCanvas: vi.fn(),
}));

import * as Taro from '@tarojs/taro';
import { clampPixelRatio, getCanvasRect, getViewport, nextFrame } from '../web-env';

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
  it('viewport prefers window/device info over legacy', () => {
    vi.spyOn(Taro as any, 'getWindowInfo').mockReturnValue({ windowWidth: 390, windowHeight: 844 });
    vi.spyOn(Taro as any, 'getDeviceInfo').mockReturnValue({ pixelRatio: 3 });
    vi.spyOn(Taro, 'getSystemInfoSync').mockReturnValue({ windowWidth: 100, windowHeight: 100, pixelRatio: 1 } as any);
    const vp = getViewport();
    expect(vp.width).toBeGreaterThan(0);
    expect(vp.pixelRatio).toBeLessThanOrEqual(2);
    expect(vp).toEqual({ width: 390, height: 844, pixelRatio: 2 });
  });
  it('viewport falls back to legacy then defaults', () => {
    vi.spyOn(Taro as any, 'getWindowInfo').mockReturnValue({});
    vi.spyOn(Taro as any, 'getDeviceInfo').mockReturnValue({});
    vi.spyOn(Taro, 'getSystemInfoSync').mockReturnValue({} as any);
    expect(getViewport()).toEqual({ width: 375, height: 667, pixelRatio: 2 });
  });
  it('getCanvasRect falls back to zeros when selector query throws (weapp RED first)', async () => {
    const origEnv = process.env.TARO_ENV;
    process.env.TARO_ENV = 'weapp';
    vi.spyOn(Taro, 'createSelectorQuery').mockImplementation(() => { throw new Error('no query'); });
    await expect(getCanvasRect('starchart')).resolves.toEqual({ left: 0, top: 0 });
    process.env.TARO_ENV = origEnv;
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
