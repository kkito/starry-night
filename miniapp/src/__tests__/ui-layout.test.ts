import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const read = (p: string) => fs.readFileSync(path.resolve(__dirname, p), 'utf8');

describe('miniapp UI 梳理（tokens 对齐 + testid 不破）', () => {
  it('基础组件存在且复用仓根 tokens', () => {
    const ui = read('../components/ui.tsx');
    expect(ui).toContain("from '../../../src/lib/tokens'");
    expect(ui).toContain('COLORS');
    for (const name of ['Page', 'Section', 'FieldRow', 'TopBar', 'NavLink', 'StatusBar']) {
      expect(ui, name).toContain(`export function ${name}`);
    }
  });
  it('主页用 TopBar + StatusBar（导航三页跳转不变）', () => {
    const page = read('../pages/index/index.tsx');
    expect(page).toContain('TopBar');
    expect(page).toContain('StatusBar');
    expect(page).toContain('NavLink');
    expect(page).toContain("url: '/pages/settings/index'");
    expect(page).toContain("url: '/pages/table/index'");
  });
  it('既有 data-testid 全部保留', () => {
    const index = read('../pages/index/index.tsx');
    // summary / viewmode-switch testid 分别收进 StatusBar / ViewModeSwitch 组件，主页只断言组件装配
    for (const id of ['open-settings', 'open-table', 'StatusBar', 'ViewModeSwitch']) {
      expect(index, id).toContain(id);
    }
    expect(read('../components/ui.tsx')).toContain("data-testid='summary'");
    expect(read('../components/ViewModeSwitch.tsx')).toContain("data-testid='viewmode-switch'");
    const settings = read('../pages/settings/index.tsx');
    for (const id of ['city', 'locate', 'lat', 'lon', 'show-solar', 'mirror']) {
      expect(settings, id).toContain(id);
    }
    const table = read('../pages/table/index.tsx');
    expect(table).toContain('filter');
  });
  it('深色导航栏（对齐星空底色）', () => {
    const cfg = read('../app.config.ts');
    expect(cfg).toContain('#0d1220');
    expect(cfg).toContain("'starry-night'");
  });
});
