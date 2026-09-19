// 小程序 3D 天穹（canvas 2d）：绘制与 web SkyHtml3D 完全同源，
// 全部天穹绘制经 @starry/sky-core drawSkyScene（组件内零绘制代码）。
// 手势状态机沿用旧 Sky3DAdapter（a22767a）的单指拖拽/双指 pinch/tap 点选，
// 系数集中在 ./sky3d-math 纯函数（与 web 版一致）。
import { useEffect, useRef, useState } from 'react';
import { Canvas, View } from '@tarojs/components';
import { createSelectorQuery } from '@tarojs/taro';
import { drawSkyScene } from '@starry/sky-core/lib/sky-scene';
import type { DrawStar } from '@starry/sky-core/lib/drawlist';
import type { StarTrack } from '@starry/sky-core/lib/track';
import { StarTooltip } from './StarTooltip';
import {
  dragDeltaToYawPitch, clampPitch, pinchDistToFov, toCanvasPoint, touchDist,
  isTapGesture, PICK_PX_TOL, pickBestStarIndex,
} from './sky3d-math';
import { nextFrame, clampPixelRatio } from '../web-env';

export interface Sky3DProps {
  stars: DrawStar[];
  track: StarTrack | null;
  selectedId: string | null;
  onSelect?: (id: string | null) => void;
}

export const SKY3D_CANVAS_ID = 'sky3d-canvas';

export function SkyCanvas3D({ stars, track, selectedId, onSelect }: Sky3DProps) {
  const camRef = useRef({ yaw: Math.PI, pitch: (25 * Math.PI) / 180, fov: 65 });
  const posRef = useRef(new Map<string, { x: number; y: number }>());
  // refs 保最新 props，触摸事件闭包读取
  const dataRef = useRef({ stars, track, selectedId, onSelect });
  dataRef.current = { stars, track, selectedId, onSelect };
  const canvasRef = useRef<{ canvas: HTMLCanvasElement; w: number; h: number } | null>(null);
  const rectRef = useRef<{ left: number; top: number } | null>(null);
  const touchRef = useRef<{ lastX: number; lastY: number; pinchD: number; moved: boolean; startX: number; startY: number } | null>(null);
  const [, force] = useState(0);

  const redraw = () => {
    const rt = canvasRef.current;
    if (!rt) return;
    const ctx = rt.canvas.getContext('2d');
    if (!ctx) return;
    posRef.current = drawSkyScene(ctx, {
      w: rt.w, h: rt.h, cam: camRef.current,
      stars: dataRef.current.stars, track: dataRef.current.track,
    });
    force((n) => n + 1);
  };

  useEffect(() => {
    let alive = true;
    // 延迟到节点挂载后取 canvas node 与 rect（weapp 必须 selectorQuery）
    const query = createSelectorQuery();
    query.select(`#${SKY3D_CANVAS_ID}`).node();
    query.select(`#${SKY3D_CANVAS_ID}`).boundingClientRect();
    query.exec((res: any[]) => {
      if (!alive || !res?.[0]?.node || !res[1]) return;
      const canvas = res[0].node as HTMLCanvasElement;
      const rect = res[1] as DOMRect;
      rectRef.current = { left: rect.left ?? 0, top: rect.top ?? 0 };
      // DPR 封顶 2（硬性约束），逻辑尺寸不变、物理尺寸放大
      const dpr = clampPixelRatio(typeof window !== 'undefined' ? window.devicePixelRatio : 1);
      const w = rect.width ?? canvas.width ?? 300;
      const h = rect.height ?? canvas.height ?? 300;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style!.width = `${w}px`;
      canvas.style!.height = `${h}px`;
      canvas.getContext('2d')?.scale(dpr, dpr);
      canvasRef.current = { canvas, w, h };
      redraw();
    });
    return () => { alive = false; canvasRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // props 变化（星表/轨迹/选中）重绘一帧
  useEffect(() => {
    redraw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stars, track, selectedId]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const extractPoint = (e: any): { clientX: number; clientY: number } | null => {
    const t = e?.changedTouches?.[0] ?? e?.touches?.[0] ?? e;
    if (t == null || typeof t.clientX !== 'number' || typeof t.clientY !== 'number') {
      const d = e?.detail;
      if (d == null || typeof d.x !== 'number' || typeof d.y !== 'number') return null;
      return { clientX: d.x, clientY: d.y };
    }
    return { clientX: t.clientX, clientY: t.clientY };
  };

  /** 屏幕坐标点选：在 drawSkyScene 返回的投影表里取 22px 内最近的星。 */
  const pickAt = (x: number, y: number): string | null => {
    const ids: string[] = [];
    const dists: number[] = [];
    const fwds: number[] = [];
    for (const [id, p] of posRef.current) {
      ids.push(id);
      dists.push(Math.hypot(p.x - x, p.y - y));
      fwds.push(1); // 投影表里只有视野内的星，全部视为朝前
    }
    if (!ids.length) return null;
    const best = pickBestStarIndex(dists, fwds, PICK_PX_TOL);
    return best >= 0 ? ids[best]! : null;
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const onTouchStart = (e: any) => {
    const touches = e?.touches ?? [];
    const t = touches[0] ?? e?.changedTouches?.[0];
    if (!t) return;
    touchRef.current = {
      lastX: t.clientX, lastY: t.clientY,
      pinchD: touches.length >= 2 ? touchDist([touches[0], touches[1]]) : 0,
      moved: false,
      startX: t.clientX, startY: t.clientY,
    };
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const onTouchMove = (e: any) => {
    const st = touchRef.current;
    if (!st) return;
    const touches = e?.touches ?? [];
    if (touches.length >= 2) {
      const d = touchDist([touches[0], touches[1]]);
      if (st.pinchD > 0) {
        camRef.current.fov = pinchDistToFov(camRef.current.fov, st.pinchD, d);
        camRef.current.pitch = clampPitch(camRef.current.pitch, camRef.current.fov);
      }
      st.pinchD = d;
      st.moved = true;
      nextFrame(redraw);
      return;
    }
    const t = touches[0] ?? e?.changedTouches?.[0];
    if (!t) return;
    const dx = t.clientX - st.lastX;
    const dy = t.clientY - st.lastY;
    // tap/drag 按起点累计位移判（触屏 tap 抖动常超 2px，逐帧判定会误杀正常点按）
    if (!isTapGesture(t.clientX - st.startX, t.clientY - st.startY)) st.moved = true;
    const r = dragDeltaToYawPitch(dx, dy, camRef.current.yaw, camRef.current.pitch, camRef.current.fov);
    camRef.current.yaw = r.yaw;
    camRef.current.pitch = r.pitch;
    st.lastX = t.clientX;
    st.lastY = t.clientY;
    // 无 rAF 环境（weapp）由 nextFrame 16ms 定时兜底
    nextFrame(redraw);
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const onTouchEnd = (e: any) => {
    const st = touchRef.current;
    touchRef.current = null;
    // touchStart 可能没触发（touchRef 为空）：不能直接 return，否则 tap 永不点选；
    // 只有明确发生过拖拽（moved）才跳过。
    if (st?.moved) return;
    const t = extractPoint(e);
    if (!t) return;
    const r = rectRef.current ?? { left: 0, top: 0 };
    const p = toCanvasPoint(t.clientX, t.clientY, r);
    dataRef.current.onSelect?.(pickAt(p.x, p.y));
  };

  const selected = selectedId ? (dataRef.current.stars.find((s) => s.id === selectedId) ?? null) : null;
  const selPos = selected ? posRef.current.get(selected.id) : undefined;
  return (
    <View data-testid='skydome-3d' style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>
      <Canvas
        type='2d'
        id={SKY3D_CANVAS_ID}
        style={{ width: '100%', height: '100%' }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      />
      {selected && selPos && (
        <View
          data-testid='selected-tooltip'
          style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
        >
          <StarTooltip star={selected} x={selPos.x} y={selPos.y} />
        </View>
      )}
    </View>
  );
}
