import { View, Text } from '@tarojs/components';
import type { ReactNode } from 'react';
import { COLORS, FONTS } from '../../../src/lib/tokens';

/** 小程序原生 UI 基础组件：对齐仓根 tokens（COLORS/FONTS），收敛各页散落的内联样式。
 * 导航保持三页跳转不变，只统一样式层；所有 data-testid 保持原样，单测不破。
 */

export const pageStyle = {
  minHeight: '100vh',
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

/** 顶部导航条：标题 + 右侧操作区（主页的设置/星表入口收拢于此）。 */
export function TopBar({ title, right }: { title: string; right?: ReactNode }) {
  return (
    <View
      style={{
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 12px',
        borderBottom: `1px solid ${COLORS.line}`,
        background: COLORS.panel,
      }}
    >
      <Text style={{ fontSize: 16, fontWeight: 700, color: COLORS.ink }}>{title}</Text>
      <View style={{ display: 'flex', flexDirection: 'row', gap: 8 }}>{right}</View>
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

/** 底部状态栏：对齐 Web 版 App.tsx SummaryCell 四格（坐标/时间/恒星时/可见星）。 */
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
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        background: 'rgba(13,18,32,.92)',
        borderTop: `1px solid ${COLORS.line}`,
        padding: '8px 10px',
      }}
    >
      <StatusCell label='坐标' value={coords} />
      <StatusCell label='时间' value={time} />
      {/* LAST 前缀与 Web 版 Readout value={`LAST ${sky.lstDeg.toFixed(1)}°`} 对齐，由调用方传入 */}
      <StatusCell label='恒星时' value={lst} />
      {/* Top 前缀与 Web 版 Readout value={`Top ${sky.stars.length} 颗`} 对齐，由调用方传入 */}
      <StatusCell label='可见星' value={visible} />
    </View>
  );
}

function StatusCell({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
      <Text style={{ color: COLORS.inkDim, fontSize: 10 }}>{label}</Text>
      <Text style={{ fontFamily: FONTS.mono, color: COLORS.ink, fontSize: 11 }}>{value}</Text>
    </View>
  );
}

export const errorTextStyle = { color: COLORS.danger, fontSize: 13 } as const;
