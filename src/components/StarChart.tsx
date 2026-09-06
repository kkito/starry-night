import { useEffect, useRef, useState, type MouseEvent } from 'react';
import { ALT_RINGS, AZ_SPOKES, AZ_SPOKE_LABELS, projectAltAz, zenithFraction } from '../lib/project';
import type { DrawStar } from '../lib/drawlist';
import { StarTooltip } from './StarTooltip';
import type { SkyStar } from '../core/sky';

export type SketchCtx = Pick<
  CanvasRenderingContext2D,
  'fillStyle' | 'strokeStyle' | 'font' | 'textAlign' | 'beginPath' | 'arc' | 'ellipse' | 'fill' | 'stroke' | 'moveTo' | 'lineTo' | 'fillText' | 'fillRect' | 'save' | 'restore'
>;

export const CANVAS_MARGIN = 10;
const HIT_PX = 8;

export interface Viewport {
  width: number;
  height: number;
}

/** 视口尺寸 + resize/旋转跟随。 */
export function useViewportSize(): Viewport {
  const [vp, setVp] = useState<Viewport>({ width: window.innerWidth, height: window.innerHeight });
  useEffect(() => {
    const onResize = () => setVp({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
    };
  }, []);
  return vp;
}

export function drawSky(ctx: SketchCtx, opts: { width: number; height: number; stars: DrawStar[] }): void {
  const { width, height, stars } = opts;
  const cx = width / 2;
  const cy = height / 2;
  const rx = cx - CANVAS_MARGIN;
  const ry = cy - CANVAS_MARGIN;
  ctx.save();
  // 地面
  ctx.fillStyle = '#232a3a';
  ctx.fillRect(0, 0, width, height);
  // 天空（椭圆）
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#0b1020';
  ctx.fill();
  // 高度环 + 刻度
  ctx.font = '11px sans-serif';
  ctx.textAlign = 'center';
  for (const alt of ALT_RINGS) {
    const k = zenithFraction(alt);
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx * k, ry * k, 0, 0, Math.PI * 2);
    ctx.strokeStyle = '#2a3350';
    ctx.stroke();
    ctx.fillStyle = '#5a6a94';
    ctx.fillText(`${alt}°`, cx, cy - ry * k - 4);
  }
  // 方位放射线 + 标注
  for (const az of AZ_SPOKES) {
    const p = projectAltAz(0, az, rx, ry);
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + p.x, cy + p.y);
    ctx.stroke();
    const lp = projectAltAz(-5, az, rx, ry); // 地平线外一点
    ctx.fillStyle = '#8b97b8';
    ctx.fillText(AZ_SPOKE_LABELS[az]!, cx + lp.x, cy + lp.y + 4);
  }
  // 天顶十字
  ctx.beginPath();
  ctx.moveTo(cx - 4, cy);
  ctx.lineTo(cx + 4, cy);
  ctx.moveTo(cx, cy - 4);
  ctx.lineTo(cx, cy + 4);
  ctx.strokeStyle = '#5a6a94';
  ctx.stroke();
  // 星星
  for (const s of stars) {
    ctx.beginPath();
    ctx.arc(cx + s.x, cy + s.y, s.rPx, 0, Math.PI * 2);
    ctx.fillStyle = s.color;
    ctx.fill();
    if (s.label && s.name) {
      ctx.fillStyle = '#e8ecf8';
      ctx.textAlign = 'left';
      ctx.fillText(s.name, cx + s.x + s.rPx + 3, cy + s.y + 3);
      ctx.textAlign = 'center';
    }
  }
  ctx.restore();
}

export function StarChart({ stars, width, height }: { stars: DrawStar[]; width: number; height: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [hover, setHover] = useState<{ star: DrawStar; px: number; py: number } | null>(null);
  useEffect(() => {
    const ctx = ref.current?.getContext('2d');
    if (ctx) drawSky(ctx, { width, height, stars });
  }, [stars, width, height]);
  const onMove = (e: MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const cx = width / 2;
    const cy = height / 2;
    let best: DrawStar | null = null;
    let bestD = HIT_PX;
    for (const s of stars) {
      const d = Math.hypot(cx + s.x - mx, cy + s.y - my);
      if (d < bestD) { best = s; bestD = d; }
    }
    setHover(best ? { star: best, px: mx, py: my } : null);
  };
  return (
    <div style={{ position: 'relative' }} onMouseLeave={() => setHover(null)}>
      <canvas ref={ref} width={width} height={height} data-testid="star-canvas" onMouseMove={onMove} style={{ display: 'block' }} />
      {hover && <StarTooltip star={hover.star as unknown as SkyStar} x={hover.px} y={hover.py} />}
    </div>
  );
}
