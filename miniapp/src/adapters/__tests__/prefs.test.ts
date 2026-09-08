import { describe, expect, it, vi } from 'vitest';

vi.mock('@tarojs/taro', () => ({
  getStorageSync: vi.fn(),
  setStorageSync: vi.fn(),
}));

import * as Taro from '@tarojs/taro';
import { loadViewPrefs, saveViewPrefs } from '../prefs';
import type { ViewParams } from '../../../../src/components/SettingsDialog';

const defaults: ViewParams = { lat: 31.2304, lon: 121.4737, date: '2026-09-08T20:00', timeMode: 'live', topN: 50, aspect: 'auto', showSolar: true, mirror: false, shape: 'ellipse', viewMode: '3d' };

describe('prefs adapter', () => {
  it('round-trips view prefs minus date', () => {
    const store: Record<string, string> = {};
    vi.spyOn(Taro, 'getStorageSync').mockImplementation((k: string) => store[k] ?? '');
    vi.spyOn(Taro, 'setStorageSync').mockImplementation((k: string, v: string) => { store[k] = v; });
    saveViewPrefs(defaults);
    const loaded = loadViewPrefs({ ...defaults, lat: 0 });
    expect(loaded.lat).toBeCloseTo(31.2304);
    expect(loaded.date).not.toBe('');
  });
});
