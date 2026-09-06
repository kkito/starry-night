# 星图界面（v2）设计文档

日期：2026-09-06
状态：已确认（用户逐项拍板：仰视惯例 / 等距方位 / 只画星星亮星名 / 静态+悬停 / 星图即页面 / TSX / 单 HTML）
前置：算法核心 v1 已完成并合并（docs/superpowers/specs/2026-09-06-star-sky-positions-design.md）

## 目标

把现有"输入 → 排序表格"验证页升级为以星图为主体的界面：整页 canvas 星图（天顶居中、仰视惯例、等距方位投影），设置与星表走弹框，星星支持悬停查看详情。用 React TSX 实现，组件测试完整，最终 `pnpm build` 产出单个自包含 HTML。

## 界面设计

**布局**
- 整页一张正方形 canvas 星图，居中；地平线圆内为天空（深空底色 ≈ `#0b1020`），圆外为地面色块
- 右上角"设置"按钮 → 设置弹框；右上角次级入口"星表" → 星表弹框
- 左下角摘要条：地点（lat/lon）、时刻（UTC）、可见星数
- 星点悬停/点击 → 浮动 tooltip：名称、星等、高度角、方位角

**星图绘制（自底向上）**
1. 地平线圆 + 地面色块
2. 高度网格：alt = 0/30/60 同心圆（细线，alt 度数标注在外侧）
3. 方位放射线：N/E/S/W 四条 + 方位标注；**N 上、E 左**（仰视惯例）
4. 天顶中心小十字标记
5. 星星：`r_px` 按星等映射（mag 越小越大），颜色按 B−V 色指数映射（蓝白→白→黄→红）；亮于 1.5 等的星标名字（白字，防遮挡偏移）
6. 天顶正上方不可见星不画（alt ≤ 0 过滤已在 core 完成）

**投影（等距方位，纯函数）**
```
projectAltAz(altDeg, azDeg, R): { x, y }   // R = 画布半径
  r = R * (90 - alt) / 90
  x = cx - r * sin(az)     // E 在左
  y = cy - r * cos(az)     // N 在上
```

## 架构

```
src/
├─ core/                  # 不动：零依赖纯 TS 算法
├─ lib/
│  ├─ project.ts          # projectAltAz 纯函数 + 网格刻度生成
│  └─ drawlist.ts         # computeSky 结果 → 绘制列表纯函数
│                         # （半径映射、B-V 颜色、名字标注过滤、可见性）
├─ components/
│  ├─ StarChart.tsx       # canvas 绘制 + 悬停命中检测 + tooltip 定位
│  ├─ SettingsDialog.tsx  # lat/lon/date/magLimit 表单弹框
│  ├─ StarTableDialog.tsx # 排序星表弹框（含名字过滤输入框）
│  └─ StarTooltip.tsx     # 悬浮详情
├─ App.tsx                # 状态持有（view 参数）、弹框开关、数据获取
└─ main.tsx
```

- **状态流**：App 持有 `{lat, lon, date, magLimit}`，`useMemo` 调 `computeSky` → `drawList` 传给 StarChart；弹框只改状态
- **数据**：`data/catalog.json`（预处理脚本补提 `bv` 字段）作为 JSON 模块打包；无需运行时网络请求

## 交互细节

- 悬停：canvas mousemove → 遍历绘制列表做距离命中（阈值 8px）→ tooltip 跟随鼠标，显示 `名称 / mag X.XX / alt XX.X° / az XX.X°`
- 设置弹框校验沿用 core 的 RangeError，错误信息显示在弹框内
- 星表弹框：按星等升序 + 名字过滤输入框；行点击关闭弹框并把该星高亮（可选，不阻塞）

## 测试策略

1. **纯函数单测**（vitest）：`projectAltAz`（北/东/天顶/地平四锚点 + 仰视镜像断言）；`drawlist`（半径单调性、颜色映射分段、1.5 等名字阈值、alt≤0 剔除）
2. **组件测试**（vitest + @testing-library/react + jsdom）：
   - SettingsDialog：表单渲染、非法值提交显示错误、合法值回调
   - StarTableDialog：排序断言、过滤交互
   - StarTooltip：传入星数据渲染字段完整
   - StarChart：mock canvas 2D context（录制调用），断言给定时调用了正确的圆/文本绘制（天顶十字、地平圆、网格圆数量、星点坐标等于 projectAltAz 输出）；悬停 mock 事件命中显示 tooltip
3. 验收：`pnpm test` 全绿；`pnpm build` 产出**单个** `dist/index.html`（无外部引用，浏览器直接打开可用）

## 依赖增量

devDependencies：`react`、`react-dom`（运行时）、`@testing-library/react`、`@testing-library/user-event`、`jsdom`、`vite-plugin-singlefile`、`@vitejs/plugin-react`。

## 非目标

- 缩放/拖拽/时间动画（用户已选静态+悬停）
- 星座连线/边界/银河（已拍板只画星星亮星名）
- 主题切换、移动端适配
