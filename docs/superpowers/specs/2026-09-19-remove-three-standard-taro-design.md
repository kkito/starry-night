# 删除 three.js + 小程序回归标准 Taro 设计文档

日期：2026-09-19
状态：已确认（用户拍板：全新 Taro 4.x 脚手架替换 miniapp/、只保 weapp、抽 workspace 包共享代码、web 顶栏收敛 2D/3D）
前置：HTML3D 模式（docs/superpowers/specs/2026-09-16-html3d-design.md，含剪影/经线/方位标注补齐）

## 目标

web 与小程序彻底移除 three.js：web 端 3D 由 canvas 版（现 SkyHtml3D）唯一承担；
小程序用全新标准 Taro 4.x 脚手架重写，3D 与 web 同源（共用 canvas 投影层），
所有为 three 服务的非标准构建 hack 随之消亡。

## 背景调查结论

- web 端 three 唯一运行时引用点是 `src/components/Sky3D.tsx`，删除影响面 11 个文件。
- 小程序（miniapp/）本身就是标准 Taro 3.6.40 项目；非标准点共 4 处且全部为 three 服务：
  three alias 到 stub、src/vendor UMD 外置 + copy-vendor 脚本、babel exclude、576 行 weapp 版
  three 适配器（Sky3DAdapter.tsx）。
- web 新写的 `src/lib/sky-html3d.ts`（投影/剪影/方位标注）为纯函数，无 DOM 依赖，可直接共享。

## 设计一：Monorepo 抽包（前置，行为零变化）

- 根目录新增 `pnpm-workspace.yaml`：`packages/*` 与 `miniapp` 入 workspace，根包（web）也入 workspace。
- 新建 `packages/sky-core`（包名 `@starry/sky-core`，纯 TS、零 DOM）：
  - 搬入：`src/core/{sky,ephemeris,catalog}`、`src/lib/{dome,drawlist,track,names,project,sky-html3d,tokens,cities}`。
  - 留在根：`src/components/*`、`App.tsx`、`src/lib/prefs.ts`（localStorage）等 web 专属代码。
- web 端 import 机械替换为 `@starry/sky-core`（含 tests）；TS paths + package exports 双配。
- 验收：`pnpm test` / `pnpm typecheck` / `pnpm build` 全绿，行为零变化。

## 设计二：Web 删 three.js

- `ViewMode` 收敛为 `'2d' | '3d'`；渲染两分支：`'3d'` → `<SkyHtml3D>`，else → `<StarChart>`。
- `prefs.ts` 迁移：`loadViewPrefs` 把老用户存的 `'html3d'` 归一化为 `'3d'`；白名单 `['2d','3d']`。
- 顶栏 `ViewModeSwitch` 两档，aria-label `'2D 视图' / '3D 视图'`。
- 删除：`src/components/Sky3D.tsx`（`Sky3DProps` 类型移入 `SkyHtml3D.tsx` 就地导出）、
  `tests/component/Sky3D.test.tsx`、`tests/component/Sky3D.fix.test.tsx`；
  更新 ViewModeSwitch / prefs / SettingsDialog 相关测试。
- 删除依赖 `three`、`@types/three`；`src/lib/dome.ts`（现 sky-core）保留。
- 验收：全量测试绿；`pnpm build` 产物（vite singlefile）从 ~976K 显著缩小（three 占大头）；
  浏览器回归 2D/3D 切换、点选、拖拽、缩放。

## 设计三：全新 miniapp（Taro 4.x，weapp only）

- `taro init` 标准脚手架（React + TS）临时生成，验收后**替换** `miniapp/` 目录；
  只配置 weapp 构建，不做 H5。
- 页面与功能完整平移旧项目三页：
  - index：TopBar / StatusBar / 2D+3D 切换 / 城市+定位 / 固定时刻 / tooltip；
  - settings、table 两页；组件 StarChart、StarTooltip、ViewModeSwitch、ui.tsx；
  - adapters（prefs=storage、geolocation）与 lib（selected、city-pick、canvas-size、table-format）平移。
- 新 3D 组件 `SkyCanvas3D`：
  - `<Canvas type="2d">` + `createSelectorQuery().node()` + DPR 封顶 2；
  - 绘制与 web 完全同源：`@starry/sky-core` 的 `projectHtml3D` / `silhouetteShapes` / `directionLabels`
    及 `dome.ts`（星点/轨迹/剪影/经线/方位标注全部对齐 web 视觉）；
  - 手势：touchstart/move/end 合成拖拽（yaw/pitch）、双指 pinch（fov）、tap（22px 容差点选），
    手势纯函数从旧 `sky3d-math.ts` 平移；选中标签复用 StarTooltip；
  - web-env 垫片保留非 GL 部分（selectorQuery 取 rect、无 rAF 用 setTimeout 兜底、isWeapp），GL 垫片删除。
- 随旧项目消亡：`Sky3D.tsx`（H5 three 版）、`Sky3DAdapter.tsx`、`sky3d-scene.ts`、
  `src/vendor/threejs-miniprogram.js`、`three-stub.js`、`scripts/copy-vendor-weapp.mjs`、three 依赖。
- 测试：纯函数测试平移（sky3d-math/pick、city-pick、selected、table-format、canvas-size、prefs、geolocation），
  three 相关（sky3d-scene、scaffold/bundle-size 锁 vendor 的用例）删除；体积门禁保留并适配新结构。
- 验收：`pnpm test` 全绿；`pnpm build:weapp` 成功 + 体积门禁通过（门禁 ≤2MB；Taro 4 runtime 壳约 430KB，业务产物显著小于旧 three 方案）；
  真机手势/帧率由用户预览验收。

## 风险与对策

- web import 替换量大但纯机械，以全量测试护航。
- Taro 4.x 未知坑：垫片（selectorQuery / 无 rAF / DPR）需按 4.x 重新验证，真机问题小步调。
- canvas 2d 每帧全量重绘，帧成本低于 three 场景渲染，但帧率需真机确认。
- 实施顺序 Part 0 → 1 → 2 串行，每部分独立 TDD + 提交，任何一步可停。
