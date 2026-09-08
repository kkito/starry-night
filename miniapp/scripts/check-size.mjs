#!/usr/bin/env node
/**
 * 主包体积门禁：断言微信小程序主包（miniapp/dist 的 weapp 构建产物）≤ 2MB。
 * 用法：node miniapp/scripts/check-size.mjs [--dir miniapp/dist] [--limit 2097152]
 *
 * 主包 = app.js + app.wxss + app.json + common*.js + vendors*.js + pages/**（不含 subpackages/**）。
 * 找不到 weapp 产物（未构建或目录结构不对）时直接 FAIL（exit 1）。
 */
import { readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';

const MAIN_LIMIT = 2 * 1024 * 1024; // 2MB（微信主包上限）

function parseArgs(argv) {
  const out = { dir: 'miniapp/dist', limit: MAIN_LIMIT };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--dir') out.dir = argv[++i];
    if (argv[i] === '--limit') out.limit = Number(argv[++i]);
  }
  return out;
}

function walk(dir, acc = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, acc);
    else if (e.isFile()) acc.push(p);
  }
  return acc;
}

function main() {
  const { dir, limit } = parseArgs(process.argv.slice(2));
  // weapp 构建产物指纹：app.js + app.json 缺一即视为"非 weapp 产物"
  if (!existsSync(join(dir, 'app.js')) || !existsSync(join(dir, 'app.json'))) {
    console.error(`[check-size] FAIL: ${dir} 下缺少 weapp 构建产物（app.js/app.json），请先跑 taro build --type weapp`);
    process.exit(1);
  }
  const files = walk(dir);
  const isSub = (f) => relative(dir, f).split(/[/\\]/)[0] === 'subpackages';
  const mainFiles = files.filter((f) => !isSub(f));
  const subFiles = files.filter((f) => isSub(f));
  const sizeOf = (fs) => fs.reduce((n, f) => n + statSync(f).size, 0);
  const mainBytes = sizeOf(mainFiles);
  const subBytes = sizeOf(subFiles);
  const fmt = (n) => `${(n / 1024).toFixed(1)}KB`;

  // Top contributors（主包内按文件从大到小前 8）
  const top = mainFiles
    .map((f) => ({ f: relative(dir, f), n: statSync(f).size }))
    .sort((a, b) => b.n - a.n)
    .slice(0, 8);

  console.log(`[check-size] dir=${dir} limit=${fmt(limit)}`);
  console.log(`[check-size] main: ${mainFiles.length} files, ${fmt(mainBytes)}`);
  for (const t of top) console.log(`[check-size]   ${fmt(t.n).padStart(10)}  ${t.f}`);
  console.log(`[check-size] subpackages: ${subFiles.length} files, ${fmt(subBytes)}`);

  if (mainBytes > limit) {
    console.error(`[check-size] FAIL: 主包 ${fmt(mainBytes)} 超过上限 ${fmt(limit)}（超 ${(mainBytes - limit) / 1024}KB）`);
    process.exit(1);
  }
  console.log(`[check-size] PASS: 主包 ${fmt(mainBytes)} ≤ ${fmt(limit)}，余量 ${fmt(limit - mainBytes)}`);
}

main();
