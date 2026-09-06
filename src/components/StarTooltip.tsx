import type { SkyStar } from '../core/sky';

export function StarTooltip({ star, x, y }: { star: SkyStar; x: number; y: number }) {
  return (
    <div
      data-testid="star-tooltip"
      style={{
        position: 'absolute', left: x + 12, top: y + 12, pointerEvents: 'none',
        background: '#1a2136', border: '1px solid #3a4666', borderRadius: 6,
        padding: '6px 10px', fontSize: 12, lineHeight: 1.6, color: '#e8ecf8',
      }}
    >
      <div style={{ fontWeight: 600 }}>{star.name ?? star.id}</div>
      <div>mag {star.mag.toFixed(2)}</div>
      <div>alt {star.alt.toFixed(1)}° / az {star.az.toFixed(1)}°</div>
    </div>
  );
}
