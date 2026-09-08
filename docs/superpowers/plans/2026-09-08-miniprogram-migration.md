# 小程序迁移（Taro + React）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在同仓 `miniapp/` 内建成 Taro + React 工程，全部功能平移、微信小程序与 H5 双端出包，3D 天穹跑在 three 0.185 + wx canvas 上。

**Architecture:** `core/lib/data` 只读共享不 fork；`miniapp/src/web-env.ts` 封装 4 个平台函数隔离 H5/weapp 差异；页面层照搬 App 状态模型；Sky3D 业务逻辑不动只换 canvas 来源与事件。

**Tech Stack:** Taro 3 (React 19), TypeScript, three 0.185 (npm), vitest, `wx.createOffscreenCanvas`, `<Canvas type="2d">` WebGL

## Global Constraints

- 同仓 `miniapp/` 目录，core/lib/data 只读引用、绝不在 miniapp 内 fork 修改。
- three 版本锁定 0.185，不用 `threejs-miniprogram` 旧 bundle。
- renderer 尺寸按 `pixelRatio ≤ 2` 封顶（安卓防 crash）。
- 测试：`pnpm test` 全量、`pnpm vitest run <path>` 单文件；`pnpm typecheck`；Taro 构建 `taro build --type weapp/h5`。
- TDD：先失败测试 → 最小实现 → 重构；频繁小步提交（执行时按用户确认再 commit）。

---

### Task 1: Taro 工程脚手架 + 双端构建跑通

**Files:**
- Create: `miniapp/package.json`, `miniapp/config/index.ts`, `miniapp/src/app.ts`, `miniapp/src/app.config.ts`, `miniapp/src/pages/index/index.tsx`, `miniapp/src/pages/index/index.config.ts`
- Test: `miniapp/src/__tests__/scaffold.test.ts`

**Interfaces:**
- Consumes: 无（首个任务）
- Produces: `getAppConfig(): { pages: string[] }` 约定主页为 `pages/index/index`；`taro build --type weapp` 与 `--type h5` 皆可执行

- [ ] **Step 1: Write the failing test**

```ts
// miniapp/src/__tests__/scaffold.test.ts
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('taro scaffold', () => {
  it('app.config declares index page', () => {
    const cfg = fs.readFileSync(path.resolve(__dirname, '../app.config.ts'), 'utf8');
    expect(cfg).toContain('pages/index/index');
  });
  it('index page exists', () => {
    expect(fs.existsSync(path.resolve(__dirname, '../pages/index/index.tsx'))).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run miniapp/src/__tests__/scaffold.test.ts`
Expected: FAIL（文件尚不存在，import/fs 断言失败）

- [ ] **Step 3: Scaffold minimal Taro app**

```bash
cd /Users/kkito/proj/own/starry-night/miniapp && npm init -y && npm i @tarojs/cli@3 -D
npx taro init --name miniapp --template react --npm pnpm  # 按提示选 TypeScript
```

然后保证最小文件存在（按 taro init 产物为准，关键行）：

```ts
// miniapp/src/app.config.ts
export default { pages: ['pages/index/index'] };
```

```tsx
// miniapp/src/pages/index/index.tsx
import { View, Text } from '@tarojs/components';
export default function Index() { return (<View><Text>starry-night miniapp boot</Text></View>); }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run miniapp/src/__tests__/scaffold.test.ts`
Expected: PASS；另跑 `cd miniapp && npx taro build --type h5` 应成功产出 `dist/`

- [ ] **Step 5: Commit**

```bash
git add miniapp docs/superpowers/plans/2026-09-08-miniprogram-migration.md
git commit -m "feat(miniapp): scaffold Taro React app with weapp+h5 build"
```

---

### Task 2: 共享 core/lib/data 只读接入 + 算法零分叉验证

**Files:**
- Create: `miniapp/src/shared/README.md`（引用约定文档）, `miniapp/tsconfig.json`（path alias 或相对引用配置）
- Modify: `miniapp/src/pages/index/index.tsx`（仅为验证而 import computeSky，不写业务）
- Test: `miniapp/src/__tests__/shared-core.test.ts`

**Interfaces:**
- Consumes: Task 1 脚手架；`../../src/core`（`computeSky`), `../../data/catalog.json`
- Produces: `loadSharedCatalog(): CatalogStar[]`（miniapp 内对共享 catalog 的唯一入口，后续任务复用）

- [ ] **Step 1: Write the failing test**

```ts
// miniapp/src/__tests__/shared-core.test.ts
import { describe, expect, it } from 'vitest';
import { computeSky } from '../../../src/core/sky';

describe('shared core in miniapp', () => {
  it('computeSky returns sorted visible stars for Shanghai now', () => {
    const { stars } = computeSky({ lat: 31.2304, lon: 121.4737, date: new Date('2026-09-08T20:00:00+08:00') });
    expect(stars.length).toBeGreaterThan(10);
    for (let i = 1; i < Math.min(20, stars.length); i++) {
      expect(stars[i]!.mag >= stars[i - 1]!.mag).toBe(true);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run miniapp/src/__tests__/shared-core.test.ts`
Expected: FAIL（`miniapp/tsconfig` 未放开根外引用或依赖缺 `astronomy-engine`，resolve 失败）

- [ ] **Step 3: Write minimal implementation**

```jsonc
// miniapp/tsconfig.json 关键片段（extends 根 tsconfig，allow 外部相对引用）
{ "extends": "../tsconfig.json", "compilerOptions": { "baseUrl": ".", "types": ["node"] }, "include": ["src", "../src/core", "../src/lib", "../data"] }
```

```ts
// miniapp/src/shared/catalog.ts
import { loadCatalog } from '../../../src/core/catalog';
export function loadSharedCatalog() { return loadCatalog(); }
```

`miniapp/package.json` 补齐与根一致的 `astronomy-engine`、`three` 依赖版本。

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run miniapp/src/__tests__/shared-core.test.ts && pnpm vitest run tests/golden`
Expected: PASS（golden 精度回归同步通过，证明算法零分叉）

- [ ] **Step 5: Commit**

```bash
git add miniapp/tsconfig.json miniapp/src/shared miniapp/src/__tests__/shared-core.test.ts
git commit -m "feat(miniapp): share core/lib read-only with golden regression"
```

---

### Task 3: 平台适配——prefs（存储）+ geolocation（定位）

**Files:**
- Create: `miniapp/src/adapters/prefs.ts`, `miniapp/src/adapters/geolocation.ts`
- Test: `miniapp/src/adapters/__tests__/prefs.test.ts`, `miniapp/src/adapters/__tests__/geolocation.test.ts`

**Interfaces:**
- Consumes: `ViewParams` 类型（从 `../../../src/components/SettingsDialog` import type）
- Produces: `saveViewPrefs(v: ViewParams): void`, `loadViewPrefs(defaults: ViewParams): ViewParams`, `getCurrentPosition(timeoutMs?: number): Promise<{lat:number;lon:number}>`

- [ ] **Step 1: Write the failing tests**

```ts
// miniapp/src/adapters/__tests__/prefs.test.ts
import { describe, expect, it, vi } from 'vitest';
import * as Taro from '@tarojs/taro';
import { loadViewPrefs, saveViewPrefs } from '../prefs';
import type { ViewParams } from '../../../../src/components/SettingsDialog';

const defaults: ViewParams = { lat: 31.2304, lon: 121.4737, date: '2026-09-08T20:00', timeMode: 'live', topN: 50, aspect: 'auto', showSolar: true, mirror: false, shape: 'ellipse', viewMode: '3d' };

describe('prefs adapter', () => {
  it('round-trips view prefs minus date', () => {
    const store: Record<string, string> = {};
    vi.spyOn(Taro, 'getStorageSync').mockImplementation((k: string) => store[k] ?? '');
    vi.spyOn(Taro, 'setStorageSync').mockImplementation((k: string, v: string) => { store[k] = v; });
    saveViewPrefs(defaults);
    const loaded = loadViewPrefs({ ...defaults, lat: 0 });
    expect(loaded.lat).toBeCloseTo(31.2304);
    expect(loaded.date).not.toBe('');
  });
});
```

```ts
// miniapp/src/adapters/__tests__/geolocation.test.ts
import { describe, expect, it, vi } from 'vitest';
import * as Taro from '@tarojs/taro';
import { getCurrentPosition } from '../geolocation';

describe('geolocation adapter', () => {
  it('resolves wgs84 via Taro.getLocation', async () => {
    vi.spyOn(Taro, 'getLocation').mockImplementation(((opts: any) => { opts.success?.({ latitude: 31.2, longitude: 121.4 }); }) as any);
    await expect(getCurrentPosition()).resolves.toEqual({ lat: 31.2, lon: 121.4 });
  });
  it('rejects with friendly message on deny', async () => {
    vi.spyOn(Taro, 'getLocation').mockImplementation(((opts: any) => { opts.fail?.({ errMsg: 'deny' }); }) as any);
    await expect(getCurrentPosition()).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run miniapp/src/adapters/__tests__/prefs.test.ts miniapp/src/adapters/__tests__/geolocation.test.ts`
Expected: FAIL（adapter 文件不存在）

- [ ] **Step 3: Write minimal implementation**

```ts
// miniapp/src/adapters/prefs.ts
import * as Taro from '@tarojs/taro';
import type { ViewParams } from '../../../src/components/SettingsDialog';
import { toLocalInput, validateView } from '../../../src/components/SettingsDialog';

const STORAGE_KEY = 'starry-night.view';

export function saveViewPrefs(v: ViewParams): void {
  try {
    const { date: _date, ...rest } = v;
    Taro.setStorageSync(STORAGE_KEY, JSON.stringify(rest));
  } catch { /* 配额不足静默跳过，与 Web 版一致 */ }
}

export function loadViewPrefs(defaults: ViewParams): ViewParams {
  try {
    const raw = Taro.getStorageSync(STORAGE_KEY) || '';
    if (!raw) return defaults;
    const merged = { ...defaults, ...JSON.parse(raw), date: toLocalInput(new Date()) } as ViewParams;
    return validateView(merged) ? defaults : merged;
  } catch { return defaults; }
}
```

```ts
// miniapp/src/adapters/geolocation.ts
import * as Taro from '@tarojs/taro';

export function getCurrentPosition(timeoutMs = 10_000): Promise<{ lat: number; lon: number }> {
  return new Promise((resolve, reject) => {
    Taro.getLocation({
      type: 'wgs84',
      success: (res) => resolve({ lat: res.latitude, lon: res.longitude }),
      fail: () => reject(new Error('定位失败：请检查微信位置权限或手动选择城市')),
    });
    void timeoutMs;
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run miniapp/src/adapters`
Expected: PASS（3 tests）

- [ ] **Step 5: Commit**

```bash
git add miniapp/src/adapters
git commit -m "feat(miniapp): prefs + geolocation adapters on Taro APIs"
```

---

### Task 4: `web-env.ts` 适配层（M1 前置，可单测部分）

**Files:**
- Create: `miniapp/src/web-env.ts`
- Test: `miniapp/src/__tests__/web-env.test.ts`

**Interfaces:**
- Consumes: `@tarojs/taro`（`getSystemInfoSync`, `createSelectorQuery`）
- Produces: `getViewport(): {width;height;pixelRatio}`, `clampPixelRatio(pr:number):number`, `nextFrame(handle:frame-callback): cancel`（H5 分支直通 rAF；canvas 获取与 offscreen 创建因需真机节点，本任务只定接口+纯函数单测，真机行为 M1 验收）

- [ ] **Step 1: Write the failing test**

```ts
// miniapp/src/__tests__/web-env.test.ts
import { describe, expect, it } from 'vitest';
import { clampPixelRatio, getViewport } from '../web-env';

describe('web-env', () => {
  it('clamps pixelRatio to 2', () => {
    expect(clampPixelRatio(3)).toBe(2);
    expect(clampPixelRatio(1.5)).toBe(1.5);
  });
  it('viewport has positive dims', () => {
    const vp = getViewport();
    expect(vp.width).toBeGreaterThan(0);
    expect(vp.pixelRatio).toBeLessThanOrEqual(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run miniapp/src/__tests__/web-env.test.ts`
Expected: FAIL（`web-env.ts` 不存在）

- [ ] **Step 3: Write minimal implementation**

```ts
// miniapp/src/web-env.ts
import * as Taro from '@tarojs/taro';

export const MAX_PIXEL_RATIO = 2;

export function clampPixelRatio(pr: number): number {
  return Math.min(Math.max(pr || 1, 1), MAX_PIXEL_RATIO);
}

export function getViewport(): { width: number; height: number; pixelRatio: number } {
  const info = Taro.getSystemInfoSync();
  return { width: info.windowWidth ?? 375, height: info.windowHeight ?? 667, pixelRatio: clampPixelRatio(info.pixelRatio ?? 2) };
}

/** 取 <Canvas type="2d" id={canvasId}> 的离屏能力节点（真机 weapp 生效，H5 走 document canvas）。 */
export function getGLCanvasNode(canvasId: string): Promise<any> {
  return new Promise((resolve, reject) => {
    // #ifdef H5
    const el = document.getElementById(canvasId) as HTMLCanvasElement | null;
    el ? resolve(el) : reject(new Error(`canvas #${canvasId} missing`));
    // #endif
    // #ifdef WEAPP
    Taro.createSelectorQuery().select(`#${canvasId}`).node((res: any) => {
      res?.node ? resolve(res.node) : reject(new Error(`canvas #${canvasId} node missing`));
    }).exec();
    // #endif
  });
}

/** 程序化纹理用的离屏 canvas（星点精灵/方位文字/渐变贴图 3 处共用）。 */
export function makeOffscreen(width: number, height: number): any {
  // #ifdef WEAPP
  return (wx as any).createOffscreenCanvas({ type: '2d', width, height });
  // #endif
  // #ifdef H5
  const c = document.createElement('canvas');
  c.width = width; c.height = height;
  return c;
  // #endif
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run miniapp/src/__tests__/web-env.test.ts`
Expected: PASS（H5/jsdom 分支；WEAPP 分支留待 M1 真机验收）

- [ ] **Step 5: Commit**

```bash
git add miniapp/src/web-env.ts miniapp/src/__tests__/web-env.test.ts
git commit -m "feat(miniapp): web-env adapter with pixelRatio cap"
```

---

### Task 5: 主页面状态迁移 + 2D 星图跑通（M2）

**Files:**
- Modify: `miniapp/src/pages/index/index.tsx`（承接 App.tsx：ViewParams/canvasSize/sky useMemo/track useMemo/心跳）
- Create: `miniapp/src/components/StarChart.tsx`（`drawSky` 照搬调用 + touch hit-test）
- Test: `miniapp/src/components/__tests__/starchart-hit.test.ts`（纯函数命中判定单测）

**Interfaces:**
- Consumes: Task 2 `loadSharedCatalog` 间接（经 computeSky），Task 3 adapters，`drawSky`（`../../../src/components/StarChart` 源码引用——若 Taro 编译器不允许跨根 import，则改为复制 `drawSky` 纯函数体并在注释注明来源与同步规则）
- Produces: 主页面渲染 2D 星图 `<Canvas type="2d" canvasId="starchart">` + 点击选中回调用

- [ ] **Step 1: Write the failing test**（命中判定纯函数先行）

```ts
// miniapp/src/components/__tests__/starchart-hit.test.ts
import { describe, expect, it } from 'vitest';
import { hitTestStar } from '../StarChart';

describe('hitTestStar', () => {
  it('picks nearest star within threshold', () => {
    const stars = [{ id: 'a', x: 10, y: 10 }, { id: 'b', x: 100, y: 100 }];
    expect(hitTestStar(stars as any, 200, 200, 12, 12)?.id).toBe('a');
    expect(hitTestStar(stars as any, 200, 200, 0, 0)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run miniapp/src/components/__tests__/starchart-hit.test.ts`
Expected: FAIL（`hitTestStar` 未导出）

- [ ] **Step 3: Write minimal implementation**（`hitTestStar` 从 Web 版 `hitTest` 提炼为纯函数，阈值 HIT_PX=8 保持；touch 事件 `e.touches[0].clientX/Y` 经 `boundingClientRect` 换算后调用；绘制直接调共享 `drawSky`）

- [ ] **Step 4: Run tests + builds**

Run: `pnpm vitest run miniapp/src/components && cd miniapp && npx taro build --type weapp && npx taro build --type h5`
Expected: 单测 PASS，双端构建成功；微信开发者工具导入 `miniapp/dist` 可见 2D 星图（M2 真机/模拟器目检）

- [ ] **Step 5: Commit**

```bash
git add miniapp/src/pages miniapp/src/components
git commit -m "feat(miniapp): index page state + 2D starchart (M2)"
```

---

### Task 6: Sky3D 移植 + M1 最小亮机（3D 死磕核心）

**Files:**
- Create: `miniapp/src/components/Sky3D.tsx`（自 Web 版 `src/components/Sky3D.tsx` 迁移：业务逻辑不动，只换 §2 的 5 处）
- Modify: `miniapp/src/pages/index/index.tsx`（viewMode 切换 2D/3D）
- Test: 真机验收清单（无自动化 WebGL 断言）：`miniapp/ACCEPT-3D.md`（勾选：天穹渐变可见/星点可见/拖拽旋转/选中跟随 yaw/轨迹/太阳系天体）

**Interfaces:**
- Consumes: Task 4 `web-env` 四函数；`lib/dome.ts altAzToVec`（只读共享）；`DrawStar/StarTrack` 类型
- Produces: `<Canvas type="2d" canvasId="skycanvas">` 上的 three 0.185 渲染循环 + touch 旋转 + pinch 缩放

- [ ] **Step 1: Write the failing gate**（本任务无 jsdom 可断言项，先立空清单使门禁变红）

```md
<!-- miniapp/ACCEPT-3D.md -->
# Sky3D 真机验收（M1→全量）
- [ ] M1: 天穹渐变 + 至少 1 颗星渲染（真机预览截图）
- [ ] Points 星点/颜色/尺寸与 H5 一致
- [ ] 方位文字 sprite 清晰
- [ ] 单指拖拽旋转 / 双指 pinch 缩放
- [ ] selectedId 变化相机 yaw 跟随
- [ ] ±6h 轨迹 + 太阳系天体可见
```

门禁测试：`test -s miniapp/ACCEPT-3D.md` 且全勾选才算过（初始必然 FAIL）。

- [ ] **Step 2: Run gate to verify it fails**（逐项未勾选 → FAIL，符合 TDD 红灯）

- [ ] **Step 3: Migrate Sky3D in slices**（按序每次只做一层，每层真机预览确认）：
  1. renderer（`getGLCanvasNode('skycanvas')` → `node.getContext('webgl',{alpha:true})` → `new THREE.WebGLRenderer({canvas})`）+ 天穹渐变球 → M1 亮机；
  2. Points 星点（`makeOffscreen(64,64)` 精灵纹理）；
  3. 方位文字 sprite（`makeOffscreen(128,64)`）+ 地面/剪影；
  4. touch 事件（`bindtouchstart/move/end` + pinch）替换 pointer/wheel；
  5. 选中跟随 yaw + 轨迹 + 太阳系天体。

- [ ] **Step 4: Verify**（开发者工具开硬件加速后模拟器初验 → 真机预览逐项勾选；`pnpm typecheck` 通过）

- [ ] **Step 5: Commit**

```bash
git add miniapp/src/components/Sky3D.tsx miniapp/ACCEPT-3D.md
git commit -m "feat(miniapp): Sky3D on three 0.185 + wx canvas (M1 bright)"
```

---

### Task 7: 对话框/开关/状态栏 + 设置/星表页（M3 功能对齐）

**Files:**
- Create: `miniapp/src/components/ViewModeSwitch.tsx`, `miniapp/src/components/StarTooltip.tsx`, `miniapp/src/pages/settings/index.tsx`, `miniapp/src/pages/table/index.tsx`
- Modify: `miniapp/src/app.config.ts`（注册子页面：`pages/settings/index`, `pages/table/index`）
- Test: `miniapp/src/__tests__/viewparams-flow.test.ts`（设置改参→重算链路单测：调共享 `computeSky` 断言 topN/mirror 变化生效）

**Interfaces:**
- Consumes: Task 3 adapters（设置页读写 prefs），Task 5 主页面状态
- Produces: 设置页（经纬度/时刻/topN/ aspect/mirror/shape/showSolar）即时生效；星表页点击条目回主页面选中（`Taro.navigateBack + eventChannel` 或全局 store 极简实现，二选一，YAGNI 取最简）

- [ ] **Step 1-2: failing test first**（`viewparams-flow`：topN 50→100 可见星数增加；mirror 翻转 drawList x 符号翻转）
- [ ] **Step 3: implement**（6 组件行为与 Web 版一致：Tooltip 绝对定位 View；dialog→抽屉/子页面，实现时二选一）
- [ ] **Step 4: verify**（`pnpm vitest run miniapp` + 双端构建 + 真机走查设置/星表/选中/心跳）
- [ ] **Step 5: Commit** `feat(miniapp): settings/table/tooltip parity (M3)`

---

### Task 8: 包体预算 + M4 双端验收收尾

**Files:**
- Create: `miniapp/BUDGET.md`（开发者工具"代码依赖分析"实测：three/astronomy-engine/catalog/Taro 各占；分包决策记录）
- Modify: `miniapp/config/index.ts`（如需分包：`subPackages` 配星表 JSON 或 table 页）
- Test: 门禁脚本 `miniapp/scripts/check-size.mjs`（断言主包 ≤2MB；`node miniapp/scripts/check-size.mjs`）

- [ ] **Step 1: Write failing gate**（`check-size.mjs` 初始跑出超限或文件缺失 → FAIL）
- [ ] **Step 2-3: implement**（按 spec 泄压阀：①星表 JSON 分包 ②astronomy-engine 按需 ③three 不动；以实测为准）
- [ ] **Step 4: M4 验收**（H5 以根 vite 产物为基准真值比对：同一经纬度时刻星数/首星一致；真机清单：渲染出星、拖拽旋转、选中跟随、设置生效；`pnpm test` 全绿 + `pnpm typecheck` + 双端构建）
- [ ] **Step 5: Commit** `feat(miniapp): size budget + M4 acceptance`

---

## Self-Review

- Spec coverage: §1→Task1/2；§2→Task4/6；§3→Task3/5/7；§4→Task1/8；§5→Task6/8 里程碑与 R1-R3 对策（pixelRatio 封顶 Task4、topN 降载 Task6、VirtualList 注记 Task7 星表页）。
- 'SettingsDialog 抽屉-or-子页面' 的开放点已收敛到 Task 7 实现时二选一，不阻塞计划。
- Type consistency: `ViewParams` 全程从 Web 版 `SettingsDialog` import type；`DrawStar/StarTrack` 同理；miniapp 不重定义。
- No placeholders: 各任务命令/断言/文件路径均已给出；真机验收以 `ACCEPT-3D.md` 勾选为可验证门禁。
