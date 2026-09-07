# starry-night — 星空位置计算

给定经纬度与时刻，计算可见星星的位置并按视星等排序。算法核心为纯 TypeScript（IAU 2006 岁差 + IAU 2000B 章动（77 项）+ 开普勒椭圆年像差，精度优于 Meeus 中等精度；黄金用例最大误差 < 4.2″，验收阈值 5″），星表来自 D3-Celestial（mag ≤ 5.0，星名来自 `data/raw/starnames.json`）。

## 使用

```bash
pnpm install
pnpm run preprocess   # data/raw/stars.6.json → data/catalog.json（已入库，可跳过）
pnpm test             # 192 项：单测 + 黄金用例 + 组件测试
pnpm run dev          # 本地页面
pnpm run build        # 产物在 dist/，静态托管即可部署
```

## 页面

整页星图应用：

- 页面主体为星图画布（地平坐标系，含高度环、方位标注），悬停星点显示 tooltip（星名/方位/高度/星等）。
- 画布下方为摘要条：经纬度、UTC 时刻、本地恒星时（LAST）与可见星数量。
- 「设置」弹框：修改纬度/经度/时间/星等上限（支持城市快捷选择与浏览器定位），应用后星图与摘要实时更新。
- 「星表」弹框：列出当前可见星（可按星名过滤）。
- 构建产物为单 HTML：`dist/index.html`，所有 JS/CSS 已内联，可直接双击打开或静态托管。

## 核心 API（src/core）

```ts
computeSky({ lat, lon, date, magLimit?, refraction? })
// → { lstDeg, stars: [{ id, name?, ra, dec, az, alt, mag }] }  仅 alt>0，mag 升序

computeTrack({ lat, lon, start, end, stepMinutes, magLimit?, refraction? })
// → { times: Date[], tracks: Record<id, { az, alt }[]> }
```

坐标约定：方位角从北顺时针；经度东正；RA/Dec 为当日视位置（度）。
