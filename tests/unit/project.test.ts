import { describe, it, expect } from 'vitest';
import { projectAltAz, zenithFraction, ALT_RINGS, AZ_SPOKES, AZ_SPOKE_LABELS } from '../../src/lib/project';

describe('projectAltAz（仰视：N 上、E 左；椭圆撑满视口）', () => {
  it('天顶在中心', () => {
    const p = projectAltAz(90, 123, 100, 200);
    expect(p.x).toBeCloseTo(0, 9);
    expect(p.y).toBeCloseTo(0, 9);
  });

  it('正方形视口下与圆投影一致（N 上）', () => {
    const p = projectAltAz(45, 0, 100, 100);
    expect(p.x).toBeCloseTo(0, 9);
    expect(p.y).toBeCloseTo(-50, 9);
  });

  it('东（az=90）在左侧', () => {
    const p = projectAltAz(45, 90, 100, 100);
    expect(p.x).toBeCloseTo(-50, 9);
    expect(p.y).toBeCloseTo(0, 9);
  });

  it('南在下（+y），西在右（+x）', () => {
    expect(projectAltAz(45, 180, 100, 100).y).toBeCloseTo(50, 9);
    expect(projectAltAz(45, 270, 100, 100).x).toBeCloseTo(50, 9);
  });

  it('椭圆：竖向半径独立缩放', () => {
    const p = projectAltAz(45, 0, 100, 200);
    expect(p.x).toBeCloseTo(0, 9);
    expect(p.y).toBeCloseTo(-100, 9);
    // az=90 时用水平半径
    expect(projectAltAz(45, 90, 100, 200).x).toBeCloseTo(-50, 9);
  });

  it('zenithFraction 线性映射', () => {
    expect(zenithFraction(0)).toBe(1);
    expect(zenithFraction(30)).toBeCloseTo(2 / 3, 9);
    expect(zenithFraction(60)).toBeCloseTo(1 / 3, 9);
    expect(zenithFraction(90)).toBe(0);
  });

  it('常量表', () => {
    expect(ALT_RINGS).toEqual([0, 30, 60]);
    expect(AZ_SPOKES).toEqual([0, 90, 180, 270]);
    expect(AZ_SPOKE_LABELS[90]).toBe('E');
  });
});
