import { dateToJD, centuriesSinceJ2000, lastDeg } from './time';
import { j2000ToApparent, raDecToAltAz, refractionDeg } from './transforms';
import { loadCatalog, type CatalogStar } from './catalog';

export interface SkyStar {
  id: string;
  name?: string;
  ra: number;   // 当日视位置赤经（度）
  dec: number;  // 当日视位置赤纬（度）
  az: number;   // 方位角，从北顺时针（度）
  alt: number;  // 高度角（度）
  mag: number;
  /** 有中文译名时保留的西文名 */
  nameEn?: string;
}

export interface SkyOptions {
  lat: number;   // 度，北正 [-90, 90]
  lon: number;   // 度，东正 [-180, 180]
  date: Date;    // UTC
  magLimit?: number;
  refraction?: boolean;
}

function validateLatLonDate(lat: number, lon: number, date: Date): void {
  if (!Number.isFinite(lat) || Math.abs(lat) > 90) throw new RangeError('lat 必须在 [-90, 90]');
  if (!Number.isFinite(lon) || Math.abs(lon) > 180) throw new RangeError('lon 必须在 [-180, 180]');
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) throw new RangeError('date 必须是有效 Date');
}

/** 单颗星在给定地点时刻的位置（不过滤可见性）。 */
export function computeStarPosition(
  star: CatalogStar,
  opts: { lat: number; lon: number; date: Date; refraction?: boolean },
): SkyStar {
  validateLatLonDate(opts.lat, opts.lon, opts.date);
  const jd = dateToJD(opts.date);
  const T = centuriesSinceJ2000(jd);
  const app = j2000ToApparent(star.raDeg, star.decDeg, T);
  const lst = lastDeg(jd, opts.lon, app.dpsiDeg, app.epsDeg);
  const { azDeg, altDeg } = raDecToAltAz(app.raDeg, app.decDeg, lst, opts.lat);
  const alt = opts.refraction ? altDeg + refractionDeg(altDeg) : altDeg;
  return {
    id: star.id,
    ...(star.name !== undefined ? { name: star.name } : {}),
    ra: app.raDeg,
    dec: app.decDeg,
    az: azDeg,
    alt,
    mag: star.mag,
  };
}

/** 全星空：地平线以上、按视星等升序。 */
export function computeSky(opts: SkyOptions): { lstDeg: number; stars: SkyStar[] } {
  validateLatLonDate(opts.lat, opts.lon, opts.date);
  const jd = dateToJD(opts.date);
  const T = centuriesSinceJ2000(jd);
  const probe = j2000ToApparent(0, 0, T); // 取章动/交角（与恒星无关）
  const lst = lastDeg(jd, opts.lon, probe.dpsiDeg, probe.epsDeg);
  const stars = loadCatalog(opts.magLimit)
    .map((s) => {
      const app = j2000ToApparent(s.raDeg, s.decDeg, T);
      const { azDeg, altDeg } = raDecToAltAz(app.raDeg, app.decDeg, lst, opts.lat);
      const alt = opts.refraction ? altDeg + refractionDeg(altDeg) : altDeg;
      return {
        id: s.id,
        ...(s.name !== undefined ? { name: s.name } : {}),
        ra: app.raDeg, dec: app.decDeg, az: azDeg, alt, mag: s.mag,
      };
    })
    .filter((st) => st.alt > 0)
    .sort((a, b) => a.mag - b.mag);
  return { lstDeg: lst, stars };
}

export interface TrackOptions {
  lat: number;
  lon: number;
  start: Date;
  end: Date;
  stepMinutes: number;
  magLimit?: number;
  refraction?: boolean;
}

/** 时间序列轨迹：times 与每个 tracks[id] 一一对应，含 start 与 end（若对齐步长）。 */
export function computeTrack(opts: TrackOptions): {
  times: Date[];
  tracks: Record<string, { az: number; alt: number }[]>;
} {
  if (!Number.isFinite(opts.stepMinutes) || opts.stepMinutes <= 0) {
    throw new RangeError('stepMinutes 必须为正数（分钟）');
  }
  if (!(opts.start instanceof Date) || !(opts.end instanceof Date) ||
      Number.isNaN(opts.start.getTime()) || Number.isNaN(opts.end.getTime())) {
    throw new RangeError('start/end 必须是有效 Date');
  }
  if (opts.end.getTime() < opts.start.getTime()) throw new RangeError('end 不能早于 start');
  const stepMs = opts.stepMinutes * 60000;
  const times: Date[] = [];
  for (let t = opts.start.getTime(); t <= opts.end.getTime(); t += stepMs) times.push(new Date(t));
  const stars = loadCatalog(opts.magLimit);
  const tracks: Record<string, { az: number; alt: number }[]> = {};
  for (const s of stars) tracks[s.id] = [];
  for (const time of times) {
    for (const s of stars) {
      const p = computeStarPosition(s, { lat: opts.lat, lon: opts.lon, date: time, refraction: opts.refraction });
      tracks[s.id]!.push({ az: p.az, alt: p.alt });
    }
  }
  return { times, tracks };
}
