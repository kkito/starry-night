import { useEffect, useMemo, useState } from 'react';
import { View, Text } from '@tarojs/components';
import * as Taro from '@tarojs/taro';
import { useDidShow } from '@tarojs/taro';
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
import { ViewModeSwitch } from '../../components/ViewModeSwitch';
import { StarTooltip } from '../../components/StarTooltip';
import { consumeSelectedId } from '../../lib/selected';
import { canvasSize } from '../../lib/canvas-size';
import { getViewport } from '../../web-env';
import { loadViewPrefs, saveViewPrefs } from '../../adapters/prefs';

// 默认 viewMode 跟 Web 版一致为 '3d'（根 App.tsx DEFAULT_VIEW；低端机若卡顿可在设置页切回 2D）。
const DEFAULT_VIEW: ViewParams = { lat: 31.2304, lon: 121.4737, date: toLocalInput(new Date()), timeMode: 'live', topN: 50, aspect: 'auto', showSolar: true, mirror: false, shape: 'ellipse', viewMode: '3d' };

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
  // 子页面（设置/星表）返回时刷新：重载 prefs + 读取星表回选 id（见 table/index.tsx 注释）。
  useDidShow(() => {
    setView(loadViewPrefs(DEFAULT_VIEW));
    const id = consumeSelectedId();
    if (id) setSelectedId(id);
  });

  const vp = getViewport();
  // 画布尺寸经 canvasSize（根 App.tsx 逻辑，I4）换算：auto 跟随视口，横/竖屏按 16:9/9:16 收敛。
  const { width: cw, height: ch } = canvasSize(vp, view.aspect);
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
          <ViewModeSwitch value={view.viewMode} onChange={(m) => setView((v) => { const next = { ...v, viewMode: m }; saveViewPrefs(next); return next; })} />
          <View style={{ display: 'flex', flexDirection: 'row', gap: 8 }}>
            <Text data-testid='open-settings' onClick={() => Taro.navigateTo({ url: '/pages/settings/index' })}>设置</Text>
            <Text data-testid='open-table' onClick={() => Taro.navigateTo({ url: '/pages/table/index' })}>星表</Text>
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
          {(() => {
            const sel = selectedId ? sky.drawStars.find((d) => d.id === selectedId) ?? null : null;
            return sel ? (
              <View style={{ position: 'relative' }}>
                {/* DrawStar 的 x/y 是相对画布中心的偏移（见 drawSky: cx+s.x），此处照搬根 StarChart.tsx:241 传画布绝对坐标 */}
                <StarTooltip star={sel} x={cw / 2 + sel.x} y={ch / 2 + sel.y} />
              </View>
            ) : null;
          })()}
        </>
      )}
    </View>
  );
}
