import { useEffect, useRef, useState, type MouseEvent } from 'react';
import { ALT_RINGS, AZ_SPOKES, AZ_SPOKE_LABELS, projectAltAz, zenithFraction } from '../lib/project';
import type { DrawStar } from '../lib/drawlist';
import { StarTooltip } from './StarTooltip';
import { COLORS, FONTS } from '../lib/tokens';

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

export type ChartShape = 'ellipse' | 'circle';

export function drawSky(
  ctx: SketchCtx,
  opts: { width: number; height: number; stars: DrawStar[]; mirror?: boolean; shape?: ChartShape },
): void {
  const { width, height, stars, mirror = false, shape = 'ellipse' } = opts;
  const cx = width / 2;
  const cy = height / 2;
  // 圆形：取内切半径；椭圆：分别撑满
  const rx = shape === 'circle' ? Math.min(cx, cy) - CANVAS_MARGIN : cx - CANVAS_MARGIN;
  const ry = shape === 'circle' ? Math.min(cx, cy) - CANVAS_MARGIN : cy - CANVAS_MARGIN;
  ctx.save();
  // 地面
  ctx.fillStyle = COLORS.ground;
  ctx.fillRect(0, 0, width, height);
  // 天空（椭圆/圆）
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.fillStyle = COLORS.sky;
  ctx.fill();
  // 高度环 + 刻度
  ctx.font = `11px ${FONTS.mono}`;
  ctx.textAlign = 'center';
  for (const alt of ALT_RINGS) {
    const k = zenithFraction(alt);
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx * k, ry * k, 0, 0, Math.PI * 2);
    ctx.strokeStyle = COLORS.line;
    ctx.stroke();
    ctx.fillStyle = COLORS.inkDim;
    ctx.fillText(`${alt}°`, cx, cy - ry * k - 4);
  }
  // 方位放射线 + 标注
  for (const az of AZ_SPOKES) {
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    const p = projectAltAz(0, az, rx, ry, mirror);
    ctx.lineTo(cx + p.x, cy + p.y);
    ctx.strokeStyle = COLORS.line;
    ctx.stroke();
    const lp = projectAltAz(4, az, rx, ry, mirror); // 椭圆内侧一点，避免被画布裁掉
    ctx.fillStyle = az === 0 ? COLORS.accent : COLORS.inkDim; // 北为定向参考
    ctx.fillText(AZ_SPOKE_LABELS[az]!, cx + lp.x, cy + lp.y + 4);
  }
  // 天顶十字
  ctx.beginPath();
  ctx.moveTo(cx - 4, cy);
  ctx.lineTo(cx + 4, cy);
  ctx.moveTo(cx, cy - 4);
  ctx.lineTo(cx, cy + 4);
  ctx.strokeStyle = COLORS.inkDim;
  ctx.stroke();
  // 星星（太阳系天体排在前，避免被恒星圆点盖住）
  const ordered = [...stars].sort((a, b) => Number(b.solar ?? false) - Number(a.solar ?? false));
  for (const s of ordered) {
    if (s.solar) {
      drawSolarBody(ctx, s, cx, cy);
      continue;
    }
    ctx.beginPath();
    ctx.arc(cx + s.x, cy + s.y, s.rPx, 0, Math.PI * 2);
    ctx.fillStyle = s.color;
    ctx.fill();
    if (s.label && s.name) {
      ctx.fillStyle = COLORS.ink;
      ctx.textAlign = 'left';
      ctx.fillText(s.name, cx + s.x + s.rPx + 3, cy + s.y + 3);
      ctx.textAlign = 'center';
    }
  }
  ctx.restore();
}

/** 太阳系天体：大圆点 + 外圈描边 + 名称。 */
function drawSolarBody(ctx: SketchCtx, s: DrawStar, cx: number, cy: number): void {
  const x = cx + s.x;
  const y = cy + s.y;
  ctx.beginPath();
  ctx.arc(x, y, s.rPx, 0, Math.PI * 2);
  ctx.fillStyle = s.color;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x, y, s.rPx + 2.5, 0, Math.PI * 2);
  ctx.strokeStyle = s.color;
  ctx.stroke();
  if (s.name) {
    ctx.fillStyle = COLORS.ink;
    ctx.textAlign = 'left';
    ctx.fillText(s.name, x + s.rPx + 5, y + 3);
    ctx.textAlign = 'center';
  }
}

export function StarChart({
  stars,
  width,
  height,
  mirror = false,
  shape = 'ellipse',
}: {
  stars: DrawStar[];
  width: number;
  height: number;
  mirror?: boolean;
  shape?: ChartShape;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [hover, setHover] = useState<{ star: DrawStar; px: number; py: number } | null>(null);
  useEffect(() => {
    const ctx = ref.current?.getContext('2d');
    if (ctx) drawSky(ctx, { width, height, stars, mirror, shape });
  }, [stars, width, height, mirror, shape]);
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
      {hover && <StarTooltip star={hover.star} x={hover.px} y={hover.py} />}
    </div>
  );
}
