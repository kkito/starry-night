import { useEffect, useRef, useState } from 'react';
import { ALT_RINGS, AZ_SPOKES, AZ_SPOKE_LABELS, projectAltAz } from '../lib/project';
import type { DrawStar } from '../lib/drawlist';
import { StarTooltip } from './StarTooltip';
import type { SkyStar } from '../core/sky';

export type SketchCtx = Pick<
  CanvasRenderingContext2D,
  'fillStyle' | 'strokeStyle' | 'font' | 'textAlign' | 'beginPath' | 'arc' | 'fill' | 'stroke' | 'moveTo' | 'lineTo' | 'fillText' | 'fillRect' | 'save' | 'restore'
>;

export const CANVAS_MARGIN = 10;
const HIT_PX = 8;

export function drawSky(ctx: SketchCtx, opts: { size: number; stars: DrawStar[] }): void {
  const { size, stars } = opts;
  const c = size / 2;
  const R = c - CANVAS_MARGIN;
  ctx.save();
  // 地面
  ctx.fillStyle = '#232a3a';
  ctx.fillRect(0, 0, size, size);
  // 天空
  ctx.beginPath();
  ctx.arc(c, c, R, 0, Math.PI * 2);
  ctx.fillStyle = '#0b1020';
  ctx.fill();
  // 高度环 + 刻度
  ctx.font = '11px sans-serif';
  ctx.textAlign = 'center';
  for (const alt of ALT_RINGS) {
    const r = (R * (90 - alt)) / 90;
    ctx.beginPath();
    ctx.arc(c, c, r, 0, Math.PI * 2);
    ctx.strokeStyle = '#2a3350';
    ctx.stroke();
    ctx.fillStyle = '#5a6a94';
    ctx.fillText(`${alt}°`, c, c - r - 4);
  }
  // 方位放射线 + 标注
  for (const az of AZ_SPOKES) {
    const p = projectAltAz(0, az, R);
    ctx.beginPath();
    ctx.moveTo(c, c);
    ctx.lineTo(c + p.x, c + p.y);
    ctx.stroke();
    const lp = projectAltAz(-5, az, R); // 圆外一点
    ctx.fillStyle = '#8b97b8';
    ctx.fillText(AZ_SPOKE_LABELS[az]!, c + lp.x, c + lp.y + 4);
  }
  // 天顶十字
  ctx.beginPath();
  ctx.moveTo(c - 4, c);
  ctx.lineTo(c + 4, c);
  ctx.moveTo(c, c - 4);
  ctx.lineTo(c, c + 4);
  ctx.strokeStyle = '#5a6a94';
  ctx.stroke();
  // 星星
  for (const s of stars) {
    ctx.beginPath();
    ctx.arc(c + s.x, c + s.y, s.rPx, 0, Math.PI * 2);
    ctx.fillStyle = s.color;
    ctx.fill();
    if (s.label && s.name) {
      ctx.fillStyle = '#e8ecf8';
      ctx.textAlign = 'left';
      ctx.fillText(s.name, c + s.x + s.rPx + 3, c + s.y + 3);
      ctx.textAlign = 'center';
    }
  }
  ctx.restore();
}

export function StarChart({ stars, size = 560 }: { stars: DrawStar[]; size?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [hover, setHover] = useState<{ star: DrawStar; px: number; py: number } | null>(null);
  useEffect(() => {
    const ctx = ref.current?.getContext('2d');
    if (ctx) drawSky(ctx, { size, stars });
  }, [stars, size]);
  const onMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const c = size / 2;
    let best: DrawStar | null = null;
    let bestD = HIT_PX;
    for (const s of stars) {
      const d = Math.hypot(c + s.x - mx, c + s.y - my);
      if (d < bestD) { best = s; bestD = d; }
    }
    setHover(best ? { star: best, px: mx, py: my } : null);
  };
  return (
    <div style={{ position: 'relative' }} onMouseLeave={() => setHover(null)}>
      <canvas ref={ref} width={size} height={size} data-testid="star-canvas" onMouseMove={onMove} />
      {hover && <StarTooltip star={hover.star as unknown as SkyStar} x={hover.px} y={hover.py} />}
    </div>
  );
}
