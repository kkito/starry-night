// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { Sky3D } from '../../src/components/Sky3D';

afterEach(cleanup);

const SRC = fs.readFileSync(path.resolve(__dirname, '../../src/components/Sky3D.tsx'), 'utf-8');

function mockStars() {
  return [
    { id: 's1', name: 'S1', mag: 1, az: 90, alt: 30, rPx: 4, color: '#fff', x: 0, y: 0 },
    { id: 's2', name: 'S2', mag: 2, az: 180, alt: 45, rPx: 3, color: '#fff', x: 0, y: 0 },
  ] as never;
}

describe('Sky3D fixes RED', () => {
  it('1. 窗户保持方形：窗户 PointsMaterial 不应带圆形贴图（当前实现窗户用了 starTex，应失败）', () => {
    // 窗户那一行现在是: new THREE.Points(winG, new THREE.PointsMaterial({ map: starTex, color: 0xffdc78 ...
    // 期望：窗户材质不应有 map，星点才用
    const winLine = SRC.split('\n').find((l) => l.includes('0xffdc78')) ?? '';
    expect(winLine, '应找到窗户 PointsMaterial 行').toContain('PointsMaterial');
    expect(winLine.includes('map: starTex') || winLine.includes('map:starTex'), '窗户不应带圆形贴图 map: starTex（保持方形）').toBe(false);
  });

  it('2. 手机端可拖动：容器需 touch-action: none（当前未设，应失败）', () => {
    // 源码必须包含 touchAction（容器 + canvas 均设为 none，防止手机端被浏览器手势拦截）
    expect(SRC.includes('touchAction') || SRC.includes('touch-action'), '源码应包含 touchAction 处理').toBe(true);
    expect(SRC.includes("touchAction: 'none'") || SRC.includes('touchAction: "none"'), '应显式设为 none').toBe(true);
    // jsdom 无 WebGL 时走 fallback，不渲染 skydome；有 WebGL 时需校验 DOM
    const { container } = render(<Sky3D stars={mockStars()} track={null} selectedId={null} />);
    const skydome = container.querySelector('[data-testid="skydome"]') as HTMLElement | null;
    if (skydome) {
      const hasTouchNone = skydome.style.touchAction === 'none' || skydome.getAttribute('style')?.includes('touch-action');
      expect(hasTouchNone, 'skydome 应设 touch-action: none 以防手机端被浏览器手势拦截').toBe(true);
    }
  });

  it('3. 地平线贴近底部 5%：初始仰角约 25°（当前 8°，应失败）', () => {
    // 当前：camRef = { yaw: ..., pitch: (8 * Math.PI)/180 }
    // 期望：约 25°，让地平线压到视口底部 ~5%
    const hasPitch25 = SRC.includes('pitch: (25') || SRC.includes('pitch: ( 25') || /pitch[^;]*25\s*\*\s*Math\.PI/.test(SRC);
    expect(hasPitch25, '初始 pitch 应改为约 25°，使地平线离底部约 5%').toBe(true);
    const hasPitch8 = /pitch:\s*\(8\s*\*\s*Math\.PI/.test(SRC);
    expect(hasPitch8, '不应再是 8° 的初始 pitch').toBe(false);
  });

  it('4. 经线/纬线与仰角标注：仰角圈应有度数标签（当前仅有东南西北，应失败）', () => {
    // 经线 = 方位线（az 每 30°），纬线 = 仰角圈（alt 10/20/30/45/60）
    // 当前仅有 4 个方位标签：北/东/南/西；期望额外为每个 ALT_RINGS 标注 "10°" 等
    // 检查源码是否对 ALT_RINGS 每个值创建了带 "°" 的标签
    const hasAltLabel = SRC.includes('°') && (SRC.includes('ALT_RINGS') && SRC.includes('directionLabel'));
    // 更严格：应出现对每个 alt 值生成标签的逻辑，例如 ALT_RINGS.forEach 内调 directionLabel 或类似
    const altLabelPattern = /ALT_RINGS.*directionLabel|for.*alt.*directionLabel|10.*°|20.*°/s;
    expect(altLabelPattern.test(SRC), '应为仰角圈（纬线）添加度数标签，如 10°/20°/30°/45°/60°').toBe(true);
  });
});
