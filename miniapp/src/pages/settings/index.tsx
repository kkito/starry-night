import { useState } from 'react';
import { View, Text, Input, Picker, Switch, Slider, Button } from '@tarojs/components';
import * as Taro from '@tarojs/taro';
import { toLocalInput, validateView, TOP_N_MIN, TOP_N_MAX, type ViewParams } from '../../../../src/components/SettingsDialog';
import { loadViewPrefs, saveViewPrefs } from '../../adapters/prefs';

const DEFAULT_VIEW: ViewParams = { lat: 31.2304, lon: 121.4737, date: toLocalInput(new Date()), timeMode: 'live', topN: 50, aspect: 'auto', showSolar: true, mirror: false, shape: 'ellipse', viewMode: '2d' };

/** 设置子页面：字段与 Web 版 SettingsDialog 对齐，即时写 prefs（Task 3 adapters），返回主页面 onShow 重载生效。 */
export default function Settings() {
  const [view, setView] = useState<ViewParams>(() => loadViewPrefs(DEFAULT_VIEW));
  const [error, setError] = useState<string | null>(null);

  const apply = (patch: Partial<ViewParams>) => {
    const next = { ...view, ...patch };
    const err = validateView(next);
    if (err) { setError(err); return; }
    setError(null);
    setView(next);
    saveViewPrefs(next);
  };

  return (
    <View style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Text style={{ fontSize: 15, fontWeight: 600 }}>设置</Text>
      <View>
        <Text>纬度</Text>
        <Input data-testid='lat' type='digit' value={String(view.lat)} onInput={(e) => apply({ lat: Number(e.detail.value) })} />
      </View>
      <View>
        <Text>经度</Text>
        <Input data-testid='lon' type='digit' value={String(view.lon)} onInput={(e) => apply({ lon: Number(e.detail.value) })} />
      </View>
      <View>
        <Text>时间模式</Text>
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
      </View>
      <View>
        <Text>显示最亮的 N 颗（{view.topN}）</Text>
        <Slider min={TOP_N_MIN} max={TOP_N_MAX} step={1} value={view.topN} onChange={(e) => apply({ topN: e.detail.value })} showValue />
      </View>
      <View>
        <Text>显示比例</Text>
        <Picker
          mode='selector'
          range={['自动', '横屏 16:9', '竖屏 9:16']}
          value={['auto', 'landscape', 'portrait'].indexOf(view.aspect)}
          onChange={(e) => apply({ aspect: (['auto', 'landscape', 'portrait'] as const)[Number(e.detail.value)]! })}
        >
          <View>{view.aspect}</View>
        </Picker>
      </View>
      <View>
        <Text>星图形状</Text>
        <Picker
          mode='selector'
          range={['椭圆', '圆形']}
          value={view.shape === 'ellipse' ? 0 : 1}
          onChange={(e) => apply({ shape: Number(e.detail.value) === 0 ? 'ellipse' : 'circle' })}
        >
          <View>{view.shape}</View>
        </Picker>
      </View>
      <View>
        <Text>显示太阳系天体</Text>
        <Switch data-testid='show-solar' checked={view.showSolar} onChange={(e) => apply({ showSolar: e.detail.value })} />
      </View>
      <View>
        <Text>东西镜像（地图式：左西右东）</Text>
        <Switch data-testid='mirror' checked={view.mirror} onChange={(e) => apply({ mirror: e.detail.value })} />
      </View>
      <View>
        <Text>视图模式</Text>
        <Picker
          mode='selector'
          range={['2D', '3D']}
          value={view.viewMode === '2d' ? 0 : 1}
          onChange={(e) => apply({ viewMode: Number(e.detail.value) === 0 ? '2d' : '3d' })}
        >
          <View>{view.viewMode.toUpperCase()}</View>
        </Picker>
      </View>
      {error && <Text style={{ color: 'red' }}>{error}</Text>}
      <Button onClick={() => Taro.navigateBack()}>返回星图</Button>
    </View>
  );
}
