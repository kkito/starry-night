import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { dragDeltaToYawPitch } from '../components/sky3d-math';

const read = (p: string) => fs.readFileSync(path.resolve(__dirname, p), 'utf8');

describe('布局需求（RED：先锁定 5 点）', () => {
  it('1. 顶栏单行：无“星空”标题，设置/星表靠左、2D/3D 靠右', () => {
    const page = read('../pages/index/index.tsx');
    expect(page).not.toContain("title='星空'");
    expect(page).not.toContain('title="星空"');
    // ViewModeSwitch 与左右入口同处顶栏一行
    const start = page.indexOf('<TopBar');
    const end = page.indexOf("data-testid='viewport'");
    const topbarBlock = page.slice(start, end);
    expect(topbarBlock).toContain('ViewModeSwitch');
    expect(topbarBlock).toContain('open-settings');
    expect(topbarBlock).toContain('open-table');
    // ui.tsx 的 TopBar 支持 left + right（不再是 title + right）
    const ui = read('../components/ui.tsx');
    expect(ui).toContain('left');
  });

  it('2. 底部状态栏吸底', () => {
    const ui = read('../components/ui.tsx');
    // sticky 吸底 + 置底
    expect(ui).toMatch(/position:\s*'sticky'/);
    expect(ui).toMatch(/bottom:\s*0/);
  });

  it('3. 状态栏字体对齐友好：等宽数字 + 单行不换行 + N/S/E/W', () => {
    const ui = read('../components/ui.tsx');
    expect(ui).toContain('tabular-nums');
    expect(ui).toContain("whiteSpace: 'nowrap'");
    const page = read('../pages/index/index.tsx');
    expect(page).toMatch(/[NSEW]/);
  });

  it('4. 中间视口固定高度（flex + overflow hidden + minHeight 0）', () => {
    const page = read('../pages/index/index.tsx');
    expect(page).toContain("data-testid='viewport'");
    expect(page).toMatch(/overflow:\s*'hidden'/);
    expect(page).toMatch(/minHeight:\s*0/);
  });

  it('5. 3D 地平线下最多留 5%：pitch 下限随 fov（不再是 -0.05）', async () => {
    const math = read('../components/sky3d-math.ts');
    expect(math).toContain('clampPitch');
    // fov 65° 下限 ≈ 0.9 * 半视场 ≈ 0.51 rad
    const m = await import('../components/sky3d-math');
    expect(m.clampPitch(0, 65)).toBeCloseTo(0.9 * ((65 * Math.PI) / 180 / 2), 6);
    expect(m.clampPitch(-0.05, 65)).toBeGreaterThan(0.4);
    expect(dragDeltaToYawPitch(0, -10000, 0, 0.5, 65).pitch).toBeGreaterThan(0.4);
  });
});
