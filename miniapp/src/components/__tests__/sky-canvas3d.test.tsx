// @vitest-environment jsdom
// jsdom 下 Taro Canvas 不能真正绘制：组件测试以「渲染壳 + props 透传 + 选中 tooltip
// 出现/消失」为准；绘制正确性由 @starry/sky-core lib/sky-scene 单测兜底。
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { SkyCanvas3D } from '../SkyCanvas3D';
import type { DrawStar } from '@starry/sky-core/lib/drawlist';

// jsdom 下 @tarojs/components 原生组件无法渲染，mock 成宿主标签（同 sky3d-math.test 方式）
vi.mock('@tarojs/components', () => ({ Canvas: 'canvas', View: 'div', Text: 'span' }));
vi.mock('@tarojs/taro', () => ({
  default: {
    createSelectorQuery: () => currentQueryFactory(),
    getWindowInfo: () => ({ windowWidth: 375, windowHeight: 667 }),
    getDeviceInfo: () => ({ pixelRatio: 2 }),
    getSystemInfoSync: () => ({ windowWidth: 375, windowHeight: 667, pixelRatio: 2 }),
  },
  createSelectorQuery: () => currentQueryFactory(),
  getWindowInfo: () => ({ windowWidth: 375, windowHeight: 667 }),
  getDeviceInfo: () => ({ pixelRatio: 2 }),
  getSystemInfoSync: () => ({ windowWidth: 375, windowHeight: 667, pixelRatio: 2 }),
}));
vi.mock('@starry/sky-core/lib/sky-scene', () => ({
  // jsdom 无法真正绘制：只验证组件消费投影表（tooltip 锚定/点选），绘制本体有独立单测
  drawSkyScene: vi.fn(() => new Map([['s1', { x: 100, y: 80 }]])),
}));

// 可切换的 query 工厂：默认就绪；重试用例换成「前 N 次 exec 未就绪」的实现
let currentQueryFactory: () => any = () => mockSelectorQuery();

afterEach(() => {
  cleanup();
  currentQueryFactory = () => mockSelectorQuery();
});

// web-env 按 TARO_ENV 判端：组件测试走 weapp 分支（selectorQuery 链路）
process.env.TARO_ENV = 'weapp';

function makeWeappCanvasNode() {
  // weapp 的 canvas 2d node 是原生节点：无 DOM .style（回归用例——曾因 node.style 未判空崩溃）
  return { width: 0, height: 0, getContext: () => ({ scale: () => {} }) };
}

/** 仿真实 selectorQuery 回调式 API：node(cb)/boundingClientRect(cb) 注册回调，exec() 触发。 */
function makeQueryApi(result: { node: any; rect: any }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const api: any = { nodeCb: null as any, rectCb: null as any };
  api.select = () => api;
  api.node = (cb: any) => { api.nodeCb = cb; return api; };
  api.boundingClientRect = (cb: any) => { api.rectCb = cb; return api; };
  api.exec = () => {
    api.nodeCb?.({ node: result.node });
    api.rectCb?.(result.rect);
  };
  return api;
}

function mockSelectorQuery() {
  return makeQueryApi({ node: makeWeappCanvasNode(), rect: { left: 0, top: 0, width: 375, height: 500 } });
}

/** 前 times 次 exec 返回 null node（真机 canvas 晚就绪场景），之后就绪。
 * 注意：组件每次重试都会重新 createSelectorQuery()——未就绪计数必须跨调用共享。 */
function makeNotReadyFactory(times: number) {
  let calls = 0;
  return () => {
    calls += 1;
    const ready = calls > times;
    return makeQueryApi({
      node: ready ? makeWeappCanvasNode() : null,
      rect: { left: 0, top: 0, width: 375, height: 500 },
    });
  };
}

const star = (id: string, az: number, alt: number): DrawStar =>
  ({ id, name: id, x: 0, y: 0, rPx: 3, color: '#fff', label: false, az, alt, mag: 1 } as unknown as DrawStar);

describe('SkyCanvas3D', () => {
  it('渲染 canvas 容器', () => {
    render(<SkyCanvas3D stars={[star('s1', 180, 25)]} track={null} selectedId={null} onSelect={vi.fn()} />);
    expect(screen.getByTestId('skydome-3d')).toBeTruthy();
  });
  it('weapp node 无 style 时初始化不崩溃（真机回归）', () => {
    expect(() =>
      render(<SkyCanvas3D stars={[star('s1', 180, 25)]} track={null} selectedId={null} onSelect={vi.fn()} />),
    ).not.toThrow();
  });
  it('node 未就绪时重试，就绪后完成绘制', async () => {
    currentQueryFactory = makeNotReadyFactory(2);
    const { drawSkyScene } = await import('@starry/sky-core/lib/sky-scene');
    render(<SkyCanvas3D stars={[star('s1', 180, 25)]} track={null} selectedId={null} onSelect={vi.fn()} />);
    await new Promise((r) => setTimeout(r, 700));
    expect(drawSkyScene).toHaveBeenCalled();
  });
  it('初始化后 Canvas 元素为显式 px 尺寸（100% 会退回默认 300×150 致黑屏）', async () => {
    const { container } = render(<SkyCanvas3D stars={[star('s1', 180, 25)]} track={null} selectedId={null} onSelect={vi.fn()} />);
    const canvas = container.querySelector('canvas');
    await vi.waitFor(() => {
      expect(canvas?.getAttribute('style')).toContain('width: 375px');
      expect(canvas?.getAttribute('style')).toContain('height: 667px');
    });
  });
  it('选中星显示 tooltip', async () => {
    render(<SkyCanvas3D stars={[star('s1', 180, 25)]} track={null} selectedId="s1" onSelect={vi.fn()} />);
    // 初始化经 promise 链（getGLCanvasNode → getCanvasRect → redraw），等微任务落地
    await screen.findByTestId('selected-tooltip');
    expect(true).toBe(true);
  });
});
