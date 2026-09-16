import { View, Text } from '@tarojs/components';
import type { ReactNode } from 'react';
import { COLORS, FONTS } from '../../../src/lib/tokens';

/** 小程序原生 UI 基础组件：对齐仓根 tokens（COLORS/FONTS），收敛各页散落的内联样式。
 * 导航保持三页跳转不变，只统一样式层；所有 data-testid 保持原样，单测不破。
 */

export const pageStyle = {
  minHeight: '100vh',
  display: 'flex',
  flexDirection: 'column',
  background: COLORS.sky,
  color: COLORS.ink,
  fontFamily: FONTS.ui,
} as const;

export function Page({ children, testId }: { children: ReactNode; testId?: string }) {
  return (
    <View data-testid={testId} style={pageStyle}>
      {children}
    </View>
  );
}

export function PageTitle({ children }: { children: ReactNode }) {
  return (
    <View style={{ padding: '16px 16px 4px', fontSize: 17, fontWeight: 700, color: COLORS.ink }}>
      {children}
    </View>
  );
}

/** 分组卡片：深色面板 + 描边 + 圆角，替代各页裸 View 堆叠。 */
export function Section({ children }: { children: ReactNode }) {
  return (
    <View
      style={{
        margin: '8px 12px',
        background: COLORS.panel,
        border: `1px solid ${COLORS.line}`,
        borderRadius: 10,
        padding: '4px 12px',
      }}
    >
      {children}
    </View>
  );
}

/** 表单行：左 label（inkDim）右控件，行高统一。 */
export function FieldRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View
      style={{
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        minHeight: 44,
        borderBottom: `1px solid ${COLORS.line}`,
        gap: 12,
      }}
    >
      <Text style={{ color: COLORS.inkDim, fontSize: 14, flexShrink: 0 }}>{label}</Text>
      <View style={{ flex: 1, display: 'flex', justifyContent: 'flex-end', alignItems: 'center', minWidth: 0 }}>
        {children}
      </View>
    </View>
  );
}

/** 顶部导航条：单行不换行，左侧入口（设置/星表）+ 右侧操作区（2D/3D 开关）。 */
export function TopBar({ left, right, testId }: { left?: ReactNode; right?: ReactNode; testId?: string }) {
  return (
    <View
      data-testid={testId}
      style={{
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'nowrap',
        minHeight: 48,
        padding: '6px 10px',
        gap: 8,
        borderBottom: `1px solid ${COLORS.line}`,
        background: COLORS.panel,
      }}
    >
      <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 8 }}>{left}</View>
      <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', marginLeft: 'auto' }}>{right}</View>
    </View>
  );
}

export const navLinkStyle = {
  color: COLORS.accent,
  fontSize: 14,
  padding: '6px 10px',
  border: `1px solid ${COLORS.line}`,
  borderRadius: 16,
  overflow: 'hidden',
} as const;

export function NavLink({
  testId,
  onClick,
  children,
}: {
  testId: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Text data-testid={testId} onClick={onClick} style={navLinkStyle}>
      {children}
    </Text>
  );
}

/** 底部状态栏：吸底 sticky，对齐 Web 版 SummaryCell 四格（坐标/时间/恒星时/可见星），读数基线对齐 + 等宽数字。 */
export function StatusBar({
  coords,
  time,
  lst,
  visible,
}: {
  coords: string;
  time: string;
  lst: string;
  visible: string;
}) {
  return (
    <View
      data-testid='summary'
      style={{
        position: 'sticky',
        bottom: 0,
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'baseline',
        justifyContent: 'center',
        flexWrap: 'wrap',
        rowGap: 2,
        background: 'rgba(13,18,32,.92)',
        borderTop: `1px solid ${COLORS.line}`,
        padding: '6px 10px',
        minHeight: 36,
        lineHeight: 1.6,
      }}
    >
      <StatusCell label='坐标' value={coords} first />
      <StatusCell label='时间' value={time} />
      {/* LAST 前缀与 Web 版 Readout value={`LAST ${sky.lstDeg.toFixed(1)}°`} 对齐，由调用方传入 */}
      <StatusCell label='恒星时' value={lst} />
      {/* Top 前缀与 Web 版 Readout value={`Top ${sky.stars.length} 颗`} 对齐，由调用方传入 */}
      <StatusCell label='可见星' value={visible} />
    </View>
  );
}

function StatusCell({ label, value, first = false }: { label: string; value: string; first?: boolean }) {
  return (
    <View
      style={{
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'baseline',
        gap: 6,
        padding: '0 12px',
        borderLeft: first ? 'none' : `1px solid ${COLORS.line}`,
        whiteSpace: 'nowrap',
      }}
    >
      <Text style={{ color: COLORS.inkDim, fontSize: 11 }}>{label}</Text>
      <Text style={{ fontFamily: FONTS.mono, color: COLORS.ink, fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>{value}</Text>
    </View>
  );
}

export const errorTextStyle = { color: COLORS.danger, fontSize: 13 } as const;
