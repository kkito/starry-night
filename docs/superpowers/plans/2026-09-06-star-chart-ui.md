# 星图界面（v2）实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 用 React TSX 把验证页升级为整页星图（天顶居中、仰视、等距方位投影、悬停 tooltip、弹框交互），组件测试完整，构建产出单个自包含 HTML。

**Architecture:** `src/core` 算法不动；新增 `src/lib`（投影/绘制列表/绘制纯函数）+ `src/components`（React 组件）；App 持有视图状态，`useMemo` 调 `computeSky` → `buildDrawList` → StarChart canvas 绘制；`vite-plugin-singlefile` 内联全部资源。spec：`docs/superpowers/specs/2026-09-06-star-chart-ui-design.md`。

**Tech Stack:** React 19 + TSX、vite（+ @vitejs/plugin-react、vite-plugin-singlefile）、vitest（node + jsdom 双环境）、@testing-library/react + user-event。

## Global Constraints

- 包管理一律 pnpm（packageManager 字段已锁定 11.7.0）；禁用 npm install
- 仰视惯例：N 上、**E 左**（`x = −r·sin(az)`）；等距方位：`r = R·(90−alt)/90`
- 颜色/阈值常量：星名标注 mag < 1.5；网格 alt ∈ {0,30,60}；方位放射线 N/E/S/W；命中阈值 8px；默认画布 560px
- 悬停 tooltip 字段：名称、mag（2 位小数）、alt/az（1 位小数）
- `src/core/` 与 `src/lib/` 必须零 DOM、零 React 依赖（可被 node 单测直接测）
- 组件测试放 `tests/component/`，文件首行加 `// @vitest-environment jsdom`
- 最终验收：`pnpm test` 全绿 + `pnpm build` 后 `dist/` 只有 `index.html`、无 `assets/` 目录
- 每任务 TDD + commit，全绿才进下一任务

---

### Task 1: React + 单 HTML 构建脚手架

**Files:**
- Create: `vite.config.ts`, `src/App.tsx`, `src/main.tsx`
- Modify: `tsconfig.json`, `index.html`, `package.json`（scripts 不变，走 pnpm add）
- Delete: `src/main.ts`

**Interfaces:**
- Produces: React 应用骨架（`<App/>` 先渲染占位标题）；后续任务在此基础上加组件

- [ ] **Step 1: 安装依赖（pnpm）**

```bash
pnpm add react react-dom
pnpm add -D @vitejs/plugin-react vite-plugin-singlefile @testing-library/react @testing-library/user-event jsdom @types/react @types/react-dom
```

若 `vite-plugin-singlefile` 与当前 vite 大版本 peer 冲突：改用 `pnpm add -D vite@^6 @vitejs/plugin-react@^4` 对齐后重试，并在报告注明。

- [ ] **Step 2: vite.config.ts**

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

export default defineConfig({
  plugins: [react(), viteSingleFile()],
});
```

- [ ] **Step 3: tsconfig.json 加 jsx**

`compilerOptions` 中增加一行（其余不动）：

```json
"jsx": "react-jsx"
```

- [ ] **Step 4: index.html 改为 React 挂载点**

整体替换为：

```html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>星空</title>
    <style>
      html, body { margin: 0; height: 100%; background: #232a3a; }
      #root { min-height: 100%; display: flex; flex-direction: column; align-items: center; }
    </style>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 5: 删除旧入口，写 main.tsx 与最小 App**

```bash
git rm -q src/main.ts
```

`src/main.tsx`：

```tsx
import { createRoot } from 'react-dom/client';
import App from './App';

createRoot(document.getElementById('root')!).render(<App />);
```

`src/App.tsx`（占位，Task 8 组装）：

```tsx
export default function App() {
  return <h1>星空</h1>;
}
```

- [ ] **Step 6: 验证**

Run: `pnpm run typecheck && pnpm test && pnpm run build && ls dist`
Expected: typecheck 无输出；测试全绿（现有 155 项不受影响）；`dist/` 只含 `index.html`、无 `assets/`。

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore: React TSX 脚手架 + vite-plugin-singlefile 单 HTML 构建"
```

---

### Task 2: 星表补提 B−V 色指数

**Files:**
- Modify: `scripts/preprocess.mjs`, `src/core/catalog.ts`, `tests/unit/catalog-json.test.ts`

**Interfaces:**
- Produces: `data/catalog.json` 星条目含 `bv?: number`（B−V 色指数，缺失省略）；`CatalogStar` 增加 `bv?: number`

- [ ] **Step 1: 修改失败测试（tests/unit/catalog-json.test.ts 增加 it）**

在 describe 内追加：

```ts
  it('亮星带 bv 色指数且取值合理', () => {
    const withBv = cat.stars.filter((s: { bv?: number }) => typeof s.bv === 'number');
    expect(withBv.length).toBeGreaterThan(1000);
    const sirius = cat.stars.find((s: { name?: string }) => s.name === 'Sirius');
    expect(sirius.bv).toBeGreaterThan(-0.5);
    expect(sirius.bv).toBeLessThan(0.5);
    const betelgeuse = cat.stars.find((s: { name?: string }) => s.name === 'Betelgeuse');
    if (betelgeuse) expect(betelgeuse.bv).toBeGreaterThan(1.0); // 红超巨星
  });
```

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run tests/unit/catalog-json.test.ts`
Expected: 新 it FAIL（bv 为 undefined）。

- [ ] **Step 3: 修改 scripts/preprocess.mjs 的 push 语句**

```js
  stars.push({
    id,
    ...(p.name ? { name: p.name } : {}),
    mag: p.mag,
    ...(typeof p.bv === 'number' && Number.isFinite(p.bv) ? { bv: p.bv } : {}),
    raDeg: ra,
    decDeg: dec,
  });
```

然后 `pnpm run preprocess` 重新生成（星数应仍为 1627）。

- [ ] **Step 4: src/core/catalog.ts 的 CatalogStar 增加可选字段**

```ts
export interface CatalogStar {
  id: string;
  name?: string;
  mag: number;
  bv?: number;
  raDeg: number;
  decDeg: number;
}
```

- [ ] **Step 5: 运行确认通过**

Run: `pnpm test`
Expected: 全绿（155+1 项）。

- [ ] **Step 6: Commit**

```bash
git add scripts/preprocess.mjs data/catalog.json src/core/catalog.ts tests/unit/catalog-json.test.ts
git commit -m "feat: 星表补提 B-V 色指数"
```

---

### Task 3: lib/project.ts — 等距方位投影

**Files:**
- Create: `src/lib/project.ts`, `tests/unit/project.test.ts`

**Interfaces:**
- Produces:
  - `interface Point { x: number; y: number }`（相对圆心）
  - `const ALT_RINGS = [0, 30, 60]`、`const AZ_SPOKES = [0, 90, 180, 270]`、`const AZ_SPOKE_LABELS = { 0: 'N', 90: 'E', 180: 'S', 270: 'W' }`
  - `altRingRadius(altDeg: number, R: number): number`
  - `projectAltAz(altDeg: number, azDeg: number, R: number): Point`

- [ ] **Step 1: 写失败测试 tests/unit/project.test.ts**

```ts
import { describe, it, expect } from 'vitest';
import { projectAltAz, altRingRadius, ALT_RINGS, AZ_SPOKES, AZ_SPOKE_LABELS } from '../../src/lib/project';

describe('projectAltAz（仰视：N 上、E 左）', () => {
  const R = 100;

  it('天顶在圆心', () => {
    const p = projectAltAz(90, 123, R);
    expect(p.x).toBeCloseTo(0, 9);
    expect(p.y).toBeCloseTo(0, 9);
  });

  it('北（az=0）在上方', () => {
    const p = projectAltAz(45, 0, R);
    expect(p.x).toBeCloseTo(0, 9);
    expect(p.y).toBeCloseTo(-50, 9);
  });

  it('东（az=90）在左侧', () => {
    const p = projectAltAz(45, 90, R);
    expect(p.x).toBeCloseTo(-50, 9);
    expect(p.y).toBeCloseTo(0, 9);
  });

  it('南在下（+y），西在右（+x）', () => {
    expect(projectAltAz(45, 180, R).y).toBeCloseTo(50, 9);
    expect(projectAltAz(45, 270, R).x).toBeCloseTo(50, 9);
  });

  it('地平线（alt=0）半径为 R，线性映射', () => {
    expect(altRingRadius(0, R)).toBe(R);
    expect(altRingRadius(30, R)).toBeCloseTo((2 / 3) * R, 9);
    expect(altRingRadius(60, R)).toBeCloseTo(R / 3, 9);
  });

  it('常量表', () => {
    expect(ALT_RINGS).toEqual([0, 30, 60]);
    expect(AZ_SPOKES).toEqual([0, 90, 180, 270]);
    expect(AZ_SPOKE_LABELS[90]).toBe('E');
  });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run tests/unit/project.test.ts`
Expected: FAIL（找不到模块）。

- [ ] **Step 3: 实现 src/lib/project.ts**

```ts
export interface Point {
  x: number;
  y: number;
}

export const ALT_RINGS = [0, 30, 60];
export const AZ_SPOKES = [0, 90, 180, 270];
export const AZ_SPOKE_LABELS: Record<number, string> = { 0: 'N', 90: 'E', 180: 'S', 270: 'W' };

/** 等距方位投影：天顶距线性映射到半径。 */
export function altRingRadius(altDeg: number, R: number): number {
  return (R * (90 - altDeg)) / 90;
}

/** 屏幕坐标（相对圆心）。仰视惯例：N 上（−y）、E 左（−x）。 */
export function projectAltAz(altDeg: number, azDeg: number, R: number): Point {
  const r = altRingRadius(altDeg, R);
  const a = (azDeg * Math.PI) / 180;
  return { x: -r * Math.sin(a), y: -r * Math.cos(a) };
}
```

- [ ] **Step 4: 运行确认通过 + Commit**

Run: `pnpm test && pnpm run typecheck`
Expected: 全绿。

```bash
git add src/lib/project.ts tests/unit/project.test.ts
git commit -m "feat(lib): 等距方位投影（仰视 N上E左）"
```

---

### Task 4: lib/drawlist.ts — 绘制列表纯函数

**Files:**
- Create: `src/lib/drawlist.ts`, `tests/unit/drawlist.test.ts`

**Interfaces:**
- Consumes: `projectAltAz`（Task 3）；`SkyStar`（`src/core/sky.ts`，字段 id/name?/ra/dec/az/alt/mag）
- Produces:
  - `type StarWithBv = SkyStar & { bv?: number }`
  - `interface DrawStar { id: string; name?: string; x: number; y: number; rPx: number; color: string; label: boolean; az: number; alt: number; mag: number }`
  - `magToRadius(mag: number): number`（clamp 到 [1, 5.5]，公式 4.6 − 0.75·mag）
  - `bvToColor(bv: number): string`（bv clamp 到 [−0.3, 2.0]；<0 → `#aabfff`；<0.4 → `#f8f7ff`；<0.8 → `#ffd2a1`；其余 → `#ff9d5c`）
  - `buildDrawList(stars: StarWithBv[], R: number): DrawStar[]`（label = mag < 1.5；bv 缺失按 0.4 白色）

- [ ] **Step 1: 写失败测试 tests/unit/drawlist.test.ts**

```ts
import { describe, it, expect } from 'vitest';
import { magToRadius, bvToColor, buildDrawList, type StarWithBv } from '../../src/lib/drawlist';

const star = (over: Partial<StarWithBv>): StarWithBv => ({
  id: 's1', ra: 0, dec: 0, az: 0, alt: 45, mag: 2, ...over,
});

describe('drawlist', () => {
  it('magToRadius 单调且 clamp', () => {
    expect(magToRadius(-1.5)).toBe(5.5);   // 天狼星级别封顶
    expect(magToRadius(0)).toBe(4.6);
    expect(magToRadius(5)).toBe(1);        // 下限
    expect(magToRadius(1)).toBeGreaterThan(magToRadius(2));
  });

  it('bvToColor 四档映射', () => {
    expect(bvToColor(-0.3)).toBe('#aabfff'); // 蓝白
    expect(bvToColor(0.2)).toBe('#f8f7ff');  // 白
    expect(bvToColor(0.6)).toBe('#ffd2a1');  // 黄
    expect(bvToColor(1.85)).toBe('#ff9d5c'); // 红（参宿四）
    expect(bvToColor(99)).toBe('#ff9d5c');   // clamp
  });

  it('buildDrawList 投影、label 阈值、bv 缺省', () => {
    const list = buildDrawList([star({ az: 0, alt: 45, mag: 0 }), star({ id: 's2', az: 90, alt: 0, mag: 2 })], 100);
    expect(list[0]).toMatchObject({ x: 0, y: -50, rPx: 4.6, color: '#f8f7ff', label: true });
    expect(list[1]).toMatchObject({ x: -100, y: 0, label: false }); // E 在左
    expect(list[1].name).toBeUndefined();
    const noBv = buildDrawList([star({ bv: undefined })], 100);
    expect(noBv[0]!.color).toBe('#f8f7ff'); // bv 缺失按 0.4
  });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run tests/unit/drawlist.test.ts`
Expected: FAIL（找不到模块）。

- [ ] **Step 3: 实现 src/lib/drawlist.ts**

```ts
import { projectAltAz } from './project';
import type { SkyStar } from '../core/sky';

export type StarWithBv = SkyStar & { bv?: number };

export interface DrawStar {
  id: string;
  name?: string;
  x: number;
  y: number;
  rPx: number;
  color: string;
  label: boolean;
  az: number;
  alt: number;
  mag: number;
}

const NAME_MAG_LIMIT = 1.5;

export function magToRadius(mag: number): number {
  return Math.max(1, Math.min(5.5, 4.6 - mag * 0.75));
}

export function bvToColor(bv: number): string {
  const b = Math.max(-0.3, Math.min(2.0, bv));
  if (b < 0) return '#aabfff';
  if (b < 0.4) return '#f8f7ff';
  if (b < 0.8) return '#ffd2a1';
  return '#ff9d5c';
}

export function buildDrawList(stars: StarWithBv[], R: number): DrawStar[] {
  return stars.map((s) => {
    const p = projectAltAz(s.alt, s.az, R);
    return {
      id: s.id,
      ...(s.name !== undefined ? { name: s.name } : {}),
      x: p.x,
      y: p.y,
      rPx: magToRadius(s.mag),
      color: bvToColor(s.bv ?? 0.4),
      label: s.mag < NAME_MAG_LIMIT,
      az: s.az,
      alt: s.alt,
      mag: s.mag,
    };
  });
}
```

- [ ] **Step 4: 运行确认通过 + Commit**

Run: `pnpm test && pnpm run typecheck`
Expected: 全绿。

```bash
git add src/lib/drawlist.ts tests/unit/drawlist.test.ts
git commit -m "feat(lib): 绘制列表（半径/颜色/标注映射）"
```

---

### Task 5: SettingsDialog 组件

**Files:**
- Create: `src/components/SettingsDialog.tsx`, `tests/component/SettingsDialog.test.tsx`

**Interfaces:**
- Produces:
  - `interface ViewParams { lat: number; lon: number; date: string; magLimit: number }`（date 为 datetime-local 字符串，如 `2026-03-20T20:00`）
  - `validateView(v: ViewParams): string | null`（返回中文错误信息或 null）
  - `<SettingsDialog open view onClose onApply />`（表单受控；提交时 validate，非法显示错误、合法回调 onApply）

- [ ] **Step 1: 写失败测试 tests/component/SettingsDialog.test.tsx**

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SettingsDialog, validateView } from '../../src/components/SettingsDialog';

const view = { lat: 39.9, lon: 116.4, date: '2026-03-20T20:00', magLimit: 5 };

describe('validateView', () => {
  it('合法返回 null', () => {
    expect(validateView(view)).toBeNull();
  });
  it('非法项返回字段名错误', () => {
    expect(validateView({ ...view, lat: 99 })).toContain('lat');
    expect(validateView({ ...view, lon: -200 })).toContain('lon');
    expect(validateView({ ...view, date: '' })).toContain('date');
    expect(validateView({ ...view, magLimit: 6 })).toContain('magLimit');
  });
});

describe('SettingsDialog', () => {
  it('open=false 不渲染', () => {
    render(<SettingsDialog open={false} view={view} onClose={() => {}} onApply={() => {}} />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('非法值提交显示错误且不回调', async () => {
    const onApply = vi.fn();
    render(<SettingsDialog open view={view} onClose={() => {}} onApply={onApply} />);
    await userEvent.type(screen.getByLabelText('纬度'), '9'); // 39.9 → 39.99 仍合法，改清空重填
    await userEvent.clear(screen.getByLabelText('纬度'));
    await userEvent.type(screen.getByLabelText('纬度'), '99');
    await userEvent.click(screen.getByRole('button', { name: '应用' }));
    expect(screen.getByText(/lat/)).toBeTruthy();
    expect(onApply).not.toHaveBeenCalled();
  });

  it('合法值提交回调 onApply', async () => {
    const onApply = vi.fn();
    render(<SettingsDialog open view={view} onClose={() => {}} onApply={onApply} />);
    await userEvent.clear(screen.getByLabelText('纬度'));
    await userEvent.type(screen.getByLabelText('纬度'), '31.2');
    await userEvent.click(screen.getByRole('button', { name: '应用' }));
    expect(onApply).toHaveBeenCalledWith({ ...view, lat: 31.2 });
  });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run tests/component/SettingsDialog.test.tsx`
Expected: FAIL（找不到模块）。

- [ ] **Step 3: 实现 src/components/SettingsDialog.tsx**

```tsx
import { useState, type FormEvent } from 'react';

export interface ViewParams {
  lat: number;
  lon: number;
  date: string;
  magLimit: number;
}

export function validateView(v: ViewParams): string | null {
  if (!Number.isFinite(v.lat) || v.lat < -90 || v.lat > 90) return 'lat 必须在 [-90, 90]';
  if (!Number.isFinite(v.lon) || v.lon < -180 || v.lon > 180) return 'lon 必须在 [-180, 180]';
  if (!v.date || Number.isNaN(new Date(`${v.date}:00Z`).getTime())) return 'date 无效';
  if (!Number.isFinite(v.magLimit) || v.magLimit <= 0 || v.magLimit > 5) return 'magLimit 必须在 (0, 5]';
  return null;
}

interface Props {
  open: boolean;
  view: ViewParams;
  onClose: () => void;
  onApply: (v: ViewParams) => void;
}

export function SettingsDialog({ open, view, onClose, onApply }: Props) {
  const [draft, setDraft] = useState<ViewParams>(view);
  const [error, setError] = useState<string | null>(null);
  if (!open) return null;
  const set = (k: keyof ViewParams, v: string) =>
    setDraft((d) => ({ ...d, [k]: k === 'lat' || k === 'lon' || k === 'magLimit' ? Number(v) : v }));
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const err = validateView(draft);
    if (err) { setError(err); return; }
    setError(null);
    onApply(draft);
    onClose();
  };
  return (
    <div role="dialog" aria-label="设置" style={overlay} onClick={onClose}>
      <form style={panel} onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <label>纬度<input aria-label="纬度" value={draft.lat} onChange={(e) => set('lat', e.target.value)} /></label>
        <label>经度<input aria-label="经度" value={draft.lon} onChange={(e) => set('lon', e.target.value)} /></label>
        <label>时间(UTC)<input aria-label="时间" type="datetime-local" value={draft.date} onChange={(e) => set('date', e.target.value)} /></label>
        <label>星等上限<input aria-label="星等上限" value={draft.magLimit} onChange={(e) => set('magLimit', e.target.value)} /></label>
        {error && <p role="alert" style={{ color: '#ff7b7b' }}>{error}</p>}
        <button type="submit">应用</button>
        <button type="button" onClick={onClose}>取消</button>
      </form>
    </div>
  );
}

const overlay: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' };
const panel: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 8, background: '#1a2136', padding: 16, borderRadius: 8, minWidth: 260 };
```

注意：测试里第二个用例的 `userEvent.type(getByLabelText('纬度'), '9')` 是为了触发一次输入后再 clear；若测试运行中发现该行多余可删（以断言为准）。

- [ ] **Step 4: 运行确认通过 + Commit**

Run: `pnpm test && pnpm run typecheck`
Expected: 全绿。

```bash
git add src/components/SettingsDialog.tsx tests/component/SettingsDialog.test.tsx
git commit -m "feat(ui): 设置弹框与视图参数校验"
```

---

### Task 6: StarTooltip + StarTableDialog 组件

**Files:**
- Create: `src/components/StarTooltip.tsx`, `src/components/StarTableDialog.tsx`, `tests/component/StarTooltip.test.tsx`, `tests/component/StarTableDialog.test.tsx`

**Interfaces:**
- Consumes: `SkyStar`（core/sky）
- Produces:
  - `<StarTooltip star={SkyStar} x={number} y={number} />`（绝对定位悬浮卡，字段：名称、mag、alt、az）
  - `<StarTableDialog open stars={SkyStar[]} onClose />`（星等升序表 + 名字过滤输入框，role="dialog" aria-label="星表"）

- [ ] **Step 1: 写失败测试 tests/component/StarTooltip.test.tsx**

```tsx
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StarTooltip } from '../../src/components/StarTooltip';

const star = { id: 's1', name: 'Vega', ra: 279, dec: 38.8, az: 45.67, alt: 30.12, mag: 0.03 };

describe('StarTooltip', () => {
  it('渲染字段与定位', () => {
    render(<StarTooltip star={star} x={100} y={80} />);
    expect(screen.getByText('Vega')).toBeTruthy();
    expect(screen.getByText(/0\.03/)).toBeTruthy();
    expect(screen.getByText(/30\.1/)).toBeTruthy();
    expect(screen.getByText(/45\.7/)).toBeTruthy();
    const el = screen.getByTestId('star-tooltip');
    expect(el.style.left).toBe('112px');
    expect(el.style.top).toBe('92px');
  });

  it('无名星显示 id', () => {
    render(<StarTooltip star={{ ...star, name: undefined }} x={0} y={0} />);
    expect(screen.getByText('s1')).toBeTruthy();
  });
});
```

- [ ] **Step 2: 写失败测试 tests/component/StarTableDialog.test.tsx**

```tsx
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StarTableDialog } from '../../src/components/StarTableDialog';
import type { SkyStar } from '../../src/core/sky';

const rows: SkyStar[] = [
  { id: 'b', name: 'B星', ra: 0, dec: 0, az: 10, alt: 20, mag: 1.9 },
  { id: 'a', name: 'A星', ra: 0, dec: 0, az: 20, alt: 30, mag: 0.5 },
  { id: 'c', ra: 0, dec: 0, az: 30, alt: 40, mag: 3.7 },
];

describe('StarTableDialog', () => {
  it('按星等升序渲染', () => {
    render(<StarTableDialog open stars={rows} onClose={() => {}} />);
    const mags = screen.getAllByTestId('mag-cell').map((el) => Number(el.textContent));
    expect(mags).toEqual([0.5, 1.9, 3.7]);
  });

  it('名字过滤', async () => {
    render(<StarTableDialog open stars={rows} onClose={() => {}} />);
    await userEvent.type(screen.getByLabelText('过滤星名'), 'A星');
    expect(screen.getAllByTestId('mag-cell').length).toBe(1);
  });

  it('open=false 不渲染', () => {
    render(<StarTableDialog open={false} stars={rows} onClose={() => {}} />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
```

- [ ] **Step 3: 运行确认失败**

Run: `npx vitest run tests/component/StarTooltip.test.tsx tests/component/StarTableDialog.test.tsx`
Expected: FAIL（找不到模块）。

- [ ] **Step 4: 实现 src/components/StarTooltip.tsx**

```tsx
import type { SkyStar } from '../core/sky';

export function StarTooltip({ star, x, y }: { star: SkyStar; x: number; y: number }) {
  return (
    <div
      data-testid="star-tooltip"
      style={{
        position: 'absolute', left: x + 12, top: y + 12, pointerEvents: 'none',
        background: '#1a2136', border: '1px solid #3a4666', borderRadius: 6,
        padding: '6px 10px', fontSize: 12, lineHeight: 1.6, color: '#e8ecf8',
      }}
    >
      <div style={{ fontWeight: 600 }}>{star.name ?? star.id}</div>
      <div>mag {star.mag.toFixed(2)}</div>
      <div>alt {star.alt.toFixed(1)}° / az {star.az.toFixed(1)}°</div>
    </div>
  );
}
```

- [ ] **Step 5: 实现 src/components/StarTableDialog.tsx**

```tsx
import { useState } from 'react';
import type { SkyStar } from '../core/sky';

export function StarTableDialog({ open, stars, onClose }: { open: boolean; stars: SkyStar[]; onClose: () => void }) {
  const [q, setQ] = useState('');
  if (!open) return null;
  const shown = stars.filter((s) => !q || (s.name ?? s.id).toLowerCase().includes(q.toLowerCase()));
  return (
    <div role="dialog" aria-label="星表" style={overlay} onClick={onClose}>
      <div style={panel} onClick={(e) => e.stopPropagation()}>
        <label>过滤星名<input aria-label="过滤星名" value={q} onChange={(e) => setQ(e.target.value)} /></label>
        <table>
          <thead><tr><th>名称</th><th>星等</th><th>高度°</th><th>方位°</th></tr></thead>
          <tbody>
            {shown.map((s) => (
              <tr key={s.id}>
                <td>{s.name ?? s.id}</td>
                <td data-testid="mag-cell">{s.mag}</td>
                <td>{s.alt.toFixed(1)}</td>
                <td>{s.az.toFixed(1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <button onClick={onClose}>关闭</button>
      </div>
    </div>
  );
}

const overlay: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' };
const panel: React.CSSProperties = { background: '#1a2136', padding: 16, borderRadius: 8, maxHeight: '80vh', overflow: 'auto', color: '#e8ecf8' };
```

- [ ] **Step 6: 运行确认通过 + Commit**

Run: `pnpm test && pnpm run typecheck`
Expected: 全绿。

```bash
git add src/components tests/component
git commit -m "feat(ui): 星表弹框与悬停 tooltip"
```

---

### Task 7: StarChart 组件（canvas 绘制 + 悬停）

**Files:**
- Create: `src/components/StarChart.tsx`, `tests/component/helpers.ts`, `tests/component/StarChart.test.tsx`

**Interfaces:**
- Consumes: `DrawStar`（Task 4）、`ALT_RINGS/AZ_SPOKES/AZ_SPOKE_LABELS/projectAltAz`（Task 3）、`StarTooltip`（Task 6）
- Produces:
  - `type SketchCtx`（drawSky 用到的 CanvasRenderingContext2D 方法子集，结构化类型，便于 mock）
  - `drawSky(ctx: SketchCtx, opts: { size: number; stars: DrawStar[] }): void`（背景地面 → 天空圆 → 网格/标注 → 天顶十字 → 星点 → 亮星名）
  - `<StarChart stars={DrawStar[]} size?: number />`（默认 560；mousemove 命中阈值 8px，悬停渲染 StarTooltip）

- [ ] **Step 1: 写 mock 助手 tests/component/helpers.ts**

```ts
export interface RecordedCall { method: string; args: unknown[]; }

export function makeMockCtx() {
  const calls: RecordedCall[] = [];
  const ctx = new Proxy({} as Record<string, unknown>, {
    get(_t, prop: string) {
      if (['fillStyle', 'strokeStyle', 'font', 'textAlign'].includes(prop)) {
        return (...args: unknown[]) => calls.push({ method: `set ${prop}`, args });
      }
      return (...args: unknown[]) => calls.push({ method: prop, args });
    },
    set(_t, prop: string) {
      calls.push({ method: `set ${prop}`, args: [] });
      return true;
    },
  });
  return { calls, ctx: ctx as unknown as CanvasRenderingContext2D };
}

export function installCanvasMock(mock: { ctx: CanvasRenderingContext2D }) {
  HTMLCanvasElement.prototype.getContext = vi.fn(() => mock.ctx) as never;
}

import { vi } from 'vitest';
```

（`import { vi }` 移到文件顶部；这里列在末尾仅提示勿漏。）

- [ ] **Step 2: 写失败测试 tests/component/StarChart.test.tsx**

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { drawSky } from '../../src/components/StarChart';
import { StarChart } from '../../src/components/StarChart';
import { buildDrawList, type StarWithBv } from '../../src/lib/drawlist';
import { makeMockCtx, installCanvasMock, type RecordedCall } from './helpers';
import type { SkyStar } from '../../src/core/sky';

const star = (over: Partial<SkyStar>): SkyStar => ({ id: 's', ra: 0, dec: 0, az: 0, alt: 90, mag: 0, ...over });

beforeAll(() => {
  const { ctx } = makeMockCtx();
  installCanvasMock({ ctx });
});

describe('drawSky', () => {
  const { calls, ctx } = makeMockCtx();
  const stars = buildDrawList([star({ name: 'Vega', az: 0, alt: 45, mag: 0, bv: 0 })], 270);
  drawSky(ctx, { size: 560, stars });

  it('画地面矩形、天空圆、三条高度环', () => {
    expect(calls.some((c) => c.method === 'fillRect')).toBe(true);
    const arcs = calls.filter((c) => c.method === 'arc') as (RecordedCall & { args: number[] })[];
    const radii = arcs.map((a) => a.args[2]);
    expect(radii).toContain(270);           // 地平线
    expect(radii).toContain(180);           // alt=30
    expect(radii).toContain(90);            // alt=60
  });

  it('标注 N/E/S/W 与高度刻度', () => {
    const texts = calls.filter((c) => c.method === 'fillText').map((c) => c.args[0]);
    for (const t of ['N', 'E', 'S', 'W', '0°', '30°', '60°']) expect(texts).toContain(t);
  });

  it('星点圆心 = projectAltAz 输出 + 圆心偏移', () => {
    const arcs = calls.filter((c) => c.method === 'arc') as (RecordedCall & { args: number[] })[];
    // Vega alt=45 az=0, R=270 → 相对 (0,-135)，圆心 (280,280)
    expect(arcs.some((a) => Math.abs(a.args[0] - 280) < 1e-6 && Math.abs(a.args[1] - 145) < 1e-6)).toBe(true);
  });

  it('亮星名被绘制', () => {
    expect(calls.some((c) => c.method === 'fillText' && c.args[0] === 'Vega')).toBe(true);
  });
});

describe('StarChart 悬停', () => {
  it('鼠标移到星点附近显示 tooltip', () => {
    const stars = buildDrawList([star({ id: 'zenith', name: 'Zenith Star', alt: 90, mag: 0 })], 270);
    render(<StarChart stars={stars} />);
    const canvas = screen.getByTestId('star-canvas');
    fireEvent.mouseMove(canvas, { clientX: 280, clientY: 280 }); // 天顶 = 画布中心
    expect(screen.getByTestId('star-tooltip')).toBeTruthy();
    expect(screen.getByText('Zenith Star')).toBeTruthy();
  });

  it('移开（onMouseLeave）后 tooltip 消失', () => {
    const stars = buildDrawList([star({ id: 'z', alt: 90, mag: 0 })], 270);
    render(<StarChart stars={stars} />);
    const canvas = screen.getByTestId('star-canvas');
    fireEvent.mouseMove(canvas, { clientX: 280, clientY: 280 });
    fireEvent.mouseLeave(canvas);
    expect(screen.queryByTestId('star-tooltip')).toBeNull();
  });
});
```

- [ ] **Step 3: 运行确认失败**

Run: `npx vitest run tests/component/StarChart.test.tsx`
Expected: FAIL（找不到模块）。

- [ ] **Step 4: 实现 src/components/StarChart.tsx**

```tsx
import { useEffect, useRef, useState } from 'react';
import { ALT_RINGS, AZ_SPOKES, AZ_SPOKE_LABELS, projectAltAz } from '../lib/project';
import type { DrawStar } from '../lib/drawlist';
import { StarTooltip } from './StarTooltip';

export type SketchCtx = Pick<
  CanvasRenderingContext2D,
  'fillStyle' | 'strokeStyle' | 'font' | 'textAlign' | 'beginPath' | 'arc' | 'fill' | 'stroke' | 'moveTo' | 'lineTo' | 'fillText' | 'fillRect' | 'save' | 'restore'
>;

export const CANVAS_MARGIN = 10;
const HIT_PX = 8;

export function drawSky(ctx: SketchCtx, opts: { size: number; stars: DrawStar[] }): void {
  const { size, stars } = opts;
  const c = size / 2;
  const R = c - CANVAS_MARGIN;
  ctx.save();
  // 地面
  ctx.fillStyle = '#232a3a';
  ctx.fillRect(0, 0, size, size);
  // 天空
  ctx.beginPath();
  ctx.arc(c, c, R, 0, Math.PI * 2);
  ctx.fillStyle = '#0b1020';
  ctx.fill();
  // 高度环 + 刻度
  ctx.font = '11px sans-serif';
  ctx.textAlign = 'center';
  for (const alt of ALT_RINGS) {
    const r = (R * (90 - alt)) / 90;
    ctx.beginPath();
    ctx.arc(c, c, r, 0, Math.PI * 2);
    ctx.strokeStyle = '#2a3350';
    ctx.stroke();
    ctx.fillStyle = '#5a6a94';
    ctx.fillText(`${alt}°`, c, c - r - 4);
  }
  // 方位放射线 + 标注
  for (const az of AZ_SPOKES) {
    const p = projectAltAz(0, az, R);
    ctx.beginPath();
    ctx.moveTo(c, c);
    ctx.lineTo(c + p.x, c + p.y);
    ctx.stroke();
    const lp = projectAltAz(-5, az, R); // 圆外一点
    ctx.fillStyle = '#8b97b8';
    ctx.fillText(AZ_SPOKE_LABELS[az]!, c + lp.x, c + lp.y + 4);
  }
  // 天顶十字
  ctx.beginPath();
  ctx.moveTo(c - 4, c);
  ctx.lineTo(c + 4, c);
  ctx.moveTo(c, c - 4);
  ctx.lineTo(c, c + 4);
  ctx.strokeStyle = '#5a6a94';
  ctx.stroke();
  // 星星
  for (const s of stars) {
    ctx.beginPath();
    ctx.arc(c + s.x, c + s.y, s.rPx, 0, Math.PI * 2);
    ctx.fillStyle = s.color;
    ctx.fill();
    if (s.label && s.name) {
      ctx.fillStyle = '#e8ecf8';
      ctx.textAlign = 'left';
      ctx.fillText(s.name, c + s.x + s.rPx + 3, c + s.y + 3);
      ctx.textAlign = 'center';
    }
  }
  ctx.restore();
}

export function StarChart({ stars, size = 560 }: { stars: DrawStar[]; size?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [hover, setHover] = useState<{ star: DrawStar; px: number; py: number } | null>(null);
  useEffect(() => {
    const ctx = ref.current?.getContext('2d');
    if (ctx) drawSky(ctx, { size, stars });
  }, [stars, size]);
  const onMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const c = size / 2;
    let best: DrawStar | null = null;
    let bestD = HIT_PX;
    for (const s of stars) {
      const d = Math.hypot(c + s.x - mx, c + s.y - my);
      if (d < bestD) { best = s; bestD = d; }
    }
    setHover(best ? { star: best, px: mx, py: my } : null);
  };
  return (
    <div style={{ position: 'relative' }} onMouseLeave={() => setHover(null)}>
      <canvas ref={ref} width={size} height={size} data-testid="star-canvas" onMouseMove={onMove} />
      {hover && <StarTooltip star={hover.star} x={hover.px} y={hover.py} />}
    </div>
  );
}
```

注意 `DrawStar.name` 是可选的，`s.name` 访问处如 typecheck 报错，改为 `s.name !== undefined && s.label` 判断。

- [ ] **Step 5: 运行确认通过 + Commit**

Run: `pnpm test && pnpm run typecheck`
Expected: 全绿。

```bash
git add src/components/StarChart.tsx tests/component
git commit -m "feat(ui): 星图 canvas 绘制与悬停命中"
```

---

### Task 8: App 组装 + 单 HTML 验收 + README

**Files:**
- Modify: `src/App.tsx`, `README.md`
- Create: `tests/component/App.test.tsx`

**Interfaces:**
- Consumes: `computeSky / loadCatalog`（core）、`buildDrawList`（Task 4）、`StarChart`（Task 7）、`SettingsDialog / ViewParams`（Task 5）、`StarTableDialog`（Task 6）
- Produces: 完整页面；`pnpm build` 单 HTML 验收通过

- [ ] **Step 1: 写失败测试 tests/component/App.test.tsx**

```tsx
// @vitest-environment jsdom
import { describe, it, expect, beforeAll } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import App from '../../src/App';
import { makeMockCtx, installCanvasMock } from './helpers';

beforeAll(() => {
  const { ctx } = makeMockCtx();
  installCanvasMock({ ctx });
});

describe('App', () => {
  it('默认视图渲染摘要与星图', () => {
    render(<App />);
    expect(screen.getByTestId('star-canvas')).toBeTruthy();
    expect(screen.getByTestId('summary').textContent).toMatch(/可见星/);
  });

  it('设置按钮打开弹框，应用后摘要更新', async () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: '设置' }));
    const lat = screen.getByLabelText('纬度');
    fireEvent.change(lat, { target: { value: '-33.87' } });
    fireEvent.click(screen.getByRole('button', { name: '应用' }));
    expect(screen.getByTestId('summary').textContent).toContain('-33.87');
  });

  it('星表按钮打开弹框', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: '星表' }));
    expect(screen.getByRole('dialog', { name: '星表' })).toBeTruthy();
  });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run tests/component/App.test.tsx`
Expected: FAIL（App 仍是占位）。

- [ ] **Step 3: 实现 src/App.tsx**

```tsx
import { useMemo, useState } from 'react';
import { computeSky, loadCatalog } from './core';
import { buildDrawList } from './lib/drawlist';
import { StarChart, CANVAS_MARGIN } from './components/StarChart';
import { SettingsDialog, type ViewParams } from './components/SettingsDialog';
import { StarTableDialog } from './components/StarTableDialog';

const SIZE = 560;
const DEFAULT_VIEW: ViewParams = { lat: 39.9, lon: 116.4, date: '2026-03-20T20:00', magLimit: 5 };

export default function App() {
  const [view, setView] = useState<ViewParams>(DEFAULT_VIEW);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [tableOpen, setTableOpen] = useState(false);

  const sky = useMemo(() => {
    try {
      const date = new Date(`${view.date}:00Z`);
      const { lstDeg, stars } = computeSky({ lat: view.lat, lon: view.lon, date, magLimit: view.magLimit });
      const bvs = new Map(loadCatalog().map((s) => [s.id, s.bv]));
      const drawStars = buildDrawList(
        stars.map((s) => ({ ...s, bv: bvs.get(s.id) })),
        SIZE / 2 - CANVAS_MARGIN,
      );
      return { error: null as string | null, lstDeg, stars, drawStars };
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err), lstDeg: NaN, stars: [], drawStars: [] };
    }
  }, [view]);

  return (
    <main style={{ color: '#e8ecf8', textAlign: 'center', paddingTop: 12 }}>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', width: SIZE, padding: '0 8px' }}>
        <button onClick={() => setSettingsOpen(true)}>设置</button>
        <button onClick={() => setTableOpen(true)}>星表</button>
      </div>
      <StarChart stars={sky.drawStars} size={SIZE} />
      <p data-testid="summary" style={{ color: '#8b97b8', fontSize: 13 }}>
        {sky.error
          ? `错误：${sky.error}`
          : `lat ${view.lat}° lon ${view.lon}° · ${view.date}Z · LAST ${sky.lstDeg.toFixed(1)}° · 可见星 ${sky.stars.length} 颗`}
      </p>
      <SettingsDialog open={settingsOpen} view={view} onClose={() => setSettingsOpen(false)} onApply={setView} />
      <StarTableDialog open={tableOpen} stars={sky.stars} onClose={() => setTableOpen(false)} />
    </main>
  );
}
```

- [ ] **Step 4: 运行确认通过**

Run: `pnpm test && pnpm run typecheck`
Expected: 全绿（全部测试）。

- [ ] **Step 5: 单 HTML 构建验收**

Run: `pnpm run build && ls dist && grep -c "<script" dist/index.html`
Expected: `dist/` 只含 `index.html`；`grep -c` 结果 ≥ 1（脚本已内联）；无 `assets/` 目录。

- [ ] **Step 6: 浏览器冒烟 + README 更新**

`pnpm run build` 后用 `vite preview` 或直接打开 `dist/index.html`：星图渲染、悬停显示 tooltip、设置/星表弹框可用。README 的"使用"与"页面"章节更新为星图版说明（命令已含 pnpm；补充：页面为整页星图，设置与星表走弹框，构建产物为单 HTML）。

- [ ] **Step 7: Commit**

```bash
git add src/App.tsx tests/component/App.test.tsx README.md
git commit -m "feat(ui): 星图页组装 + 单 HTML 构建验收"
```

---

## Self-Review 记录

- **Spec 覆盖**：投影/网格（Task 3+7 绘制）、绘制列表与颜色（Task 4）、星名阈值 mag<1.5（Task 4）、悬停 tooltip 字段与 8px 阈值（Task 6+7）、设置/星表弹框（Task 5/6）、星图即页面+摘要条（Task 8）、bv 色指数（Task 2）、单 HTML（Task 1+8 验收）——全覆盖。
- **占位符**：无 TBD；Task 5/7 中的两处"注意"是实施提示非占位。
- **类型一致性**：`ViewParams.date` 为 datetime-local 字符串，App 内 `new Date(\`${date}:00Z\`)`（与 Task 5 校验一致）；`CANVAS_MARGIN` 由 StarChart 导出、App 消费；`DrawStar.label` 布尔与 drawSky 的 `s.label && s.name` 一致；mock 助手 helpers.ts 被 StarChart/App 测试共用。
