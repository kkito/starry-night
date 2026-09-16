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
