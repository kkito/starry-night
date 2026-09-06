# stardemo — 星空位置计算

给定经纬度与时刻，计算可见星星的位置并按视星等排序。算法核心为纯 TypeScript（IAU 2006 岁差 + IAU 2000B 章动（77 项）+ 开普勒椭圆年像差，精度优于 Meeus 中等精度；黄金用例最大误差 < 4.2″，验收阈值 5″），星表来自 D3-Celestial（mag ≤ 5.0，星名来自 `data/raw/starnames.json`）。

## 使用

```bash
npm install
npm run preprocess   # data/raw/stars.6.json → data/catalog.json（已入库，可跳过）
npm test             # 155 项：单测 + 黄金用例
npm run dev          # 本地页面
npm run build        # 产物在 dist/，静态托管即可部署
```

## 核心 API（src/core）

```ts
computeSky({ lat, lon, date, magLimit?, refraction? })
// → { lstDeg, stars: [{ id, name?, ra, dec, az, alt, mag }] }  仅 alt>0，mag 升序

computeTrack({ lat, lon, start, end, stepMinutes, magLimit?, refraction? })
// → { times: Date[], tracks: Record<id, { az, alt }[]> }
```

坐标约定：方位角从北顺时针；经度东正；RA/Dec 为当日视位置（度）。
