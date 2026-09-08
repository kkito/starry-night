/** 星表回选键：table 页写入选中星 id，主页面 onShow 读取。见 table/index.tsx 注释。 */
export const SELECTED_KEY = 'starry-night.selected';

import * as Taro from '@tarojs/taro';

/**
 * 一次性消费回选 id：读后即删，避免从设置页等返回时旧 id 被重新盖回（I1）。
 * 读取/删除异常均吞掉，返回 null 表示无回选。
 */
export function consumeSelectedId(): string | null {
  let id: unknown = null;
  try {
    id = Taro.getStorageSync(SELECTED_KEY);
  } catch { /* 无回选 */ }
  try {
    Taro.removeStorageSync(SELECTED_KEY);
  } catch { /* 清理失败忽略，下次覆盖 */ }
  return typeof id === 'string' && id ? id : null;
}
