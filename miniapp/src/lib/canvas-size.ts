import type { ViewParams } from '../../../src/components/SettingsDialog';

// 来源：根 src/App.tsx 的 canvasSize 纯函数逻辑（只读引用搬运，I4 双端一致）。
// auto 跟随视口；横/竖屏固定 16:9 / 9:16 并收进视口内。
const ASPECT_RATIO = { landscape: 16 / 9, portrait: 9 / 16 } as const;

export function canvasSize(
  vp: { width: number; height: number },
  aspect: ViewParams['aspect'],
): { width: number; height: number } {
  if (aspect === 'auto') return { width: vp.width, height: vp.height };
  const r = ASPECT_RATIO[aspect];
  const width = Math.min(vp.width, vp.height * r);
  return { width, height: width / r };
}
