# HTML3D 模式（Web 端 2D Canvas 自研投影）设计文档

日期：2026-09-16
状态：已确认（用户拍板：改 Web 端 `src/` 不动小程序 / 三段并存 / 与 3D 完全对齐 / html3D 做默认）
前置：3D 天穹 v3（docs/superpowers/specs/2026-09-07-3d-dome-design.md）

## 目标

Web 端新增 `html3D` 视图模式：纯 2D Canvas 手写 yaw/pitch 投影，视觉与功能与现有 three.js
3D 版完全对齐（天穹/辉光/地面/仰角圈/方位线/剪影/星点/轨迹/点选/tooltip），零新增依赖。
顶栏变为 `2D / 3D / HTML3D` 三段并存，老 `Sky3D.tsx` 一行不动；新用户默认进 `html3D`。

## 设计一：模式与入口

- `SettingsDialog.tsx`：`ViewMode` 从 `'2d' | '3d'` 扩成 `'2d' | '3d' | 'html3d'`，
  `validateView` 白名单同步加 `'html3d'`。
- `ViewModeSwitch.tsx`：三段渲染，顺序 `2D / 3D / HTML3D`。
- `App.tsx`：`DEFAULT_VIEW.viewMode` 改 `'html3d'`；`loadViewPrefs` 存啥进啥，不做老用户迁移。
- 渲染分支：`viewMode==='html3d' ? <SkyHtml3D/> : viewMode==='3d' ? <Sky3D/> : <StarChart/>`，
  三者同 props（复用 `Sky3DProps` 类型），数据源同一份 `sky.drawStars` + `track`。

## 设计二：新组件结构

新增 `src/components/SkyHtml3D.tsx`（老 `Sky3D.tsx` 不动，风险隔离），内部分三层：

1. `project(az, alt, yaw, pitch, fov, w, h)` 纯函数（可单测）：`altAzToVec` 出世界坐标 →
   绕 Y 转 yaw、绕 X 转 pitch → 透视除法落屏，`z<=0`（背后星）直接剔除。
   交互系数复用小程序已验证手感：`yaw -= dx*0.003`、`pitch += dy*0.002`、
   pitch 下限 0.9 倍半视场角（地平线下最多留 5%），fov 滚轮/pinch 缩放夹紧 [30, 100]。
2. `drawScene(ctx, ...)` 渲染函数：天穹渐变（按高度插值 zen/mid/hor 三色，与 shader 同色标）、
   辉光环（地平线椭圆描边）、仰角圈/方位线、剪影（底部黑块 + 窗点）、方位与仰角文字、
   星点（按 `pointSizeFor` 半径、`color` 填充的圆）、轨迹（过去实线 / 未来 `setLineDash` 虚线）、
   选中光晕。
3. 组件壳：`<canvas>` + 拖拽/pinch/滚轮事件 + 点选（屏幕 2D 距离 22px 内取最近，
   背后星已在投影层剔除）+ 选中后复用现有 `StarTooltip`（HTML 浮窗，开发者工具可见）。

## 设计三：验证与收尾

- TDD 红灯先行：`project` 投影单测（正前方星落屏幕中心 / 背后星剔除 / yaw 转 180° 后东西对调）
  + `ViewMode` 三段切换测试。
- 手感验收：拖拽/缩放与老 3D 一致、地平线下最多留 5%、点选 22px 内必中、tooltip 内容与 3D 版一致。
- `pnpm test` + `pnpm typecheck` 全绿。
- 本次不删老 3D：`three` 仍被 `Sky3D.tsx` 引用所以包体积暂不变；等 html3D 验收通过后，
  另起一步删除老 3D 并真正减体积。
