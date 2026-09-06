import { useState, type FormEvent, type CSSProperties } from 'react';
import { CITIES, findCity } from '../lib/cities';
import { getCurrentPosition } from '../lib/geolocation';

export interface ViewParams {
  lat: number;
  lon: number;
  date: string;
  magLimit: number;
}

export function validateView(v: ViewParams): string | null {
  if (!Number.isFinite(v.lat) || v.lat < -90 || v.lat > 90) return 'lat 必须在 [-90, 90]';
  if (!Number.isFinite(v.lon) || v.lon < -180 || v.lon > 180) return 'lon 必须在 [-180, 180]';
  if (!v.date || Number.isNaN(new Date(`${v.date}:00Z`).getTime())) return 'date 无效';
  if (!Number.isFinite(v.magLimit) || v.magLimit <= 0 || v.magLimit > 5) return 'magLimit 必须在 (0, 5]';
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
  return { lat: String(v.lat), lon: String(v.lon), date: v.date, magLimit: String(v.magLimit) };
}

const fmt = (n: number) => String(Number(n.toFixed(4)));

export function SettingsDialog({ open, view, onClose, onApply }: Props) {
  const [draft, setDraft] = useState<Draft>(() => toDraft(view));
  const [error, setError] = useState<string | null>(null);
  const [city, setCity] = useState('');
  const [locating, setLocating] = useState(false);
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
      magLimit: Number(draft.magLimit),
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
            <select aria-label="城市" value={city} onChange={(e) => pickCity(e.target.value)}>
              <option value="">手动输入</option>
              {CITIES.map((c) => (
                <option key={c.name} value={c.name}>{c.name}</option>
              ))}
            </select>
          </label>
          <button type="button" aria-label="使用当前位置" onClick={locate} disabled={locating}>
            {locating ? '定位中…' : '使用当前位置'}
          </button>
        </div>
        <label>纬度<input aria-label="纬度" value={draft.lat} onChange={(e) => { set('lat', e.target.value); setCity(''); }} /></label>
        <label>经度<input aria-label="经度" value={draft.lon} onChange={(e) => { set('lon', e.target.value); setCity(''); }} /></label>
        <label>时间(UTC)<input aria-label="时间" type="datetime-local" value={draft.date} onChange={(e) => set('date', e.target.value)} /></label>
        <label>星等上限<input aria-label="星等上限" value={draft.magLimit} onChange={(e) => set('magLimit', e.target.value)} /></label>
        {error && <p role="alert" style={{ color: '#ff7b7b' }}>{error}</p>}
        <button type="submit">应用</button>
        <button type="button" onClick={onClose}>取消</button>
      </form>
    </div>
  );
}

const overlay: CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' };
const panel: CSSProperties = { display: 'flex', flexDirection: 'column', gap: 8, background: '#1a2136', padding: 16, borderRadius: '12px 12px 0 0', width: '100%', maxWidth: 640, maxHeight: '85dvh', overflowY: 'auto' };
const row: CSSProperties = { display: 'flex', gap: 8, alignItems: 'flex-end' };
