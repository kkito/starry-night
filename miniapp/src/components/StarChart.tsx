import { useEffect, useState } from 'react';
import { Canvas, View, Text } from '@tarojs/components';
// 直接只读引用 Web 版 drawSky 纯函数（Task 2 已验证 mini.webpackChain 可打包仓根外文件）。
// 同步规则：drawSky 逻辑以仓根 src/components/StarChart.tsx 为准，此处不分叉复制；
// 若 Web 版 SketchCtx/drawSky 签名变更，此处 import 会随类型检查失败而显式暴露。
import { drawSky } from '../../../src/components/StarChart';
import type { DrawStar } from '../../../src/lib/drawlist';
import type { StarTrack } from '../../../src/lib/track';
import { getCanvasRect, getGLCanvasNode, nextFrame } from '../web-env';

export const HIT_PX = 8;

/** 首帧节点未就绪时的最大重试次数（不含首次尝试）。 */
export const MAX_DRAW_RETRIES = 3;

export interface DrawArgs {
  width: number;
  height: number;
  stars: DrawStar[];
  mirror: boolean;
  shape: 'ellipse' | 'circle';
  track: StarTrack | null;
}

/** 可单测的重试状态机：失败时经 schedule（一帧延迟）重试有限次，仍失败则 onFail。 */
export function tryDrawWithRetry(opts: {
  getNode: (canvasId: string) => Promise<any>;
  schedule: (fn: () => void) => void;
  draw: (ctx: any, args: DrawArgs) => void;
  canvasId: string;
  args: DrawArgs;
  attempt?: number;
  onOk?: () => void;
  onFail?: (err: unknown) => void;
}): void {
  const { getNode, schedule, draw, canvasId, args, attempt = 0, onOk, onFail } = opts;
  getNode(canvasId)
    .then((node: any) => {
      const ctx = node?.getContext?.('2d') ?? node;
      if (ctx) draw(ctx, args);
      onOk?.();
    })
    .catch((err: unknown) => {
      if (attempt < MAX_DRAW_RETRIES) {
        schedule(() =>
          tryDrawWithRetry({ getNode, schedule, draw, canvasId, args, attempt: attempt + 1, onOk, onFail }),
        );
      } else {
        onFail?.(err);
      }
    });
}

/** 统一取点：touch 数据优先（小程序 onClick 也触发时），H5 click 只有 clientX/Y。无数据返回 null。 */
export function extractClientPoint(e: any): { x: number; y: number } | null {
  const t = e?.changedTouches?.[0] ?? e?.touches?.[0] ?? e;
  if (t == null || typeof t.clientX !== 'number' || typeof t.clientY !== 'number') return null;
  return { x: t.clientX, y: t.clientY };
}

/** 可单测的纯函数：从 Web 版 StarChart.hitTest 提炼（最近邻 + 阈值 HIT_PX=8 保持）。
 * 坐标约定：stars 的 x/y 与 (mx, my) 同为画布左上角原点的绝对像素坐标；
 * 调用方负责把 DrawStar 的中心相对偏移 (+cx/+cy) 换算进来。 */
export function hitTestStar(
  stars: Pick<DrawStar, 'id' | 'x' | 'y'>[],
  width: number,
  height: number,
  mx: number,
  my: number,
): Pick<DrawStar, 'id' | 'x' | 'y'> | null {
  void width;
  void height;
  let best: Pick<DrawStar, 'id' | 'x' | 'y'> | null = null;
  let bestD = HIT_PX;
  for (const s of stars) {
    const d = Math.hypot(s.x - mx, s.y - my);
    if (d < bestD) { best = s; bestD = d; }
  }
  return best;
}

export function StarChart({
  stars,
  width,
  height,
  mirror = false,
  shape = 'ellipse',
  track = null,
  selectedId = null,
  onSelect,
}: {
  stars: DrawStar[];
  width: number;
  height: number;
  mirror?: boolean;
  shape?: 'ellipse' | 'circle';
  track?: StarTrack | null;
  selectedId?: string | null;
  /** 点击星星时回调其 id，点击空白处回调 null。 */
  onSelect?: (id: string | null) => void;
}) {
  const [drawError, setDrawError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    tryDrawWithRetry({
      canvasId: 'starchart',
      args: { width, height, stars, mirror, shape, track },
      getNode: getGLCanvasNode,
      schedule: (fn) => { nextFrame(() => { if (!cancelled) fn(); }); },
      draw: drawSky,
      onOk: () => { if (!cancelled) setDrawError(null); },
      onFail: (err) => {
        if (!cancelled) setDrawError(err instanceof Error ? err.message : String(err));
      },
    });
    return () => { cancelled = true; };
  }, [stars, width, height, mirror, shape, track]);

  const pick = (clientX: number, clientY: number, left: number, top: number) => {
    const mx = clientX - left;
    const my = clientY - top;
    const abs = stars.map((s) => ({ ...s, x: width / 2 + s.x, y: height / 2 + s.y }));
    onSelect?.(hitTestStar(abs, width, height, mx, my)?.id ?? null);
  };

  const handlePickEvent = (e: any) => {
    const p = extractClientPoint(e);
    if (!p) return;
    // 判端走 web-env.getCanvasRect（按 TARO_ENV 判）：不能用 typeof document 判端，
    // Taro weapp 运行时也有 document 垫片，其元素没有 getBoundingClientRect，会炸。
    getCanvasRect('starchart').then((r) => {
      pick(p.x, p.y, r.left, r.top);
    });
  };

  const selected = selectedId ? (stars.find((x) => x.id === selectedId) ?? null) : null;

  return (
    <View style={{ position: 'relative' }}>
      <Canvas
        type='2d'
        canvasId='starchart'
        id='starchart'
        style={{ width: `${width}px`, height: `${height}px` }}
        onTouchEnd={handlePickEvent}
        onClick={handlePickEvent}
      />
      {drawError && (
        <View data-testid='draw-error'>
          <Text>星图加载失败：{drawError}</Text>
        </View>
      )}
      {selected && (
        <View data-testid='selected-tip'>
          <Text>{selected.name ?? selected.id}</Text>
        </View>
      )}
    </View>
  );
}
