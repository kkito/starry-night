# miniapp 包体预算（Task 8 实测）

实测方式：`cd miniapp && ./node_modules/.bin/taro build --type weapp` 后，
`node scripts/check-size.mjs`（断言主包 ≤ 2MB）+ 对构建产物的手工归因
（grep 关键字定位各依赖所在 chunk，按"开发者工具代码依赖分析"思路）。

## 总量（2026-09-08 实测）

- 主包：24 files，**1146.9KB / 2048KB（56%），余量 901.1KB → PASS**
- 分包：0 files（未配置分包）
- 门禁：`node miniapp/scripts/check-size.mjs`（默认 dir=miniapp/dist，limit=2MB）

## 主包构成（按文件）

| 文件 | 体积 | 主要内容（归因依据） |
|---|---|---|
| `pages/index/index.js` | 641.8KB | **three**（`WebGLRenderer`×38、`Quaternion`×24、`SphereGeometry`/`TorusGeometry`）+ astronomy-engine（`Observer`×7、phase/illumination）+ 中文名（`\u` 转义 8073 处）+ 首页业务 |
| `common.js` | 150.5KB | **catalog.json**（`magLimit`/`d3-celestial`/`raDeg`×1636、Sirius/Canopus/Betelgeuse 各 2 处）+ 共享 core/lib（`dpsi`×5、prefs 等） |
| `taro.js` | 118.8KB | **Taro 运行时** |
| `app.js` | 93.9KB | 应用入口 |
| `vendors.js` | 70.8KB | 第三方公共 chunk |
| `base.wxml` | 57.1KB | 模板 |
| `pages/settings/index.js` | 4.4KB | 设置页 |
| `pages/table/index.js` | 2.5KB | 星表页 |

## 各依赖占比（源体积 vs 产物归属）

| 依赖 | 源体积 | 在产物中的位置 | 产物内量级 |
|---|---|---|---|
| three | `three.module.js` 635KB / min 357KB | `pages/index/index.js`（641.8KB 的主体） | ~500KB+（最大头） |
| astronomy-engine | `astronomy.browser.js` 412KB / min 114KB / esm 412KB | `pages/index/index.js`（`Observer` 等） | ~100KB 量级 |
| catalog.json | 187KB（1627 星） | `common.js`（150.5KB 的主体） | ~100KB+（minify 后） |
| star_names_zh.json | 64KB（约 1900 条） | `pages/index/index.js`（`\u` 转义内联，经 `zhName` 引用） | ~60KB 量级 |
| Taro 运行时 | — | `taro.js` 118.8KB + `vendors.js` 70.8KB | ~190KB |

注：webpack 未输出 stats 文件，以上为关键字归因估算，非逐模块精确拆分；
`common.js` 被三页共享，settings/table 页自身仅 4.4/2.5KB。

## 分包决策：无需分包

- 主包 1146.9KB，仅用掉 2MB 上限的 56%，余量 901KB。
- 泄压阀（①星表 JSON 分包 ②astronomy-engine 裁剪 ③three 不动）**均不触发**，
  `miniapp/config/index.ts` 与 `app.config.ts` 保持三页全主包，不配 `subPackages`。
- 触发线：若后续主包 > 1700KB（余量 < 350KB），优先把 `catalog.json` 拆到分包
  （`loadCatalog` 改为分包内 `require`，table 页随之进分包）。

## 门禁脚本

`miniapp/scripts/check-size.mjs`：检查 `app.js`+`app.json` 存在（非 weapp 产物直接 FAIL），
统计主包（排除 `subpackages/**`）总字节 ≤ 2MB。发布前跑：

```sh
node miniapp/scripts/check-size.mjs
```
