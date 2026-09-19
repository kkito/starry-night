# 全新标准 Taro 4 小程序重写 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 用标准 Taro 4.x 脚手架（React + TS，仅 weapp）替换 `miniapp/`，3D 用 canvas 2d 复用 `@starry/sky-core` 的 `drawSkyScene`（与 web 同源），彻底移除 three 全链。

**Architecture:** 生成官方脚手架替换旧目录 → 平移与渲染无关的胶水层（垫片/适配器/组件 + 测试）→ 新 `SkyCanvas3D` 组件（TDD）→ 三页接线与体积门禁验收。旧代码统一从 git 历史 `dd7f5c5` 读取（`git show dd7f5c5:miniapp/<path>`）。

**Tech Stack:** Taro 4.x、React、TypeScript、pnpm workspace、`<Canvas type="2d">`、`@starry/sky-core`（见计划 `2026-09-19-remove-three-web.md`，须先完成）。

## Global Constraints

- 只做 weapp 构建，不做 H5（`build:h5` 相关配置/脚本一律不建）。
- 无 `three`、无 vendor UMD、无 stub、无构建后拷贝脚本；允许且仅允许的非标配置：webpack babel include 指向 `packages/sky-core/src`（共享源码，非 three hack）。
- 小程序 canvas 坑位沿用旧项目经验：canvas rect 必须 `createSelectorQuery().boundingClientRect()`、DPR 封顶 2、无 rAF 用 `setTimeout(…, 16)` 兜底。
- 交互手感与 web 对齐：`yaw -= dx*0.003`、`pitch += dy*0.002`（下限 0.9×半视场、上限 1.2）、fov∈[30,100]、tap 容差 3px（web 鼠标）/触屏 touch slop 12px（TAP_SLOP_PX，承旧 Sky3DAdapter 实测，Task 3 评审裁决 2026-09-19）、点选半径 22px。
- 旧代码参考基线：`git show dd7f5c5:miniapp/...`（dd7f5c5 = 重写前最后一个提交）。
- 验证：`pnpm test`（根，vitest 一并跑 miniapp 测试）、`pnpm build:weapp`（miniapp 目录内）、体积门禁脚本。

---

### Task 1: 生成官方脚手架并替换 miniapp/

**Files:**
- Create: 官方 Taro 4 脚手架（临时目录 `starry-taro`）→ 替换 `miniapp/`
- Delete: 旧 `miniapp/` 全部内容（git 历史可回溯）

- [ ] **Step 1: 生成脚手架**

```bash
cd /tmp && npx @tarojs/cli@4 init starry-taro
```
交互选择：框架 **React**、**TypeScript**、CSS 预处理 **Sass**、编译工具 **Webpack5**、包管理 **pnpm**、模板**默认模板**。

- [ ] **Step 2: 替换 miniapp/**

```bash
git rm -r --cached miniapp >/dev/null && rm -rf miniapp
mv /tmp/starry-taro miniapp && rm -rf miniapp/.git
```

`miniapp/package.json`：`name` 改 `"starry-night-miniapp"`；删除模板 demo 页（`src/pages/index` 模板内容留到 Task 4 接线时整体替换，此时先跑通空模板构建）。`miniapp/project.config.json` 的 `appid` 沿用旧值 `wxdf0fc97e5d4941ee`（从 `git show dd7f5c5:miniapp/project.config.json` 查看）。

- [ ] **Step 3: 跑通空模板构建**

```bash
cd miniapp && pnpm install && pnpm build:weapp
```
Expected: 构建成功，`dist/` 产出微信小程序包。

- [ ] **Step 4: Commit**

```bash
cd .. && git add -A && git commit -m "chore(miniapp): 全新 Taro 4 脚手架替换旧项目（three 链随旧目录移除）"
```

### Task 2: sky-core 接入 + 胶水层平移（含测试）

**Files:**
- Create（从 `git show dd7f5c5:miniapp/...` 恢复并改 import）:
  - `miniapp/src/web-env.ts`（**删除** `shimGLCanvas`、`makeOffscreen` 两个 GL 垫片及其导出，其余原样）
  - `miniapp/src/lib/{selected,city-pick,canvas-size,table-format}.ts`
  - `miniapp/src/adapters/{prefs,geolocation}.ts`
  - `miniapp/src/components/{StarTooltip,ViewModeSwitch,ui,StarChart}.tsx`
- Modify: `miniapp/package.json`（加 `@starry/sky-core: workspace:*`、`astronomy-engine: ^2.1.19`）、`miniapp/tsconfig.json`（paths）、`miniapp/config/index.ts`（babel include）
- Test: 从 `git show dd7f5c5:miniapp/src/...` 恢复对应 `__tests__`（selected/city-pick/canvas-size/table-format/prefs/geolocation/ui-layout/status-bar），删除其中引用 GL 垫片的用例

**Interfaces:**
- Consumes: `@starry/sky-core/lib/tokens`、`@starry/sky-core/core/*`（StarChart/页面用）。
- Produces: `isWeapp()`、`getViewport()`、`nextFrame()`、`getCanvasRect(ref)`（web-env 非 GL 部分），Task 3 的 SkyCanvas3D 依赖它们。

- [ ] **Step 1: 依赖与配置**

`miniapp/package.json` dependencies 加：
```json
"@starry/sky-core": "workspace:*",
"astronomy-engine": "^2.1.19"
```
`miniapp/tsconfig.json` compilerOptions 加：
```json
"baseUrl": ".",
"paths": { "@starry/sky-core/*": ["../packages/sky-core/src/*"] }
```
`miniapp/config/index.ts` webpackChain 加（唯一非标配置，注明用途）：
```ts
// 共享源码包：让 webpack 处理 workspace 内 sky-core 的 TS 源码
chain.module.rule('script').include.add(path.resolve(__dirname, '..', '..', 'packages', 'sky-core', 'src'));
```
执行 `pnpm install`（miniapp 目录内）。

- [ ] **Step 2: 平移胶水层并改 import**

对每个文件：`git show dd7f5c5:miniapp/src/<path> > miniapp/src/<path>`，然后统一改写 import：
```bash
MOVED='dome|drawlist|track|names|project|sky-html3d|tokens|cities'
grep -rl "src/\(lib\|core\)\|'\.\./\.\./\.\./\.\./src" miniapp/src | xargs sed -i '' -E \
  -e "s|'\.\./\.\./\.\./\.\./src/lib/($MOVED)'|'@starry/sky-core/lib/\1'|g" \
  -e "s|'\.\./\.\./\.\./\.\./src/core/?|'@starry/sky-core/core|g"
```
注意：`ViewParams` 类型旧代码从 `../../../../src/components/SettingsDialog` 导入——改为在 `miniapp/src/shared/view-params.ts` 就地声明（从 `git show dd7f5c5:src/components/SettingsDialog.tsx` 拷贝 `ViewParams` 接口与 `validateView`/`toLocalInput` 纯函数，**不带 JSX**），胶水层改从该文件导入。

- [ ] **Step 3: 平移对应测试**

同样方式恢复各 `__tests__/*.test.ts`，import 按上式改写；`web-env.test.ts` 中 shimGLCanvas/makeOffscreen 相关用例删除。

- [ ] **Step 4: 验证**

Run: `pnpm test`（根目录）
Expected: 平移的测试全绿，无 import 报错。

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(miniapp): 接入 @starry/sky-core，平移胶水层与测试"
```

### Task 3: `SkyCanvas3D` 组件（canvas 2d，与 web 同源，TDD）

**Files:**
- Create: `miniapp/src/components/sky3d-math.ts`（从 `git show dd7f5c5:miniapp/src/components/sky3d-math.ts` 原样恢复，纯函数无 three）、`miniapp/src/components/SkyCanvas3D.tsx`
- Test: `miniapp/src/components/__tests__/sky3d-math.test.ts`（恢复原测试）、`miniapp/src/components/__tests__/sky-canvas3d.test.ts`（新增）

**Interfaces:**
- Consumes: `drawSkyScene(ctx, { w, h, cam, stars, track })`（sky-core，返回 `Map<id, {x,y}>`）、`isTapGesture`/`touchDist` 等（sky3d-math）、`getCanvasRect`/`nextFrame`（web-env）、`StarTooltip`。
- Produces: `<SkyCanvas3D stars track selectedId onSelect/>`（props 与 web `Sky3DProps` 一致），容器 `data-testid="skydome-3d"`。

- [ ] **Step 1: 恢复手势纯函数与其测试**

`git show dd7f5c5:miniapp/src/components/sky3d-math.ts` 与 `__tests__/sky3d-math.test.ts`（含 pick 容差/命中半径用例）原样恢复；旧 `sky3d-scene.ts` 与其测试**不恢复**（场景数据已被 `drawSkyScene` 取代）。Run `pnpm vitest run miniapp/src/components/__tests__/sky3d-math.test.ts`，Expected: PASS（纯搬迁）。

- [ ] **Step 2: 写组件失败测试**

```tsx
// miniapp/src/components/__tests__/sky-canvas3d.test.tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { SkyCanvas3D } from '../SkyCanvas3D';

afterEach(cleanup);

const star = (id: string, az: number, alt: number) =>
  ({ id, name: id, x: 0, y: 0, rPx: 3, color: '#fff', label: false, az, alt, mag: 1 });

describe('SkyCanvas3D', () => {
  it('渲染 canvas 容器', () => {
    render(<SkyCanvas3D stars={[star('s1', 180, 25)]} track={null} selectedId={null} onSelect={vi.fn()} />);
    expect(screen.getByTestId('skydome-3d')).toBeTruthy();
  });
  it('选中星显示 tooltip', () => {
    render(<SkyCanvas3D stars={[star('s1', 180, 25)]} track={null} selectedId="s1" onSelect={vi.fn()} />);
    expect(screen.getByTestId('selected-tooltip')).toBeTruthy();
  });
});
```

Run: `pnpm vitest run miniapp/src/components/__tests__/sky-canvas3d.test.tsx`，Expected: FAIL（组件不存在）。

- [ ] **Step 3: 实现组件**

`miniapp/src/components/SkyCanvas3D.tsx` 要点（绘制与 `src/components/SkyHtml3D.tsx` 同源，经 `drawSkyScene`）：

```tsx
import { useEffect, useRef, useState } from 'react';
import Taro from '@tarojs/taro';
import { Canvas } from '@tarojs/components';
import { drawSkyScene } from '@starry/sky-core/lib/sky-scene';
import type { DrawStar } from '@starry/sky-core/lib/drawlist';
import type { StarTrack } from '@starry/sky-core/lib/track';
import { StarTooltip } from './StarTooltip';
import { isTapGesture, dragDeltaToYawPitch, pinchDistToFov, pickBestStarIndex } from './sky3d-math';
import { getCanvasRect, nextFrame } from '../web-env';

export interface Sky3DProps {
  stars: DrawStar[]; track: StarTrack | null; selectedId: string | null;
  onSelect?: (id: string | null) => void;
}

export function SkyCanvas3D({ stars, track, selectedId, onSelect }: Sky3DProps) {
  const camRef = useRef({ yaw: Math.PI, pitch: (25 * Math.PI) / 180, fov: 65 });
  const posRef = useRef(new Map<string, { x: number; y: number }>());
  const [, force] = useState(0);
  // refs 保最新 props，触摸事件闭包读取
  const dataRef = useRef({ stars, track, selectedId, onSelect });
  dataRef.current = { stars, track, selectedId, onSelect };

  const redraw = (canvas: HTMLCanvasElement, w: number, h: number) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    posRef.current = drawSkyScene(ctx, { w, h, cam: camRef.current, stars: dataRef.current.stars, track: dataRef.current.track });
    force((n) => n + 1);
  };

  useEffect(() => {
    let alive = true;
    // 延迟到节点挂载后取 canvas node 与 rect（weapp 必须 selectorQuery）
    const query = Taro.createSelectorQuery();
    query.select('#sky3d-canvas').node().boundingClientRect();
    query.exec((res) => {
      if (!alive || !res?.[0]?.node || !res[1]) return;
      const canvas = res[0].node as HTMLCanvasElement;
      const rect = res[1] as { width: number; height: number };
      const dpr = Math.min(2, (typeof window !== 'undefined' ? window.devicePixelRatio : 1) || 1);
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style!.width = `${rect.width}px`;
      canvas.style!.height = `${rect.height}px`;
      const ctx = canvas.getContext('2d')!;
      ctx.scale(dpr, dpr);
      redraw(canvas, rect.width, rect.height);
    });
    return () => { alive = false; };
  }, []);

  // 手势：touchstart/move/end 合成拖拽/pinch/tap（系数与 web 一致，见 sky3d-math）
  const touchRef = useRef<{ x: number; y: number; dist: number } | null>(null);
  const onTouchStart = (e) => { /* 记录单指坐标或双指间距，用 touchDist */ };
  const onTouchMove = (e) => {
    /* 单指: dragDeltaToYawPitch 得 dyaw/dpitch 累加进 camRef；双指: pinchDistToFov 改 fov；
       末尾 nextFrame(() => redraw(...)) 兜底无 rAF 环境 */
  };
  const onTouchEnd = (e) => {
    /* isTapGesture 判定 tap → pickBestStarIndex(坐标表, stars, 22) → onSelect(id|null) */
  };

  const selected = dataRef.current.stars.find((s) => s.id === selectedId);
  const selPos = selected ? posRef.current.get(selectedId!) : undefined;
  return (
    <view style={{ position: 'relative', width: '100%', height: '100%' }} data-testid="skydome-3d">
      <Canvas type="2d" id="sky3d-canvas" style={{ width: '100%', height: '100%' }}
        onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd} />
      {selected && selPos && (
        <view data-testid="selected-tooltip" style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
          <StarTooltip star={selected} x={selPos.x} y={selPos.y} />
        </view>
      )}
    </view>
  );
}
```

注：`onTouchStart/Move/End` 三个处理器的完整实现以旧 `Sky3DAdapter.tsx`（`git show dd7f5c5:miniapp/src/components/Sky3DAdapter.tsx`）的手势状态机为蓝本，但**只调用 `sky3d-math` 纯函数 + `drawSkyScene` 重绘，不出现任何 three/UMD 引用**。`view`/`Canvas` 为 Taro 组件，页面需 `.config.ts` 无特殊配置。

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm vitest run miniapp/src/components/__tests__/`
Expected: sky3d-math + sky-canvas3d 全 PASS（jsdom 下 Canvas 事件不触发，渲染壳测试为准）。

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(miniapp): SkyCanvas3D canvas2d 组件，绘制与 web 同源"
```

### Task 4: 三页接线 + 体积门禁 + 验收

**Files:**
- Modify: `miniapp/src/pages/index/`（替换模板：从 `git show dd7f5c5:miniapp/src/pages/index/index.tsx` 恢复结构，3D 档渲染改 `<SkyCanvas3D/>`，删除 `Sky3DAdapter`/`Sky3D` import）、`pages/settings/`、`pages/table/`（同法恢复）、`miniapp/src/app.config.ts`（pages 列表：index/settings/table）
- Create: `miniapp/scripts/check-size.mjs`（从 `git show dd7f5c5:miniapp/scripts/check-size.mjs` 恢复，门禁 ≤2MB 不变）

**Interfaces:**
- Consumes: Task 3 `<SkyCanvas3D>`（props 同 `Sky3DProps`）。

- [ ] **Step 1: 恢复三页并接线**

三页文件从 `git show dd7f5c5:miniapp/src/pages/...` 恢复（index.tsx + 各 `index.config.ts`）；`pages/index/index.tsx` 中：
```diff
-<Sky3DAdapter ... />（three/weapp 分支）
-<Sky3D ... />（H5 分支）
+<SkyCanvas3D stars={...} track={...} selectedId={...} onSelect={...} />
```
视图切换只留 `'2d' | '3d'` 两档，`ViewParams` 类型从 `shared/view-params` 导入。

- [ ] **Step 2: 全量测试**

Run: `pnpm test`
Expected: 全绿（web 339−8 + miniapp 平移与新增用例）。

- [ ] **Step 3: 构建 + 体积门禁**

```bash
cd miniapp && pnpm build:weapp && node scripts/check-size.mjs
```
Expected: 构建成功；门禁通过且显著小于旧 124K（无 three、无 vendor）。

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat(miniapp): 三页功能完整接线，weapp 构建与体积门禁通过"
```

- [ ] **Step 5: 用户真机验收（不阻塞合并）**

微信开发者工具导入 `miniapp/dist`，预览：3D 拖拽/pinch/tap 点选/tooltip、2D 星图、设置页、数据表。帧率或手势问题转后续小步修复。

## Self-Review

- Spec 覆盖：设计一（workspace 包）→ Plan A Task 1；设计二（web 删 three/迁移/两档）→ Plan A Task 2-4；设计三（脚手架/三页平移/SkyCanvas3D/删除链/测试/体积门禁/真机验收）→ 本计划 Task 1-4。无缺口。
- 占位符扫描：手势处理器与页面接线给出了确切来源（git show 基线 + 明确 diff），无 TBD。
- 类型一致：`Sky3DProps` 四字段与 web 一致；`drawSkyScene` 签名与 Plan A Task 3 相同；`view-params` 声明点唯一。
