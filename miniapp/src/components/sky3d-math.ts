/** Sky3D 相机纯函数（Web 版 Sky3D.tsx 交互系数的可单测提炼）。
 * 约定：yaw 右拖减小（yaw -= dx*0.003），pitch 下拖增大并夹紧 [-0.05, 1.2]；
 * pinch 张开（距离变大）fov 减小，夹紧 [30, 100]；fov 换算系数 0.05/px。
 */

/** 单指拖拽系数：与 Web 版 onMove 一致。 */
export const YAW_PER_PX = 0.003;
export const PITCH_PER_PX = 0.002;
export const PITCH_MIN = -0.05;
export const PITCH_MAX = 1.2;

/** 双指 pinch 的 fov 换算系数与夹紧范围（Web 版 wheel 系数 0.02 按触屏放大取 0.05）。 */
export const FOV_PER_PX = 0.05;
export const FOV_MIN = 30;
export const FOV_MAX = 100;

export function dragDeltaToYawPitch(dx: number, dy: number, yaw: number, pitch: number): { yaw: number; pitch: number } {
  return {
    yaw: yaw - dx * YAW_PER_PX,
    pitch: Math.max(PITCH_MIN, Math.min(PITCH_MAX, pitch + dy * PITCH_PER_PX)),
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

/** client 坐标换算为画布内坐标：减去画布 rect 偏移（画布上方切换条导致 y 系统性偏移）。 */
export function toCanvasPoint(
  clientX: number,
  clientY: number,
  rect: { left: number; top: number },
): { x: number; y: number } {
  return { x: clientX - rect.left, y: clientY - rect.top };
}
