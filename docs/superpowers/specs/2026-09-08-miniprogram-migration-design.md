# 小程序迁移（Taro + React，双端微信/H5）设计文档

日期：2026-09-08
状态：已确认（方案 A：Taro + React + web-env 薄适配层跑 three 0.185；3D 死磕、无 2D 兜底）
分支：`feature/mini_prog`
前置：3D 天穹 v3（docs/superpowers/specs/2026-09-07-3d-dome-design.md）

## 背景与约束

- 现状：React 19 + TS + three 0.185 单页应用，vite 打单文件 `dist/index.html`（~972KB）。
- 已确认约束：① 平台=微信小程序 + 保留 Web H5；② 功能=现有全部功能平移
  （2D 星图 / 3D 天穹 / 选中弹窗 / 设置 / 星表 / 城市选择）；
  ③ 工程=同仓新增 `miniapp/` 目录；④ 3D 必须移植，不接受降级为 2D 兜底。
- 关键事实：`core/*`（sky/transforms/time/catalog/ephemeris）与 `lib/`
  （project/dome/drawlist/track/names/tokens/cities）为纯函数、无 DOM 依赖，
  小程序侧只读复用，不展开改写。`drawSky(ctx)` 的 `SketchCtx`
  （Pick<CanvasRenderingContext2D, 14 方法>）天然对齐微信 canvas 2d。
- 否决项：`threejs-miniprogram` 官方库停在 2021-04（v0.0.8，基于 three r108），
  与项目 three 0.185 行为差异大，不采用；WebView 套壳方案因域名/审核/体验问题不采用。

## §1 工程结构：同仓 `miniapp/` + 源码级共享

```
starry-night/
├── src/ core/ lib/ components/ …      # 现有 Web 版（不动，H5 仍走 vite）
├── data/catalog.json, star_names_zh.json  # 双端共用数据源（只读）
├── miniapp/                            # 新增 Taro 工程
│   ├── src/
│   │   ├── app.config.ts / app.ts      # 入口 + 页面路由
│   │   ├── pages/index/                # 主星图页（承接 App.tsx 状态）
│   │   ├── pages/table/ …              # 星表等子页面（dialog→page 按需拆）
│   │   ├── shared/ -> 相对引用 ../../src/core, ../../lib, ../../data
│   │   │   # 约定：core/lib/data 只读引用，绝不在 miniapp 内 fork；
│   │   │   # 若需改算法，先改 Web 版 + 过 golden 测试，再同步
│   │   └── web-env.ts                  # §2 适配层
│   └── config/index.ts                 # weapp + h5 双端构建配置
└── tests/                              # unit+golden 双端共用，component 仅 Web
```

## §2 `web-env.ts` 适配层：three 0.185 跑在 wx canvas 上

three 本体不动（npm 装 0.185），只做 5 处替换，对外暴露
`getGLCanvas() / makeOffscreen(w,h) / getViewport() / nextFrame()`，
内部 `#ifdef H5 / #ifdef WEAPP` 条件编译隔离：

| # | Web 版写法 | 小程序写法 |
|---|---|---|
| 1 | `new THREE.WebGLRenderer({antialias})` + `mount.appendChild(domElement)` | `<Canvas type="2d">` 节点经 `createSelectorQuery().node()` 取 canvas，`node.getContext('webgl', {alpha:true})` 后传 `new THREE.WebGLRenderer({canvas: wxCanvas, antialias:true})`（three 官方支持外部 canvas 参数） |
| 2 | 3 处 `document.createElement('canvas')`（星点精灵/方位文字/渐变贴图） | `wx.createOffscreenCanvas({type:'2d', width, height})` 后同样 `new THREE.CanvasTexture(offscreen)`（Sky3D 不用任何 Loader，避开 Loader 改写大坑） |
| 3 | `window.devicePixelRatio` + `innerWidth/Height` | `Taro.getSystemInfoSync()`，renderer 尺寸按 `pixelRatio ≤ 2` 封顶（安卓大画布 crash 硬性要求） |
| 4 | `requestAnimationFrame(loop)` | wx canvas 节点 / 逻辑层全局 rAF，行为一致 |
| 5 | pointerdown/move/up + wheel + `getBoundingClientRect` | `bindtouchstart/move/end` 单指旋转 + 双指 pinch 代替 wheel；坐标经 Taro `boundingClientRect` 换算（改动面最大，但 dome 几何不动） |

Sky3D 业务逻辑（相机 yaw 跟随选中星、轨迹、太阳系天体）一行不改，只换 4 个调用点。

## §3 状态与页面映射

- `App.tsx` 的 `ViewParams`（经纬度/时刻/topN/2D-3D 模式/选中星）整体搬进
  `pages/index/index.tsx`，仍 `useState/useMemo/useEffect` + props 下钻，React 模型照搬。
- 6 组件映射：`StarChart/Sky3D/ViewModeSwitch/StarTooltip` 留主页面
  （Tooltip 改绝对定位 View）；`SettingsDialog/StarTableDialog` 改为 Taro
  抽屉或独立子页面（实现阶段定，行为与 Web 一致）。
- `prefs.ts` localStorage → `Taro.getStorageSync/setStorageSync`（key 不变）；
  `geolocation.ts` → `Taro.getLocation({type:'wgs84'})` + 拒绝时回退城市列表；
  `setInterval` 心跳保留。

## §4 构建、包体与双端对齐

- 构建：`miniapp/` 内 `taro build --type weapp/h5` 双端出包；根 vite 构建不动。
- 包体预算（主包 2MB 红线）：three 0.185（~600KB min）+ astronomy-engine
  + catalog 188KB + 中文名 64KB + Taro 运行时。泄压阀按序：
  ① 星表 JSON 移分包/按需 require；② astronomy-engine 按需裁剪（先验证全量）；
  ③ three 不可裁。以开发者工具"代码依赖分析"实测为准。
- 对齐：H5 以现有 vite 产物为基准真值；`tests/unit + tests/golden` 在 Taro 工程
  同样跑（算法零分叉的证明）；component 测试仅 Web 保留，小程序端补真机验收清单
  （渲染出星、拖拽旋转、选中跟随、设置生效）。
- 排障约束：WebGL 不支持真机调试面板，只能真机预览；开发者工具需手动开"硬件加速"。

## §5 风险与里程碑

- R1：three 0.185 + wx canvas 真机行为差异（抗锯齿/纹理尺寸/sRGB）。
  对策：M1 最小亮机（天穹渐变 + 一颗星），再叠 Points/文字 sprite/手势。
- R2：低端安卓 WebGL 性能/crash。对策：pixelRatio 封顶 2、topN 复用为降载开关。
- R3：Taro 运行时 setData 开销（星表长列表）。对策：星表页用 VirtualList；
  主星图页 canvas 直绘不受影响。
- 里程碑：M1 3D 亮机 → M2 2D 星图跑通 → M3 全部功能对齐 → M4 双端验收。
