// 从根 src/components/StarChart.tsx 拷贝的 2D 绘制纯函数（drawSky 及其私有辅助）。
// 根组件文件含 DOM/React 依赖，不能进小程序包；本文件只保留纯 canvas 绘制逻辑。
// 同步规则：以根 src/components/StarChart.tsx 当前版本的 drawSky 为准，签名/样式变更时同步。
import { ALT_RINGS, AZ_SPOKES, AZ_SPOKE_LABELS, projectAltAz, zenithFraction } from '@starry/sky-core/lib/project';
import { COLORS, FONTS } from '@starry/sky-core/lib/tokens';
import type { DrawStar } from '@starry/sky-core/lib/drawlist';
import type { StarTrack } from '@starry/sky-core/lib/track';

export type SketchCtx = Pick<
  CanvasRenderingContext2D,
  'fillStyle' | 'strokeStyle' | 'font' | 'textAlign' | 'lineWidth' | 'setLineDash' | 'beginPath' | 'arc' | 'ellipse' | 'fill' | 'stroke' | 'moveTo' | 'lineTo' | 'fillText' | 'fillRect' | 'save' | 'restore'
>;
export const CANVAS_MARGIN = 10;

export type ChartShape = 'ellipse' | 'circle';

export function drawSky(
  ctx: SketchCtx,
  opts: { width: number; height: number; stars: DrawStar[]; mirror?: boolean; shape?: ChartShape; track?: StarTrack | null },
): void {
  const { width, height, stars, mirror = false, shape = 'ellipse', track } = opts;
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
  // 选中天体的轨迹：过去实线、未来虚线，均在星星之下
  if (track) drawTrack(ctx, track, cx, cy);
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

/** 选中天体的 ±6 小时轨迹：过去实线、未来虚线，地平线以下的段落不画，两端画沿运动方向的箭头。 */
function drawTrack(ctx: SketchCtx, track: StarTrack, cx: number, cy: number): void {
  ctx.lineWidth = 1.5;
  let firstVisible = -1;
  let lastVisible = -1;
  for (let i = 1; i < track.points.length; i++) {
    const a = track.points[i - 1]!;
    const b = track.points[i]!;
    if (a.alt <= 0 || b.alt <= 0) continue;
    if (firstVisible < 0) firstVisible = i - 1;
    lastVisible = i;
    ctx.setLineDash(i <= track.pastCount ? [] : [5, 5]);
    ctx.strokeStyle = COLORS.accent;
    ctx.beginPath();
    ctx.moveTo(cx + a.x, cy + a.y);
    ctx.lineTo(cx + b.x, cy + b.y);
    ctx.stroke();
  }
  ctx.setLineDash([]);
  ctx.lineWidth = 1;
  // 整小时标记：沿运动方向的小箭头，比端点箭头小一号（当前时刻点是星星本身，跳过）
  for (let i = 0; i < track.points.length; i += 6) {
    if (i === track.pastCount) continue;
    const p = track.points[i]!;
    const prev = track.points[i - 1] ?? track.points[i + 1]!;
    const next = track.points[i + 1] ?? track.points[i - 1]!;
    if (p.alt <= 0 || prev.alt <= 0 || next.alt <= 0) continue;
    drawArrowHead(ctx, cx + prev.x, cy + prev.y, cx + next.x, cy + next.y, 4, 'rgba(232,180,90,.7)');
  }
  // 端点箭头：沿该端局部线段方向（即时间前进方向），标记运动趋势
  if (firstVisible >= 0) {
    drawArrowHead(ctx, cx + track.points[firstVisible]!.x, cy + track.points[firstVisible]!.y,
      cx + track.points[firstVisible + 1]!.x, cy + track.points[firstVisible + 1]!.y);
  }
  if (lastVisible > track.pastCount) {
    drawArrowHead(ctx, cx + track.points[lastVisible - 1]!.x, cy + track.points[lastVisible - 1]!.y,
      cx + track.points[lastVisible]!.x, cy + track.points[lastVisible]!.y);
  }
}

/** 从 (fromX, fromY) 指向 (toX, toY) 的小箭头，画在 to 端。 */
function drawArrowHead(ctx: SketchCtx, fromX: number, fromY: number, toX: number, toY: number, size = 6, color: string = COLORS.accent): void {
  const ang = Math.atan2(toY - fromY, toX - fromX);
  ctx.beginPath();
  ctx.moveTo(toX, toY);
  ctx.lineTo(toX - size * Math.cos(ang - Math.PI / 6), toY - size * Math.sin(ang - Math.PI / 6));
  ctx.moveTo(toX, toY);
  ctx.lineTo(toX - size * Math.cos(ang + Math.PI / 6), toY - size * Math.sin(ang + Math.PI / 6));
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.lineWidth = 1;
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
