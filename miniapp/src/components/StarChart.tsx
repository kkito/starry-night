import { useEffect } from 'react';
import { Canvas, View, Text } from '@tarojs/components';
import * as Taro from '@tarojs/taro';
// 直接只读引用 Web 版 drawSky 纯函数（Task 2 已验证 mini.webpackChain 可打包仓根外文件）。
// 同步规则：drawSky 逻辑以仓根 src/components/StarChart.tsx 为准，此处不分叉复制；
// 若 Web 版 SketchCtx/drawSky 签名变更，此处 import 会随类型检查失败而显式暴露。
import { drawSky } from '../../../src/components/StarChart';
import type { DrawStar } from '../../../src/lib/drawlist';
import type { StarTrack } from '../../../src/lib/track';
import { getGLCanvasNode } from '../web-env';

export const HIT_PX = 8;

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

function redraw(canvasId: string, args: { width: number; height: number; stars: DrawStar[]; mirror: boolean; shape: 'ellipse' | 'circle'; track: StarTrack | null }): void {
  getGLCanvasNode(canvasId)
    .then((node: any) => {
      const ctx = node.getContext('2d');
      if (ctx) drawSky(ctx, args);
    })
    .catch(() => { /* 首帧节点未就绪时静默跳过，等下一拍重绘 */ });
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
  useEffect(() => {
    redraw('starchart', { width, height, stars, mirror, shape, track });
  }, [stars, width, height, mirror, shape, track]);

  const pick = (clientX: number, clientY: number, left: number, top: number) => {
    const mx = clientX - left;
    const my = clientY - top;
    const abs = stars.map((s) => ({ ...s, x: width / 2 + s.x, y: height / 2 + s.y }));
    onSelect?.(hitTestStar(abs, width, height, mx, my)?.id ?? null);
  };

  const onTouchEnd = (e: any) => {
    const t = e.changedTouches?.[0] ?? e.touches?.[0];
    if (!t) return;
    if (typeof document !== 'undefined') {
      const r = document.getElementById('starchart')?.getBoundingClientRect();
      pick(t.clientX, t.clientY, r?.left ?? 0, r?.top ?? 0);
      return;
    }
    Taro.createSelectorQuery()
      .select('#starchart')
      .boundingClientRect((rect: any) => {
        if (!rect) return;
        pick(t.clientX, t.clientY, rect.left ?? 0, rect.top ?? 0);
      })
      .exec();
  };

  const selected = selectedId ? (stars.find((x) => x.id === selectedId) ?? null) : null;

  return (
    <View style={{ position: 'relative' }}>
      <Canvas
        type='2d'
        canvasId='starchart'
        id='starchart'
        style={{ width: `${width}px`, height: `${height}px` }}
        onTouchEnd={onTouchEnd}
      />
      {selected && (
        <View data-testid='selected-tip'>
          <Text>{selected.name ?? selected.id}</Text>
        </View>
      )}
    </View>
  );
}
