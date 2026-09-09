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
  it('weapp 3D 修复回归：canvas type=webgl + gl 垫片 + three 版本钉死 + vendor 跳过 babel', () => {
    // Invalid context type [webgl]：Canvas type 曾为 '2d'，小程序拿不到 webgl 上下文。
    const sky3d = fs.readFileSync(path.resolve(__dirname, '../components/Sky3D.tsx'), 'utf8');
    expect(sky3d).toContain("type='webgl'");
    // Error creating WebGL context：小程序 getContext 对 webgl2 直接抛异常（非 null），
    // three 的 webgl2→webgl 回退链第一步就炸——shimGLCanvas 把抛异常包成 null 让回退继续。
    expect(sky3d).toContain('shimGLCanvas(node)');
    // three>=0.159 只走 webgl2：钉死 0.158（最后一个带 webgl1 回退的版本）。
    const pkg = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../package.json'), 'utf8'));
    expect(pkg.dependencies.three).toBe('0.158.0');
    // helpers/typeof.js is not defined：vendor 进 babel 会被注入 transform-runtime 的
    // 绝对路径 require，noParse 又让 webpack 不解析——exclude 让 babel 碰都不碰。
    const cfg = fs.readFileSync(path.resolve(__dirname, '../../config/index.ts'), 'utf8');
    expect(cfg).toContain('vendorDir');
    expect(cfg).toMatch(/\.exclude\.add\(vendorDir\)/);
  });
  it('weapp adapter 外置 vendor：hidden require 加载，不打进 bundle', () => {
    // vendor UMD 写裸 exports，webpack scope-hoisting 内联后 import * 读不到
    // （Jp is not a function），必须 copy 原样到 dist + hidden require 运行时加载。
    const weapp = fs.readFileSync(path.resolve(__dirname, '../components/Sky3DAdapter.tsx'), 'utf8');
    expect(weapp).toContain('__non_webpack_require__');
    expect(weapp).toContain('./threejs-miniprogram.js');
    expect(weapp).not.toContain("from '../vendor/threejs-miniprogram'");
    // adapter 的 canvas 也要是 webgl（同 Invalid context type [webgl] 教训）。
    expect(weapp).toContain("type='webgl'");
    const cfg = fs.readFileSync(path.resolve(__dirname, '../../config/index.ts'), 'utf8');
    expect(cfg).toContain('copy-vendor-weapp');
    expect(fs.existsSync(path.resolve(__dirname, '../../scripts/copy-vendor-weapp.mjs'))).toBe(true);
  });
});
