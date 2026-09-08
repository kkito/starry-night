import * as Taro from '@tarojs/taro';

/** pixelRatio 封顶（硬性约束）：防高 DPR 真机爆显存/掉帧。 */
export const MAX_PIXEL_RATIO = 2;

export function clampPixelRatio(pr: number): number {
  return Math.min(Math.max(pr || 1, 1), MAX_PIXEL_RATIO);
}

export function getViewport(): { width: number; height: number; pixelRatio: number } {
  const info = Taro.getSystemInfoSync();
  return { width: info.windowWidth ?? 375, height: info.windowHeight ?? 667, pixelRatio: clampPixelRatio(info.pixelRatio ?? 2) };
}

export type FrameCallback = (time: number) => void;

/** 编译期环境（Taro DefinePlugin 在构建时替换为 'weapp'/'h5' 字面量）。
 * 注意：不要用 `// #ifdef` 注释判端——实测 weapp 产物里 H5/WEAPP 双分支都被打进去了，ifdef 根本没剥离。
 * 用函数每次读 env（而非模块顶层常量），单测可改 process.env.TARO_ENV 覆盖两分支。 */
export function isWeapp(): boolean {
  return process.env.TARO_ENV === 'weapp';
}

/** 下一帧调度（H5 直通 rAF；WEAPP 无全局 rAF，用 16ms 定时兜底），返回 cancel 函数。 */
export function nextFrame(handle: FrameCallback): () => void {
  if (!isWeapp() && typeof requestAnimationFrame === 'function') {
    const id = requestAnimationFrame(handle);
    return () => cancelAnimationFrame(id);
  }
  const t = setTimeout(() => handle(Date.now()), 16);
  return () => clearTimeout(t);
}

/** 画布在视口中的偏移（点击换算用）。H5 走 document；weapp 必须走 selectorQuery。
 * 注意：不能用 `typeof document !== 'undefined'` 判端——Taro weapp 运行时也有 document
 * 垫片，但其 getElementById 返回的元素没有 getBoundingClientRect，会炸。必须按 TARO_ENV 判。 */
export function getCanvasRect(canvasId: string): Promise<{ left: number; top: number }> {
  if (isWeapp()) {
    return new Promise((resolve) => {
      try {
        Taro.createSelectorQuery()
          .select(`#${canvasId}`)
          .boundingClientRect((rect: any) => {
            resolve({ left: rect?.left ?? 0, top: rect?.top ?? 0 });
          })
          .exec();
      } catch {
        resolve({ left: 0, top: 0 });
      }
    });
  }
  const r = typeof document !== 'undefined'
    ? (document.getElementById(canvasId) as HTMLElement | null)?.getBoundingClientRect()
    : undefined;
  return Promise.resolve({ left: r?.left ?? 0, top: r?.top ?? 0 });
}

/** 取 <Canvas type="2d" id={canvasId}> 的绘制节点（weapp 走 selectorQuery.node()，H5 走 document）。 */
export function getGLCanvasNode(canvasId: string): Promise<any> {
  if (!isWeapp()) {
    return new Promise((resolve, reject) => {
      const el = document.getElementById(canvasId) as HTMLCanvasElement | null;
      el ? resolve(el) : reject(new Error(`canvas #${canvasId} missing`));
    });
  }
  return new Promise((resolve, reject) => {
    Taro.createSelectorQuery().select(`#${canvasId}`).node((res: any) => {
      res?.node ? resolve(res.node) : reject(new Error(`canvas #${canvasId} node missing`));
    }).exec();
  });
}

/** 程序化纹理用的离屏 canvas（星点精灵/方位文字/渐变贴图共用）。 */
export function makeOffscreen(width: number, height: number): any {
  if (isWeapp()) {
    return Taro.createOffscreenCanvas({ type: '2d', width, height });
  }
  const c = document.createElement('canvas');
  c.width = width; c.height = height;
  return c;
}
