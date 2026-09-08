import * as Taro from '@tarojs/taro';
import type { ViewParams } from '../../../src/components/SettingsDialog';
import { toLocalInput, validateView } from '../../../src/components/SettingsDialog';

const STORAGE_KEY = 'starry-night.view';

export function saveViewPrefs(v: ViewParams): void {
  try {
    const { date: _date, ...rest } = v;
    Taro.setStorageSync(STORAGE_KEY, JSON.stringify(rest));
  } catch { /* 配额不足静默跳过，与 Web 版一致 */ }
}

export function loadViewPrefs(defaults: ViewParams): ViewParams {
  try {
    const raw = Taro.getStorageSync(STORAGE_KEY) || '';
    if (!raw) return defaults;
    const merged = { ...defaults, ...JSON.parse(raw), date: toLocalInput(new Date()) } as ViewParams;
    return validateView(merged) ? defaults : merged;
  } catch { return defaults; }
}
