import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const read = (p: string) => fs.readFileSync(path.resolve(__dirname, p), 'utf8');

describe('status bar + viewMode parity (Web App.tsx)', () => {
  it('主页 summary 与 Web 版状态栏对齐：坐标/时间/恒星时/可见星四格', () => {
    const page = read('../pages/index/index.tsx');
    expect(page).toContain('summary');
    // Web 版 SummaryCell 四格：坐标、时间、LAST 恒星时、Top 可见星
    expect(page).toContain('LAST');
    expect(page).toContain('Top ');
    expect(page).toMatch(/坐标|view\.lat/);
    expect(page).toMatch(/实时|timeMode/);
  });
  it('三页 DEFAULT_VIEW viewMode 一致为 3d（Web 版 App.tsx DEFAULT_VIEW）', () => {
    for (const p of ['../pages/index/index.tsx', '../pages/settings/index.tsx', '../pages/table/index.tsx']) {
      const src = read(p);
      expect(src, p).toContain("viewMode: '3d'");
      expect(src, p).not.toContain("viewMode: '2d'");
    }
  });
});
