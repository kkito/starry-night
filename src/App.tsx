import { useMemo, useState } from 'react';
import { computeSky, loadCatalog } from './core';
import { buildDrawList } from './lib/drawlist';
import { StarChart, CANVAS_MARGIN, useViewportSize } from './components/StarChart';
import { SettingsDialog, type ViewParams } from './components/SettingsDialog';
import { StarTableDialog } from './components/StarTableDialog';

const DEFAULT_VIEW: ViewParams = { lat: 39.9, lon: 116.4, date: '2026-03-20T20:00', magLimit: 5 };

export default function App() {
  const [view, setView] = useState<ViewParams>(DEFAULT_VIEW);
  const [menuOpen, setMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [tableOpen, setTableOpen] = useState(false);
  const vp = useViewportSize();

  const sky = useMemo(() => {
    try {
      const date = new Date(`${view.date}:00Z`);
      const { lstDeg, stars } = computeSky({ lat: view.lat, lon: view.lon, date, magLimit: view.magLimit });
      const bvs = new Map(loadCatalog().map((s) => [s.id, s.bv]));
      const drawStars = buildDrawList(
        stars.map((s) => ({ ...s, bv: bvs.get(s.id) })),
        vp.width / 2 - CANVAS_MARGIN,
        vp.height / 2 - CANVAS_MARGIN,
      );
      return { error: null as string | null, lstDeg, stars, drawStars };
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err), lstDeg: NaN, stars: [], drawStars: [] };
    }
  }, [view, vp]);

  const openFromMenu = (open: () => void) => {
    setMenuOpen(false);
    open();
  };

  return (
    <main style={{ position: 'relative', width: '100vw', height: '100dvh', overflow: 'hidden', color: '#e8ecf8' }}>
      <StarChart stars={sky.drawStars} width={vp.width} height={vp.height} />
      <div style={{ position: 'absolute', top: 10, left: 10 }}>
        <button aria-label="菜单" onClick={() => setMenuOpen((o) => !o)}>☰</button>
        {menuOpen && (
          <div
            role="menu"
            style={{ position: 'absolute', top: 34, left: 0, background: '#1a2136', border: '1px solid #3a4666', borderRadius: 8, padding: 6, display: 'flex', flexDirection: 'column', gap: 4, minWidth: 120 }}
          >
            <button onClick={() => openFromMenu(() => setSettingsOpen(true))}>设置</button>
            <button onClick={() => openFromMenu(() => setTableOpen(true))}>星表</button>
          </div>
        )}
      </div>
      <p
        data-testid="summary"
        style={{ position: 'absolute', bottom: 8, left: 0, right: 0, margin: 0, textAlign: 'center', color: '#8b97b8', fontSize: 12 }}
      >
        {sky.error
          ? `错误：${sky.error}`
          : `lat ${view.lat}° lon ${view.lon}° · ${view.date}Z · LAST ${sky.lstDeg.toFixed(1)}° · 可见星 ${sky.stars.length} 颗`}
      </p>
      <SettingsDialog open={settingsOpen} view={view} onClose={() => setSettingsOpen(false)} onApply={setView} />
      <StarTableDialog open={tableOpen} stars={sky.stars} onClose={() => setTableOpen(false)} />
    </main>
  );
}
