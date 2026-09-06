// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { loadViewPrefs, saveViewPrefs } from '../../src/lib/prefs';
import type { ViewParams } from '../../src/components/SettingsDialog';

// 与 App.tsx 的 DEFAULT_VIEW 保持一致
const base = (): ViewParams => ({ lat: 31.2304, lon: 121.4737, date: '2026-03-20T20:00', timeMode: 'live', topN: 50, aspect: 'auto', showSolar: true, mirror: false, shape: 'ellipse' });

beforeEach(() => localStorage.clear());

describe('view 偏好持久化', () => {
  it('保存后能恢复除时间外的全部参数', () => {
    saveViewPrefs({ ...base(), lat: 31.2304, lon: 121.4737, topN: 120, mirror: true });
    const restored = loadViewPrefs(base());
    expect(restored.lat).toBe(31.2304);
    expect(restored.lon).toBe(121.4737);
    expect(restored.topN).toBe(120);
    expect(restored.mirror).toBe(true);
  });

  it('时间不持久化，恢复时始终为当前时间', () => {
    saveViewPrefs({ ...base(), date: '2000-01-01T00:00' });
    const restored = loadViewPrefs(base());
    const saved = new Date(restored.date).getTime();
    expect(Math.abs(Date.now() - saved)).toBeLessThan(60_000);
  });

  it('无存储时回退默认值', () => {
    expect(loadViewPrefs(base())).toEqual(base());
  });

  it('存储数据非法时回退默认值', () => {
    localStorage.setItem('stardemo.view', '{"lat":999}');
    expect(loadViewPrefs(base())).toEqual(base());
    localStorage.setItem('stardemo.view', 'not json');
    expect(loadViewPrefs(base())).toEqual(base());
  });
});
