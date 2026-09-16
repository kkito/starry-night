import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const read = (p: string) => fs.readFileSync(path.resolve(__dirname, p), 'utf8');

describe('weapp 包体积（RED）', () => {
  it('weapp 构建不打包 npm three：mini.webpackChain 把 three alias 到 stub', () => {
    // 背景：index.tsx 同时 import H5 版 Sky3D（npm three）与 Sky3DWeapp（外置 vendor），
    // webpack 把 npm three（~600KB）整个打进 dist/pages/index/index.js（593 KiB告警），
    // 而 weapp 运行时只走 adapter，npm three 是死代码。
    // 修法：仅 mini（weapp）构建把 three 指到空 stub；H5 构建保持真 three。
    const cfg = read('../../config/index.ts');
    expect(cfg).toContain('three-stub');
    expect(cfg).toMatch(/alias\.set\(['"]three['"]/);
    expect(fs.existsSync(path.resolve(__dirname, '../../three-stub.js'))).toBe(true);
  });

  it('stub 用 ESM 具名 export：Sky3D.tsx 走 import * as THREE，CJS 会刷屏 ModuleDependencyWarning', () => {
    // 教训：CJS 的 module.exports 被 webpack 判为 module has no exports，
    // 每个 THREE.X 都报 export 'X' was not found in 'three'。ESM 具名导出则静态可链，构建干净。
    const stub = read('../../three-stub.js');
    expect(stub).not.toContain('module.exports');
    for (const name of ['Scene', 'PerspectiveCamera', 'WebGLRenderer', 'Vector2', 'Vector3', 'Color', 'Group', 'Mesh', 'Points', 'PointsMaterial', 'BufferGeometry', 'Raycaster', 'BackSide', 'Object3D']) {
      expect(stub).toContain(`export const ${name}`);
    }
  });

  it('开启 webpack 持久化缓存：构建不再提示开启持久化缓存，二次编译走 filesystem 缓存', () => {
    // 背景：taro build 每次都提示"建议开启持久化缓存功能"（见 webpack5-runner BaseConfig：
    // 仅当 config.cache.enable 为真才配 filesystem 缓存）。修法：顶层加 cache.enable。
    const cfg = read('../../config/index.ts');
    expect(cfg).toMatch(/cache:\s*\{\s*\n?\s*enable:\s*true/);
  });
});
