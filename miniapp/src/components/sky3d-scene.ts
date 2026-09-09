// Sky3D 3D 场景纯数据层：Web 版 Sky3D.tsx 的 buildTrack / ring / 方位线几何提炼。
// 与 three 对象解耦（r108 adapter 与 H5 版 three 共用），可单测；
// adapter 与 H5 组件各自把 Vec3 点位包成对应 three 的 Vector3。
import { altAzToVec, type DomeVec } from '../../../src/lib/dome';
import type { StarTrack } from '../../../src/lib/track';

export interface TrackSeg { a: DomeVec; b: DomeVec }

/** 选中星 ±6h 轨迹分段：过去实线（i<=pastCount）/未来虚线，地平线下段跳过。 */
export function splitTrackSegments(t: StarTrack | null, r = 400 * 0.98): { past: TrackSeg[]; future: TrackSeg[] } {
  const past: TrackSeg[] = [];
  const future: TrackSeg[] = [];
  if (!t) return { past, future };
  for (let i = 1; i < t.points.length; i++) {
    const a = t.points[i - 1]!;
    const b = t.points[i]!;
    if (a.alt <= 0 || b.alt <= 0) continue;
    const seg = { a: altAzToVec(a.az, a.alt, r), b: altAzToVec(b.az, b.alt, r) };
    (i <= t.pastCount ? past : future).push(seg);
  }
  return { past, future };
}

/** 等高圈点位（az 0→360 步进 3°，首尾闭环），供 Line 串起。 */
export function ringPoints(altDeg: number, r = 400 * 0.985, step = 3): DomeVec[] {
  const pts: DomeVec[] = [];
  for (let az = 0; az <= 360; az += step) pts.push(altAzToVec(az, altDeg, r));
  return pts;
}

/** 方位线两端：地平 (alt 0) → 高空 (alt 70)。 */
export function azLineEnds(azDeg: number, r = 400 * 0.985): [DomeVec, DomeVec] {
  return [altAzToVec(azDeg, 0, r), altAzToVec(azDeg, 70, r)];
}
