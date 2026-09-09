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
  it('weapp 3D 走 adapter 分支（RED：Sky3DAdapter + vendor 产物存在）', () => {
    // 注：文件名不能叫 Sky3D.weapp.tsx——Taro 会把 .weapp 后缀当平台文件解析，
    // import '../../components/Sky3D' 时误命中它，导致 H5 版 Sky3D 导出丢失。
    expect(fs.existsSync(path.resolve(__dirname, '../components/Sky3DAdapter.tsx'))).toBe(true);
    expect(fs.existsSync(path.resolve(__dirname, '../vendor/threejs-miniprogram.js'))).toBe(true);
    const page = fs.readFileSync(path.resolve(__dirname, '../pages/index/index.tsx'), 'utf8');
    expect(page).toContain('Sky3DWeapp');
    expect(page).toContain('isWeapp()');
    const weapp = fs.readFileSync(path.resolve(__dirname, '../components/Sky3DAdapter.tsx'), 'utf8');
    expect(weapp).toContain('createScopedThreejs');
    // r108 兼容：不能出现新版 setAttribute 直调
    expect(weapp).not.toMatch(/g\.setAttribute\(/);
    expect(weapp).toMatch(/addAttribute/);
  });
  it('weapp adapter 外置 vendor：hidden require 加载，不打进 bundle', () => {
    // vendor UMD 写裸 exports，webpack scope hoisting 内联后 import * 读不到
    // （Jp is not a function），必须 copy 原样到 dist + __non_webpack_require__ 运行时加载。
    const weapp = fs.readFileSync(path.resolve(__dirname, '../components/Sky3DAdapter.tsx'), 'utf8');
    expect(weapp).toContain('__non_webpack_require__');
    expect(weapp).toContain('./threejs-miniprogram.js');
    expect(weapp).not.toContain("from '../vendor/threejs-miniprogram'");
    const cfg = fs.readFileSync(path.resolve(__dirname, '../../config/index.ts'), 'utf8');
    expect(cfg).toContain('copy-vendor-weapp');
    expect(fs.existsSync(path.resolve(__dirname, '../../scripts/copy-vendor-weapp.mjs'))).toBe(true);
  });
});
