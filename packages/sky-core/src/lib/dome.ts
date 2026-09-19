export interface DomeVec {
  x: number;
  y: number;
  z: number;
}

/** 地平坐标 → 天球直角坐标（北=-z、南=+z、东=+x、天顶=+y）。 */
export function altAzToVec(azDeg: number, altDeg: number, r: number): DomeVec {
  const a = (azDeg * Math.PI) / 180;
  const e = (altDeg * Math.PI) / 180;
  return {
    x: r * Math.cos(e) * Math.sin(a),
    y: r * Math.sin(e),
    z: -r * Math.cos(e) * Math.cos(a),
  };
}

export const DOME_R = 400;
export const TREE_AZ = 110;
export const BUILDING_AZ = 133;

/**
 * 2D 半径 rPx（drawlist.magToRadius，圆半径像素）→ three Points 尺寸（直径像素）。
 * PointsMaterial 的 size 即 gl_PointSize 量级，取直径并保底 2px 可见。
 */
export function pointSizeFor(rPx: number): number {
  return Math.max(2, Math.round(rPx * 2));
}
