import { findCity } from '../../../src/lib/cities';

// I2 城市选择映射：只读引用根 lib/cities 的 findCity，不 fork 城市表。
export function pickCityCoords(name: string): { lat: number; lon: number } | undefined {
  const c = findCity(name);
  return c ? { lat: c.lat, lon: c.lon } : undefined;
}
