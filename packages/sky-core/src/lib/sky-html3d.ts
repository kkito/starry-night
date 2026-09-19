// src/lib/sky-html3d.ts
import { altAzToVec } from './dome';

export interface Html3DPoint { x: number; y: number; }

/** 地平坐标 → canvas 像素坐标。相机位于原点，先绕 Y 转 -yaw 再绕 X 转 pitch（与 Sky3D 相机 lookAt 方向一致），透视除法落屏。z2>=0（背后）返回 null。 */
export function projectHtml3D(
  az: number, alt: number, yaw: number, pitch: number, fovDeg: number, w: number, h: number,
): Html3DPoint | null {
  const v = altAzToVec(az, alt, 1);
  // 世界 → 相机系：yaw 旋转（绕 Y）+ pitch 旋转（绕 X）
  const cosY = Math.cos(-yaw);
  const sinY = Math.sin(-yaw);
  const x1 = v.x * cosY - v.z * sinY;
  const z1 = v.x * sinY + v.z * cosY;
  const cosP = Math.cos(pitch);
  const sinP = Math.sin(pitch);
  const y2 = v.y * cosP + z1 * sinP;
  const z2 = -v.y * sinP + z1 * cosP;
  // 约定：旋转后相机看向 −z（Sky3D lookAt 方向 d 经变换后落在 −z 轴），z2>=0 即背后/屏面后，返回 null。
  // （首版 z2 符号反了导致正前方星被剔除，此处翻转 pitch 旋转符号修正，单测为准。）
  if (z2 >= 0) return null;
  const depth = -z2;
  const focal = (h / 2) / Math.tan(((fovDeg * Math.PI) / 180 / 2));
  return { x: w / 2 + (x1 / depth) * focal, y: h / 2 - (y2 / depth) * focal };
}

export interface SilhouetteWindow { dxN: number; dyN: number; }
export interface SilhouetteShape {
  kind: 'tree' | 'building';
  az: number;
  /** 底边中心的落屏点；在相机背后时为 null（不绘制） */
  base: Html3DPoint | null;
  /** 宽/高，单位为「占比 × focal」像素（随 fov 缩放） */
  wN: number;
  hN: number;
  /** 楼的亮窗偏移：dxN 为楼宽比例（相对中心），dyN 为楼高比例（自底边向上） */
  windows: SilhouetteWindow[];
}

const SILHOUETTE_GROUPS = [
  { treeAz: 20, bldAz: 43 },
  { treeAz: 110, bldAz: 133 },
  { treeAz: 200, bldAz: 223 },
  { treeAz: 290, bldAz: 313 },
] as const;
const WIN_PATTERN = [[0, 3], [2, 2], [1, 1], [2, 0]] as const;

/** 剪影布局（与 Sky3D 同方位、同亮窗分布），只做方位投影，底边落在地平线上；超出画布水平视场的组 base 置 null。 */
export function silhouetteShapes(
  w: number, h: number, yaw: number, pitch: number, fovDeg: number,
): SilhouetteShape[] {
  const focal = (h / 2) / Math.tan(((fovDeg * Math.PI) / 180 / 2));
  const out: SilhouetteShape[] = [];
  for (const g of SILHOUETTE_GROUPS) {
    out.push({
      kind: 'tree', az: g.treeAz,
      base: culled(projectHtml3D(g.treeAz, 0, yaw, pitch, fovDeg, w, h), 0.075 * focal, w),
      wN: 0.075, hN: 0.095, windows: [],
    });
    out.push({
      kind: 'building', az: g.bldAz,
      base: culled(projectHtml3D(g.bldAz, 0, yaw, pitch, fovDeg, w, h), 0.13 * focal, w),
      wN: 0.13, hN: 0.23,
      windows: WIN_PATTERN.map(([c, r]) => ({
        dxN: (c - 1.5) * 0.3,
        dyN: 0.18 + r * 0.2,
      })),
    });
  }
  return out;
}

function culled(p: Html3DPoint | null, margin: number, w: number): Html3DPoint | null {
  if (!p) return null;
  return p.x < -margin || p.x > w + margin ? null : p;
}

export interface DirectionLabel {
  az: number;
  text: string;
  /** 与 Sky3D 一致：正东金色高亮，其余灰蓝 */
  color: string;
  /** 落屏点；视野外为 null */
  p: Html3DPoint | null;
}

const CARDINALS = [
  { az: 0, text: '北' },
  { az: 90, text: '东' },
  { az: 180, text: '南' },
  { az: 270, text: '西' },
] as const;

/** 地平线方位标注：标在 alt 4° 处，只留视野内的。 */
export function directionLabels(
  w: number, h: number, yaw: number, pitch: number, fovDeg: number,
): DirectionLabel[] {
  return CARDINALS.map(({ az, text }) => ({
    az,
    text,
    color: az === 90 ? '#e8b45a' : '#9aa5c4',
    p: culled(projectHtml3D(az, 4, yaw, pitch, fovDeg, w, h), 16, w),
  }));
}

/** 归一化尺寸 → 像素：随 fov 的 focal 缩放，与天幕透视一致。 */
export function silhouettePx(shape: SilhouetteShape, h: number, fovDeg: number): { pw: number; ph: number } {
  const focal = (h / 2) / Math.tan(((fovDeg * Math.PI) / 180 / 2));
  return { pw: shape.wN * focal, ph: shape.hN * focal };
}
