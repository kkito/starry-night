import { useEffect, useState, type FormEvent, type CSSProperties } from 'react';
import { CITIES, findCity } from '../lib/cities';
import { getCurrentPosition } from '../lib/geolocation';
import { COLORS, FONTS, buttonStyle } from '../lib/tokens';

export type AspectPref = 'auto' | 'landscape' | 'portrait';

export interface ViewParams {
  lat: number;
  lon: number;
  date: string;
  topN: number;
  aspect: AspectPref;
}

/** 本地时间 → datetime-local 输入串（YYYY-MM-DDTHH:mm）。 */
export function toLocalInput(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export const TOP_N_MIN = 10;
export const TOP_N_MAX = 200;

export function validateView(v: ViewParams): string | null {
  if (!Number.isFinite(v.lat) || v.lat < -90 || v.lat > 90) return 'lat 必须在 [-90, 90]';
  if (!Number.isFinite(v.lon) || v.lon < -180 || v.lon > 180) return 'lon 必须在 [-180, 180]';
  if (!v.date || Number.isNaN(new Date(v.date).getTime())) return 'date 无效';
  if (!Number.isFinite(v.topN) || v.topN < 1 || v.topN > 500) return 'topN 必须在 [1, 500]';
  if (!['auto', 'landscape', 'portrait'].includes(v.aspect)) return 'aspect 无效';
  return null;
}

interface Props {
  open: boolean;
  view: ViewParams;
  onClose: () => void;
  onApply: (v: ViewParams) => void;
}

type Draft = { [K in keyof ViewParams]: string };

function toDraft(v: ViewParams): Draft {
  return { lat: String(v.lat), lon: String(v.lon), date: v.date, topN: String(v.topN), aspect: v.aspect };
}

const fmt = (n: number) => String(Number(n.toFixed(4)));

export function SettingsDialog({ open, view, onClose, onApply }: Props) {
  const [draft, setDraft] = useState<Draft>(() => toDraft(view));
  const [error, setError] = useState<string | null>(null);
  const [city, setCity] = useState('');
  const [locating, setLocating] = useState(false);
  // 每次打开时以最新 view 重置草稿，避免上次未应用的修改残留
  useEffect(() => {
    if (open) {
      setDraft(toDraft(view));
      setError(null);
      setCity('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  if (!open) return null;
  const set = (k: keyof Draft, v: string) => setDraft((d) => ({ ...d, [k]: v }));
  const pickCity = (name: string) => {
    setCity(name);
    setError(null);
    const c = findCity(name);
    if (c) setDraft((d) => ({ ...d, lat: fmt(c.lat), lon: fmt(c.lon) }));
  };
  const locate = async () => {
    setLocating(true);
    setError(null);
    try {
      const pos = await getCurrentPosition();
      setDraft((d) => ({ ...d, lat: fmt(pos.lat), lon: fmt(pos.lon) }));
      setCity('');
    } catch (e) {
      setError(e instanceof Error ? e.message : '定位失败');
    } finally {
      setLocating(false);
    }
  };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const parsed: ViewParams = {
      lat: Number(draft.lat),
      lon: Number(draft.lon),
      date: draft.date,
      topN: Number(draft.topN),
      aspect: draft.aspect as ViewParams['aspect'],
    };
    const err = validateView(parsed);
    if (err) { setError(err); return; }
    setError(null);
    onApply(parsed);
    onClose();
  };
  return (
    <div role="dialog" aria-label="设置" style={overlay} onClick={onClose}>
      <form style={panel} onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <div style={row}>
          <label style={{ flex: 1 }}>
            城市
            <select aria-label="城市" style={input} value={city} onChange={(e) => pickCity(e.target.value)}>
              <option value="">手动输入</option>
              {CITIES.map((c) => (
                <option key={c.name} value={c.name}>{c.name}</option>
              ))}
            </select>
          </label>
          <button type="button" style={button} aria-label="使用当前位置" onClick={locate} disabled={locating}>
            {locating ? '定位中…' : '使用当前位置'}
          </button>
        </div>
        <label>纬度<input aria-label="纬度" style={input} value={draft.lat} onChange={(e) => { set('lat', e.target.value); setCity(''); }} /></label>
        <label>经度<input aria-label="经度" style={input} value={draft.lon} onChange={(e) => { set('lon', e.target.value); setCity(''); }} /></label>
        <label>时间(本地)<input aria-label="时间" type="datetime-local" style={input} value={draft.date} onChange={(e) => set('date', e.target.value)} /></label>
        <label>
          显示最亮的 N 颗
          <div style={row}>
            <input
              aria-label="Top N 亮星"
              type="range"
              min={TOP_N_MIN}
              max={TOP_N_MAX}
              step={1}
              style={{ flex: 1 }}
              value={draft.topN}
              onChange={(e) => set('topN', e.target.value)}
            />
            <span style={mono} data-testid="top-n-value">{draft.topN}</span>
          </div>
        </label>
        <label>
          显示比例
          <select aria-label="显示比例" style={input} value={draft.aspect} onChange={(e) => set('aspect', e.target.value)}>
            <option value="auto">自动（跟随窗口）</option>
            <option value="landscape">横屏 16:9</option>
            <option value="portrait">竖屏 9:16</option>
          </select>
        </label>
        {error && <p role="alert" style={{ color: COLORS.danger }}>{error}</p>}
        <button type="submit" style={primaryButton}>应用</button>
        <button type="button" style={button} onClick={onClose}>取消</button>
      </form>
    </div>
  );
}

const overlay: CSSProperties = { position: 'fixed', inset: 0, background: COLORS.overlay, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' };
const panel: CSSProperties = {
  display: 'flex', flexDirection: 'column', gap: 8, background: COLORS.panel,
  borderTop: `1px solid ${COLORS.accent}`, padding: 16, borderRadius: '12px 12px 0 0',
  width: '100%', maxWidth: 640, maxHeight: '85dvh', overflowY: 'auto',
  color: COLORS.ink, fontFamily: FONTS.ui,
};
const row: CSSProperties = { display: 'flex', gap: 8, alignItems: 'flex-end' };
const input: CSSProperties = {
  background: '#1f2740', color: COLORS.ink, border: `1px solid ${COLORS.line}`,
  borderRadius: 6, padding: '5px 8px', fontFamily: FONTS.mono, fontVariantNumeric: 'tabular-nums',
};
const button: CSSProperties = { ...buttonStyle };
const primaryButton: CSSProperties = { ...buttonStyle, borderColor: COLORS.accent, color: COLORS.accent };
const mono: CSSProperties = { fontFamily: FONTS.mono, fontVariantNumeric: 'tabular-nums', color: COLORS.accent, minWidth: 28, textAlign: 'right' };
