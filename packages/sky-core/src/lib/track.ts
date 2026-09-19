import { loadCatalog } from '../core/catalog';
import { computeStarPosition } from '../core/sky';
import { computeSolarBodies, SOLAR_BODIES } from '../core/ephemeris';
import { projectAltAz } from './project';

export interface TrackPoint {
  x: number; // 相对画布中心的屏幕偏移
  y: number;
  alt: number; // 地平线以下不画
  az: number; // 3D 天穹重投球面用
}

export interface StarTrack {
  id: string;
  /** 均匀时间采样点，points[pastCount] 即当前时刻 */
  points: TrackPoint[];
  /** 当前时刻在 points 中的下标：之前的为过去（实线），之后的为未来（虚线） */
  pastCount: number;
}

const STEP_MIN = 10;
const HALF_HOURS = 6;
const SOLAR_IDS = new Set(SOLAR_BODIES.map((b) => b.id));

/** 某天体以当前时刻为中心、前后各 6 小时（含端点）的地平坐标轨迹。 */
export function computeTrackAround(
  id: string,
  opts: { lat: number; lon: number; date: Date; rx: number; ry: number; mirror?: boolean; refraction?: boolean },
): StarTrack | null {
  const { lat, lon, date, rx, ry, mirror = false } = opts;
  const isSolar = SOLAR_IDS.has(id);
  const catalog = isSolar ? null : loadCatalog().find((s) => s.id === id);
  if (!isSolar && !catalog) return null;

  const center = date.getTime();
  const times: number[] = [];
  for (let m = -HALF_HOURS * 60; m <= HALF_HOURS * 60; m += STEP_MIN) times.push(center + m * 60000);
  const pastCount = (HALF_HOURS * 60) / STEP_MIN;

  const points: TrackPoint[] = times.map((t) => {
    let az: number, alt: number;
    if (isSolar) {
      const b = computeSolarBodies({ lat, lon, date: new Date(t) }).find((x) => x.id === id)!;
      az = b.az;
      alt = b.alt;
    } else {
      const p = computeStarPosition(catalog!, { lat, lon, date: new Date(t), refraction: opts.refraction });
      az = p.az;
      alt = p.alt;
    }
    const pr = projectAltAz(alt, az, rx, ry, mirror);
    return { x: pr.x, y: pr.y, alt, az };
  });
  return { id, points, pastCount };
}
