import { describe, it, expect } from 'vitest';
import {
  unitFromRaDec, raDecFromUnit, meanObliquityDeg, precessionMatrix,
  raDecToAltAz, refractionDeg, j2000ToApparent, annualAberrationEclVecArcsec,
} from '../../src/core/transforms';

describe('transforms', () => {
  it('RA/Dec ↔ 单位向量往返一致', () => {
    const rd = { raDeg: 101.287, decDeg: -16.716 }; // 天狼星附近
    const back = raDecFromUnit(unitFromRaDec(rd.raDeg, rd.decDeg));
    expect(back.raDeg).toBeCloseTo(rd.raDeg, 9);
    expect(back.decDeg).toBeCloseTo(rd.decDeg, 9);
  });

  it('J2000 平均黄赤交角 ε0 = 23.4392911°', () => {
    expect(meanObliquityDeg(0)).toBeCloseTo(23.4392911, 6);
  });

  it('岁差矩阵正交归一', () => {
    const P = precessionMatrix(0.26); // ~J2650
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        const dot = P[i]![0]! * P[j]![0]! + P[i]![1]! * P[j]![1]! + P[i]![2]! * P[j]![2]!;
        expect(dot).toBeCloseTo(i === j ? 1 : 0, 10);
      }
    }
  });

  it('像差矢量幅度 ≈ 20.489″', () => {
    const [x, y, z] = annualAberrationEclVecArcsec(0.25);
    expect(Math.hypot(x, y, z)).toBeCloseTo(20.489, 3);
    expect(z).toBe(0);
  });

  it('地平坐标：赤道星中天 alt = 90° − |lat|', () => {
    // lat=40N，dec=0 的星在上中天（LAST = RA）
    const { altDeg, azDeg } = raDecToAltAz(100, 0, 100, 40);
    expect(altDeg).toBeCloseTo(50, 9);
    expect(azDeg).toBeCloseTo(180, 9);
  });

  it('地平坐标：上中天后向西（az 介于南与西之间）', () => {
    const { azDeg } = raDecToAltAz(100, 20, 101, 40); // H = +1° → 偏西
    expect(azDeg).toBeGreaterThan(180);
    expect(azDeg).toBeLessThan(270);
  });

  it('北极星高度 ≈ 观测纬度（J2000 位置，忽略章动小差）', () => {
    const app = j2000ToApparent(37.95456067, 89.26410861, 0.25); // J2025 附近
    const { altDeg } = raDecToAltAz(app.raDeg, app.decDeg, app.raDeg, 39.9); // 中天
    expect(Math.abs(altDeg - 39.9)).toBeLessThan(1.0);
  });

  it('折射量级正确：alt=10° 处约 5.3′', () => {
    expect(refractionDeg(10)).toBeGreaterThan(5.0 / 60);
    expect(refractionDeg(10)).toBeLessThan(5.6 / 60);
    expect(refractionDeg(88)).toBeLessThan(0.04 / 60);
    expect(refractionDeg(-5)).toBe(0);
  });
});
