import zhJson from '../../data/star_names_zh.json';

/** IAU 西文星名 → 官方中文译名（源自 Stellarium zh_CN 星空翻译，约 1900 条）。 */
const ZH_NAMES = zhJson as Record<string, string>;

export function zhName(western?: string): string | undefined {
  if (!western) return undefined;
  return ZH_NAMES[western];
}
