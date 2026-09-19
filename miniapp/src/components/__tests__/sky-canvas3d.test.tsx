// @vitest-environment jsdom
// jsdom 下 Taro Canvas 不能真正绘制：组件测试以「渲染壳 + props 透传 + 选中 tooltip
// 出现/消失」为准；绘制正确性由 @starry/sky-core lib/sky-scene 单测兜底。
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { SkyCanvas3D } from '../SkyCanvas3D';
import type { DrawStar } from '@starry/sky-core/lib/drawlist';

afterEach(cleanup);

// jsdom 下 @tarojs/components 原生组件无法渲染，mock 成宿主标签（同 sky3d-math.test 方式）
vi.mock('@tarojs/components', () => ({ Canvas: 'canvas', View: 'div', Text: 'span' }));
vi.mock('@tarojs/taro', () => ({
  default: { createSelectorQuery: mockSelectorQuery },
  createSelectorQuery: mockSelectorQuery,
}));
vi.mock('@starry/sky-core/lib/sky-scene', () => ({
  // jsdom 无法真正绘制：只验证组件消费投影表（tooltip 锚定/点选），绘制本体有独立单测
  drawSkyScene: vi.fn(() => new Map([['s1', { x: 100, y: 80 }]])),
}));

function mockSelectorQuery() {
  const api: any = {
    select: () => api,
    node: () => api,
    boundingClientRect: () => api,
    exec: (cb: (res: any[]) => void) => {
      cb([
        { node: { width: 0, height: 0, style: {}, getContext: () => ({ scale: () => {} }) } },
        { left: 0, top: 0, width: 375, height: 500 },
      ]);
    },
  };
  return api;
}

const star = (id: string, az: number, alt: number): DrawStar =>
  ({ id, name: id, x: 0, y: 0, rPx: 3, color: '#fff', label: false, az, alt, mag: 1 } as unknown as DrawStar);

describe('SkyCanvas3D', () => {
  it('渲染 canvas 容器', () => {
    render(<SkyCanvas3D stars={[star('s1', 180, 25)]} track={null} selectedId={null} onSelect={vi.fn()} />);
    expect(screen.getByTestId('skydome-3d')).toBeTruthy();
  });
  it('选中星显示 tooltip', () => {
    render(<SkyCanvas3D stars={[star('s1', 180, 25)]} track={null} selectedId="s1" onSelect={vi.fn()} />);
    expect(screen.getByTestId('selected-tooltip')).toBeTruthy();
  });
});
