import { useEffect, useState, type FormEvent, type CSSProperties } from 'react';
import { CITIES, findCity } from '../lib/cities';
import { getCurrentPosition } from '../lib/geolocation';
import { COLORS, FONTS, buttonStyle } from '../lib/tokens';

export type AspectPref = 'auto' | 'landscape' | 'portrait';
export type ShapePref = 'ellipse' | 'circle';

export interface ViewParams {
  lat: number;
  lon: number;
  date: string;
  topN: number;
  aspect: AspectPref;
  /** 是否显示太阳系天体（八大行星 + 月亮） */
  showSolar: boolean;
  /** 东西镜像：true 为地图式（左西右东），false 为仰视式（左东右西） */
  mirror: boolean;
  /** 星图外轮廓形状 */
  shape: ShapePref;
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
  if (!['ellipse', 'circle'].includes(v.shape)) return 'shape 无效';
  return null;
}

interface Props {
  open: boolean;
  view: ViewParams;
  onClose: () => void;
  onApply: (v: ViewParams) => void;
  /** 打开星表弹框（设置弹框会先关闭） */
  onOpenTable: () => void;
}

type Draft = Omit<{ [K in keyof ViewParams]: string }, 'showSolar' | 'mirror'> & { showSolar: boolean; mirror: boolean };

function toDraft(v: ViewParams): Draft {
  return { lat: String(v.lat), lon: String(v.lon), date: v.date, topN: String(v.topN), aspect: v.aspect, showSolar: v.showSolar, mirror: v.mirror, shape: v.shape };
}

const fmt = (n: number) => String(Number(n.toFixed(4)));

export function SettingsDialog({ open, view, onClose, onApply, onOpenTable }: Props) {
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
      showSolar: draft.showSolar,
      mirror: draft.mirror,
      shape: draft.shape as ViewParams['shape'],
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
        <header style={header}>
          <span style={title}>设置</span>
          <button type="button" aria-label="关闭设置" style={closeButton} onClick={onClose}>✕</button>
        </header>
        <div style={body}>
          <section style={section}>
            <SectionTitle>位置</SectionTitle>
            <div style={grid}>
              <label style={fieldLabel}>
                城市
                <select aria-label="城市" style={input} value={city} onChange={(e) => pickCity(e.target.value)}>
                  <option value="">手动输入</option>
                  {CITIES.map((c) => (
                    <option key={c.name} value={c.name}>{c.name}</option>
                  ))}
                </select>
              </label>
              <label style={fieldLabel}>
                纬度
                <input aria-label="纬度" style={input} value={draft.lat} onChange={(e) => { set('lat', e.target.value); setCity(''); }} />
              </label>
              <label style={fieldLabel}>
                经度
                <input aria-label="经度" style={input} value={draft.lon} onChange={(e) => { set('lon', e.target.value); setCity(''); }} />
              </label>
            </div>
            <button type="button" style={button} aria-label="使用当前位置" onClick={locate} disabled={locating}>
              {locating ? '定位中…' : '使用当前位置'}
            </button>
          </section>
          <section style={section}>
            <SectionTitle>时间</SectionTitle>
            <label style={fieldLabel}>
              本地时间
              <input aria-label="时间" type="datetime-local" style={input} value={draft.date} onChange={(e) => set('date', e.target.value)} />
            </label>
          </section>
          <section style={section}>
            <SectionTitle>显示</SectionTitle>
            <label style={fieldLabel}>
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
            <div style={grid}>
              <label style={fieldLabel}>
                显示比例
                <select aria-label="显示比例" style={input} value={draft.aspect} onChange={(e) => set('aspect', e.target.value)}>
                  <option value="auto">自动（跟随窗口）</option>
                  <option value="landscape">横屏 16:9</option>
                  <option value="portrait">竖屏 9:16</option>
                </select>
              </label>
              <label style={fieldLabel}>
                星图形状
                <select aria-label="星图形状" style={input} value={draft.shape} onChange={(e) => set('shape', e.target.value)}>
                  <option value="ellipse">椭圆（撑满视口）</option>
                  <option value="circle">圆形</option>
                </select>
              </label>
            </div>
            <label style={checkLabel}>
              <input
                aria-label="显示太阳系天体"
                type="checkbox"
                checked={draft.showSolar}
                onChange={(e) => setDraft((d) => ({ ...d, showSolar: e.target.checked }))}
              />
              显示太阳系天体（八大行星 + 月亮）
            </label>
            <label style={checkLabel}>
              <input
                aria-label="东西镜像"
                type="checkbox"
                checked={draft.mirror}
                onChange={(e) => setDraft((d) => ({ ...d, mirror: e.target.checked }))}
              />
              东西镜像（地图式：左西右东；默认仰视式：左东右西）
            </label>
          </section>
          {error && <p role="alert" style={{ margin: 0, color: COLORS.danger, fontSize: 13 }}>{error}</p>}
        </div>
        <footer style={footer}>
          <button type="button" style={button} aria-label="查看星表" onClick={onOpenTable}>查看星表</button>
          <span style={{ flex: 1 }} />
          <button type="button" style={button} onClick={onClose}>取消</button>
          <button type="submit" style={primaryButton}>应用</button>
        </footer>
      </form>
    </div>
  );
}

const overlay: CSSProperties = { position: 'fixed', inset: 0, background: COLORS.overlay, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' };
const panel: CSSProperties = {
  display: 'flex', flexDirection: 'column', background: COLORS.panel,
  borderTop: `1px solid ${COLORS.accent}`, borderRadius: '12px 12px 0 0',
  width: '100%', maxWidth: 640, maxHeight: '85dvh',
  color: COLORS.ink, fontFamily: FONTS.ui,
};
const header: CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  padding: '12px 16px', borderBottom: `1px solid ${COLORS.line}`,
};
const title: CSSProperties = { fontSize: 15, fontWeight: 600, letterSpacing: 1 };
const closeButton: CSSProperties = {
  ...buttonStyle, padding: '2px 10px', fontSize: 14,
  background: 'transparent', border: 'none', color: COLORS.inkDim,
};
const body: CSSProperties = { display: 'flex', flexDirection: 'column', gap: 16, padding: 16, overflowY: 'auto' };
const section: CSSProperties = { display: 'flex', flexDirection: 'column', gap: 8 };
const SectionTitle = ({ children }: { children: React.ReactNode }) => (
  <h3 style={{ margin: 0, fontSize: 12, fontWeight: 500, color: COLORS.inkDim, letterSpacing: 2 }}>{children}</h3>
);
const grid: CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 8 };
const footer: CSSProperties = {
  display: 'flex', gap: 8, alignItems: 'center',
  padding: '12px 16px', borderTop: `1px solid ${COLORS.line}`,
};
const checkLabel: CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 };
const fieldLabel: CSSProperties = { display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, color: COLORS.inkDim };
const row: CSSProperties = { display: 'flex', gap: 8, alignItems: 'center' };
const input: CSSProperties = {
  background: '#1f2740', color: COLORS.ink, border: `1px solid ${COLORS.line}`,
  borderRadius: 6, padding: '5px 8px', fontFamily: FONTS.mono, fontVariantNumeric: 'tabular-nums',
};
const button: CSSProperties = { ...buttonStyle };
const primaryButton: CSSProperties = { ...buttonStyle, borderColor: COLORS.accent, color: COLORS.accent };
const mono: CSSProperties = { fontFamily: FONTS.mono, fontVariantNumeric: 'tabular-nums', color: COLORS.accent, minWidth: 28, textAlign: 'right' };
