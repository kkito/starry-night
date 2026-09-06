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
    render(<App />);
    expect(screen.getByTestId('star-canvas')).toBeTruthy();
    expect(screen.getByTestId('summary').textContent).toMatch(/可见星/);
  });

  it('设置按钮打开弹框，应用后摘要更新', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: '设置' }));
    const lat = screen.getByLabelText('纬度');
    fireEvent.change(lat, { target: { value: '-33.87' } });
    fireEvent.click(screen.getByRole('button', { name: '应用' }));
    expect(screen.getByTestId('summary').textContent).toContain('-33.87');
  });

  it('星表按钮打开弹框', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: '星表' }));
    expect(screen.getByRole('dialog', { name: '星表' })).toBeTruthy();
  });
});
