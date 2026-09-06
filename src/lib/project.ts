export interface Point {
  x: number;
  y: number;
}

export const ALT_RINGS = [0, 30, 60];
export const AZ_SPOKES = [0, 90, 180, 270];
export const AZ_SPOKE_LABELS: Record<number, string> = { 0: '北', 90: '东', 180: '南', 270: '西' };

/** 等距方位投影：天顶距线性映射到 0..1 径向比例。 */
export function zenithFraction(altDeg: number): number {
  return (90 - altDeg) / 90;
}

/** 屏幕坐标（相对中心）。仰视惯例：N 上（−y）、E 左（−x）。椭圆投影撑满非正方形视口。 */
export function projectAltAz(altDeg: number, azDeg: number, rx: number, ry: number): Point {
  const k = zenithFraction(altDeg);
  const a = (azDeg * Math.PI) / 180;
  return { x: -rx * k * Math.sin(a), y: -ry * k * Math.cos(a) };
}
