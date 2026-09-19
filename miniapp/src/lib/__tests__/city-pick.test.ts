import { describe, expect, it } from 'vitest';
import { pickCityCoords } from '../city-pick';

describe('pickCityCoords（I2 城市选择映射，只读引用根 lib/cities）', () => {
  it('已知城市返回其经纬度', () => {
    expect(pickCityCoords('北京')).toEqual({ lat: 39.9042, lon: 116.4074 });
    expect(pickCityCoords('上海')).toEqual({ lat: 31.2304, lon: 121.4737 });
  });

  it('未知城市返回 undefined（保持手动输入值）', () => {
    expect(pickCityCoords('不存在市')).toBeUndefined();
    expect(pickCityCoords('')).toBeUndefined();
  });
});
