/** 仪器风视觉 token：夜空底色 + 单一琥珀强调色 + 等宽读数字体。 */
export const COLORS = {
  sky: '#0d1220',
  ground: '#1c2334',
  panel: '#151b2c',
  ink: '#dfe6f5',
  inkDim: '#7d89a8',
  line: '#2c3757',
  accent: '#e8b45a',
  danger: '#ff7b7b',
  overlay: 'rgba(0,0,0,.55)',
} as const;

export const FONTS = {
  ui: '-apple-system, "PingFang SC", "Noto Sans SC", "Microsoft YaHei", sans-serif',
  mono: 'ui-monospace, "SF Mono", Menlo, Consolas, monospace',
} as const;

export const monoStyle = { font: `12px ${FONTS.mono}` } as const;

/** 深色面板上的通用按钮（作为 CSSProperties 基底，可按需覆盖）。 */
export const buttonStyle = {
  background: '#1f2740',
  color: COLORS.ink,
  border: `1px solid ${COLORS.line}`,
  borderRadius: 6,
  padding: '5px 12px',
  fontSize: 13,
  fontFamily: FONTS.ui,
  cursor: 'pointer',
} as const;
