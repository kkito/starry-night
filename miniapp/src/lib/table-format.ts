import type { SkyStar } from '../../../src/core/sky';

/** 与 Web 版 StarTableDialog 一致的过滤：名称/id + nameEn（大小写不敏感）。 */
export function filterTableStars(stars: SkyStar[], q: string): SkyStar[] {
  if (!q) return stars;
  const ql = q.toLowerCase();
  return stars.filter((s) => (s.name ?? s.id).toLowerCase().includes(ql) || (s.nameEn ?? '').toLowerCase().includes(ql));
}

/** 恒星星等展示：Web 版 StarTableDialog 恒星列为 s.mag（数字），小程序统一 toFixed(2)。 */
export function formatStarMag(mag: number): string {
  return mag.toFixed(2);
}

/** 地平线下注记展示规则（照搬 Web 版 StarTableDialog：alt<=0 标注）。 */
export function belowHorizonNote(alt: number): string {
  return alt <= 0 ? '（地平线下）' : '';
}
