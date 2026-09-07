import type { ViewMode } from './SettingsDialog';
import { COLORS, FONTS } from '../lib/tokens';

export function ViewModeSwitch({ value, onChange }: { value: ViewMode; onChange: (m: ViewMode) => void }) {
  const is3d = value === '3d';
  return (
    <div
      role="group"
      aria-label="视图模式"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        background: 'rgba(13,18,32,.75)',
        border: `1px solid ${COLORS.line}`,
        borderRadius: 20,
        padding: 3,
        gap: 0,
      }}
    >
      {(['2d', '3d'] as const).map((m) => {
        const active = value === m;
        return (
          <button
            key={m}
            role="switch"
            aria-checked={active}
            aria-label={m === '2d' ? '2D 视图' : '3D 视图'}
            onClick={() => onChange(m)}
            style={{
              border: 'none',
              borderRadius: 16,
              padding: '5px 14px',
              fontSize: 12,
              fontWeight: active ? 700 : 400,
              fontFamily: FONTS.ui,
              cursor: 'pointer',
              color: active ? '#0d1220' : COLORS.ink,
              background: active ? (is3d ? COLORS.accent : '#fff') : 'transparent',
              transition: 'all .18s',
            }}
          >
            {m.toUpperCase()}
          </button>
        );
      })}
    </div>
  );
}
