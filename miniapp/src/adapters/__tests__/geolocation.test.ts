import { describe, expect, it, vi } from 'vitest';

vi.mock('@tarojs/taro', () => ({
  getLocation: vi.fn(),
}));

import * as Taro from '@tarojs/taro';
import { getCurrentPosition } from '../geolocation';

describe('geolocation adapter', () => {
  it('resolves wgs84 via Taro.getLocation', async () => {
    vi.spyOn(Taro, 'getLocation').mockImplementation(((opts: any) => { opts.success?.({ latitude: 31.2, longitude: 121.4 }); }) as any);
    await expect(getCurrentPosition()).resolves.toEqual({ lat: 31.2, lon: 121.4 });
  });
  it('rejects with friendly message on deny', async () => {
    vi.spyOn(Taro, 'getLocation').mockImplementation(((opts: any) => { opts.fail?.({ errMsg: 'deny' }); }) as any);
    await expect(getCurrentPosition()).rejects.toThrow();
  });
});
