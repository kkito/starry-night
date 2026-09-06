import { describe, it, expect } from 'vitest';
import { dateToJD, gmstDeg, norm360, centuriesSinceJ2000, lastDeg } from '../../src/core/time';

describe('time', () => {
  it('J2000.0 = 2451545.0', () => {
    expect(dateToJD(new Date('2000-01-01T12:00:00Z'))).toBeCloseTo(2451545.0, 6);
  });

  it('Meeus 例 12.b：1987-04-10 19:21 UT → GMST ≈ 128.73787°', () => {
    // JD = 2446895.5 + 19h21m/24h = 2446896.30625
    expect(gmstDeg(2446896.30625)).toBeCloseTo(128.7378733, 3);
  });

  it('T(J2000)=0', () => {
    expect(centuriesSinceJ2000(2451545.0)).toBe(0);
  });

  it('norm360 归一到 [0,360)', () => {
    expect(norm360(-1)).toBeCloseTo(359);
    expect(norm360(361)).toBeCloseTo(1);
    expect(norm360(360)).toBeCloseTo(0);
  });

  it('lastDeg = gmst + lon + 赤经章动', () => {
    // dpsi=0.001°, eps≈23.44° → eqeq ≈ 0.000919°
    const expectVal = norm360(gmstDeg(2451545.0) + 116.4 + 0.001 * Math.cos((23.44 * Math.PI) / 180));
    expect(lastDeg(2451545.0, 116.4, 0.001, 23.44)).toBeCloseTo(expectVal, 9);
  });
});
