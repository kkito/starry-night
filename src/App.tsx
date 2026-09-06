import { useMemo, useState, useEffect, type CSSProperties } from 'react';
import { computeSky, computeSolarBodies, loadCatalog } from './core';
import { buildDrawList, buildSolarDrawList } from './lib/drawlist';
import { zhName } from './lib/names';
import { StarChart, CANVAS_MARGIN, useViewportSize } from './components/StarChart';
import { SettingsDialog, toLocalInput, type ViewParams } from './components/SettingsDialog';
import { StarTableDialog } from './components/StarTableDialog';
import { loadViewPrefs, saveViewPrefs } from './lib/prefs';
import { COLORS, FONTS } from './lib/tokens';

const ASPECT_RATIO = { landscape: 16 / 9, portrait: 9 / 16 } as const;

const DEFAULT_VIEW: ViewParams = { lat: 31.2304, lon: 121.4737, date: toLocalInput(new Date()), timeMode: 'live', topN: 50, aspect: 'auto', showSolar: true, mirror: false, shape: 'ellipse' };

/** 按比例偏好计算画布尺寸：auto 跟随窗口，横/竖屏固定 16:9 / 9:16 并在视口内居中。 */
function canvasSize(vp: { width: number; height: number }, aspect: ViewParams['aspect']): { width: number; height: number } {
  if (aspect === 'auto') return { width: vp.width, height: vp.height };
  const r = ASPECT_RATIO[aspect];
  const width = Math.min(vp.width, vp.height * r);
  return { width, height: width / r };
}

export default function App() {
  const [view, setView] = useState<ViewParams>(() => loadViewPrefs(DEFAULT_VIEW));
  // 实时模式的心跳：每 5 分钟更新一次，驱动星图与状态栏刷新
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (view.timeMode !== 'live') return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 5 * 60 * 1000);
    return () => clearInterval(id);
  }, [view.timeMode]);
  const activeDate = view.timeMode === 'live' ? toLocalInput(new Date(now)) : view.date;
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [tableOpen, setTableOpen] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(true);
  const vp = useViewportSize();
  const { width: cw, height: ch } = canvasSize(vp, view.aspect);

  const sky = useMemo(() => {
      try {
        const date = new Date(activeDate); // datetime-local 即本地时间
      const { lstDeg, stars } = computeSky({ lat: view.lat, lon: view.lon, date });
      const bvs = new Map(loadCatalog().map((s) => [s.id, s.bv]));
      // 中文译名优先，保留西文名供 tooltip/星表检索
      const named = stars.map((s) => {
        const zh = zhName(s.name);
        return zh ? { ...s, name: zh, nameEn: s.name } : s;
      });
      const visible = named.slice(0, view.topN); // computeSky 已按视星等升序
      // 圆形时投影半径取内切，保证与 drawSky 的外轮廓一致
      const effRx = view.shape === 'circle' ? Math.min(cw, ch) / 2 - CANVAS_MARGIN : cw / 2 - CANVAS_MARGIN;
      const effRy = view.shape === 'circle' ? Math.min(cw, ch) / 2 - CANVAS_MARGIN : ch / 2 - CANVAS_MARGIN;
      const drawStars = buildDrawList(
        visible.map((s) => ({ ...s, bv: bvs.get(s.id) })),
        effRx,
        effRy,
        view.mirror,
      );
      // 太阳系天体：地平线以上的投到星图，全部（含地平线下）进星表
      const solarAll = view.showSolar
        ? computeSolarBodies({ lat: view.lat, lon: view.lon, date })
        : [];
      const solarVisible = solarAll.filter((b) => b.alt > 0);
      const drawSolar = buildSolarDrawList(solarVisible, effRx, effRy, view.mirror);
      return { error: null as string | null, lstDeg, stars: visible, drawStars: [...drawStars, ...drawSolar], solar: solarAll };
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err), lstDeg: NaN, stars: [], drawStars: [], solar: [] };
    }
  }, [view, vp, cw, ch, activeDate]);

  return (
    <main style={{ position: 'relative', width: '100vw', height: '100dvh', overflow: 'hidden', color: COLORS.ink, fontFamily: FONTS.ui }}>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <StarChart stars={sky.drawStars} width={cw} height={ch} mirror={view.mirror} shape={view.shape} />
      </div>
      <div style={{ position: 'absolute', top: 10, left: 10 }}>
        <button aria-label="菜单" style={menuButton} onClick={() => setSettingsOpen(true)}>☰</button>
      </div>
      {sky.error ? (
        <p
          data-testid="summary"
          style={{ position: 'absolute', bottom: 8, left: 0, right: 0, margin: 0, textAlign: 'center', color: COLORS.danger, fontSize: 12 }}
        >
          错误：{sky.error}
        </p>
      ) : (
        <>
          {summaryOpen ? (
            <div
              data-testid="summary"
              style={{
                position: 'absolute', bottom: 0, left: 0, right: 0, margin: 0,
                display: 'flex', alignItems: 'center', gap: 0,
                background: 'rgba(13,18,32,.82)', borderTop: `1px solid ${COLORS.line}`,
                padding: '4px 10px', fontSize: 12,
              }}
            >
              <button
                aria-label="收起状态栏"
                style={{ ...menuButton, background: 'transparent', borderColor: 'transparent' }}
                onClick={() => setSummaryOpen(false)}
              >
                ▾
              </button>
              <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
                <SummaryCell>
                  <Readout label="坐标" value={`${formatNum(view.lat)}° ${formatNum(view.lon)}°`} />
                  <Readout label="时间" value={view.timeMode === 'live' ? `${activeDate}（实时）` : view.date} />
                </SummaryCell>
                <SummaryCell>
                  <Readout label="恒星时" value={`LAST ${sky.lstDeg.toFixed(1)}°`} />
                </SummaryCell>
                <SummaryCell>
                  <Readout label="可见星" value={`Top ${sky.stars.length} 颗`} />
                </SummaryCell>
              </div>
              {/* 与左侧收起按钮等宽的占位，保证读数区真正水平居中 */}
              <span aria-hidden style={{ width: 37 }} />
            </div>
          ) : (
            <button
              aria-label="展开状态栏"
              style={{ ...menuButton, position: 'absolute', bottom: 10, left: 10 }}
              onClick={() => setSummaryOpen(true)}
            >
              ▴
            </button>
          )}
        </>
      )}
      <SettingsDialog
        open={settingsOpen}
        view={view}
        onClose={() => setSettingsOpen(false)}
        onApply={(v) => { setView(v); saveViewPrefs(v); }}
        onOpenTable={() => { setSettingsOpen(false); setTableOpen(true); }}
      />
      <StarTableDialog open={tableOpen} stars={sky.stars} solar={sky.solar} onClose={() => setTableOpen(false)} />
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
  background: 'rgba(13,18,32,.6)', color: COLORS.ink, border: `1px solid ${COLORS.line}`,
  borderRadius: 6, padding: '4px 10px', fontSize: 13, cursor: 'pointer',
};
