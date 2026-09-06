import { describe, it, expect } from 'vitest';
import { projectAltAz, altRingRadius, ALT_RINGS, AZ_SPOKES, AZ_SPOKE_LABELS } from '../../src/lib/project';

describe('projectAltAz（仰视：N 上、E 左）', () => {
  const R = 100;

  it('天顶在圆心', () => {
    const p = projectAltAz(90, 123, R);
    expect(p.x).toBeCloseTo(0, 9);
    expect(p.y).toBeCloseTo(0, 9);
  });

  it('北（az=0）在上方', () => {
    const p = projectAltAz(45, 0, R);
    expect(p.x).toBeCloseTo(0, 9);
    expect(p.y).toBeCloseTo(-50, 9);
  });

  it('东（az=90）在左侧', () => {
    const p = projectAltAz(45, 90, R);
    expect(p.x).toBeCloseTo(-50, 9);
    expect(p.y).toBeCloseTo(0, 9);
  });

  it('南在下（+y），西在右（+x）', () => {
    expect(projectAltAz(45, 180, R).y).toBeCloseTo(50, 9);
    expect(projectAltAz(45, 270, R).x).toBeCloseTo(50, 9);
  });

  it('地平线（alt=0）半径为 R，线性映射', () => {
    expect(altRingRadius(0, R)).toBe(R);
    expect(altRingRadius(30, R)).toBeCloseTo((2 / 3) * R, 9);
    expect(altRingRadius(60, R)).toBeCloseTo(R / 3, 9);
  });

  it('常量表', () => {
    expect(ALT_RINGS).toEqual([0, 30, 60]);
    expect(AZ_SPOKES).toEqual([0, 90, 180, 270]);
    expect(AZ_SPOKE_LABELS[90]).toBe('E');
  });
});
