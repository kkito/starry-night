// 从根 src/components/SettingsDialog.tsx 拷贝的纯类型/纯函数（无 JSX/React 依赖）。
// 根组件文件不能进小程序包（会带入 DOM 组件与 React DOM 依赖），故在此就地带一份；
// 同步规则：以根 SettingsDialog 当前版本为准，签名变更时此处同步修改。

export type AspectPref = 'auto' | 'landscape' | 'portrait';
export type ShapePref = 'ellipse' | 'circle';
export type ViewMode = '2d' | '3d';
/** live：跟随当前时间（定期刷新）；fixed：使用选定的本地时间 */
export type TimeMode = 'live' | 'fixed';

export interface ViewParams {
  lat: number;
  lon: number;
  date: string;
  timeMode: TimeMode;
  topN: number;
  aspect: AspectPref;
  /** 是否显示太阳系天体（八大行星 + 月亮） */
  showSolar: boolean;
  /** 东西镜像：true 为地图式（左西右东），false 为仰视式（左东右西） */
  mirror: boolean;
  /** 星图外轮廓形状 */
  shape: ShapePref;
  viewMode: ViewMode;
}

/** 本地时间 → datetime-local 输入串（YYYY-MM-DDTHH:mm）。 */
export function toLocalInput(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export const TOP_N_MIN = 10;
export const TOP_N_MAX = 200;

export function validateView(v: ViewParams): string | null {
  if (!Number.isFinite(v.lat) || v.lat < -90 || v.lat > 90) return 'lat 必须在 [-90, 90]';
  if (!Number.isFinite(v.lon) || v.lon < -180 || v.lon > 180) return 'lon 必须在 [-180, 180]';
  if (!v.date || Number.isNaN(new Date(v.date).getTime())) return 'date 无效';
  if (!['live', 'fixed'].includes(v.timeMode)) return 'timeMode 无效';
  if (!Number.isFinite(v.topN) || v.topN < 1 || v.topN > 500) return 'topN 必须在 [1, 500]';
  if (!['auto', 'landscape', 'portrait'].includes(v.aspect)) return 'aspect 无效';
  if (!['ellipse', 'circle'].includes(v.shape)) return 'shape 无效';
  if (!['2d', '3d'].includes(v.viewMode)) return 'viewMode 无效';
  return null;
}
