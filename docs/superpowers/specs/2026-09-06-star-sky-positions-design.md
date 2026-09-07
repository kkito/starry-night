# 星空位置计算页（starry-night）设计文档

日期：2026-09-06
状态：待用户审阅

## 目标

给定观测点经纬度与时刻，计算当前星空：每颗星的当日位置（赤经/赤纬）与地平坐标（方位角/高度角），并按视星等排序输出；支持时间序列轨迹（可配置步长）。算法层用 TypeScript 独立实现并完整测试；页面最小化，最终产出可部署的单页 HTML。

## 非目标（本阶段明确不做）

- 交互式星图渲染（D3-Celestial 可视化）——页面只做最小验证 UI
- 太阳、月亮、行星位置
- 变星亮度、自行的高精度处理
- 移动端适配、主题样式打磨

## 需求决策记录

| 决策点 | 结论 |
|---|---|
| 星表范围 | 亮于 5.0 等（默认，可配置上限，数据源为 D3-Celestial stars.6.json） |
| 输出内容 | 全部星含 alt/az；时间序列轨迹（起止时刻 + 步长可配置） |
| 算法精度 | 中等精度（Meeus）：岁差（IAU1976，Meeus 21.x）+ 简化章动 + 年像差，约 1 角分量级；恒星周年视差/自行忽略 |
| 测试验收 | 黄金用例快照：用 astronomy-engine 作为参考实现离线生成期望值，vitest 断言角距误差 < 5″ |
| 框架 | 尽量简单：vite + vitest + tsc，无其他运行时依赖 |

## 架构

```
starry-night/
├─ src/core/                  # 纯 TS 算法核心，零 DOM 依赖，Node 可直接测试
│  ├─ time.ts                 # Date→JD、T、GMST、LST
│  ├─ transforms.ts           # 岁差/章动/像差矩阵、赤道→地平、可选大气折射
│  ├─ catalog.ts              # catalog.json 加载、按星等上限裁剪
│  └─ sky.ts                  # computeSky / computeTrack 对外 API
├─ scripts/
│  ├─ preprocess.mjs          # 读 data/raw/stars.6.json → 生成 data/catalog.json
│  └─ gen-golden.mjs          # 用 astronomy-engine 生成 tests/golden/golden.json
├─ tests/
│  ├─ unit/                   # 纯函数单测 + 物理合理性断言
│  └─ golden/                 # 快照对比测试（误差阈值 5″）
├─ data/
│  ├─ raw/stars.6.json        # D3-Celestial 原始星表（一次性下载入库）
│  └─ catalog.json            # 预处理产物：{id, name?, mag, raDeg(J2000), decDeg(J2000)}
├─ index.html + src/main.ts   # 最小验证页：输入经纬度/时间/星等上限 → 排序表格
└─ dist/index.html            # vite build 产物，可直接部署
```

## 核心 API（src/core/sky.ts）

```ts
// 单时刻全星空
computeSky(opts: {
  lat: number;            // 度，北正，[-90, 90]
  lon: number;            // 度，东正，[-180, 180]
  date: Date;             // UTC
  magLimit?: number;      // 默认 5.0
}): {
  lstDeg: number;
  stars: {
    id: string; name?: string;
    ra: number; dec: number;   // 当日真位置（度）
    az: number; alt: number;   // 度，az 从北向东量
    mag: number;
  }[];                          // 仅 alt > 0，按 mag 升序
}

// 时间序列轨迹
computeTrack(opts: {
  lat: number; lon: number;
  start: Date; end: Date; stepMinutes: number;
  magLimit?: number;
}): {
  times: Date[];
  tracks: Record<string, { az: number; alt: number }[]>; // 按 star id
}
```

## 算法要点（中等精度，Meeus《Astronomical Algorithms》）

1. **时间**：Unix 时间戳 → JD（JD = ts/86400000 + 2440587.5）；T = (JD−2451545.0)/36525。
2. **岁差**：IAU1976 三角形变换（Meeus 21.4–21.5：ζ, z, θ），J2000 → 当日平位置，构成旋转矩阵。
3. **章动**：简化主项（Meeus 22.x 低精度，Δψ、Δε 取主项），得真位置与真黄赤交角 ε。
4. **年像差**：恒星年像差修正（Meeus 23.3），幅度约 20.5″。
5. **时角/地平**：GMST（Meeus 12.4）+ 经度 = LST；H = LST − RA；标准球面三角转 alt/az，方位角从北顺时针。
6. **大气折射**：Bennett 公式作为独立可选开关（默认关闭，黄金用例对比时关闭以保证口径一致）。

## 数据流

D3-Celestial `stars.6.json`（GeoJSON，properties 含 mag/name/des，geometry 坐标为 J2000 度）→ `preprocess.mjs` 提取并裁剪 mag ≤ 5.0 → `data/catalog.json`（数组，约 1600+ 颗星，几百 KB）→ 运行时 `catalog.ts` 加载 → computeSky/computeTrack。

字段缺失处理：无名星用 `des`（HD/Bayer 编号）作为 id fallback；无 mag 的条目跳过并计数。

## 测试策略

**单元测试（tests/unit/）**
- JD/GMST 对 Meeus 书中已知例题值（例 12.a 等）。
- 赤道↔地平转换互逆性。
- 物理合理性：北极星 alt ≈ 观测纬度（±1°）；任一时刻天顶星 az 唯一性处理；南/北半球、极圈内边界不崩溃。

**黄金用例（tests/golden/）**
- `gen-golden.mjs`（devDependency：astronomy-engine）离线生成：约 30 组场景 = 若干代表星（含赤道、北/南半球高赤纬）× 若干地点（北京、悉尼、北纬 78° 极区）× 若干时刻（含跨年），输出期望 alt/az 到 JSON 快照入库。
- vitest 断言：|Δalt| < 5″ 且方位角角距 < 5″（高度角 > 85° 时方位角阈值放宽）。

**口径说明**：参考实现 astronomy-engine 的恒星位置含岁差/章动/像差（geocentric，恒星视差可忽略），与本实现口径一致；折射两侧均关闭。

## 错误处理

- 非法经纬度、非法日期、stepMinutes ≤ 0：抛 `RangeError`，信息含字段名。
- 星表文件缺失/损坏：抛明确错误，提示先跑 preprocess。
- 方位角在 alt ≈ 90° 时数值不稳定：文档注明并保持确定性输出。

## 部署产物

`npm run build` → `dist/`（单 HTML + 打包 JS），静态托管即可。页面内容：经纬度/时间/星等上限输入，计算按钮，结果为按星等排序的表格（名称、星等、alt、az、ra、dec），并显示可见星总数。轨迹 API 在页面中以控制台可调用的方式暴露（`window.computeTrack`），UI 暂不画轨迹。
