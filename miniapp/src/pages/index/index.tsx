import { useEffect, useMemo, useState } from 'react';
import { View, Text } from '@tarojs/components';
import './index.scss';
import { computeSky } from '../../../../src/core/sky';
import { computeSolarBodies } from '../../../../src/core/ephemeris';
import { loadCatalog } from '../../../../src/core/catalog';
import { buildDrawList, buildSolarDrawList } from '../../../../src/lib/drawlist';
import { computeTrackAround } from '../../../../src/lib/track';
import { zhName } from '../../../../src/lib/names';
import { CANVAS_MARGIN } from '../../../../src/components/StarChart';
import { toLocalInput, type ViewParams } from '../../../../src/components/SettingsDialog';
import { StarChart } from '../../components/StarChart';
import { Sky3D } from '../../components/Sky3D';
import { getViewport } from '../../web-env';
import { loadViewPrefs } from '../../adapters/prefs';

const DEFAULT_VIEW: ViewParams = { lat: 31.2304, lon: 121.4737, date: toLocalInput(new Date()), timeMode: 'live', topN: 50, aspect: 'auto', showSolar: true, mirror: false, shape: 'ellipse', viewMode: '2d' };

export const VIEW_MODES = ['2d', '3d'] as const;

export default function Index() {
  const [view, setView] = useState<ViewParams>(() => loadViewPrefs(DEFAULT_VIEW));
  // 实时模式的心跳：每 5 分钟更新一次（承接 Web 版 App.tsx 状态模型）
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (view.timeMode !== 'live') return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 5 * 60 * 1000);
    return () => clearInterval(id);
  }, [view.timeMode]);
  const activeDate = view.timeMode === 'live' ? toLocalInput(new Date(now)) : view.date;
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const vp = getViewport();
  const cw = vp.width;
  const ch = vp.height;
  const half = Math.min(cw, ch) / 2;
  const effRx = view.shape === 'circle' ? half - CANVAS_MARGIN : cw / 2 - CANVAS_MARGIN;
  const effRy = view.shape === 'circle' ? half - CANVAS_MARGIN : ch / 2 - CANVAS_MARGIN;

  const sky = useMemo(() => {
    try {
      const date = new Date(activeDate);
      const { lstDeg, stars } = computeSky({ lat: view.lat, lon: view.lon, date });
      const bvs = new Map(loadCatalog().map((s) => [s.id, s.bv]));
      const named = stars.map((s) => {
        const zh = zhName(s.name);
        return zh ? { ...s, name: zh, nameEn: s.name } : s;
      });
      const visible = named.slice(0, view.topN);
      const drawStars = buildDrawList(
        visible.map((s) => ({ ...s, bv: bvs.get(s.id) })),
        effRx,
        effRy,
        view.mirror,
      );
      const solarAll = view.showSolar
        ? computeSolarBodies({ lat: view.lat, lon: view.lon, date })
        : [];
      const solarVisible = solarAll.filter((b) => b.alt > 0);
      const drawSolar = buildSolarDrawList(solarVisible, effRx, effRy, view.mirror);
      return { error: null as string | null, lstDeg, stars: visible, drawStars: [...drawStars, ...drawSolar], solar: solarAll };
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err), lstDeg: NaN, stars: [], drawStars: [], solar: [] };
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, activeDate, cw, ch]);

  const track = useMemo(() => {
    if (!selectedId) return null;
    try {
      return computeTrackAround(selectedId, {
        lat: view.lat, lon: view.lon, date: new Date(activeDate), rx: effRx, ry: effRy, mirror: view.mirror,
      });
    } catch {
      return null;
    }
  }, [selectedId, view.lat, view.lon, view.mirror, activeDate, effRx, effRy]);

  return (
    <View className='index'>
      {sky.error ? (
        <Text>错误：{sky.error}</Text>
      ) : (
        <>
          <View data-testid='viewmode-switch'>
            <Text data-testid='mode-2d' onClick={() => setView((v) => ({ ...v, viewMode: '2d' }))}>2D</Text>
            <Text data-testid='mode-3d' onClick={() => setView((v) => ({ ...v, viewMode: '3d' }))}>3D</Text>
          </View>
          {view.viewMode === '3d' ? (
            <Sky3D
              stars={sky.drawStars}
              track={track}
              selectedId={selectedId}
              onSelect={setSelectedId}
            />
          ) : (
          <StarChart
            stars={sky.drawStars}
            width={cw}
            height={ch}
            mirror={view.mirror}
            shape={view.shape}
            track={track}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
          )}
          <Text data-testid='summary'>Top {sky.stars.length} 颗 · LAST {Number.isNaN(sky.lstDeg) ? '--' : sky.lstDeg.toFixed(1)}°</Text>
        </>
      )}
    </View>
  );
}
