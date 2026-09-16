import { describe, expect, it, vi } from 'vitest';

vi.mock('@tarojs/components', () => ({ Canvas: 'canvas', View: 'div', Text: 'span' }));
vi.mock('@tarojs/taro', () => ({ createSelectorQuery: vi.fn() }));

import {
  TAP_SLOP_PX,
  PICK_PX_TOL,
  isTapGesture,
  pickToleranceWorld,
  pickBestStarIndex,
} from '../sky3d-math';

describe('3D 点选（RED：点不中）', () => {
  it('tap 容差对手指友好：小抖动算 tap，大拖拽不算', () => {
    // 真机 tap 抖动常超 2px，2px 阈值会把正常点按判成拖拽丢掉
    expect(TAP_SLOP_PX).toBeGreaterThanOrEqual(10);
    expect(isTapGesture(3, 4)).toBe(true); // 5px 抖动
    expect(isTapGesture(10, 10)).toBe(false); // 14px 真拖拽
  });

  it('命中半径按屏幕像素折算，远大于老阈值 6 世界单位', () => {
    // fov65/屏高700/星距392 下，22px 对应约 14 世界单位（老 6 仅约 8px）
    const tol = pickToleranceWorld(PICK_PX_TOL, 392, 700, 65);
    expect(PICK_PX_TOL).toBeGreaterThanOrEqual(20);
    expect(tol).toBeGreaterThan(6);
    expect(tol).toBeCloseTo(392 * ((PICK_PX_TOL / 700) * ((65 * Math.PI) / 180)), 0);
  });

  it('相机背后的星不参选：再近也不选中', () => {
    // dists[0] 最近但在背后（forwardDot<=0），应选 dists[1]
    expect(pickBestStarIndex([2, 5], [-1, 0.5], 100)).toBe(1);
    expect(pickBestStarIndex([2, 5], [-1, -0.5], 100)).toBe(-1);
    expect(pickBestStarIndex([200, 5], [0.9, 0.9], 100)).toBe(1);
  });
});
