import { useState, type CSSProperties } from 'react';
import type { SkyStar } from '../core/sky';

export function StarTableDialog({ open, stars, onClose }: { open: boolean; stars: SkyStar[]; onClose: () => void }) {
  const [q, setQ] = useState('');
  if (!open) return null;
  const shown = stars
    .filter((s) => !q || (s.name ?? s.id).toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => a.mag - b.mag);
  return (
    <div role="dialog" aria-label="星表" style={overlay} onClick={onClose}>
      <div style={panel} onClick={(e) => e.stopPropagation()}>
        <label>过滤星名<input aria-label="过滤星名" value={q} onChange={(e) => setQ(e.target.value)} /></label>
        <table>
          <thead><tr><th>名称</th><th>星等</th><th>高度°</th><th>方位°</th></tr></thead>
          <tbody>
            {shown.map((s) => (
              <tr key={s.id}>
                <td>{s.name ?? s.id}</td>
                <td data-testid="mag-cell">{s.mag}</td>
                <td>{s.alt.toFixed(1)}</td>
                <td>{s.az.toFixed(1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <button onClick={onClose}>关闭</button>
      </div>
    </div>
  );
}

const overlay: CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' };
const panel: CSSProperties = { background: '#1a2136', padding: 16, borderRadius: '12px 12px 0 0', width: '100%', maxWidth: 640, maxHeight: '85dvh', overflowY: 'auto', color: '#e8ecf8' };
