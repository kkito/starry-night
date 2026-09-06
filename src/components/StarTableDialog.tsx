import { useState, type CSSProperties } from 'react';
import type { SkyStar } from '../core/sky';
import type { SolarBody } from '../core/ephemeris';
import { COLORS, FONTS, buttonStyle } from '../lib/tokens';

export function StarTableDialog({ open, stars, solar, onClose }: { open: boolean; stars: SkyStar[]; solar?: SolarBody[]; onClose: () => void }) {
  const [q, setQ] = useState('');
  if (!open) return null;
  const shown = stars
    .filter((s) => {
      if (!q) return true;
      const ql = q.toLowerCase();
      return (s.name ?? s.id).toLowerCase().includes(ql) || (s.nameEn ?? '').toLowerCase().includes(ql);
    })
    .sort((a, b) => a.mag - b.mag);
  return (
    <div role="dialog" aria-label="星表" style={overlay} onClick={onClose}>
      <div style={panel} onClick={(e) => e.stopPropagation()}>
        <label>过滤星名<input aria-label="过滤星名" style={input} value={q} onChange={(e) => setQ(e.target.value)} /></label>
        <table style={table}>
          <thead>
            <tr>
              <th style={th}>名称</th><th style={th}>星等</th><th style={th}>高度°</th><th style={th}>方位°</th>
            </tr>
            {solar && solar.length > 0 && (
              <tr><th colSpan={4} style={th} data-testid="solar-group">—— 太阳系 ——</th></tr>
            )}
          </thead>
          <tbody>
            {(solar ?? []).map((b) => (
              <tr key={b.id}>
                <td style={td}>
                  {b.name}
                  <span style={{ color: COLORS.inkDim, fontSize: 11 }}> {b.nameEn}</span>
                </td>
                <td style={{ ...tdNum, color: COLORS.accent }} data-testid="mag-cell">{b.mag.toFixed(2)}</td>
                <td style={{ ...tdNum, color: b.alt > 0 ? COLORS.ink : COLORS.inkDim }}>
                  {b.alt.toFixed(1)}{b.alt <= 0 ? '（地平线下）' : ''}
                </td>
                <td style={tdNum}>{b.az.toFixed(1)}</td>
              </tr>
            ))}
            {solar && solar.length > 0 && (
              <tr><td colSpan={4} style={{ ...th, paddingTop: 8 }}>—— 恒星 ——</td></tr>
            )}
            {shown.map((s) => (
              <tr key={s.id}>
                <td style={td}>
                  {s.name ?? s.id}
                  {s.nameEn && <span style={{ color: COLORS.inkDim, fontSize: 11 }}> {s.nameEn}</span>}
                </td>
                <td style={{ ...tdNum, color: COLORS.accent }} data-testid="mag-cell">{s.mag}</td>
                <td style={tdNum}>{s.alt.toFixed(1)}</td>
                <td style={tdNum}>{s.az.toFixed(1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <button style={button} onClick={onClose}>关闭</button>
      </div>
    </div>
  );
}

const overlay: CSSProperties = { position: 'fixed', inset: 0, background: COLORS.overlay, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' };
const panel: CSSProperties = {
  background: COLORS.panel, borderTop: `1px solid ${COLORS.accent}`, padding: 16,
  borderRadius: '12px 12px 0 0', width: '100%', maxWidth: 640, maxHeight: '85dvh', overflowY: 'auto',
  color: COLORS.ink, fontFamily: FONTS.ui, display: 'flex', flexDirection: 'column', gap: 8,
};
const input: CSSProperties = {
  background: '#1f2740', color: COLORS.ink, border: `1px solid ${COLORS.line}`,
  borderRadius: 6, padding: '5px 8px', fontFamily: FONTS.mono,
};
const table: CSSProperties = { borderCollapse: 'collapse', width: '100%', fontSize: 13 };
const th: CSSProperties = { textAlign: 'left', color: COLORS.inkDim, fontWeight: 500, fontSize: 11, padding: '4px 8px', borderBottom: `1px solid ${COLORS.line}` };
const td: CSSProperties = { padding: '4px 8px', borderBottom: `1px solid ${COLORS.line}` };
const tdNum: CSSProperties = { ...td, fontFamily: FONTS.mono, fontVariantNumeric: 'tabular-nums' };
const button: CSSProperties = { ...buttonStyle, alignSelf: 'flex-start' };
