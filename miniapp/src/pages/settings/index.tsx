import { useState } from 'react';
import { View, Text, Input, Picker, Switch, Slider, Button } from '@tarojs/components';
import * as Taro from '@tarojs/taro';
import { toLocalInput, validateView, TOP_N_MIN, TOP_N_MAX, type ViewParams } from '../../../../src/components/SettingsDialog';
import { CITIES } from '../../../../src/lib/cities';
import { pickCityCoords } from '../../lib/city-pick';
import { getCurrentPosition } from '../../adapters/geolocation';
import { loadViewPrefs, saveViewPrefs } from '../../adapters/prefs';
import { FieldRow, Page, PageTitle, Section, errorTextStyle } from '../../components/ui';

// 默认 viewMode 跟 Web 版一致为 '3d'（根 App.tsx DEFAULT_VIEW）。
const DEFAULT_VIEW: ViewParams = { lat: 31.2304, lon: 121.4737, date: toLocalInput(new Date()), timeMode: 'live', topN: 50, aspect: 'auto', showSolar: true, mirror: false, shape: 'ellipse', viewMode: '3d' };

/** 设置子页面：字段与 Web 版 SettingsDialog 对齐，即时写 prefs（Task 3 adapters），返回主页面 onShow 重载生效。 */
export default function Settings() {
  const [view, setView] = useState<ViewParams>(() => loadViewPrefs(DEFAULT_VIEW));
  const [error, setError] = useState<string | null>(null);
  const [city, setCity] = useState('');
  const [locating, setLocating] = useState(false);

  const apply = (patch: Partial<ViewParams>) => {
    const next = { ...view, ...patch };
    const err = validateView(next);
    if (err) { setError(err); return; }
    setError(null);
    setView(next);
    saveViewPrefs(next);
  };

  const pickCity = (name: string) => {
    setCity(name);
    const coords = pickCityCoords(name);
    if (coords) apply(coords);
    else setError(null);
  };

  const locate = async () => {
    setLocating(true);
    setError(null);
    try {
      const pos = await getCurrentPosition();
      setCity('');
      apply({ lat: pos.lat, lon: pos.lon });
    } catch (e) {
      setError(e instanceof Error ? e.message : '定位失败');
    } finally {
      setLocating(false);
    }
  };

  return (
    <Page>
      <PageTitle>设置</PageTitle>
      <Section>
        <FieldRow label='城市'>
          <Picker
            mode='selector'
            range={['手动输入', ...CITIES.map((c) => c.name)]}
            value={city ? CITIES.findIndex((c) => c.name === city) + 1 : 0}
            onChange={(e) => pickCity(Number(e.detail.value) === 0 ? '' : CITIES[Number(e.detail.value) - 1]!.name)}
          >
            <View data-testid='city'>{city || '手动输入'}</View>
          </Picker>
        </FieldRow>
        <FieldRow label='定位'>
          <Button data-testid='locate' size='mini' onClick={locate} disabled={locating}>
            {locating ? '定位中…' : '定位当前'}
          </Button>
        </FieldRow>
        <FieldRow label='纬度'>
          <Input data-testid='lat' type='digit' value={String(view.lat)} onInput={(e) => { setCity(''); apply({ lat: Number(e.detail.value) }); }} />
        </FieldRow>
        <FieldRow label='经度'>
          <Input data-testid='lon' type='digit' value={String(view.lon)} onInput={(e) => { setCity(''); apply({ lon: Number(e.detail.value) }); }} />
        </FieldRow>
      </Section>
      <Section>
        <FieldRow label='时间模式'>
          <Picker
            mode='selector'
            range={['实时', '选定时间']}
            value={view.timeMode === 'live' ? 0 : 1}
            onChange={(e) => {
              const live = Number(e.detail.value) === 0;
              apply({ timeMode: live ? 'live' : 'fixed', ...(live ? { date: toLocalInput(new Date()) } : {}) });
            }}
          >
            <View>{view.timeMode === 'live' ? '实时（跟随当前时间）' : '选定时间'}</View>
          </Picker>
        </FieldRow>
        {view.timeMode === 'fixed' && (
          <>
            <FieldRow label='日期'>
              <Picker
                mode='date'
                value={view.date.slice(0, 10)}
                onChange={(e) => apply({ date: `${String(e.detail.value)}T${view.date.slice(11, 16)}` })}
              >
                <View data-testid='fixed-date'>{view.date.slice(0, 10)}</View>
              </Picker>
            </FieldRow>
            <FieldRow label='时间'>
              <Picker
                mode='time'
                value={view.date.slice(11, 16)}
                onChange={(e) => apply({ date: `${view.date.slice(0, 10)}T${String(e.detail.value)}` })}
              >
                <View data-testid='fixed-time'>{view.date.slice(11, 16)}</View>
              </Picker>
            </FieldRow>
          </>
        )}
      </Section>
      <Section>
        <FieldRow label={`最亮 N 颗（${view.topN}）`}>
          <Slider min={TOP_N_MIN} max={TOP_N_MAX} step={1} value={view.topN} onChange={(e) => apply({ topN: e.detail.value })} showValue />
        </FieldRow>
        <FieldRow label='显示比例'>
          <Picker
            mode='selector'
            range={['自动', '横屏 16:9', '竖屏 9:16']}
            value={['auto', 'landscape', 'portrait'].indexOf(view.aspect)}
            onChange={(e) => apply({ aspect: (['auto', 'landscape', 'portrait'] as const)[Number(e.detail.value)]! })}
          >
            <View>{view.aspect}</View>
          </Picker>
        </FieldRow>
        <FieldRow label='星图形状'>
          <Picker
            mode='selector'
            range={['椭圆', '圆形']}
            value={view.shape === 'ellipse' ? 0 : 1}
            onChange={(e) => apply({ shape: Number(e.detail.value) === 0 ? 'ellipse' : 'circle' })}
          >
            <View>{view.shape}</View>
          </Picker>
        </FieldRow>
        <FieldRow label='太阳系天体'>
          <Switch data-testid='show-solar' checked={view.showSolar} onChange={(e) => apply({ showSolar: e.detail.value })} />
        </FieldRow>
        <FieldRow label='东西镜像'>
          <Switch data-testid='mirror' checked={view.mirror} onChange={(e) => apply({ mirror: e.detail.value })} />
        </FieldRow>
        <FieldRow label='视图模式'>
          <Picker
            mode='selector'
            range={['2D', '3D']}
            value={view.viewMode === '2d' ? 0 : 1}
            onChange={(e) => apply({ viewMode: Number(e.detail.value) === 0 ? '2d' : '3d' })}
          >
            <View>{view.viewMode.toUpperCase()}</View>
          </Picker>
        </FieldRow>
      </Section>
      {error && (
        <View style={{ margin: '0 12px' }}>
          <Text style={errorTextStyle}>{error}</Text>
        </View>
      )}
      <View style={{ margin: '12px' }}>
        <Button onClick={() => Taro.navigateBack()}>返回星图</Button>
      </View>
    </Page>
  );
}
