import { projectAltAz } from './project';
import type { SkyStar } from '../core/sky';
import type { SolarBody } from '../core/ephemeris';
import { SOLAR_BODIES } from '../core/ephemeris';

export type StarWithBv = SkyStar & { bv?: number };

export interface DrawStar {
  id: string;
  name?: string;
  nameEn?: string;
  x: number;
  y: number;
  rPx: number;
  color: string;
  label: boolean;
  az: number;
  alt: number;
  mag: number;
  /** 太阳系天体：外圈描边，区别于恒星 */
  solar?: boolean;
  /** 仅太阳系：地心距离（AU） */
  distAu?: number;
}

const NAME_MAG_LIMIT = 1.5;

export function magToRadius(mag: number): number {
  return Math.max(1, Math.min(5.5, 4.6 - mag * 0.75));
}

export function bvToColor(bv: number): string {
  const b = Math.max(-0.3, Math.min(2.0, bv));
  if (b < 0) return '#aabfff';
  if (b <= 0.4) return '#f8f7ff';
  if (b < 0.8) return '#ffd2a1';
  return '#ff9d5c';
}

const EPS = 1e-9;
// 规范化浮点误差：-0/极小残差归零，保证轴上坐标精确
const snap = (v: number): number => (Math.abs(v) < EPS ? 0 : v);

export function buildDrawList(stars: StarWithBv[], rx: number, ry: number, mirror = false): DrawStar[] {
  return stars.map((s) => {
    const p = projectAltAz(s.alt, s.az, rx, ry, mirror);
    return {
      id: s.id,
      ...(s.name !== undefined ? { name: s.name } : {}),
      ...(s.nameEn !== undefined ? { nameEn: s.nameEn } : {}),
      x: snap(p.x),
      y: snap(p.y),
      rPx: magToRadius(s.mag),
      color: bvToColor(s.bv ?? 0.4),
      label: s.mag < NAME_MAG_LIMIT,
      az: s.az,
      alt: s.alt,
      mag: s.mag,
    };
  });
}

/** 太阳系天体半径：比同星等恒星大一号。 */
export function solarRadius(mag: number): number {
  return magToRadius(mag) * 1.8;
}

export function buildSolarDrawList(bodies: SolarBody[], rx: number, ry: number, mirror = false): DrawStar[] {
  return bodies.map((b) => {
    const p = projectAltAz(b.alt, b.az, rx, ry, mirror);
    return {
      id: b.id,
      name: b.name,
      nameEn: b.nameEn,
      x: snap(p.x),
      y: snap(p.y),
      rPx: solarRadius(b.mag),
      color: SOLAR_COLORS[b.id] ?? '#ffffff',
      label: true,
      az: b.az,
      alt: b.alt,
      mag: b.mag,
      solar: true,
      distAu: b.distAu,
    };
  });
}

const SOLAR_COLORS: Record<string, string> = Object.fromEntries(SOLAR_BODIES.map((m) => [m.id, m.color]));
