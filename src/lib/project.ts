export interface Point {
  x: number;
  y: number;
}

export const ALT_RINGS = [0, 30, 60];
export const AZ_SPOKES = [0, 90, 180, 270];
export const AZ_SPOKE_LABELS: Record<number, string> = { 0: 'N', 90: 'E', 180: 'S', 270: 'W' };

/** 等距方位投影：天顶距线性映射到半径。 */
export function altRingRadius(altDeg: number, R: number): number {
  return (R * (90 - altDeg)) / 90;
}

/** 屏幕坐标（相对圆心）。仰视惯例：N 上（−y）、E 左（−x）。 */
export function projectAltAz(altDeg: number, azDeg: number, R: number): Point {
  const r = altRingRadius(altDeg, R);
  const a = (azDeg * Math.PI) / 180;
  return { x: -r * Math.sin(a), y: -r * Math.cos(a) };
}
