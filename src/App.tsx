import { useMemo, useState, type CSSProperties } from 'react';
import { computeSky, loadCatalog } from './core';
import { buildDrawList } from './lib/drawlist';
import { zhName } from './lib/names';
import { StarChart, CANVAS_MARGIN, useViewportSize } from './components/StarChart';
import { SettingsDialog, toLocalInput, type ViewParams } from './components/SettingsDialog';
import { StarTableDialog } from './components/StarTableDialog';
import { COLORS, FONTS } from './lib/tokens';

const ASPECT_RATIO = { landscape: 16 / 9, portrait: 9 / 16 } as const;

const DEFAULT_VIEW: ViewParams = { lat: 39.9, lon: 116.4, date: toLocalInput(new Date()), topN: 50, aspect: 'auto' };

/** 按比例偏好计算画布尺寸：auto 跟随窗口，横/竖屏固定 16:9 / 9:16 并在视口内居中。 */
function canvasSize(vp: { width: number; height: number }, aspect: ViewParams['aspect']): { width: number; height: number } {
  if (aspect === 'auto') return { width: vp.width, height: vp.height };
  const r = ASPECT_RATIO[aspect];
  const width = Math.min(vp.width, vp.height * r);
  return { width, height: width / r };
}

export default function App() {
  const [view, setView] = useState<ViewParams>(DEFAULT_VIEW);
  const [menuOpen, setMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [tableOpen, setTableOpen] = useState(false);
  const vp = useViewportSize();
  const { width: cw, height: ch } = canvasSize(vp, view.aspect);

  const sky = useMemo(() => {
    try {
      const date = new Date(view.date); // datetime-local 即本地时间
      const { lstDeg, stars } = computeSky({ lat: view.lat, lon: view.lon, date });
      const bvs = new Map(loadCatalog().map((s) => [s.id, s.bv]));
      // 中文译名优先，保留西文名供 tooltip/星表检索
      const named = stars.map((s) => {
        const zh = zhName(s.name);
        return zh ? { ...s, name: zh, nameEn: s.name } : s;
      });
      const visible = named.slice(0, view.topN); // computeSky 已按视星等升序
      const drawStars = buildDrawList(
        visible.map((s) => ({ ...s, bv: bvs.get(s.id) })),
        cw / 2 - CANVAS_MARGIN,
        ch / 2 - CANVAS_MARGIN,
      );
      return { error: null as string | null, lstDeg, stars: visible, drawStars };
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err), lstDeg: NaN, stars: [], drawStars: [] };
    }
  }, [view, vp, cw, ch]);

  const openFromMenu = (open: () => void) => {
    setMenuOpen(false);
    open();
  };

  return (
    <main style={{ position: 'relative', width: '100vw', height: '100dvh', overflow: 'hidden', color: COLORS.ink, fontFamily: FONTS.ui }}>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <StarChart stars={sky.drawStars} width={cw} height={ch} />
      </div>
      <div style={{ position: 'absolute', top: 10, left: 10 }}>
        <button aria-label="菜单" style={menuButton} onClick={() => setMenuOpen((o) => !o)}>☰</button>
        {menuOpen && (
          <div
            role="menu"
            style={{ position: 'absolute', top: 34, left: 0, background: COLORS.panel, border: `1px solid ${COLORS.accent}`, borderRadius: 8, padding: 6, display: 'flex', flexDirection: 'column', gap: 4, minWidth: 120 }}
          >
            <button style={menuButton} onClick={() => openFromMenu(() => setSettingsOpen(true))}>设置</button>
            <button style={menuButton} onClick={() => openFromMenu(() => setTableOpen(true))}>星表</button>
          </div>
        )}
      </div>
      {sky.error ? (
        <p
          data-testid="summary"
          style={{ position: 'absolute', bottom: 8, left: 0, right: 0, margin: 0, textAlign: 'center', color: COLORS.danger, fontSize: 12 }}
        >
          错误：{sky.error}
        </p>
      ) : (
        <div
          data-testid="summary"
          style={{
            position: 'absolute', bottom: 0, left: 0, right: 0, margin: 0,
            display: 'flex', justifyContent: 'center', alignItems: 'stretch', gap: 0,
            background: 'rgba(13,18,32,.82)', borderTop: `1px solid ${COLORS.line}`,
            padding: '8px 16px', fontSize: 12,
          }}
        >
          <SummaryCell>
            <Readout label="坐标" value={`${formatNum(view.lat)}° ${formatNum(view.lon)}°`} />
            <Readout label="时间" value={view.date} />
          </SummaryCell>
          <SummaryCell>
            <Readout label="恒星时" value={`LAST ${sky.lstDeg.toFixed(1)}°`} />
          </SummaryCell>
          <SummaryCell>
            <Readout label="可见星" value={`Top ${sky.stars.length} 颗`} />
          </SummaryCell>
        </div>
      )}
      <SettingsDialog open={settingsOpen} view={view} onClose={() => setSettingsOpen(false)} onApply={setView} />
      <StarTableDialog open={tableOpen} stars={sky.stars} onClose={() => setTableOpen(false)} />
    </main>
  );
}

function formatNum(n: number): string {
  return String(Number(n.toFixed(4)));
}

function SummaryCell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: 16, padding: '0 16px', alignItems: 'baseline', borderLeft: `1px solid ${COLORS.line}` }}>
      {children}
    </div>
  );
}

function Readout({ label, value }: { label: string; value: string }) {
  return (
    <span style={{ display: 'inline-flex', gap: 6, alignItems: 'baseline' }}>
      <span style={{ color: COLORS.inkDim, fontSize: 11 }}>{label}</span>
      <span style={{ fontFamily: FONTS.mono, color: COLORS.ink, fontVariantNumeric: 'tabular-nums' }}>{value}</span>
    </span>
  );
}

const menuButton: CSSProperties = {
  background: COLORS.panel, color: COLORS.ink, border: `1px solid ${COLORS.line}`,
  borderRadius: 6, padding: '4px 10px', fontSize: 13, cursor: 'pointer',
};
