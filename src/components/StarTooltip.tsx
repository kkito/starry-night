import type { SkyStar } from '../core/sky';
import { COLORS, FONTS } from '../lib/tokens';

export function StarTooltip({ star, x, y }: { star: SkyStar; x: number; y: number }) {
  const num: React.CSSProperties = { fontFamily: FONTS.mono, fontVariantNumeric: 'tabular-nums' };
  return (
    <div
      data-testid="star-tooltip"
      style={{
        position: 'absolute', left: x + 12, top: y + 12, pointerEvents: 'none',
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
    </div>
  );
}
