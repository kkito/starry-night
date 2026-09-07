// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { ViewModeSwitch } from '../../src/components/ViewModeSwitch';

afterEach(cleanup);

describe('ViewModeSwitch', () => {
  it('渲染为 switch，分 2D/3D 两档', () => {
    render(<ViewModeSwitch value="3d" onChange={vi.fn()} />);
    expect(screen.getByRole('group', { name: '视图模式' })).toBeTruthy();
    expect(screen.getByRole('switch', { name: '3D 视图' }).getAttribute('aria-checked')).toBe('true');
    expect(screen.getByRole('switch', { name: '2D 视图' }).getAttribute('aria-checked')).toBe('false');
  });
  it('点击切换回调', () => {
    const onChange = vi.fn();
    render(<ViewModeSwitch value="3d" onChange={onChange} />);
    fireEvent.click(screen.getByRole('switch', { name: '2D 视图' }));
    expect(onChange).toHaveBeenCalledWith('2d');
  });
});

describe('App 默认 3D', () => {
  it('默认进入 3D 天穹', async () => {
    const { default: App } = await import('../../src/App');
    const { makeMockCtx, installCanvasMock } = await import('./helpers');
    const { ctx } = makeMockCtx();
    installCanvasMock({ ctx });
    localStorage.clear();
    render(<App />);
    // 默认应为 3D（fallback 占位），而非 2D canvas
    expect(screen.queryByTestId('skydome-fallback')).toBeTruthy();
    expect(screen.queryByTestId('star-canvas')).toBeNull();
    expect(screen.getByRole('switch', { name: '3D 视图' }).getAttribute('aria-checked')).toBe('true');
  });
});
