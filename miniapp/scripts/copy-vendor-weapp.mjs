// 构建后钩子：把官方 threejs-miniprogram UMD 原样拷到 dist/pages/index/。
// 背景：adapter factory 写裸 exports，进 webpack 会被 scope-hoisting 内联、
// import * 读不到 createScopedThreejs（Jp is not a function）；Taro copy 插件的 to
// 相对项目根，会误拷到 miniapp/pages/ 而非 dist/（module is not defined）。
// 用法：taro build --type weapp && node scripts/copy-vendor-weapp.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const src = path.join(root, 'src', 'vendor', 'threejs-miniprogram.js');
const dstDir = path.join(root, 'dist', 'pages', 'index');
const dst = path.join(dstDir, 'threejs-miniprogram.js');

fs.mkdirSync(dstDir, { recursive: true });
fs.copyFileSync(src, dst);
const same = fs.readFileSync(src, 'utf8') === fs.readFileSync(dst, 'utf8');
console.log(`[copy-vendor-weapp] ${src} -> ${dst} identical=${same}`);
if (!same) process.exit(1);
