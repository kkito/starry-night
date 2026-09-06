// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { drawSky } from '../../src/components/StarChart';
import { StarChart } from '../../src/components/StarChart';
import { buildDrawList, type StarWithBv } from '../../src/lib/drawlist';
import { makeMockCtx, installCanvasMock, type RecordedCall } from './helpers';

const star = (over: Partial<StarWithBv>): StarWithBv => ({ id: 's', ra: 0, dec: 0, az: 0, alt: 90, mag: 0, ...over });

beforeAll(() => {
  const { ctx } = makeMockCtx();
  installCanvasMock({ ctx });
});

describe('drawSky（椭圆投影）', () => {
  const { calls, ctx } = makeMockCtx();
  // 正方形视口 560×560：rx=ry=270，便于沿用数值断言
  const stars = buildDrawList([star({ name: 'Vega', az: 0, alt: 45, mag: 0, bv: 0 })], 270, 270);
  drawSky(ctx, { width: 560, height: 560, stars });

  it('画地面矩形、天空椭圆、三条高度环', () => {
    expect(calls.some((c) => c.method === 'fillRect')).toBe(true);
    const ellipses = calls.filter((c) => c.method === 'ellipse') as (RecordedCall & { args: number[] })[];
    const rxs = ellipses.map((e) => e.args[2]!);
    expect(rxs).toContain(270);           // 地平线
    expect(rxs).toContain(180);           // alt=30
    expect(rxs).toContain(90);            // alt=60
    // 椭圆第二半径 = ry
    const horizon = ellipses.find((e) => e.args[2] === 270)!;
    expect(horizon.args[3]).toBe(270);
  });

  it('标注 N/E/S/W 与高度刻度', () => {
    const texts = calls.filter((c) => c.method === 'fillText').map((c) => c.args[0]);
    for (const t of ['北', '东', '南', '西', '0°', '30°', '60°']) expect(texts).toContain(t);
  });

  it('星点圆心 = projectAltAz 输出 + 中心偏移', () => {
    const arcs = calls.filter((c) => c.method === 'arc') as (RecordedCall & { args: number[] })[];
    // Vega alt=45 az=0, rx=ry=270 → 相对 (0,-135)，中心 (280,280)
    expect(arcs.some((a) => Math.abs(a.args[0]! - 280) < 1e-6 && Math.abs(a.args[1]! - 145) < 1e-6)).toBe(true);
  });

  it('亮星名被绘制', () => {
    expect(calls.some((c) => c.method === 'fillText' && c.args[0] === 'Vega')).toBe(true);
  });

  it('非正方形视口：环用椭圆半径', () => {
    const { calls: c2, ctx: ctx2 } = makeMockCtx();
    drawSky(ctx2, { width: 400, height: 800, stars: [] });
    const ellipses = c2.filter((c) => c.method === 'ellipse') as (RecordedCall & { args: number[] })[];
    const horizon = ellipses.find((e) => e.args[2] === 190)!; // rx = 200-10
    expect(horizon.args[3]).toBe(390);                        // ry = 400-10
  });
});

afterEach(cleanup);

describe('StarChart 悬停', () => {
  it('鼠标移到星点附近显示 tooltip', () => {
    const stars = buildDrawList([star({ id: 'zenith', name: 'Zenith Star', alt: 90, mag: 0 })], 270, 270);
    render(<StarChart stars={stars} width={560} height={560} />);
    const canvas = screen.getByTestId('star-canvas');
    fireEvent.mouseMove(canvas, { clientX: 280, clientY: 280 }); // 天顶 = 画布中心
    expect(screen.getByTestId('star-tooltip')).toBeTruthy();
    expect(screen.getByText('Zenith Star')).toBeTruthy();
  });

  it('移开（onMouseLeave）后 tooltip 消失', () => {
    const stars = buildDrawList([star({ id: 'z', alt: 90, mag: 0 })], 270, 270);
    render(<StarChart stars={stars} width={560} height={560} />);
    const canvas = screen.getByTestId('star-canvas');
    fireEvent.mouseMove(canvas, { clientX: 280, clientY: 280 });
    fireEvent.mouseLeave(canvas);
    expect(screen.queryByTestId('star-tooltip')).toBeNull();
  });
});

describe('太阳系天体渲染', () => {
  const solarBody = (over: Record<string, unknown>): StarWithBv =>
    star({ id: 'mars', name: '火星', az: 0, alt: 45, mag: 1, ...over } as never) as never;

  it('太阳系天体画外圈描边 + 名称', () => {
    const { calls, ctx } = makeMockCtx();
    drawSky(ctx, { width: 560, height: 560, stars: [{ ...buildDrawList([solarBody({})], 270, 270)[0]!, solar: true }] });
    expect(calls.some((c) => c.method === 'stroke')).toBe(true);
    expect(calls.some((c) => c.method === 'fillText' && c.args[0] === '火星')).toBe(true);
  });

  it('太阳系天体始终显示名称（不看星等门槛）', () => {
    const { calls, ctx } = makeMockCtx();
    const d = { ...buildDrawList([solarBody({ id: 'moon', name: '月亮', mag: -9 })], 270, 270)[0]!, solar: true } as never;
    drawSky(ctx, { width: 560, height: 560, stars: [d] });
    expect(calls.some((c) => c.method === 'fillText' && c.args[0] === '月亮')).toBe(true);
  });

  it('悬停太阳系天体显示含距离与月相的 tooltip', () => {
    const d = { ...buildDrawList([solarBody({ id: 'moon', name: '月亮', mag: -9, alt: 90 })], 270, 270)[0]!, solar: true, distAu: 0.0024 } as never;
    render(<StarChart stars={[d]} width={560} height={560} />);
    const canvas = screen.getByTestId('star-canvas');
    fireEvent.mouseMove(canvas, { clientX: 280, clientY: 280 });
    expect(screen.getByText('月亮')).toBeTruthy();
    expect(screen.getByText(/AU/)).toBeTruthy();
  });
});
