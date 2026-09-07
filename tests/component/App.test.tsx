// @vitest-environment jsdom
import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import App from '../../src/App';
import { makeMockCtx, installCanvasMock } from './helpers';

beforeAll(() => {
  const { ctx } = makeMockCtx();
  installCanvasMock({ ctx });
});

afterEach(cleanup);

describe('App', () => {
  it('默认视图渲染摘要与星图', () => {
    localStorage.clear();
    render(<App />);
    expect(screen.getByTestId('skydome-fallback')).toBeTruthy();
    expect(screen.getByTestId('summary').textContent).toMatch(/可见星/);
  });

  it('菜单按钮直接打开设置弹框，应用后摘要更新', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: '菜单' }));
    const lat = screen.getByLabelText('纬度');
    fireEvent.change(lat, { target: { value: '-33.87' } });
    fireEvent.click(screen.getByRole('button', { name: '应用' }));
    expect(screen.getByTestId('summary').textContent).toContain('-33.87');
  });

  it('默认时间为本地当前时间（无 Z 后缀）', () => {
    render(<App />);
    const text = screen.getByTestId('summary').textContent!;
    const m = text.match(/时间(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})/)!;
    expect(m).toBeTruthy();
    const shown = m[1]!;
    const now = new Date();
    const p = (n: number) => String(n).padStart(2, '0');
    const today = `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
    expect(shown).toMatch(new RegExp(`^${today}T`));
    expect(screen.getByTestId('summary').textContent).not.toContain('Z');
  });

  it('Top N 限制可见星数量', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: '菜单' }));
    const slider = screen.getByLabelText('Top N 亮星');
    fireEvent.change(slider, { target: { value: '12' } });
    fireEvent.click(screen.getByRole('button', { name: '应用' }));
    expect(screen.getByTestId('summary').textContent).toContain('Top 12 颗');
  });

  it('显示比例横屏后画布为 16:9 并居中', () => {
    localStorage.clear();
    render(<App />);
    fireEvent.click(screen.getByRole('switch', { name: '2D 视图' }));
    fireEvent.click(screen.getByRole('button', { name: '菜单' }));
    fireEvent.change(screen.getByLabelText('显示比例'), { target: { value: 'landscape' } });
    fireEvent.click(screen.getByRole('button', { name: '应用' }));
    const canvas = screen.getByTestId('star-canvas') as HTMLCanvasElement;
    expect(canvas.width / canvas.height).toBeCloseTo(16 / 9, 6);
  });

  it('设置弹框内查看星表', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: '菜单' }));
    fireEvent.click(screen.getByRole('button', { name: '查看星表' }));
    expect(screen.getByRole('dialog', { name: '星表' })).toBeTruthy();
    expect(screen.queryByRole('dialog', { name: '设置' })).toBeNull();
  });

  it('底部状态栏可收起/展开', () => {
    render(<App />);
    expect(screen.getByTestId('summary')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '收起状态栏' }));
    expect(screen.queryByTestId('summary')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '展开状态栏' }));
    expect(screen.getByTestId('summary')).toBeTruthy();
  });

  it('右上可切换 3D 视图', () => {
    localStorage.clear();
    render(<App />);
    expect(screen.getByTestId('skydome-fallback')).toBeTruthy();
    fireEvent.click(screen.getByRole('switch', { name: '2D 视图' }));
    expect(screen.getByTestId('star-canvas')).toBeTruthy();
    fireEvent.click(screen.getByRole('switch', { name: '3D 视图' }));
    expect(screen.getByTestId('skydome-fallback')).toBeTruthy();
  });
});
