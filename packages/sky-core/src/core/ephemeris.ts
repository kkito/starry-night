import { Body, Equator, Horizon, Illumination, Observer } from 'astronomy-engine';

/** 太阳系天体（八大行星 + 月亮）在星图中的静态元数据。 */
export interface SolarBodyMeta {
  id: string;
  name: string;
  nameEn: string;
  body: Body;
  color: string;
}

export const SOLAR_BODIES: SolarBodyMeta[] = [
  { id: 'moon',    name: '月亮',  nameEn: 'Moon',    body: Body.Moon,    color: '#f5e9c8' },
  { id: 'mercury', name: '水星',  nameEn: 'Mercury', body: Body.Mercury, color: '#b8b0a6' },
  { id: 'venus',   name: '金星',  nameEn: 'Venus',   body: Body.Venus,   color: '#f7ead0' },
  { id: 'mars',    name: '火星',  nameEn: 'Mars',    body: Body.Mars,    color: '#e2603f' },
  { id: 'jupiter', name: '木星',  nameEn: 'Jupiter', body: Body.Jupiter, color: '#e8a95c' },
  { id: 'saturn',  name: '土星',  nameEn: 'Saturn',  body: Body.Saturn,  color: '#e3cf8e' },
  { id: 'uranus',  name: '天王星', nameEn: 'Uranus', body: Body.Uranus,  color: '#9fdbe8' },
  { id: 'neptune', name: '海王星', nameEn: 'Neptune', body: Body.Neptune, color: '#6f9fe8' },
];

export interface SolarBody {
  id: string;
  name: string;
  nameEn: string;
  ra: number;      // 当日视位置赤经（度）
  dec: number;     // 当日视位置赤纬（度）
  az: number;      // 方位角，从北顺时针（度）
  alt: number;     // 高度角（度）
  mag: number;
  distAu: number;  // 地心距离（AU）
}

export interface SolarOptions {
  lat: number;
  lon: number;
  date: Date;
  refraction?: boolean;
}

function validateLatLonDate(lat: number, lon: number, date: Date): void {
  if (!Number.isFinite(lat) || Math.abs(lat) > 90) throw new RangeError('lat 必须在 [-90, 90]');
  if (!Number.isFinite(lon) || Math.abs(lon) > 180) throw new RangeError('lon 必须在 [-180, 180]');
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) throw new RangeError('date 必须是有效 Date');
}

/** 计算七颗行星 + 月亮的视位置（不过滤地平线，含地平线以下）。 */
export function computeSolarBodies(opts: SolarOptions): SolarBody[] {
  validateLatLonDate(opts.lat, opts.lon, opts.date);
  const observer = new Observer(opts.lat, opts.lon, 0);
  return SOLAR_BODIES.map((meta) => {
    // ofdate + aberration：当日视位置，含光行差，与恒星管线的坐标框架一致
    const eq = Equator(meta.body, opts.date, observer, true, true);
    const hor = Horizon(opts.date, observer, eq.ra, eq.dec, opts.refraction ? 'normal' : undefined);
    const illum = Illumination(meta.body, opts.date);
    const body: SolarBody = {
      id: meta.id,
      name: meta.name,
      nameEn: meta.nameEn,
      ra: eq.ra * 15,
      dec: eq.dec,
      az: hor.azimuth,
      alt: hor.altitude,
      mag: illum.mag,
      distAu: illum.geo_dist,
    };
    return body;
  });
}
