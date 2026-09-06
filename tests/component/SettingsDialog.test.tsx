// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SettingsDialog, validateView } from '../../src/components/SettingsDialog';

afterEach(cleanup);

const view = { lat: 39.9, lon: 116.4, date: '2026-03-20T20:00', magLimit: 5 };

describe('validateView', () => {
  it('合法返回 null', () => {
    expect(validateView(view)).toBeNull();
  });
  it('非法项返回字段名错误', () => {
    expect(validateView({ ...view, lat: 99 })).toContain('lat');
    expect(validateView({ ...view, lon: -200 })).toContain('lon');
    expect(validateView({ ...view, date: '' })).toContain('date');
    expect(validateView({ ...view, magLimit: 6 })).toContain('magLimit');
  });
});

describe('SettingsDialog', () => {
  it('open=false 不渲染', () => {
    render(<SettingsDialog open={false} view={view} onClose={() => {}} onApply={() => {}} />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('非法值提交显示错误且不回调', async () => {
    const onApply = vi.fn();
    render(<SettingsDialog open view={view} onClose={() => {}} onApply={onApply} />);
    await userEvent.type(screen.getByLabelText('纬度'), '9'); // 39.9 → 39.99 仍合法，改清空重填
    await userEvent.clear(screen.getByLabelText('纬度'));
    await userEvent.type(screen.getByLabelText('纬度'), '99');
    await userEvent.click(screen.getByRole('button', { name: '应用' }));
    expect(screen.getByText(/lat/)).toBeTruthy();
    expect(onApply).not.toHaveBeenCalled();
  });

  it('合法值提交回调 onApply', async () => {
    const onApply = vi.fn();
    render(<SettingsDialog open view={view} onClose={() => {}} onApply={onApply} />);
    await userEvent.clear(screen.getByLabelText('纬度'));
    await userEvent.type(screen.getByLabelText('纬度'), '31.2');
    await userEvent.click(screen.getByRole('button', { name: '应用' }));
    expect(onApply).toHaveBeenCalledWith({ ...view, lat: 31.2 });
  });
});
