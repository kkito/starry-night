# Web 删 three.js + Monorepo 抽包 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 抽出 `@starry/sky-core` workspace 包（行为零变化），web 顶栏收敛 2D/3D 两档，canvas 绘制同源化为 `drawSkyScene`，彻底删除 three.js。

**Architecture:** 四个串行 Task：① 目录搬迁建包（纯机械，全量测试护航）；② ViewMode 类型收敛 + prefs 老值迁移（TDD）；③ 把 SkyHtml3D 的绘制逻辑抽成 sky-core 纯 canvas 函数 `drawSkyScene`（为小程序复用，TDD）；④ 删除 Sky3D/three 依赖并验证体积。

**Tech Stack:** pnpm workspace、vite/vitest（exports 解析 TS 源码包）、React、2D Canvas。

## Global Constraints

- 老 `data/`、`src/core` 全部、`src/lib` 中 8 个纯 TS 模块（dome/drawlist/track/names/project/sky-html3d/tokens/cities）进 `@starry/sky-core`；`src/lib/{prefs,geolocation}.ts` 与 `src/components/*` 留在 web。
- `src/lib/prefs.ts` 迁移规则：老用户 localStorage 存的 `viewMode:'html3d'` 读出时归一化为 `'3d'`。
- 每个 Task 结束：`pnpm test` 全绿 + `pnpm typecheck` 0 错误。
- 验证命令：`pnpm vitest run <path>` 单文件；`pnpm test` 全量；`pnpm build`。

---

### Task 1: Monorepo 抽包 `@starry/sky-core`（行为零变化）

**Files:**
- Create: `pnpm-workspace.yaml`、`packages/sky-core/package.json`
- Move: `src/core/`（6 文件）→ `packages/sky-core/src/core/`；`src/lib/{dome,drawlist,track,names,project,sky-html3d,tokens,cities}.ts` → `packages/sky-core/src/lib/`；`data/` → `packages/sky-core/data/`
- Modify: `package.json`（加 workspace 依赖）、`tsconfig.json`（paths + include）、所有引用被搬模块的 import（`src/App.tsx`、`src/components/*.tsx`、`tests/**`）
- 不动: `src/lib/prefs.ts`、`src/lib/geolocation.ts`（留 web；prefs 只 import components，geolocation 只用浏览器 API）

**Interfaces:**
- Produces: 包 `@starry/sky-core`，子路径导入 `@starry/sky-core/lib/dome`、`@starry/sky-core/core/sky` 等；后续 Task 与小程序计划都依赖此路径形式。

- [ ] **Step 1: 建包并搬迁文件**

```bash
mkdir -p packages/sky-core/src
git mv src/core packages/sky-core/src/core
mkdir -p packages/sky-core/src/lib
for f in dome drawlist track names project sky-html3d tokens cities; do git mv src/lib/$f.ts packages/sky-core/src/lib/$f.ts; done
git mv data packages/sky-core/data
```

包内相对引用无需改动（如 `src/lib/drawlist.ts` 的 `'../core/sky'`、`src/core/catalog.ts` 的 `'../../data/catalog.json'`，目录深度不变仍然成立）。

- [ ] **Step 2: 写 `packages/sky-core/package.json`**

```json
{
  "name": "@starry/sky-core",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    "./core": "./src/core/index.ts",
    "./*": "./src/*.ts"
  },
  "dependencies": {
    "astronomy-engine": "^2.1.19"
  }
}
```

- [ ] **Step 3: 根 `pnpm-workspace.yaml` 与依赖**

```yaml
packages:
  - .
  - packages/*
  - miniapp
```

根 `package.json` 的 `dependencies` 加 `"@starry/sky-core": "workspace:*"`。执行 `pnpm install`。

- [ ] **Step 4: `tsconfig.json` 加 paths 与 include**

`compilerOptions` 加：

```json
"baseUrl": ".",
"paths": { "@starry/sky-core/*": ["./packages/sky-core/src/*"] }
```

`include` 改为 `["src", "tests", "packages/sky-core/src"]`。

- [ ] **Step 5: 批量改写 import**

```bash
MOVED='dome|drawlist|track|names|project|sky-html3d|tokens|cities'
# web src（components 与 App）: '../lib/<moved>' 与 '../core[/x]' → 包路径
grep -rl "from '\.\./" src --include='*.tsx' --include='*.ts' | xargs sed -i '' -E \
  -e "s|'\.\./lib/($MOVED)'|'@starry/sky-core/lib/\1'|g" \
  -e "s|'\.\./\.\./lib/($MOVED)'|'@starry/sky-core/lib/\1'|g" \
  -e "s|'\.\./core/'|'@starry/sky-core/core'|g" \
  -e "s|'\.\./core/|'@starry/sky-core/core/|g" \
  -e "s|'\.\./\.\./core/|'@starry/sky-core/core/|g"
# tests: '../../src/lib/<moved>'、'../../src/core/...' → 包路径
grep -rl "src/\(lib\|core\)" tests | xargs sed -i '' -E \
  -e "s|'\.\./\.\./src/lib/($MOVED)'|'@starry/sky-core/lib/\1'|g" \
  -e "s|'\.\./\.\./src/core/?|'@starry/sky-core/core|g"
```

- [ ] **Step 6: 验证无残留引用**

```bash
grep -rn "src/lib/\(dome\|drawlist\|track\|names\|project\|sky-html3d\|tokens\|cities\)\|src/core/" src tests
```
Expected: 无输出（`src/lib/prefs.ts`、`src/lib/geolocation.ts` 的引用不受影响）。

- [ ] **Step 7: 全量验证**

Run: `pnpm test && pnpm typecheck && pnpm build`
Expected: 339 用例全过；tsc 0 错误；`dist/index.html` 产出（体积暂不变，three 还在）。

- [ ] **Step 8: Commit**

```bash
git add -A && git commit -m "refactor(web): 抽 @starry/sky-core workspace 包，行为零变化"
```

### Task 2: ViewMode 收敛 `'2d' | '3d'` + prefs 迁移

**Files:**
- Modify: `src/components/SettingsDialog.tsx:8`（ViewMode 类型）、`SettingsDialog.tsx:45`（白名单）、`src/components/ViewModeSwitch.tsx:20-22`、`src/components/SkyHtml3D.tsx`（import 类型来源不变）、`src/App.tsx:17,94-109`（默认值与分支）
- Modify: `src/lib/prefs.ts:17-26`（html3d→3d 迁移）
- Test: `tests/unit/prefs.test.ts`、`tests/component/ViewModeSwitch.test.tsx`、`tests/component/SettingsDialog.test.tsx`

**Interfaces:**
- Consumes: Task 1 的包路径（组件 import 不涉新接口）。
- Produces: `ViewMode = '2d' | '3d'`（`'3d'` 渲染 `<SkyHtml3D>`）；`loadViewPrefs` 迁移语义（后续小程序计划不依赖）。

- [ ] **Step 1: 写失败测试**

`tests/unit/prefs.test.ts` 追加：

```ts
it('老值 html3d 自动迁移为 3d', () => {
  localStorage.setItem('starry-night.view', JSON.stringify({ viewMode: 'html3d' }));
  expect(loadViewPrefs(base()).viewMode).toBe('3d');
});
```

`tests/component/ViewModeSwitch.test.tsx`：删除「渲染三档，HTML3D 可切换」「点击 HTML3D 回调」两个用例，追加：

```tsx
it('只有 2D/3D 两档，无 HTML3D 档', () => {
  render(<ViewModeSwitch value="3d" onChange={vi.fn()} />);
  expect(screen.getByRole('switch', { name: '3D 视图' })).toBeTruthy();
  expect(screen.queryByRole('switch', { name: 'HTML3D 视图' })).toBeNull();
});
```

「App 默认 HTML3D」用例改名为「App 默认 3D（canvas 版）」，断言改为：

```tsx
expect(screen.queryByTestId('skydome-html3d')).toBeTruthy();
expect(screen.queryByTestId('star-canvas')).toBeNull();
expect(screen.getByRole('switch', { name: '3D 视图' }).getAttribute('aria-checked')).toBe('true');
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm vitest run tests/unit/prefs.test.ts tests/component/ViewModeSwitch.test.tsx`
Expected: 新用例 FAIL（迁移未实现 / HTML3D 档仍存在）。

- [ ] **Step 3: 最小实现**

`src/components/SettingsDialog.tsx:8`：
```ts
export type ViewMode = '2d' | '3d';
```
白名单行：
```ts
if (!['2d', '3d'].includes(v.viewMode)) return 'viewMode 无效';
```

`src/lib/prefs.ts` `loadViewPrefs` 内 merge 前归一化：
```ts
const parsed = JSON.parse(raw) as Partial<ViewParams>;
if (parsed.viewMode === 'html3d') parsed.viewMode = '3d';
const merged = { ...defaults, ...parsed, date: toLocalInput(new Date()) } as ViewParams;
```

`src/components/ViewModeSwitch.tsx`：map 改 `(['2d', '3d'] as const)`，label 改 `m === '2d' ? '2D 视图' : '3D 视图'`。

`src/App.tsx`：`DEFAULT_VIEW` 的 `viewMode: 'html3d'` → `'3d'`；渲染分支去掉 `html3d` 三元层：
```tsx
{view.viewMode === '3d' ? (
  <SkyHtml3D stars={sky.drawStars} track={track} selectedId={selectedId} onSelect={setSelectedId} />
) : (
  <StarChart ... />
)}
```

`tests/component/SettingsDialog.test.tsx` 与 `tests/unit/prefs.test.ts` 中其余 `'html3d'` 字面量统一替换为 `'3d'`：
```bash
sed -i '' "s/'html3d'/'3d'/g" tests/component/SettingsDialog.test.tsx tests/unit/prefs.test.ts
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm vitest run tests/unit/prefs.test.ts tests/component/ViewModeSwitch.test.tsx tests/component/SettingsDialog.test.tsx`
Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(web): viewmode 收敛 2d/3d，3d=canvas 版，html3d 自动迁移"
```

### Task 3: 绘制同源化——抽 `drawSkyScene` 到 sky-core

**Files:**
- Create: `packages/sky-core/src/lib/sky-scene.ts`
- Modify: `src/components/SkyHtml3D.tsx`（useEffect 绘制段替换为一次调用；`_sx/_sy` hack 删除，改用返回的坐标表）
- Test: `tests/unit/sky-scene.test.ts`

**Interfaces:**
- Produces: `drawSkyScene(ctx, opts)` 供 web `SkyHtml3D` 与小程序 `SkyCanvas3D` 共用：

```ts
export interface SkySceneCam { yaw: number; pitch: number; fov: number; }
export interface SkySceneOpts {
  w: number; h: number; cam: SkySceneCam;
  stars: DrawStar[]; track: StarTrack | null;
}
/** 全量绘制一帧（天穹渐变/辉光/仰角圈/经线/方位标注/剪影/星点/轨迹）。
 * 返回可见星 id → 屏幕坐标，供点选与 tooltip 锚定；背后星不在表内。 */
export function drawSkyScene(
  ctx: CanvasRenderingContext2D,
  opts: SkySceneOpts,
): Map<string, { x: number; y: number }>
```

- [ ] **Step 1: 写失败测试**

```ts
// tests/unit/sky-scene.test.ts
import { describe, it, expect } from 'vitest';
import { drawSkyScene } from '@starry/sky-core/lib/sky-scene';
import type { DrawStar } from '@starry/sky-core/lib/drawlist';

const star = (id: string, az: number, alt: number): DrawStar =>
  ({ id, name: id, x: 0, y: 0, rPx: 3, color: '#ffffff', label: false, az, alt, mag: 1 });

function makeCtx() {
  const calls: string[] = [];
  const gradient = { addColorStop: () => {} };
  const ctx = {
    canvas: { width: 0, height: 0 },
    createLinearGradient: () => gradient,
    fillRect: () => calls.push('fillRect'),
    beginPath: () => calls.push('beginPath'),
    arc: () => calls.push('arc'),
    fill: () => calls.push('fill'),
    stroke: () => calls.push('stroke'),
    moveTo: () => {}, lineTo: () => {}, closePath: () => {},
    ellipse: () => calls.push('ellipse'),
    fillText: () => calls.push('fillText'),
    setLineDash: () => {},
    fillStyle: '', strokeStyle: '', font: '', textAlign: '', textBaseline: '',
  };
  return { ctx: ctx as unknown as CanvasRenderingContext2D, calls };
}

const cam = { yaw: Math.PI, pitch: (25 * Math.PI) / 180, fov: 65 };

describe('drawSkyScene', () => {
  it('画出背景/辉光/星点，正前方星在返回表中且坐标居中', () => {
    const { ctx, calls } = makeCtx();
    const pos = drawSkyScene(ctx, { w: 800, h: 600, cam, stars: [star('s1', 180, 25)], track: null });
    expect(calls).toContain('fillRect');
    expect(calls).toContain('ellipse');
    expect(calls.filter((c) => c === 'arc').length).toBeGreaterThan(0);
    expect(pos.get('s1')).toBeTruthy();
    expect(Math.abs(pos.get('s1')!.x - 400)).toBeLessThan(2);
    expect(Math.abs(pos.get('s1')!.y - 300)).toBeLessThan(2);
  });
  it('背后星不画也不进表；剪影与方位文字随 yaw 出现', () => {
    const { ctx, calls } = makeCtx();
    const pos = drawSkyScene(ctx, { w: 800, h: 600, cam, stars: [star('behind', 0, 25)], track: null });
    expect(pos.size).toBe(0);
    const { ctx: ctx2, calls: calls2 } = makeCtx();
    drawSkyScene(ctx2, { w: 800, h: 600, cam, stars: [], track: null });
    expect(calls2).toContain('fillText'); // 「南」
    expect(calls2.filter((c) => c === 'fillRect').length).toBeGreaterThan(1); // 树干/楼（az200 树可见）
  });
  it('轨迹：选中星带 track 时画实线+虚线两组', () => {
    const { ctx, calls } = makeCtx();
    const track = {
      id: 's1',
      points: [ { az: 178, alt: 24 }, { az: 180, alt: 25 }, { az: 182, alt: 26 } ],
      pastCount: 2,
    } as never;
    drawSkyScene(ctx, { w: 800, h: 600, cam, stars: [star('s1', 180, 25)], track });
    expect(calls.filter((c) => c === 'stroke').length).toBeGreaterThan(2);
  });
});
```

（track 类型以 `@starry/sky-core/lib/track` 的 `StarTrack` 实际字段为准——实现前先 `grep -n "interface StarTrack" packages/sky-core/src/lib/track.ts` 对齐字段名，测试里 `as never` 换成真实构造。）

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm vitest run tests/unit/sky-scene.test.ts`
Expected: FAIL `Cannot resolve '@starry/sky-core/lib/sky-scene'`。

- [ ] **Step 3: 实现（把 `src/components/SkyHtml3D.tsx` 的 useEffect 绘制段整体平移）**

新建 `packages/sky-core/src/lib/sky-scene.ts`：把 `SkyHtml3D.tsx` 中从「天穹渐变」到「轨迹」再到「星点」的绘制代码原样搬入，参数化 `w/h/cam/stars/track`；星点屏幕坐标不再写回 `_sx/_sy`，而是收集进 `Map<string, {x,y}>` 返回。剪影（`silhouetteShapes`/`silhouettePx`）、方位标注（`directionLabels`）、投影（`projectHtml3D`）、`pointSizeFor`、`COLORS` 均为包内相对引用。

- [ ] **Step 4: `SkyHtml3D.tsx` 改为调用**

useEffect 内替换为：

```ts
const pos = drawSkyScene(ctx, { w, h, cam: camRef.current, stars, track });
posRef.current = pos; // useRef<Map<...>>
```

`pick` 改为遍历 `posRef.current`（键为星 id，天然剔除背后星），删除 `_sx/_sy` 相关代码；`selectedPos` 改从 `posRef.current.get(selectedId)` 读取（effect 里 `setSelectedPos` 语义保持）。

- [ ] **Step 5: 全量验证**

Run: `pnpm test && pnpm typecheck`
Expected: 全绿（既有 SkyHtml3D 组件测试与截图行为不变）。

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "refactor(web): canvas 绘制抽成 sky-core drawSkyScene，星点坐标表替代 _sx/_sy"
```

### Task 4: 删除 three.js 全部残留

**Files:**
- Delete: `src/components/Sky3D.tsx`、`tests/component/Sky3D.test.tsx`、`tests/component/Sky3D.fix.test.tsx`
- Modify: `src/components/SkyHtml3D.tsx`（`Sky3DProps` 移入就地导出）、`package.json`（删依赖）

**Interfaces:**
- Produces: `SkyHtml3D.tsx` 导出 `Sky3DProps`（字段不变：`stars/track/selectedId/onSelect`），App 与测试继续可用。

- [ ] **Step 1: 类型搬迁**

`src/components/SkyHtml3D.tsx` 顶部加（并删除 `import type { Sky3DProps } from './Sky3D'`）：

```ts
import type { DrawStar } from '@starry/sky-core/lib/drawlist';
import type { StarTrack } from '@starry/sky-core/lib/track';

export interface Sky3DProps {
  stars: DrawStar[];
  track: StarTrack | null;
  selectedId: string | null;
  onSelect?: (id: string | null) => void;
}
```

- [ ] **Step 2: 删除文件与依赖**

```bash
git rm src/components/Sky3D.tsx tests/component/Sky3D.test.tsx tests/component/Sky3D.fix.test.tsx
pnpm remove three @types/three
grep -rn "from 'three'\|@types/three" src tests packages
```
Expected: grep 无输出。

- [ ] **Step 3: 全量验证 + 体积**

Run: `pnpm test && pnpm typecheck && pnpm build`
Expected: 用例数比 339 少 8 个左右（删两个 Sky3D 测试文件），全绿；`dist/index.html` 显著缩小（此前 976K，three 内联占大头，预期 <200K）。

- [ ] **Step 4: 浏览器回归**

`pnpm dev` 起服务，浏览器验证：默认进 3D（canvas 版，剪影/经线/方位标注齐全）、2D/3D 两档切换、点选星 tooltip 锚定、拖拽缩放正常。

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(web): 删除 three.js，3D 由 canvas 版唯一承担"
```
