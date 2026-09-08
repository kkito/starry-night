import { View, Text } from '@tarojs/components';
import type { TooltipStar } from '../../../src/components/StarTooltip';

/** 对齐 Web 版 StarTooltip：选中星的绝对定位信息浮层。
 * 小程序无 offsetParent 越界翻转能力，简化为固定偏移 (x+12, y+12) 渲染。 */
export function StarTooltip({ star, x, y }: { star: TooltipStar; x: number; y: number }) {
  return (
    <View
      data-testid='star-tooltip'
      style={{
        position: 'absolute', left: x + 12, top: y + 12,
        background: '#141b2e', border: '1px solid #ffd166', borderRadius: 6,
        padding: '6px 10px', fontSize: 12, lineHeight: 1.6, color: '#e8ecf4',
      }}
    >
      <View style={{ fontWeight: 600 }}>{star.name ?? star.id}</View>
      {star.nameEn && <View style={{ color: '#8b93a7', fontSize: 11 }}>{star.nameEn}</View>}
      <View>
        <Text style={{ color: '#8b93a7' }}>mag </Text>
        <Text>{star.mag.toFixed(2)}</Text>
      </View>
      <View>
        <Text style={{ color: '#8b93a7' }}>alt </Text>
        <Text>{star.alt.toFixed(1)}°</Text>
        <Text style={{ color: '#8b93a7' }}> / az </Text>
        <Text>{star.az.toFixed(1)}°</Text>
      </View>
      {star.distAu !== undefined && (
        <View>
          <Text style={{ color: '#8b93a7' }}>dist </Text>
          <Text>{star.distAu.toFixed(2)} AU</Text>
        </View>
      )}
    </View>
  );
}
