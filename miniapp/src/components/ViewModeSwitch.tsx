import { View, Text } from '@tarojs/components';
import type { ViewMode } from '../../../src/components/SettingsDialog';

/** 对齐 Web 版 ViewModeSwitch：2D/3D 分段开关，选中态高亮。 */
export function ViewModeSwitch({ value, onChange }: { value: ViewMode; onChange: (m: ViewMode) => void }) {
  return (
    <View data-testid='viewmode-switch' style={{ display: 'inline-flex', flexDirection: 'row' }}>
      {(['2d', '3d'] as const).map((m) => {
        const active = value === m;
        return (
          <Text
            key={m}
            data-testid={m === '2d' ? 'mode-2d' : 'mode-3d'}
            onClick={() => onChange(m)}
            style={{
              padding: '5px 14px',
              fontSize: 12,
              fontWeight: active ? 700 : 400,
              color: active ? '#0d1220' : '#e8ecf4',
              background: active ? '#ffd166' : 'transparent',
              borderRadius: 16,
              overflow: 'hidden',
            }}
          >
            {m.toUpperCase()}
          </Text>
        );
      })}
    </View>
  );
}
