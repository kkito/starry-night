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

/**
 * 屏幕坐标（相对中心）。仰视惯例：N 上（−y）、E 左（−x）。
 * mirror=true 时水平镜像为地图式（E 右、W 左）。椭圆/圆形由调用方传入 rx、ry 决定。
 */
export function projectAltAz(altDeg: number, azDeg: number, rx: number, ry: number, mirror = false): Point {
  const k = zenithFraction(altDeg);
  const a = (azDeg * Math.PI) / 180;
  const x = rx * k * Math.sin(a);
  return { x: mirror ? x : -x, y: -ry * k * Math.cos(a) };
}
