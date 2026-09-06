import { useLayoutEffect, useRef, useState } from 'react';
import { COLORS, FONTS } from '../lib/tokens';

/** Tooltip 信息：恒星或太阳系天体共有的展示字段。 */
export interface TooltipStar {
  id: string;
  name?: string;
  nameEn?: string;
  mag: number;
  alt: number;
  az: number;
  /** 仅太阳系天体：地心距离（AU） */
  distAu?: number;
}

export function StarTooltip({ star, x, y }: { star: TooltipStar; x: number; y: number }) {
  const num: React.CSSProperties = { fontFamily: FONTS.mono, fontVariantNumeric: 'tabular-nums' };
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: x + 12, top: y + 12 });

  useLayoutEffect(() => {
    const el = ref.current;
    const parent = el?.offsetParent as HTMLElement | null;
    if (!el || !parent) return;
    const PAD = 12;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    // 优先显示在指针右下方，越界时翻转到左侧/上方并夹紧在容器内
    let left = x + PAD;
    let top = y + PAD;
    if (left + w > parent.clientWidth) left = Math.max(0, x - PAD - w);
    if (top + h > parent.clientHeight) top = Math.max(0, y - PAD - h);
    setPos({ left, top });
  }, [x, y, star.id]);

  return (
    <div
      ref={ref}
      data-testid="star-tooltip"
      style={{
        position: 'absolute', left: pos.left, top: pos.top, pointerEvents: 'none',
        background: COLORS.panel, border: `1px solid ${COLORS.accent}`, borderRadius: 6,
        padding: '6px 10px', fontSize: 12, lineHeight: 1.6, color: COLORS.ink, fontFamily: FONTS.ui,
      }}
    >
      <div style={{ fontWeight: 600 }}>{star.name ?? star.id}</div>
      {star.nameEn && <div style={{ color: COLORS.inkDim, fontSize: 11 }}>{star.nameEn}</div>}
      <div><span style={{ color: COLORS.inkDim }}>mag </span><span style={num}>{star.mag.toFixed(2)}</span></div>
      <div>
        <span style={{ color: COLORS.inkDim }}>alt </span><span style={num}>{star.alt.toFixed(1)}°</span>
        <span style={{ color: COLORS.inkDim }}> / az </span><span style={num}>{star.az.toFixed(1)}°</span>
      </div>
      {star.distAu !== undefined && (
        <div><span style={{ color: COLORS.inkDim }}>dist </span><span style={num}>{star.distAu.toFixed(2)} AU</span></div>
      )}
    </div>
  );
}
