import { useMemo, useState } from 'react';
import { computeSky, loadCatalog } from './core';
import { buildDrawList } from './lib/drawlist';
import { StarChart, CANVAS_MARGIN } from './components/StarChart';
import { SettingsDialog, type ViewParams } from './components/SettingsDialog';
import { StarTableDialog } from './components/StarTableDialog';

const SIZE = 560;
const DEFAULT_VIEW: ViewParams = { lat: 39.9, lon: 116.4, date: '2026-03-20T20:00', magLimit: 5 };

export default function App() {
  const [view, setView] = useState<ViewParams>(DEFAULT_VIEW);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [tableOpen, setTableOpen] = useState(false);

  const sky = useMemo(() => {
    try {
      const date = new Date(`${view.date}:00Z`);
      const { lstDeg, stars } = computeSky({ lat: view.lat, lon: view.lon, date, magLimit: view.magLimit });
      const bvs = new Map(loadCatalog().map((s) => [s.id, s.bv]));
      const drawStars = buildDrawList(
        stars.map((s) => ({ ...s, bv: bvs.get(s.id) })),
        SIZE / 2 - CANVAS_MARGIN,
      );
      return { error: null as string | null, lstDeg, stars, drawStars };
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err), lstDeg: NaN, stars: [], drawStars: [] };
    }
  }, [view]);

  return (
    <main style={{ color: '#e8ecf8', textAlign: 'center', paddingTop: 12 }}>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', width: SIZE, padding: '0 8px' }}>
        <button onClick={() => setSettingsOpen(true)}>设置</button>
        <button onClick={() => setTableOpen(true)}>星表</button>
      </div>
      <StarChart stars={sky.drawStars} size={SIZE} />
      <p data-testid="summary" style={{ color: '#8b97b8', fontSize: 13 }}>
        {sky.error
          ? `错误：${sky.error}`
          : `lat ${view.lat}° lon ${view.lon}° · ${view.date}Z · LAST ${sky.lstDeg.toFixed(1)}° · 可见星 ${sky.stars.length} 颗`}
      </p>
      <SettingsDialog open={settingsOpen} view={view} onClose={() => setSettingsOpen(false)} onApply={setView} />
      <StarTableDialog open={tableOpen} stars={sky.stars} onClose={() => setTableOpen(false)} />
    </main>
  );
}
