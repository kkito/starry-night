# 星空位置计算页（stardemo）实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 给定经纬度与时刻，计算可见星星的地平坐标并按视星等排序；算法为独立 TS 核心并带黄金用例测试；vite 打包出可部署单页 HTML。

**Architecture:** 纯 TS 算法核心（time / transforms / catalog / sky，零 DOM）+ 预处理脚本（D3-Celestial stars.6.json → catalog.json）+ astronomy-engine 参考实现的黄金用例快照测试 + 极简验证页。spec 见 `docs/superpowers/specs/2026-09-06-star-sky-positions-design.md`。

**Tech Stack:** TypeScript（strict）、vite（构建/dev）、vitest（测试）、astronomy-engine（仅 dev，生成黄金用例）。无其他运行时依赖。

## Global Constraints

- 星表：D3-Celestial `stars.6.json`，预处理裁剪 mag ≤ 5.0
- 算法：Meeus 中等精度（IAU1976 岁差 + 简化章动主项 + 圆轨道年像差 + Bennett 折射可选），忽略恒星视差与自行
- 坐标约定：RA/Dec 为度；方位角从北顺时针 0–360；经度东正；高度角含折射开关，默认关闭
- 黄金用例阈值：|Δalt| < 5″（= 5/3600°），方位角角距 < 5″（expected alt > 85° 时改用球面角距且阈值 30″）
- 抛错类型：非法输入抛 `RangeError`，消息含字段名
- 脚本一律 `.mjs`（Node 直跑），核心与测试用 TS
- 每个任务完成即 commit，`npm test` 全绿后才能进下一任务

---

### Task 1: 项目脚手架

**Files:**
- Create: `package.json`, `tsconfig.json`, `.gitignore`

**Interfaces:**
- Produces: npm scripts（后续任务依赖）：`npm run preprocess` / `gen-golden` / `test` / `dev` / `build` / `typecheck`

- [ ] **Step 1: 初始化 npm 项目并安装依赖**

```bash
cd /Users/kkito/proj/demo/stardemo
npm init -y
npm i -D vite vitest typescript astronomy-engine
```

- [ ] **Step 2: 写 package.json scripts**

用下面内容替换 `package.json` 中自动生成的 `"scripts"` 字段（保留其余字段）：

```json
{
  "name": "stardemo",
  "private": true,
  "type": "module",
  "scripts": {
    "preprocess": "node scripts/preprocess.mjs",
    "gen-golden": "node scripts/gen-golden.mjs",
    "test": "vitest run",
    "dev": "vite",
    "build": "vite build",
    "typecheck": "tsc --noEmit"
  }
}
```

- [ ] **Step 3: 写 tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2020", "DOM"],
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "skipLibCheck": true,
    "types": ["vite/client"],
    "noEmit": true
  },
  "include": ["src", "tests"]
}
```

- [ ] **Step 4: 写 .gitignore**

```
node_modules/
dist/
```

- [ ] **Step 5: 验证**

Run: `npx tsc --noEmit && npx vitest run`
Expected: typecheck 无输出；vitest 报 "No test files found"（exit code 1 属预期，不阻塞）。

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json tsconfig.json .gitignore
git commit -m "chore: 项目脚手架（vite + vitest + tsc strict）"
```

---

### Task 2: 星表数据下载与预处理

**Files:**
- Create: `data/raw/stars.6.json`（入库）, `scripts/preprocess.mjs`, `data/catalog.json`（产物入库）, `tests/unit/catalog-json.test.ts`

**Interfaces:**
- Produces: `data/catalog.json`，结构 `{ source: string, magLimit: number, generated: string, count: number, skipped: number, stars: { id: string, name?: string, mag: number, raDeg: number, decDeg: number }[] }`（raDeg/decDeg 为 J2000，单位度）

- [ ] **Step 1: 下载 D3-Celestial 星表**

```bash
mkdir -p data/raw
curl -L -o data/raw/stars.6.json https://raw.githubusercontent.com/ofrohn/d3-celestial/master/data/stars.6.json
node -e "const d=JSON.parse(require('fs').readFileSync('data/raw/stars.6.json','utf8')); console.log(d.type, d.features.length); console.log(JSON.stringify(d.features[0]))"
```

Expected: `FeatureCollection` + features 数量 > 5000；首条 feature 打出 properties（含 `mag`，部分含 `name`/`des`）与 geometry.coordinates `[ra, dec]`（度）。若 properties 字段名与 `mag/name/des` 不符，以实际字段为准调整 Step 2 脚本后再继续。

- [ ] **Step 2: 写预处理脚本 scripts/preprocess.mjs**

```js
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const MAG_LIMIT = 5.0;
const raw = JSON.parse(readFileSync('data/raw/stars.6.json', 'utf8'));
const stars = [];
let skipped = 0;

raw.features.forEach((f, i) => {
  const p = f.properties ?? {};
  const [ra, dec] = f.geometry.coordinates;
  if (typeof p.mag !== 'number' || !Number.isFinite(p.mag)) { skipped++; return; }
  if (p.mag > MAG_LIMIT) return;
  const id = p.name ?? p.des ?? `star-${i}`;
  stars.push({
    id,
    ...(p.name ? { name: p.name } : {}),
    mag: p.mag,
    raDeg: ra,
    decDeg: dec,
  });
});

mkdirSync('data', { recursive: true });
writeFileSync(
  'data/catalog.json',
  JSON.stringify(
    { source: 'd3-celestial stars.6.json', magLimit: MAG_LIMIT, generated: new Date().toISOString(), count: stars.length, skipped, stars },
    null,
    1,
  ),
);
console.log(`stars: ${stars.length}, skipped(no mag): ${skipped}`);
```

- [ ] **Step 3: 运行预处理**

Run: `npm run preprocess`
Expected: 输出 `stars: <约1600>, skipped(no mag): <0..少量>`，生成 `data/catalog.json`。

- [ ] **Step 4: 写失败测试 tests/unit/catalog-json.test.ts**

```ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

describe('data/catalog.json', () => {
  const cat = JSON.parse(readFileSync(new URL('../../data/catalog.json', import.meta.url), 'utf8'));

  it('结构完整', () => {
    expect(cat.source).toContain('stars.6.json');
    expect(cat.magLimit).toBe(5.0);
    expect(cat.stars.length).toBe(cat.count);
    expect(cat.stars.length).toBeGreaterThan(1000);
  });

  it('每颗星字段合法且 id 唯一', () => {
    const ids = new Set<string>();
    for (const s of cat.stars) {
      expect(typeof s.id).toBe('string');
      expect(s.id.length).toBeGreaterThan(0);
      expect(s.mag).toBeLessThanOrEqual(5.0);
      expect(s.raDeg).toBeGreaterThanOrEqual(0);
      expect(s.raDeg).toBeLessThan(360);
      expect(s.decDeg).toBeGreaterThanOrEqual(-90);
      expect(s.decDeg).toBeLessThanOrEqual(90);
      ids.add(s.id);
    }
    expect(ids.size).toBe(cat.stars.length);
  });

  it('包含知名亮星', () => {
    const names = new Set(cat.stars.map((s: { name?: string }) => s.name));
    for (const n of ['Sirius', 'Vega', 'Canopus', 'Polaris']) expect(names).toContain(n);
  });
});
```

- [ ] **Step 5: 运行测试确认通过**

Run: `npx vitest run tests/unit/catalog-json.test.ts`
Expected: 3 passed（本任务以数据为被测物，先跑脚本再写断言测试是合理的）。

- [ ] **Step 6: Commit**

```bash
git add data/raw/stars.6.json data/catalog.json scripts/preprocess.mjs tests/unit/catalog-json.test.ts
git commit -m "feat: D3-Celestial 星表预处理为 catalog.json (mag<=5.0)"
```

---

### Task 3: core/time.ts — 时间系统

**Files:**
- Create: `src/core/time.ts`, `tests/unit/time.test.ts`

**Interfaces:**
- Produces:
  - `dateToJD(date: Date): number`
  - `centuriesSinceJ2000(jd: number): number`
  - `gmstDeg(jd: number): number`（格林尼治平恒星时，度）
  - `lastDeg(jd: number, lonEastDeg: number, dpsiDeg: number, epsDeg: number): number`（当地真恒星时 = GMST + 经度 + 赤经章动 Δψ·cosε）
  - `norm360(deg: number): number`

- [ ] **Step 1: 写失败测试 tests/unit/time.test.ts**

```ts
import { describe, it, expect } from 'vitest';
import { dateToJD, gmstDeg, norm360, centuriesSinceJ2000, lastDeg } from '../../src/core/time';

describe('time', () => {
  it('J2000.0 = 2451545.0', () => {
    expect(dateToJD(new Date('2000-01-01T12:00:00Z'))).toBeCloseTo(2451545.0, 6);
  });

  it('Meeus 例 12.b：1987-04-10 19:21 UT → GMST ≈ 128.73787°', () => {
    // JD = 2446895.5 + 19h21m/24h = 2446896.30625
    expect(gmstDeg(2446896.30625)).toBeCloseTo(128.7378733, 3);
  });

  it('T(J2000)=0', () => {
    expect(centuriesSinceJ2000(2451545.0)).toBe(0);
  });

  it('norm360 归一到 [0,360)', () => {
    expect(norm360(-1)).toBeCloseTo(359);
    expect(norm360(361)).toBeCloseTo(1);
    expect(norm360(360)).toBeCloseTo(0);
  });

  it('lastDeg = gmst + lon + 赤经章动', () => {
    // dpsi=0.001°, eps≈23.44° → eqeq ≈ 0.000919°
    const expectVal = norm360(gmstDeg(2451545.0) + 116.4 + 0.001 * Math.cos((23.44 * Math.PI) / 180));
    expect(lastDeg(2451545.0, 116.4, 0.001, 23.44)).toBeCloseTo(expectVal, 9);
  });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run tests/unit/time.test.ts`
Expected: FAIL（找不到模块 `../../src/core/time`）。

- [ ] **Step 3: 实现 src/core/time.ts**

```ts
export function norm360(deg: number): number {
  const r = deg % 360;
  return r < 0 ? r + 360 : r;
}

export function dateToJD(date: Date): number {
  return date.getTime() / 86400000 + 2440587.5;
}

export function centuriesSinceJ2000(jd: number): number {
  return (jd - 2451545.0) / 36525;
}

/** 格林尼治平恒星时（度），Meeus 12.4。 */
export function gmstDeg(jd: number): number {
  const T = centuriesSinceJ2000(jd);
  const g =
    280.46061837 +
    360.98564736629 * (jd - 2451545.0) +
    0.000387933 * T * T -
    (T * T * T) / 38710000;
  return norm360(g);
}

/** 当地真恒星时（度）：GMST + 东经 + 赤经章动 Δψ·cosε。 */
export function lastDeg(jd: number, lonEastDeg: number, dpsiDeg: number, epsDeg: number): number {
  const eqOfEquinox = dpsiDeg * Math.cos((epsDeg * Math.PI) / 180);
  return norm360(gmstDeg(jd) + lonEastDeg + eqOfEquinox);
}
```

- [ ] **Step 4: 运行确认通过**

Run: `npx vitest run tests/unit/time.test.ts`
Expected: 5 passed。

- [ ] **Step 5: Commit**

```bash
git add src/core/time.ts tests/unit/time.test.ts
git commit -m "feat(core): 时间系统 JD/GMST/LAST (Meeus 12.4)"
```

---

### Task 4: core/transforms.ts — 岁差/章动/像差/地平坐标

**Files:**
- Create: `src/core/transforms.ts`, `tests/unit/transforms.test.ts`

**Interfaces:**
- Consumes: `centuriesSinceJ2000` 不直接用（T 由调用方传），`norm360` from `./time`
- Produces:
  - `deg2rad/rad2deg`
  - `type Vec3 = [number, number, number]`
  - `unitFromRaDec(raDeg, decDeg): Vec3` / `raDecFromUnit(v): { raDeg, decDeg }`
  - `meanObliquityDeg(T): number`（ε0，Meeus 22.2）
  - `nutationArcsec(T): { dpsi, deps }`（主项，Meeus 22 简化）
  - `precessionMatrix(T): number[][]`（IAU1976，J2000→date 平赤道，Meeus 21.4）
  - `annualAberrationEclVecArcsec(T): Vec3`（黄道系中像差位移矢量，圆轨道 k=20.489″）
  - `j2000ToApparent(raDeg, decDeg, T): { raDeg, decDeg, dpsiDeg, epsDeg }`（J2000 → 当日视位置，含岁差/章动/年像差）
  - `raDecToAltAz(raDeg, decDeg, lastDeg, latDeg): { azDeg, altDeg }`（az 从北顺时针）
  - `refractionDeg(altDeg): number`（Bennett，观测高度修正量）

- [ ] **Step 1: 写失败测试 tests/unit/transforms.test.ts**

```ts
import { describe, it, expect } from 'vitest';
import {
  unitFromRaDec, raDecFromUnit, meanObliquityDeg, precessionMatrix,
  raDecToAltAz, refractionDeg, j2000ToApparent, annualAberrationEclVecArcsec,
} from '../../src/core/transforms';

describe('transforms', () => {
  it('RA/Dec ↔ 单位向量往返一致', () => {
    const rd = { raDeg: 101.287, decDeg: -16.716 }; // 天狼星附近
    const back = raDecFromUnit(unitFromRaDec(rd.raDeg, rd.decDeg));
    expect(back.raDeg).toBeCloseTo(rd.raDeg, 9);
    expect(back.decDeg).toBeCloseTo(rd.decDeg, 9);
  });

  it('J2000 平均黄赤交角 ε0 = 23.4392911°', () => {
    expect(meanObliquityDeg(0)).toBeCloseTo(23.4392911, 6);
  });

  it('岁差矩阵正交归一', () => {
    const P = precessionMatrix(0.26); // ~J2650
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        const dot = P[i]![0] * P[j]![0] + P[i]![1] * P[j]![1] + P[i]![2] * P[j]![2];
        expect(dot).toBeCloseTo(i === j ? 1 : 0, 10);
      }
    }
  });

  it('像差矢量幅度 ≈ 20.489″', () => {
    const [x, y, z] = annualAberrationEclVecArcsec(0.25);
    expect(Math.hypot(x, y, z)).toBeCloseTo(20.489, 3);
    expect(z).toBe(0);
  });

  it('地平坐标：赤道星中天 alt = 90° − |lat|', () => {
    // lat=40N，dec=0 的星在上中天（LAST = RA）
    const { altDeg, azDeg } = raDecToAltAz(100, 0, 100, 40);
    expect(altDeg).toBeCloseTo(50, 9);
    expect(azDeg).toBeCloseTo(180, 9);
  });

  it('地平坐标：上中天后向西（az 介于南与西之间）', () => {
    const { azDeg } = raDecToAltAz(100, 20, 101, 40); // H = +1° → 偏西
    expect(azDeg).toBeGreaterThan(180);
    expect(azDeg).toBeLessThan(270);
  });

  it('北极星高度 ≈ 观测纬度（J2000 位置，忽略章动小差）', () => {
    const app = j2000ToApparent(37.95456067, 89.26410861, 0.25); // J2025 附近
    const { altDeg } = raDecToAltAz(app.raDeg, app.decDeg, app.raDeg, 39.9); // 中天
    expect(Math.abs(altDeg - 39.9)).toBeLessThan(1.0);
  });

  it('折射量级正确：alt=10° 处约 5.3′', () => {
    expect(refractionDeg(10)).toBeGreaterThan(5.0 / 60);
    expect(refractionDeg(10)).toBeLessThan(5.6 / 60);
    expect(refractionDeg(88)).toBeLessThan(0.02 / 60);
    expect(refractionDeg(-5)).toBe(0);
  });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run tests/unit/transforms.test.ts`
Expected: FAIL（找不到模块）。

- [ ] **Step 3: 实现 src/core/transforms.ts**

```ts
import { norm360 } from './time';

export const DEG = Math.PI / 180;
export function deg2rad(d: number): number { return d * DEG; }
export function rad2deg(r: number): number { return r / DEG; }

export type Vec3 = [number, number, number];

export function unitFromRaDec(raDeg: number, decDeg: number): Vec3 {
  const ra = deg2rad(raDeg), dec = deg2rad(decDeg), cosd = Math.cos(dec);
  return [cosd * Math.cos(ra), cosd * Math.sin(ra), Math.sin(dec)];
}

export function raDecFromUnit(v: Vec3): { raDeg: number; decDeg: number } {
  const r = Math.hypot(v[0], v[1], v[2]);
  return {
    raDeg: norm360(rad2deg(Math.atan2(v[1], v[0]))),
    decDeg: rad2deg(Math.asin(v[2] / r)),
  };
}

function normalize(v: Vec3): Vec3 {
  const r = Math.hypot(v[0], v[1], v[2]);
  return [v[0] / r, v[1] / r, v[2] / r];
}

function matMul(A: number[][], B: number[][]): number[][] {
  return A.map((row, i) => B[0]!.map((_, j) => row[0]! * B[0]![j]! + row[1]! * B[1]![j]! + row[2]! * B[2]![j]!));
}

function matVec(M: number[][], v: Vec3): Vec3 {
  return [
    M[0]![0]! * v[0] + M[0]![1]! * v[1] + M[0]![2]! * v[2],
    M[1]![0]! * v[0] + M[1]![1]! * v[1] + M[1]![2]! * v[2],
    M[2]![0]! * v[0] + M[2]![1]! * v[1] + M[2]![2]! * v[2],
  ];
}

/** 右手系旋转矩阵：绕 x/y/z 轴旋转角 a（弧度）。 */
function rotX(a: number): number[][] {
  const c = Math.cos(a), s = Math.sin(a);
  return [[1, 0, 0], [0, c, -s], [0, s, c]];
}
function rotY(a: number): number[][] {
  const c = Math.cos(a), s = Math.sin(a);
  return [[c, 0, s], [0, 1, 0], [-s, 0, c]];
}
function rotZ(a: number): number[][] {
  const c = Math.cos(a), s = Math.sin(a);
  return [[c, -s, 0], [s, c, 0], [0, 0, 1]];
}

/** 平均黄赤交角 ε0（度），Meeus 22.2。 */
export function meanObliquityDeg(T: number): number {
  const s = 21.448 - T * (46.815 + T * (0.00059 - T * 0.001813));
  return 23 + 26 / 60 + s / 3600;
}

/** 章动主项（角秒），Meeus 22 简化式，精度约 ±0.5″。 */
export function nutationArcsec(T: number): { dpsi: number; deps: number } {
  const omega = deg2rad(norm360(125.04452 - 1934.136261 * T));
  const L = deg2rad(norm360(280.4665 + 36000.7698 * T));
  const Lp = deg2rad(norm360(218.3165 + 481267.8813 * T));
  return {
    dpsi:
      -17.20 * Math.sin(omega) - 1.32 * Math.sin(2 * L) -
      0.23 * Math.sin(2 * Lp) + 0.21 * Math.sin(2 * omega),
    deps:
      9.20 * Math.cos(omega) + 0.57 * Math.cos(2 * L) +
      0.10 * Math.cos(2 * Lp) - 0.09 * Math.cos(2 * omega),
  };
}

/** 岁差矩阵：J2000 → date 平赤道（IAU1976，Meeus 21.4/21.5）。 */
export function precessionMatrix(T: number): number[][] {
  const zeta = deg2rad((2306.2181 * T + 0.30188 * T * T + 0.017998 * T ** 3) / 3600);
  const z = deg2rad((2306.2181 * T + 1.09468 * T * T + 0.018203 * T ** 3) / 3600);
  const theta = deg2rad((2004.3109 * T - 0.42665 * T * T - 0.041833 * T ** 3) / 3600);
  return matMul(rotZ(-z), matMul(rotY(theta), rotZ(-zeta)));
}

/** 年像差位移矢量（黄道系，角秒；圆轨道近似，k = 20.489″）。 */
export function annualAberrationEclVecArcsec(T: number): Vec3 {
  const lambdaSun = deg2rad(norm360(280.46646 + 36000.76983 * T + 0.0003032 * T * T));
  const k = 20.489;
  // 地球公转速度指向黄经 λ⊙+90°（像差把星向运动顶点方向推）
  return [-k * Math.sin(lambdaSun), k * Math.cos(lambdaSun), 0];
}

/** J2000 平位置 → 当日视位置（岁差 + 章动 + 年像差）。 */
export function j2000ToApparent(
  raDeg: number, decDeg: number, T: number,
): { raDeg: number; decDeg: number; dpsiDeg: number; epsDeg: number } {
  let v = unitFromRaDec(raDeg, decDeg);
  v = matVec(precessionMatrix(T), v);            // → 平赤道(date)
  const eps0 = meanObliquityDeg(T);
  v = matVec(rotX(-deg2rad(eps0)), v);           // → 黄道(date)：y' = y cosε + z sinε
  const { dpsi, deps } = nutationArcsec(T);
  v = matVec(rotZ(deg2rad(dpsi / 3600)), v);     // 黄经章动 Δψ
  const d = annualAberrationEclVecArcsec(T);
  v = normalize([
    v[0] + deg2rad(d[0] / 3600),
    v[1] + deg2rad(d[1] / 3600),
    v[2] + deg2rad(d[2] / 3600),
  ]);
  const eps = eps0 + deps / 3600;                // 真黄赤交角
  v = matVec(rotX(deg2rad(eps)), v);             // → 真赤道(date)
  const rd = raDecFromUnit(v);
  return { raDeg: rd.raDeg, decDeg: rd.decDeg, dpsiDeg: dpsi / 3600, epsDeg: eps };
}

/** 赤道(date) → 地平坐标。az 从北顺时针，alt 向上为正。 */
export function raDecToAltAz(
  raDeg: number, decDeg: number, lastDeg: number, latDeg: number,
): { azDeg: number; altDeg: number } {
  const H = deg2rad(norm360(lastDeg - raDeg)); // 时角，向西为正
  const phi = deg2rad(latDeg), dec = deg2rad(decDeg);
  const sinAlt = Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(H);
  const alt = rad2deg(Math.asin(Math.min(1, Math.max(-1, sinAlt))));
  // Meeus 13.5：A 从南向西量；转为从北顺时针 +180°
  const A = Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(phi) - Math.tan(dec) * Math.cos(phi));
  return { azDeg: norm360(rad2deg(A) + 180), altDeg: alt };
}

/** Bennett 大气折射（度），只对 alt > −1° 生效；alt 加上返回值即视高度。 */
export function refractionDeg(altDeg: number): number {
  if (altDeg < -1 || altDeg > 90) return 0;
  const r = 1.02 / Math.tan(deg2rad(altDeg + 10.3 / (altDeg + 5.11))); // 角分
  return r / 60;
}
```

- [ ] **Step 4: 运行确认通过**

Run: `npx vitest run tests/unit/transforms.test.ts`
Expected: 8 passed。

- [ ] **Step 5: Commit**

```bash
git add src/core/transforms.ts tests/unit/transforms.test.ts
git commit -m "feat(core): 岁差/章动/像差/地平坐标变换 (Meeus 中等精度)"
```

---

### Task 5: core/catalog.ts — 星表加载

**Files:**
- Create: `src/core/catalog.ts`, `tests/unit/catalog.test.ts`

**Interfaces:**
- Consumes: `data/catalog.json`（Task 2 产物）
- Produces:
  - `interface CatalogStar { id: string; name?: string; mag: number; raDeg: number; decDeg: number }`
  - `loadCatalog(magLimit?: number): CatalogStar[]`（默认 5.0；magLimit > 5.0 抛 RangeError）

- [ ] **Step 1: 写失败测试 tests/unit/catalog.test.ts**

```ts
import { describe, it, expect } from 'vitest';
import { loadCatalog } from '../../src/core/catalog';

describe('loadCatalog', () => {
  it('默认裁剪到 5.0 等，数量在 1200–2200 之间', () => {
    const stars = loadCatalog();
    expect(stars.length).toBeGreaterThan(1200);
    expect(stars.length).toBeLessThan(2200);
    expect(stars.every((s) => s.mag <= 5.0)).toBe(true);
  });

  it('magLimit 收紧后数量变少', () => {
    expect(loadCatalog(3.0).length).toBeLessThan(loadCatalog(5.0).length);
  });

  it('magLimit 超出星表上限抛 RangeError', () => {
    expect(() => loadCatalog(6.0)).toThrow(RangeError);
  });

  it('每次返回新数组（调用方可自由过滤不污染缓存）', () => {
    const a = loadCatalog();
    a.pop();
    expect(loadCatalog().length).toBeGreaterThan(a.length);
  });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run tests/unit/catalog.test.ts`
Expected: FAIL（找不到模块）。

- [ ] **Step 3: 实现 src/core/catalog.ts**

```ts
import catalogJson from '../../data/catalog.json';

export interface CatalogStar {
  id: string;
  name?: string;
  mag: number;
  raDeg: number;
  decDeg: number;
}

interface CatalogFile {
  magLimit: number;
  stars: CatalogStar[];
}

let cached: CatalogStar[] | null = null;

/** 加载预处理星表并按星等上限裁剪（默认 5.0，即星表全量）。 */
export function loadCatalog(magLimit = 5.0): CatalogStar[] {
  const file = catalogJson as CatalogFile;
  if (magLimit > file.magLimit) {
    throw new RangeError(`magLimit ${magLimit} 超出星表上限 ${file.magLimit}，请调低 preprocess 的 MAG_LIMIT`);
  }
  if (!cached) cached = [...file.stars];
  return cached.filter((s) => s.mag <= magLimit);
}
```

- [ ] **Step 4: 运行确认通过**

Run: `npx vitest run tests/unit/catalog.test.ts`
Expected: 4 passed。

- [ ] **Step 5: Commit**

```bash
git add src/core/catalog.ts tests/unit/catalog.test.ts
git commit -m "feat(core): 星表加载与星等裁剪"
```

---

### Task 6: core/sky.ts — 对外 API

**Files:**
- Create: `src/core/sky.ts`, `tests/unit/sky.test.ts`, `src/core/index.ts`

**Interfaces:**
- Consumes: `dateToJD / centuriesSinceJ2000 / lastDeg`（Task 3），`j2000ToApparent / raDecToAltAz / refractionDeg`（Task 4），`loadCatalog / CatalogStar`（Task 5）
- Produces:
  - `interface SkyStar { id: string; name?: string; ra: number; dec: number; az: number; alt: number; mag: number }`
  - `computeStarPosition(star: CatalogStar, opts: { lat: number; lon: number; date: Date; refraction?: boolean }): SkyStar`（不做可见性过滤——黄金用例测试用它）
  - `computeSky(opts: { lat: number; lon: number; date: Date; magLimit?: number; refraction?: boolean }): { lstDeg: number; stars: SkyStar[] }`（仅 alt > 0，按 mag 升序）
  - `computeTrack(opts: { lat: number; lon: number; start: Date; end: Date; stepMinutes: number; magLimit?: number; refraction?: boolean }): { times: Date[]; tracks: Record<string, { az: number; alt: number }[]> }`
  - `src/core/index.ts` 汇出上述全部（页面与测试统一从这里 import）

- [ ] **Step 1: 写失败测试 tests/unit/sky.test.ts**

```ts
import { describe, it, expect } from 'vitest';
import { computeSky, computeTrack, computeStarPosition } from '../../src/core/sky';
import { loadCatalog } from '../../src/core/catalog';

const BJ = { lat: 39.9, lon: 116.4 };

describe('computeSky', () => {
  it('非法输入抛 RangeError', () => {
    expect(() => computeSky({ ...BJ, lat: 91, date: new Date() })).toThrow(RangeError);
    expect(() => computeSky({ ...BJ, lon: 200, date: new Date() })).toThrow(RangeError);
    expect(() => computeSky({ ...BJ, date: new Date('bad') })).toThrow(RangeError);
    expect(() => computeTrack({ ...BJ, start: new Date(), end: new Date(), stepMinutes: 0 })).toThrow(RangeError);
  });

  it('按 mag 升序、全部在地平线上', () => {
    const { stars } = computeSky({ ...BJ, date: new Date('2026-06-21T16:00:00Z') });
    expect(stars.length).toBeGreaterThan(100);
    for (let i = 1; i < stars.length; i++) {
      expect(stars[i]!.mag).toBeGreaterThanOrEqual(stars[i - 1]!.mag);
      expect(stars[i]!.alt).toBeGreaterThan(0);
    }
    expect(stars[0]!.id).toBe('Sirius'); // 全天最亮恒星（在地平线上时必排第一）
  });

  it('北极星高度 ≈ 纬度（±1.5°）', () => {
    const polaris = loadCatalog().find((s) => s.name === 'Polaris')!;
    const p = computeStarPosition(polaris, { ...BJ, date: new Date('2026-03-20T12:00:00Z') });
    expect(Math.abs(p.alt - BJ.lat)).toBeLessThan(1.5);
  });

  it('同一天顶距的天狼星，南半球可见而北京不可见（抽样时刻）', () => {
    // 天狼星 dec≈-16.7，北京最高 33°；选其在北京地平线下的时刻
    const date = new Date('2026-06-21T12:00:00Z');
    const sirius = loadCatalog().find((s) => s.name === 'Sirius')!;
    const inBeijing = computeStarPosition(sirius, { ...BJ, date });
    const inSydney = computeStarPosition(sirius, { lat: -33.87, lon: 151.2, date });
    expect(inBeijing.alt).toBeLessThan(0);
    expect(inSydney.alt).toBeGreaterThan(0);
  });

  it('结果确定（同输入两次调用一致）', () => {
    const a = computeSky({ ...BJ, date: new Date('2026-01-01T00:00:00Z') });
    const b = computeSky({ ...BJ, date: new Date('2026-01-01T00:00:00Z') });
    expect(a).toEqual(b);
  });
});

describe('computeTrack', () => {
  it('时间点数量与步长正确', () => {
    const start = new Date('2026-03-20T00:00:00Z');
    const { times, tracks } = computeTrack({ ...BJ, start, end: new Date('2026-03-20T02:00:00Z'), stepMinutes: 30 });
    expect(times.length).toBe(5); // 0,30,60,90,120
    expect(times[0]!.getTime()).toBe(start.getTime());
    const first = Object.values(tracks)[0]!;
    expect(first.length).toBe(5);
  });

  it('恒星轨迹向西移动：az 随时间增大（北半球东天→西天）', () => {
    const vega = loadCatalog().find((s) => s.name === 'Vega')!;
    const { tracks } = computeTrack({ ...BJ, start: new Date('2026-03-20T12:00:00Z'), end: new Date('2026-03-20T16:00:00Z'), stepMinutes: 60 });
    const t = tracks[vega.id]!;
    expect(t[0]!.az).toBeLessThan(t[t.length - 1]!.az);
  });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run tests/unit/sky.test.ts`
Expected: FAIL（找不到模块）。

- [ ] **Step 3: 实现 src/core/sky.ts**

```ts
import { dateToJD, centuriesSinceJ2000, lastDeg } from './time';
import { j2000ToApparent, raDecToAltAz, refractionDeg } from './transforms';
import { loadCatalog, type CatalogStar } from './catalog';

export interface SkyStar {
  id: string;
  name?: string;
  ra: number;   // 当日视位置赤经（度）
  dec: number;  // 当日视位置赤纬（度）
  az: number;   // 方位角，从北顺时针（度）
  alt: number;  // 高度角（度）
  mag: number;
}

export interface SkyOptions {
  lat: number;   // 度，北正 [-90, 90]
  lon: number;   // 度，东正 [-180, 180]
  date: Date;    // UTC
  magLimit?: number;
  refraction?: boolean;
}

function validateLatLonDate(lat: number, lon: number, date: Date): void {
  if (!Number.isFinite(lat) || Math.abs(lat) > 90) throw new RangeError('lat 必须在 [-90, 90]');
  if (!Number.isFinite(lon) || Math.abs(lon) > 180) throw new RangeError('lon 必须在 [-180, 180]');
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) throw new RangeError('date 必须是有效 Date');
}

/** 单颗星在给定地点时刻的位置（不过滤可见性）。 */
export function computeStarPosition(
  star: CatalogStar,
  opts: { lat: number; lon: number; date: Date; refraction?: boolean },
): SkyStar {
  validateLatLonDate(opts.lat, opts.lon, opts.date);
  const jd = dateToJD(opts.date);
  const T = centuriesSinceJ2000(jd);
  const app = j2000ToApparent(star.raDeg, star.decDeg, T);
  const lst = lastDeg(jd, opts.lon, app.dpsiDeg, app.epsDeg);
  const { azDeg, altDeg } = raDecToAltAz(app.raDeg, app.decDeg, lst, opts.lat);
  const alt = opts.refraction ? altDeg + refractionDeg(altDeg) : altDeg;
  return {
    id: star.id,
    ...(star.name !== undefined ? { name: star.name } : {}),
    ra: app.raDeg,
    dec: app.decDeg,
    az: azDeg,
    alt,
    mag: star.mag,
  };
}

/** 全星空：地平线以上、按视星等升序。 */
export function computeSky(opts: SkyOptions): { lstDeg: number; stars: SkyStar[] } {
  validateLatLonDate(opts.lat, opts.lon, opts.date);
  const jd = dateToJD(opts.date);
  const T = centuriesSinceJ2000(jd);
  const probe = j2000ToApparent(0, 0, T); // 取章动/交角（与恒星无关）
  const lst = lastDeg(jd, opts.lon, probe.dpsiDeg, probe.epsDeg);
  const stars = loadCatalog(opts.magLimit)
    .map((s) => {
      const app = j2000ToApparent(s.raDeg, s.decDeg, T);
      const { azDeg, altDeg } = raDecToAltAz(app.raDeg, app.decDeg, lst, opts.lat);
      const alt = opts.refraction ? altDeg + refractionDeg(altDeg) : altDeg;
      return {
        id: s.id,
        ...(s.name !== undefined ? { name: s.name } : {}),
        ra: app.raDeg, dec: app.decDeg, az: azDeg, alt, mag: s.mag,
      };
    })
    .filter((st) => st.alt > 0)
    .sort((a, b) => a.mag - b.mag);
  return { lstDeg: lst, stars };
}

export interface TrackOptions {
  lat: number;
  lon: number;
  start: Date;
  end: Date;
  stepMinutes: number;
  magLimit?: number;
  refraction?: boolean;
}

/** 时间序列轨迹：times 与每个 tracks[id] 一一对应，含 start 与 end（若对齐步长）。 */
export function computeTrack(opts: TrackOptions): {
  times: Date[];
  tracks: Record<string, { az: number; alt: number }[]>;
} {
  if (!Number.isFinite(opts.stepMinutes) || opts.stepMinutes <= 0) {
    throw new RangeError('stepMinutes 必须为正数（分钟）');
  }
  if (!(opts.start instanceof Date) || !(opts.end instanceof Date) ||
      Number.isNaN(opts.start.getTime()) || Number.isNaN(opts.end.getTime())) {
    throw new RangeError('start/end 必须是有效 Date');
  }
  if (opts.end.getTime() < opts.start.getTime()) throw new RangeError('end 不能早于 start');
  const stepMs = opts.stepMinutes * 60000;
  const times: Date[] = [];
  for (let t = opts.start.getTime(); t <= opts.end.getTime(); t += stepMs) times.push(new Date(t));
  const stars = loadCatalog(opts.magLimit);
  const tracks: Record<string, { az: number; alt: number }[]> = {};
  for (const s of stars) tracks[s.id] = [];
  for (const time of times) {
    for (const s of stars) {
      const p = computeStarPosition(s, { lat: opts.lat, lon: opts.lon, date: time, refraction: opts.refraction });
      tracks[s.id]!.push({ az: p.az, alt: p.alt });
    }
  }
  return { times, tracks };
}
```

同时创建 `src/core/index.ts`：

```ts
export * from './time';
export * from './transforms';
export * from './catalog';
export * from './sky';
```

- [ ] **Step 4: 运行确认通过**

Run: `npx vitest run tests/unit/sky.test.ts && npx tsc --noEmit`
Expected: 8 passed；typecheck 无输出。

- [ ] **Step 5: Commit**

```bash
git add src/core/sky.ts src/core/index.ts tests/unit/sky.test.ts
git commit -m "feat(core): computeSky/computeTrack/computeStarPosition 对外 API"
```

---

### Task 7: 黄金用例 — astronomy-engine 参考对比

**Files:**
- Create: `scripts/gen-golden.mjs`, `tests/golden/golden.json`（产物入库）, `tests/golden/golden.test.ts`

**Interfaces:**
- Consumes: `computeStarPosition`（Task 6）；`data/catalog.json`（Task 2）
- Produces: `tests/golden/golden.json`，结构 `{ generated: string, reference: 'astronomy-engine@<version>', cases: [{ id, lat, lon, iso, expected: { raDeg, decDeg, azDeg, altDeg } }] }`

- [ ] **Step 1: 写生成脚本 scripts/gen-golden.mjs**

```js
import { readFileSync, writeFileSync } from 'node:fs';
import * as A from 'astronomy-engine';

const cat = JSON.parse(readFileSync('data/catalog.json', 'utf8'));
const PICK = ['Sirius', 'Canopus', 'Alpha Centauri', 'Polaris', 'Vega', 'Betelgeuse', 'Aldebaran', 'Fomalhaut'];
const stars = PICK.map((name) => {
  const s = cat.stars.find((x) => x.name === name);
  if (!s) throw new Error(`星表中找不到 ${name}，请检查 name 拼写后重试`);
  return s;
});

const SITES = [
  { lat: 39.9, lon: 116.4 },    // 北京
  { lat: -33.87, lon: 151.2 },  // 悉尼
  { lat: 78.22, lon: 15.65 },   // 朗伊尔城（极区）
  { lat: 0, lon: -79.5 },       // 赤道
];
const DATES = ['2000-01-01T12:00:00Z', '2026-03-20T12:00:00Z', '2026-06-21T16:00:00Z', '2025-12-31T23:30:00Z'];

// astronomy-engine 仅支持 8 颗用户定义恒星（Star1..Star8）
stars.forEach((s, i) => A.DefineStar(Object.values(A.Body).find((b) => b === A.Body.Star1) && `SKIP`, 0, 0, 0)); // 占位防误用，见下行真正注册
```

注意：`DefineStar` 需要 `Body.Star1..Star8` 逐个注册，删除上面占位行，真正的注册与生成循环为：

```js
import { readFileSync, writeFileSync } from 'node:fs';
import * as A from 'astronomy-engine';

const cat = JSON.parse(readFileSync('data/catalog.json', 'utf8'));
const PICK = ['Sirius', 'Canopus', 'Alpha Centauri', 'Polaris', 'Vega', 'Betelgeuse', 'Aldebaran', 'Fomalhaut'];
const stars = PICK.map((name) => {
  const s = cat.stars.find((x) => x.name === name);
  if (!s) throw new Error(`星表中找不到 ${name}，请检查 name 拼写后重试`);
  return s;
});
const BODIES = [A.Body.Star1, A.Body.Star2, A.Body.Star3, A.Body.Star4, A.Body.Star5, A.Body.Star6, A.Body.Star7, A.Body.Star8];
stars.forEach((s, i) => A.DefineStar(BODIES[i], s.raDeg, s.decDeg, 100));

const SITES = [
  { lat: 39.9, lon: 116.4 },
  { lat: -33.87, lon: 151.2 },
  { lat: 78.22, lon: 15.65 },
  { lat: 0, lon: -79.5 },
];
const DATES = ['2000-01-01T12:00:00Z', '2026-03-20T12:00:00Z', '2026-06-21T16:00:00Z', '2025-12-31T23:30:00Z'];

const cases = [];
for (const s of stars) {
  for (const site of SITES) {
    for (const iso of DATES) {
      const date = new Date(iso);
      const observer = new A.Observer(site.lat, site.lon, 0);
      const equ = A.Equator(BODIES[stars.indexOf(s)], date, observer, true, true); // ofdate + aberration
      const hor = A.Horizon(date, observer, equ.ra, equ.dec, 'none'); // 不加折射，与本实现口径一致
      cases.push({
        id: s.id, lat: site.lat, lon: site.lon, iso,
        expected: {
          raDeg: (equ.ra * 15) % 360, // equ.ra 单位是恒星时小时
          decDeg: equ.dec,
          azDeg: hor.azimuth,
          altDeg: hor.altitude,
        },
      });
    }
  }
}

writeFileSync(
  'tests/golden/golden.json',
  JSON.stringify({ generated: new Date().toISOString(), reference: 'astronomy-engine', cases }, null, 1),
);
console.log(`golden cases: ${cases.length}`);
```

（实施时以第二个代码块为准，文件中只保留一份完整脚本。）

- [ ] **Step 2: 生成黄金用例**

Run: `npm run gen-golden`
Expected: 输出 `golden cases: 128`（8 星 × 4 地点 × 4 时刻）。若某星名找不到，`node -e "..."` 打印 catalog 中全部 name 修正 PICK 后重跑。

- [ ] **Step 3: 写失败测试 tests/golden/golden.test.ts**

```ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { computeStarPosition } from '../../src/core/sky';
import { loadCatalog } from '../../src/core/catalog';

const golden = JSON.parse(readFileSync(new URL('./golden.json', import.meta.url), 'utf8'));
const byId = new Map(loadCatalog().map((s) => [s.id, s]));

const ARCSEC = 1 / 3600;

function angDist(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

describe('golden vs astronomy-engine', () => {
  for (const c of golden.cases) {
    it(`${c.id} @ (${c.lat},${c.lon}) ${c.iso}`, () => {
      const star = byId.get(c.id);
      expect(star, `星表缺少 ${c.id}`).toBeTruthy();
      const got = computeStarPosition(star!, { lat: c.lat, lon: c.lon, date: new Date(c.iso) });
      // 视位置 RA/Dec
      expect(angDist(got.ra, c.expected.raDeg)).toBeLessThan(5 * ARCSEC);
      expect(Math.abs(got.dec - c.expected.decDeg)).toBeLessThan(5 * ARCSEC);
      // 地平坐标
      expect(Math.abs(got.alt - c.expected.altDeg)).toBeLessThan(5 * ARCSEC);
      if (c.expected.altDeg > 85) {
        // 天顶附近方位角病态，改用整体球面角距（阈值 30″）
        const altR = (x: number) => (x * Math.PI) / 180;
        const sep =
          Math.acos(
            Math.sin(altR(got.alt)) * Math.sin(altR(c.expected.altDeg)) +
            Math.cos(altR(got.alt)) * Math.cos(altR(c.expected.altDeg)) *
            Math.cos(altR(got.az) - altR(c.expected.azDeg)),
          ) * (180 / Math.PI);
        expect(sep).toBeLessThan(30 * ARCSEC);
      } else {
        expect(angDist(got.az, c.expected.azDeg)).toBeLessThan(5 * ARCSEC);
      }
    });
  }
});
```

- [ ] **Step 4: 运行并迭代到通过**

Run: `npx vitest run tests/golden/golden.test.ts`
Expected: 128 passed。

若少量用例超差（预期差源优先级）：① 章动主项不足 → 无需修，阈值内即可；② `equ.ra` 单位换算或 `Horizon` 方位角约定（astronomy-engine azimuth 从北顺时针，与本实现一致）；③ 像差矢量方向符号反了 → 在 `annualAberrationEclVecArcsec` 中对调 `(−sinλ⊙, cosλ⊙)` 的符号后重跑。若仍有 > 5″ 用例，先打印最差 5 个用例的逐项差值定位是 RA/Dec 环节还是 alt/az 环节，再回到对应模块修，不允许放宽阈值超过 10″。

- [ ] **Step 5: 全量测试 + typecheck**

Run: `npm test && npm run typecheck`
Expected: 全部通过。

- [ ] **Step 6: Commit**

```bash
git add scripts/gen-golden.mjs tests/golden
git commit -m "test: astronomy-engine 黄金用例快照（阈值 5″）"
```

---

### Task 8: 验证页与可部署构建

**Files:**
- Create: `index.html`, `src/main.ts`

**Interfaces:**
- Consumes: `computeSky / computeTrack` from `./core`（Task 6）
- Produces: `npm run build` → `dist/index.html`（静态托管即可部署）；`window.__starDemo = { computeSky, computeTrack }`

- [ ] **Step 1: 写 index.html（项目根）**

```html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>星空位置计算</title>
    <style>
      body { font-family: system-ui, sans-serif; max-width: 720px; margin: 2rem auto; padding: 0 1rem; }
      form { display: flex; gap: .5rem; flex-wrap: wrap; align-items: end; }
      label { display: flex; flex-direction: column; font-size: .8rem; }
      input { padding: .35rem; }
      table { border-collapse: collapse; width: 100%; font-size: .85rem; }
      th, td { border-bottom: 1px solid #ddd; padding: .3rem .5rem; text-align: right; }
      th:first-child, td:first-child { text-align: left; }
      #summary { color: #666; }
    </style>
  </head>
  <body>
    <h1>星空位置计算</h1>
    <form id="f">
      <label>纬度<input id="lat" value="39.9" required /></label>
      <label>经度<input id="lon" value="116.4" required /></label>
      <label>时间(UTC)<input id="date" type="datetime-local" value="2026-03-20T20:00" required /></label>
      <label>星等上限<input id="mag" value="5.0" step="0.1" /></label>
      <button type="submit">计算</button>
    </form>
    <p id="summary"></p>
    <table id="tbl" hidden>
      <thead>
        <tr><th>名称</th><th>星等</th><th>高度°</th><th>方位°</th><th>RA°</th><th>Dec°</th></tr>
      </thead>
      <tbody></tbody>
    </table>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

- [ ] **Step 2: 写 src/main.ts**

```ts
import { computeSky, computeTrack } from './core';

const form = document.getElementById('f') as HTMLFormElement;
const summary = document.getElementById('summary')!;
const table = document.getElementById('tbl') as HTMLTableElement;
const tbody = table.querySelector('tbody')!;
const MAX_ROWS = 200;

form.addEventListener('submit', (e) => {
  e.preventDefault();
  const lat = Number((document.getElementById('lat') as HTMLInputElement).value);
  const lon = Number((document.getElementById('lon') as HTMLInputElement).value);
  const mag = Number((document.getElementById('mag') as HTMLInputElement).value) || 5.0;
  const dateLocal = (document.getElementById('date') as HTMLInputElement).value;
  let date: Date;
  try {
    date = new Date(`${dateLocal}:00Z`); // 输入框按 UTC 解释
    const { lstDeg, stars } = computeSky({ lat, lon, date, magLimit: mag });
    summary.textContent = `LAST ${lstDeg.toFixed(2)}° · 可见星 ${stars.length} 颗（显示前 ${Math.min(stars.length, MAX_ROWS)}）`;
    tbody.innerHTML = stars
      .slice(0, MAX_ROWS)
      .map(
        (s) =>
          `<tr><td>${s.name ?? s.id}</td><td>${s.mag.toFixed(2)}</td><td>${s.alt.toFixed(2)}</td>` +
          `<td>${s.az.toFixed(2)}</td><td>${s.ra.toFixed(3)}</td><td>${s.dec.toFixed(3)}</td></tr>`,
      )
      .join('');
    table.hidden = false;
  } catch (err) {
    summary.textContent = `错误：${err instanceof Error ? err.message : String(err)}`;
    table.hidden = true;
  }
});

// 轨迹 API 先暴露给控制台，UI 后续再做
Object.assign(window, { __starDemo: { computeSky, computeTrack } });
```

- [ ] **Step 3: 本地验证页面**

Run: `npm run dev`，浏览器打开输出的地址，点"计算"。
Expected: 出现按星等排序的表格，首行 Sirius（若在该时刻可见）；`summary` 显示可见星数。控制台执行 `__starDemo.computeTrack({lat:39.9, lon:116.4, start:new Date(), end:new Date(Date.now()+6e5), stepMinutes:5})` 返回轨迹对象。验证后停掉 dev server。

- [ ] **Step 4: 构建部署产物**

Run: `npm run build && ls dist`
Expected: `dist/index.html` 与打包 assets 存在。用 `npx vite preview` 打开确认功能同上后停掉。

- [ ] **Step 5: typecheck + 全量测试**

Run: `npm run typecheck && npm test`
Expected: 全部通过。

- [ ] **Step 6: Commit**

```bash
git add index.html src/main.ts
git commit -m "feat: 最小验证页 + vite 可部署构建"
```

---

### Task 9: README 收尾

**Files:**
- Create: `README.md`

- [ ] **Step 1: 写 README.md**

````markdown
# stardemo — 星空位置计算

给定经纬度与时刻，计算可见星星的位置并按视星等排序。算法核心为纯 TypeScript（Meeus 中等精度：岁差 + 章动 + 年像差），星表来自 D3-Celestial（mag ≤ 5.0），用 astronomy-engine 黄金用例验收（阈值 5″）。

## 使用

```bash
npm install
npm run preprocess   # data/raw/stars.6.json → data/catalog.json（已入库，可跳过）
npm test             # 单测 + 黄金用例
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
````

- [ ] **Step 2: 全量验证 + Commit**

```bash
npm test && npm run typecheck && npm run build
git add README.md
git commit -m "docs: README"
```

---

## Self-Review 记录

- **Spec 覆盖**：星表裁剪（Task 2/5）、中等精度算法（Task 3/4）、computeSky/computeTrack（Task 6）、黄金用例 5″（Task 7）、极简部署页（Task 8）、折射开关（Task 4/6/8 默认关）——全覆盖。spec 中"页面暂不画轨迹、轨迹走控制台 API"在 Task 8 Step 2 落实。
- **占位符**：Task 7 Step 1 的第一个代码块是明确的"作废提示"，第二个代码块为唯一完整脚本，已注明。
- **类型一致性**：`computeStarPosition(star, opts)` 在 Task 6 定义、Task 7 消费；`CatalogStar` 字段在 Task 2（JSON）/Task 5（TS）一致；`lastDeg` 参数序在 Task 3 定义、Task 6 调用一致；`Body.Star1..8` 注册数 ≤ 8 与 PICK 长度 8 一致。
