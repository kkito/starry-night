import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const read = (p: string) => fs.readFileSync(path.resolve(__dirname, p), 'utf8');

describe('status bar + viewMode parity (Web App.tsx)', () => {
  it('主页 summary 与 Web 版状态栏对齐：坐标/时间/恒星时/可见星四格', () => {
    // summary 四格收进 StatusBar 组件（ui.tsx）：主页断言装配传参，ui 断言四格渲染
    const page = read('../pages/index/index.tsx');
    expect(page).toContain('StatusBar');
    for (const prop of ['coords=', 'time=', 'lst=', 'visible=']) {
      expect(page, prop).toContain(prop);
    }
    // LAST / Top 前缀由主页传入（与 Web 版 Readout value 对齐）
    expect(page).toContain('LAST');
    expect(page).toContain('Top ');
    const ui = read('../components/ui.tsx');
    expect(ui).toContain("data-testid='summary'");
    expect(ui).toContain('恒星时');
    expect(ui).toContain('可见星');
  });
  it('三页 DEFAULT_VIEW viewMode 一致为 3d（Web 版 App.tsx DEFAULT_VIEW）', () => {
    for (const p of ['../pages/index/index.tsx', '../pages/settings/index.tsx', '../pages/table/index.tsx']) {
      const src = read(p);
      expect(src, p).toContain("viewMode: '3d'");
      expect(src, p).not.toContain("viewMode: '2d'");
    }
  });
});
