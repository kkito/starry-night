// @vitest-environment jsdom
import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { makeMockCtx, installCanvasMock } from './helpers';
import { StarChart } from '../../src/components/StarChart';
import { buildDrawList, type StarWithBv } from '../../src/lib/drawlist';
import { SkyDome3D } from '../../src/components/SkyDome3D';

const star = (over: Partial<StarWithBv>): StarWithBv => ({ id: 's', ra: 0, dec: 0, az: 0, alt: 90, mag: 0, ...over });
beforeAll(() => {
  const { ctx } = makeMockCtx();
  installCanvasMock({ ctx });
});
afterEach(cleanup);

describe('选中弹窗 2D', () => {
  it('传入 selectedId 显示 selected-tooltip，点击空白回调 null', () => {
    const onSelect = () => {};
    const stars = buildDrawList([star({ id: 'a', name: 'A', alt: 90, mag: 1 })], 270, 270);
    const { rerender } = render(<StarChart stars={stars} width={560} height={560} selectedId="a" onSelect={onSelect} />);
    expect(screen.getByTestId('selected-tooltip')).toBeTruthy();
    expect(screen.getByText('A')).toBeTruthy();
    // 切到无选中：弹窗消失
    rerender(<StarChart stars={stars} width={560} height={560} selectedId={null} onSelect={onSelect} />);
    expect(screen.queryByTestId('selected-tooltip')).toBeNull();
  });
  it('切星替换：selectedId 变更后显示新星', () => {
    const stars = buildDrawList(
      [star({ id: 'a', name: 'A', alt: 90, mag: 1 }), star({ id: 'b', name: 'B', alt: 45, az: 90, mag: 1 })],
      270, 270
    );
    const { rerender } = render(<StarChart stars={stars} width={560} height={560} selectedId="a" />);
    expect(screen.getByText('A')).toBeTruthy();
    rerender(<StarChart stars={stars} width={560} height={560} selectedId="b" />);
    expect(screen.getByText('B')).toBeTruthy();
    expect(screen.queryByText('A')).toBeNull();
  });
});

describe('选中弹窗 3D', () => {
  it('selectedId 显示弹窗，null 时消失', () => {
    const stars = [{ id: 'a', name: 'A', mag: 1, alt: 30, az: 90, rPx: 4, color: '#fff', x: 0, y: 0 } as never];
    const { rerender } = render(<SkyDome3D stars={stars} track={null} selectedId="a" />);
    expect(screen.getByTestId('selected-tooltip')).toBeTruthy();
    rerender(<SkyDome3D stars={stars} track={null} selectedId={null} />);
    expect(screen.queryByTestId('selected-tooltip')).toBeNull();
  });
});
