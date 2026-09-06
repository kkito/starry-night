---

# 3D 天穹视角（v3）设计文档

日期：2026-09-07
状态：已确认（用户拍板：B 完全对齐 / three npm 打包 / C 跟随选中星）
前置：星图界面 v2（docs/superpowers/specs/2026-09-06-star-chart-ui-design.md），分支 `feature/3d_view`

## 目标

在现有 2D 星图旁新增 3D 天穹模式：three.js 大球体内壁 + 地平线辉光 + 地面圆盘 + 树/楼半透明剪影，
右上角切换 2D/3D。3D 与 2D 功能完全对齐（悬停 tooltip / 点击选中 / 前后 6 小时轨迹 / 太阳系天体），
数据源同一份 `DrawStar[]` + `StarTrack`。`three` 经 npm 安装、由 vite 打进 dist 单文件，运行时无外部请求。

## 设计一：架构与文件

- 新增 `src/lib/dome.ts`：`altAzToVec(azDeg, altDeg, r): { x, y, z }` 纯函数
  （北 = -z、南 = +z、东 = +x、天顶 = +y），可单测。
- 新增 `src/components/SkyDome3D.tsx`：与 `StarChart` 同构 props
  `{ stars: DrawStar[]; track: StarTrack | null; onSelect; onHover? }`，内部 useEffect 建
  scene（天穹 shader 球 BackSide / 地面圆盘 / 辉光环 / 仰角圈 / 方位线 / 剪影 / 星星 Points /
  轨迹 Line），useMemo 随数据更新 Points 位置，raycast 做悬停/点击。
  - 天穹 shader 由 `demo-3d.html` 搬入（天顶深黑 → 地平线暖灰辉光）。
  - 星星颜色/大小沿用 `DrawStar.color / rPx`；太阳系天体沿用颜色、大点（外圈描边 v1 可省略，保证可见即可）。
  - 树（方位 110°）/ 楼（方位 133°）剪影：圆柱 + 圆锥 / 盒子 + 窗口灯 Points，`opacity ≈ 0.55`。
- `App.tsx`：顶栏右上角加 2D/3D 切换按钮（`viewMode: '2d' | '3d'` state，持久化进 localStorage
  与现有视图偏好一起）；3D 模式下 `StarChart` 换 `SkyDome3D`，数据源同一份 `sky.drawStars` + `track`。
- `ViewParams` 新增 `viewMode`（默认 `'2d'`），`validateView` / `SettingsDialog.toDraft` 同步；
  注意 `prefs.saveViewPrefs` 剔除 `date` 但保留 `viewMode`。
- 依赖：`pnpm add three` + `@types/three`（dev），`vite build` 单文件增量约 +600KB min（gzip 约 150KB）。

## 设计二：数据与交互（C：跟随选中星）

- 3D 星点位置 = 同一份 `az/alt` 经 `altAzToVec` 上球面（半径 `R*0.98`），不复用 2D 的 `x/y` 投影。
- 悬停：raycast 取最近 Points → 复用 `StarTooltip` 显示（星名/方位/高度/星等）。
- 点击：调现有 `onSelect(id | null)`，选中逻辑、星表、摘要栏都不变。
- 轨迹：`StarTrack.points` 现只有 `{ x, y, alt }`（2D 投影），3D 需 `az` 重投球面 →
  `track.ts` 的 `TrackPoint` 新增 `az` 字段并回填（`computeTrackAround` 内已有 `az` 变量，直接带出）。
  过去实线（`LineBasicMaterial`）、未来虚线（`LineDashedMaterial`，需 `computeLineDistances`）。
- C 行为：`selectedId` 变化时，相机 yaw 转到该星 `az`、pitch 跟到 `max(8°, alt*0.5)`；
  用户手动拖拽后不再强制跟随，直到下次选中变化。无选中时进 3D 默认朝南微仰 8°。
- 相机：`PerspectiveCamera(fov 65)` 置于 `(0, 2, 0)`，拖拽改 yaw/pitch，滚轮改 fov（30–100）。

## 设计三：验证

- 新增 `tests/dome.test.ts`：`altAzToVec` 方位映射（北=-z、南=+z、东=+x、天顶=+y）
  + `computeTrackAround` 回填 `az`（抽一颗星断言 `points` 皆有有限 `az`）。
- `pnpm typecheck` + `vitest run` 全过；`pnpm build` 确认单文件可产出。
- 现有 2D 测试不受影响（`track.ts` 只加字段不改行为）。
