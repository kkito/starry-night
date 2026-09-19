import type { ViewParams } from '../components/SettingsDialog';
import { toLocalInput, validateView } from '../components/SettingsDialog';

const STORAGE_KEY = 'starry-night.view';

/** 除时间外的全部视图参数存入 localStorage；时间不持久化，每次用当前时间。 */
export function saveViewPrefs(v: ViewParams): void {
  try {
    const { date: _date, ...rest } = v;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rest));
  } catch {
    // 隐私模式或配额不足时静默跳过
  }
}

/** 启动时恢复上次保存的偏好；时间始终为当前时间。无存储或数据非法时回退默认值。 */
export function loadViewPrefs(defaults: ViewParams): ViewParams {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem('stardemo.view');
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as Partial<ViewParams>;
    // 老用户存量的 'html3d' 档已收敛进 '3d'（canvas 版），读出时自动迁移
    if ((parsed.viewMode as string) === 'html3d') parsed.viewMode = '3d';
    const merged = { ...defaults, ...parsed, date: toLocalInput(new Date()) } as ViewParams;
    return validateView(merged) ? defaults : merged;
  } catch {
    return defaults;
  }
}
