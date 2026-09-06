// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { drawSky } from '../../src/components/StarChart';
import { StarChart } from '../../src/components/StarChart';
import { buildDrawList, type StarWithBv } from '../../src/lib/drawlist';
import { makeMockCtx, installCanvasMock, type RecordedCall } from './helpers';
import type { SkyStar } from '../../src/core/sky';

const star = (over: Partial<StarWithBv>): StarWithBv => ({ id: 's', ra: 0, dec: 0, az: 0, alt: 90, mag: 0, ...over });

beforeAll(() => {
  const { ctx } = makeMockCtx();
  installCanvasMock({ ctx });
});

describe('drawSky', () => {
  const { calls, ctx } = makeMockCtx();
  const stars = buildDrawList([star({ name: 'Vega', az: 0, alt: 45, mag: 0, bv: 0 })], 270);
  drawSky(ctx, { size: 560, stars });

  it('画地面矩形、天空圆、三条高度环', () => {
    expect(calls.some((c) => c.method === 'fillRect')).toBe(true);
    const arcs = calls.filter((c) => c.method === 'arc') as (RecordedCall & { args: number[] })[];
    const radii = arcs.map((a) => a.args[2]!);
    expect(radii).toContain(270);           // 地平线
    expect(radii).toContain(180);           // alt=30
    expect(radii).toContain(90);            // alt=60
  });

  it('标注 N/E/S/W 与高度刻度', () => {
    const texts = calls.filter((c) => c.method === 'fillText').map((c) => c.args[0]);
    for (const t of ['N', 'E', 'S', 'W', '0°', '30°', '60°']) expect(texts).toContain(t);
  });

  it('星点圆心 = projectAltAz 输出 + 圆心偏移', () => {
    const arcs = calls.filter((c) => c.method === 'arc') as (RecordedCall & { args: number[] })[];
    // Vega alt=45 az=0, R=270 → 相对 (0,-135)，圆心 (280,280)
    expect(arcs.some((a) => Math.abs(a.args[0]! - 280) < 1e-6 && Math.abs(a.args[1]! - 145) < 1e-6)).toBe(true);
  });

  it('亮星名被绘制', () => {
    expect(calls.some((c) => c.method === 'fillText' && c.args[0] === 'Vega')).toBe(true);
  });
});

afterEach(cleanup);

describe('StarChart 悬停', () => {
  it('鼠标移到星点附近显示 tooltip', () => {
    const stars = buildDrawList([star({ id: 'zenith', name: 'Zenith Star', alt: 90, mag: 0 })], 270);
    render(<StarChart stars={stars} />);
    const canvas = screen.getByTestId('star-canvas');
    fireEvent.mouseMove(canvas, { clientX: 280, clientY: 280 }); // 天顶 = 画布中心
    expect(screen.getByTestId('star-tooltip')).toBeTruthy();
    expect(screen.getByText('Zenith Star')).toBeTruthy();
  });

  it('移开（onMouseLeave）后 tooltip 消失', () => {
    const stars = buildDrawList([star({ id: 'z', alt: 90, mag: 0 })], 270);
    render(<StarChart stars={stars} />);
    const canvas = screen.getByTestId('star-canvas');
    fireEvent.mouseMove(canvas, { clientX: 280, clientY: 280 });
    fireEvent.mouseLeave(canvas);
    expect(screen.queryByTestId('star-tooltip')).toBeNull();
  });
});
