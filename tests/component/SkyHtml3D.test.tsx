// tests/component/SkyHtml3D.test.tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { SkyHtml3D } from '../../src/components/SkyHtml3D';
import type { DrawStar } from '@starry/sky-core/lib/drawlist';

afterEach(cleanup);

const star = (id: string, az: number, alt: number): DrawStar => ({
  id, name: id, x: 0, y: 0, rPx: 3, color: '#ffffff', label: false, az, alt, mag: 1,
});

describe('SkyHtml3D', () => {
  it('渲染 canvas 容器', () => {
    render(<SkyHtml3D stars={[star('s1', 180, 25)]} track={null} selectedId={null} onSelect={vi.fn()} />);
    expect(screen.getByTestId('skydome-html3d')).toBeTruthy();
  });
  it('选中星显示 tooltip', () => {
    render(<SkyHtml3D stars={[star('s1', 180, 25)]} track={null} selectedId="s1" onSelect={vi.fn()} />);
    expect(screen.getByTestId('selected-tooltip')).toBeTruthy();
    expect(screen.getByTestId('star-tooltip')).toBeTruthy();
  });
  it('tooltip 定位到选中星的投影点（正前方星应在画布中心 400,300）', () => {
    render(<SkyHtml3D stars={[star('s1', 180, 25)]} track={null} selectedId="s1" onSelect={vi.fn()} />);
    const tip = screen.getByTestId('selected-tooltip');
    expect(Math.abs(Number(tip.getAttribute('data-x')) - 400)).toBeLessThan(2);
    expect(Math.abs(Number(tip.getAttribute('data-y')) - 300)).toBeLessThan(2);
  });
  it('选中星转到相机背后后 tooltip 消失（与 3D 版一致）', () => {
    render(<SkyHtml3D stars={[star('s1', 0, 25)]} track={null} selectedId="s1" onSelect={vi.fn()} />);
    expect(screen.queryByTestId('selected-tooltip')).toBeNull();
  });
});
