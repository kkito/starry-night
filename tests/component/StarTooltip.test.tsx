// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { StarTooltip } from '../../src/components/StarTooltip';

afterEach(cleanup);

const star = { id: 's1', name: 'Vega', ra: 279, dec: 38.8, az: 45.67, alt: 30.12, mag: 0.03 };

describe('StarTooltip', () => {
  it('渲染字段与定位', () => {
    render(<StarTooltip star={star} x={100} y={80} />);
    expect(screen.getByText('Vega')).toBeTruthy();
    expect(screen.getByText(/0\.03/)).toBeTruthy();
    expect(screen.getByText(/30\.1/)).toBeTruthy();
    expect(screen.getByText(/45\.7/)).toBeTruthy();
    const el = screen.getByTestId('star-tooltip');
    expect(el.style.left).toBe('112px');
    expect(el.style.top).toBe('92px');
  });

  it('无名星显示 id', () => {
    render(<StarTooltip star={{ ...star, name: undefined }} x={0} y={0} />);
    expect(screen.getByText('s1')).toBeTruthy();
  });
});
