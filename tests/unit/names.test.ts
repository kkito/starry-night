import { describe, it, expect } from 'vitest';
import { zhName } from '../../src/lib/names';
import { loadCatalog } from '../../src/core/catalog';

describe('zhName（西文名 → IAU 中文译名）', () => {
  it('知名恒星', () => {
    expect(zhName('Sirius')).toBe('天狼');
    expect(zhName('Vega')).toBe('织女一');
    expect(zhName('Polaris')).toBe('勾陈一');
    expect(zhName('Betelgeuse')).toBe('参宿四');
    expect(zhName('Alpheratz')).toBe('壁宿二');
  });
  it('未知/缺失名回退 undefined', () => {
    expect(zhName('Not A Star')).toBeUndefined();
    expect(zhName(undefined)).toBeUndefined();
  });
  it('星表中有专名的恒星覆盖率 > 60%', () => {
    const named = loadCatalog().filter((s) => s.name !== undefined);
    const covered = named.filter((s) => zhName(s.name) !== undefined);
    expect(named.length).toBeGreaterThan(400);
    expect(covered.length / named.length).toBeGreaterThan(0.6);
  });
});
