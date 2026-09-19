/** Sky3D 相机纯函数（Web 版 Sky3D.tsx 交互系数的可单测提炼）。
 * 约定：yaw 右拖减小（yaw -= dx*0.003），pitch 下拖增大并夹紧 [-0.05, 1.2]；
 * pinch 张开（距离变大）fov 减小，夹紧 [30, 100]；fov 换算系数 0.05/px。
 */

/** 单指拖拽系数：与 Web 版 onMove 一致。 */
export const YAW_PER_PX = 0.003;
export const PITCH_PER_PX = 0.002;
export const PITCH_MIN = -0.05;
export const PITCH_MAX = 1.2;

/** 地平线下最多留 5%：pitch 下限为 0.9 倍半视场角（fov 度）。 */
export function clampPitch(pitch: number, fovDeg = 65): number {
  const min = 0.9 * ((fovDeg * Math.PI) / 180 / 2);
  return Math.max(min, Math.min(PITCH_MAX, pitch));
}

/** 双指 pinch 的 fov 换算系数与夹紧范围（Web 版 wheel 系数 0.02 按触屏放大取 0.05）。 */
export const FOV_PER_PX = 0.05;
export const FOV_MIN = 30;
export const FOV_MAX = 100;

export function dragDeltaToYawPitch(dx: number, dy: number, yaw: number, pitch: number, fovDeg = 65): { yaw: number; pitch: number } {
  return {
    yaw: yaw - dx * YAW_PER_PX,
    pitch: clampPitch(pitch + dy * PITCH_PER_PX, fovDeg),
  };
}

export function pinchDistToFov(fov: number, prevDist: number, nextDist: number): number {
  return Math.max(FOV_MIN, Math.min(FOV_MAX, fov - (nextDist - prevDist) * FOV_PER_PX));
}

/** 双指触点间距。 */
export function touchDist(touches: Array<{ clientX: number; clientY: number }>): number {
  const [a, b] = touches;
  if (!a || !b) return 0;
  return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
}

/** tap 判定位移上限（px）：触屏 tap 抖动常超 2px，2px 会把正常点按判成拖拽丢掉。 */
export const TAP_SLOP_PX = 12;

/** tap 判定：按下点到抬起点累计位移在容限内即算 tap。 */
export function isTapGesture(dx: number, dy: number, slopPx = TAP_SLOP_PX): boolean {
  return Math.abs(dx) + Math.abs(dy) <= slopPx;
}

/** 点选命中半径（屏幕 px）：手指落点误差 10~20px，老阈值 6 世界单位仅约 8px。 */
export const PICK_PX_TOL = 22;

/** 屏幕像素容差 → 射线距离世界单位：tol_world ≈ dist × 容差角（fov 按屏高折算）。 */
export function pickToleranceWorld(tolPx: number, dist: number, screenH: number, fovDeg: number): number {
  return dist * ((tolPx / screenH) * ((fovDeg * Math.PI) / 180));
}

/** 候选星取优：只要距射线最近且在容限内；forwardDot<=0（相机背后）不参选。 */
export function pickBestStarIndex(dists: number[], forwardDots: number[], tol: number): number {
  let best = -1;
  let bestD = Infinity;
  for (let i = 0; i < dists.length; i++) {
    if ((forwardDots[i] ?? 0) <= 0) continue;
    const d = dists[i]!;
    if (d < bestD) { bestD = d; best = i; }
  }
  if (bestD > tol || best < 0) return -1;
  return best;
}

/** client 坐标换算为画布内坐标：减去画布 rect 偏移（画布上方切换条导致 y 系统性偏移）。 */
export function toCanvasPoint(
  clientX: number,
  clientY: number,
  rect: { left: number; top: number },
): { x: number; y: number } {
  return { x: clientX - rect.left, y: clientY - rect.top };
}
