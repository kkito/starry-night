// tests/component/SkyHtml3D.test.tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { SkyHtml3D } from '../../src/components/SkyHtml3D';
import type { DrawStar } from '../../src/lib/drawlist';

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
});
