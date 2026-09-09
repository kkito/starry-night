import { useState } from 'react';
import { View, Text, Input, Button } from '@tarojs/components';
import * as Taro from '@tarojs/taro';
import { filterTableStars, formatStarMag, belowHorizonNote } from '../../lib/table-format';
import { computeSky } from '../../../../src/core/sky';
import { computeSolarBodies } from '../../../../src/core/ephemeris';
import { toLocalInput, type ViewParams } from '../../../../src/components/SettingsDialog';
import { loadViewPrefs } from '../../adapters/prefs';
import { SELECTED_KEY } from '../../lib/selected';
import { Page, PageTitle, Section } from '../../components/ui';
import { COLORS, FONTS } from '../../../../src/lib/tokens';

// 默认 viewMode 跟 Web 版一致为 '3d'（根 App.tsx DEFAULT_VIEW）。
const DEFAULT_VIEW: ViewParams = { lat: 31.2304, lon: 121.4737, date: toLocalInput(new Date()), timeMode: 'live', topN: 50, aspect: 'auto', showSolar: true, mirror: false, shape: 'ellipse', viewMode: '3d' };

/**
 * 星表子页面：列/排序/过滤与 Web 版 StarTableDialog 一致（名称/星等/高度/方位，按星等升序，太阳系分组）。
 * 回选方案（YAGNI 二选一，取最简）：不走 eventChannel，直接把选中 id 写入
 * Taro.setStorageSync(SELECTED_KEY)，主页面 onShow（useDidShow）读取并 setSelectedId。
 * 理由：eventChannel 需 navigateTo 成功回调里取 opoener，链路长、真机调试成本高；storage 键读写已有 prefs 先例。
 */
export default function Table() {
  const [q, setQ] = useState('');
  const [view] = useState<ViewParams>(() => loadViewPrefs(DEFAULT_VIEW));
  const date = view.timeMode === 'live' ? new Date() : new Date(view.date);
  const { stars } = computeSky({ lat: view.lat, lon: view.lon, date });
  const solar = view.showSolar ? computeSolarBodies({ lat: view.lat, lon: view.lon, date }) : [];
  const shown = filterTableStars(stars.slice(0, view.topN), q)
    .sort((a, b) => a.mag - b.mag);

  const pick = (id: string) => {
    try {
      Taro.setStorageSync(SELECTED_KEY, id);
    } catch { /* 忽略配额异常 */ }
    Taro.navigateBack();
  };

  return (
    <Page>
      <PageTitle>星表</PageTitle>
      <Section>
        <View style={{ padding: '8px 0' }}>
          <Input data-testid='filter' placeholder='过滤星名' value={q} onInput={(e) => setQ(e.detail.value)} />
        </View>
        <View style={{ display: 'flex', flexDirection: 'row', gap: 16, padding: '8px 0', color: COLORS.inkDim, fontSize: 12 }}>
          <Text>名称</Text><Text>星等</Text><Text>高度</Text><Text>方位</Text>
        </View>
      </Section>
      {solar.length > 0 && (
        <Section>
          <GroupTitle>太阳系</GroupTitle>
          {solar.map((b) => (
            <Row key={b.id} testId={`row-${b.id}`} onClick={() => pick(b.id)}>
              <Text>{b.name}{b.nameEn ? ` ${b.nameEn}` : ''} {b.mag.toFixed(2)} {b.alt.toFixed(1)}°{belowHorizonNote(b.alt)} {b.az.toFixed(1)}°</Text>
            </Row>
          ))}
        </Section>
      )}
      <Section>
        {solar.length > 0 && <GroupTitle>恒星</GroupTitle>}
        {shown.map((s) => (
          <Row key={s.id} testId={`row-${s.id}`} onClick={() => pick(s.id)}>
            <Text>{s.name ?? s.id}{s.nameEn ? ` ${s.nameEn}` : ''} {formatStarMag(s.mag)} {s.alt.toFixed(1)}°{belowHorizonNote(s.alt)} {s.az.toFixed(1)}°</Text>
          </Row>
        ))}
      </Section>
      <View style={{ margin: '12px' }}>
        <Button onClick={() => Taro.navigateBack()}>关闭</Button>
      </View>
    </Page>
  );
}

function GroupTitle({ children }: { children: string }) {
  return (
    <View style={{ padding: '8px 0 4px', color: COLORS.inkDim, fontSize: 12 }}>
      <Text>—— {children} ——</Text>
    </View>
  );
}

function Row({ testId, onClick, children }: { testId: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <View
      data-testid={testId}
      onClick={onClick}
      style={{
        padding: '10px 0',
        borderBottom: `1px solid ${COLORS.line}`,
        fontFamily: FONTS.mono,
        fontSize: 13,
      }}
    >
      {children}
    </View>
  );
}
