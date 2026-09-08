import { describe, expect, it, vi } from 'vitest';

vi.mock('@tarojs/taro', () => ({
  getStorageSync: vi.fn(),
  setStorageSync: vi.fn(),
  removeStorageSync: vi.fn(),
}));

import * as Taro from '@tarojs/taro';
import { consumeSelectedId, SELECTED_KEY } from '../selected';

describe('consumeSelectedId (I1 回选清理)', () => {
  it('读到 id 后调用 removeStorageSync 清理', () => {
    vi.mocked(Taro.getStorageSync).mockReturnValue('vega');
    consumeSelectedId();
    expect(Taro.getStorageSync).toHaveBeenCalledWith(SELECTED_KEY);
    expect(Taro.removeStorageSync).toHaveBeenCalledWith(SELECTED_KEY);
  });

  it('返回读到的 id，无 id 时返回 null 且仍清理', () => {
    vi.mocked(Taro.getStorageSync).mockReturnValue('');
    expect(consumeSelectedId()).toBeNull();
    expect(Taro.removeStorageSync).toHaveBeenCalledWith(SELECTED_KEY);
  });
});
