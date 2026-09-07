// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SettingsDialog, validateView } from '../../src/components/SettingsDialog';
import { CITIES, findCity } from '../../src/lib/cities';

afterEach(cleanup);

const view = { lat: 39.9, lon: 116.4, date: '2026-03-20T20:00', timeMode: 'fixed' as const, topN: 50, aspect: 'auto' as const, showSolar: true, mirror: false, shape: 'ellipse' as const, viewMode: '2d' as const };

describe('validateView', () => {
  it('合法返回 null', () => {
    expect(validateView(view)).toBeNull();
  });
  it('非法项返回字段名错误', () => {
    expect(validateView({ ...view, lat: 99 })).toContain('lat');
    expect(validateView({ ...view, lon: -200 })).toContain('lon');
    expect(validateView({ ...view, date: '' })).toContain('date');
    expect(validateView({ ...view, timeMode: 'auto' as never })).toContain('timeMode');
    expect(validateView({ ...view, topN: 0 })).toContain('topN');
    expect(validateView({ ...view, aspect: 'diagonal' as never })).toContain('aspect');
  });
});

describe('SettingsDialog 基础行为', () => {
  it('open=false 不渲染', () => {
    render(<SettingsDialog open={false}
      onOpenTable={() => {}} view={view} onClose={() => {}} onApply={() => {}} />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('非法值提交显示错误且不回调', async () => {
    const onApply = vi.fn();
    render(<SettingsDialog open onOpenTable={() => {}} view={view} onClose={() => {}} onApply={onApply} />);
    await userEvent.clear(screen.getByLabelText('纬度'));
    await userEvent.type(screen.getByLabelText('纬度'), '99');
    await userEvent.click(screen.getByRole('button', { name: '应用' }));
    expect(screen.getByText(/lat/)).toBeTruthy();
    expect(onApply).not.toHaveBeenCalled();
  });

  it('合法值提交回调 onApply', async () => {
    const onApply = vi.fn();
    render(<SettingsDialog open onOpenTable={() => {}} view={view} onClose={() => {}} onApply={onApply} />);
    await userEvent.clear(screen.getByLabelText('纬度'));
    await userEvent.type(screen.getByLabelText('纬度'), '31.2');
    await userEvent.click(screen.getByRole('button', { name: '应用' }));
    expect(onApply).toHaveBeenCalledWith({ ...view, lat: 31.2 });
  });
});

describe('Top N 滑块与显示比例', () => {
  it('拖动滑块后应用携带 topN', async () => {
    const onApply = vi.fn();
    render(<SettingsDialog open onOpenTable={() => {}} view={view} onClose={() => {}} onApply={onApply} />);
    const slider = screen.getByLabelText('Top N 亮星');
    fireEvent.change(slider, { target: { value: '88' } });
    expect(screen.getByTestId('top-n-value').textContent).toBe('88');
    await userEvent.click(screen.getByRole('button', { name: '应用' }));
    expect(onApply).toHaveBeenCalledWith({ ...view, topN: 88 });
  });

  it('切换太阳系天体开关后应用携带 showSolar', async () => {
    const onApply = vi.fn();
    render(<SettingsDialog open onOpenTable={() => {}} view={view} onClose={() => {}} onApply={onApply} />);
    const cb = screen.getByLabelText('显示太阳系天体') as HTMLInputElement;
    expect(cb.checked).toBe(true);
    await userEvent.click(cb);
    await userEvent.click(screen.getByRole('button', { name: '应用' }));
    expect(onApply).toHaveBeenCalledWith({ ...view, showSolar: false });
  });

  it('选择显示比例后应用携带 aspect', async () => {
    const onApply = vi.fn();
    render(<SettingsDialog open onOpenTable={() => {}} view={view} onClose={() => {}} onApply={onApply} />);
    await userEvent.selectOptions(screen.getByLabelText('显示比例'), 'portrait');
    await userEvent.click(screen.getByRole('button', { name: '应用' }));
    expect(onApply).toHaveBeenCalledWith({ ...view, aspect: 'portrait' });
  });

  it('实时模式提交时携带当前时间', async () => {
    const onApply = vi.fn();
    render(<SettingsDialog open onOpenTable={() => {}} view={{ ...view, timeMode: 'live' }} onClose={() => {}} onApply={onApply} />);
    await userEvent.click(screen.getByRole('button', { name: '应用' }));
    const arg = onApply.mock.calls[0]![0];
    expect(arg.timeMode).toBe('live');
    expect(Math.abs(Date.now() - new Date(arg.date).getTime())).toBeLessThan(60_000);
  });

  it('重新打开时草稿重置为当前 view', async () => {
    const { rerender } = render(
      <SettingsDialog open={false}
      onOpenTable={() => {}} view={view} onClose={() => {}} onApply={() => {}} />,
    );
    rerender(<SettingsDialog open onOpenTable={() => {}} view={view} onClose={() => {}} onApply={() => {}} />);
    fireEvent.change(screen.getByLabelText('Top N 亮星'), { target: { value: '30' } });
    expect(screen.getByTestId('top-n-value').textContent).toBe('30');
    rerender(<SettingsDialog open={false}
      onOpenTable={() => {}} view={view} onClose={() => {}} onApply={() => {}} />);
    rerender(<SettingsDialog open onOpenTable={() => {}} view={view} onClose={() => {}} onApply={() => {}} />);
    expect((screen.getByLabelText('Top N 亮星') as HTMLInputElement).value).toBe('50');
  });
});

describe('cities', () => {
  it('城市表经纬度在合法范围', () => {
    for (const c of CITIES) {
      expect(c.lat).toBeGreaterThanOrEqual(-90);
      expect(c.lat).toBeLessThanOrEqual(90);
      expect(c.lon).toBeGreaterThanOrEqual(-180);
      expect(c.lon).toBeLessThanOrEqual(180);
    }
  });
  it('按名称查找城市', () => {
    expect(findCity('北京')).toEqual({ name: '北京', lat: 39.9042, lon: 116.4074 });
    expect(findCity('不存在')).toBeUndefined();
  });
});

function stubGeolocation(impl: {
  success?: { latitude: number; longitude: number };
  error?: { code: number; message: string };
}) {
  const getCurrentPosition = vi.fn(
    (ok: PositionCallback, ko: PositionErrorCallback) => {
      if (impl.error) ko(impl.error as GeolocationPositionError);
      else ok({ coords: { latitude: impl.success!.latitude, longitude: impl.success!.longitude } } as GeolocationPosition);
    },
  );
  Object.defineProperty(navigator, 'geolocation', { value: { getCurrentPosition }, configurable: true });
  return getCurrentPosition;
}

beforeEach(() => {
  Object.defineProperty(navigator, 'geolocation', { value: undefined, configurable: true });
});

describe('城市选择', () => {
  it('选择城市回填经纬度', async () => {
    const onApply = vi.fn();
    render(<SettingsDialog open onOpenTable={() => {}} view={view} onClose={() => {}} onApply={onApply} />);
    await userEvent.selectOptions(screen.getByLabelText('城市'), '成都');
    expect(screen.getByLabelText('纬度')).toHaveProperty('value', '30.5728');
    expect(screen.getByLabelText('经度')).toHaveProperty('value', '104.0668');
  });

  it('城市回填后可应用', async () => {
    const onApply = vi.fn();
    render(<SettingsDialog open onOpenTable={() => {}} view={view} onClose={() => {}} onApply={onApply} />);
    await userEvent.selectOptions(screen.getByLabelText('城市'), '伦敦');
    await userEvent.click(screen.getByRole('button', { name: '应用' }));
    expect(onApply).toHaveBeenCalledWith({ ...view, lat: 51.5072, lon: -0.1276 });
  });

  it('手动修改纬度时城市复位为手动输入', async () => {
    render(<SettingsDialog open onOpenTable={() => {}} view={view} onClose={() => {}} onApply={() => {}} />);
    await userEvent.selectOptions(screen.getByLabelText('城市'), '成都');
    await userEvent.type(screen.getByLabelText('纬度'), '1');
    const select = screen.getByLabelText('城市') as HTMLSelectElement;
    expect(select.value).toBe('');
  });
});

describe('浏览器定位', () => {
  it('授权成功回填经纬度并复位城市', async () => {
    stubGeolocation({ success: { latitude: -33.8688, longitude: 151.2093 } });
    render(<SettingsDialog open onOpenTable={() => {}} view={view} onClose={() => {}} onApply={() => {}} />);
    await userEvent.selectOptions(screen.getByLabelText('城市'), '北京');
    await userEvent.click(screen.getByRole('button', { name: '使用当前位置' }));
    await waitFor(() => {
      expect(screen.getByLabelText('纬度')).toHaveProperty('value', '-33.8688');
    });
    expect(screen.getByLabelText('经度')).toHaveProperty('value', '151.2093');
    expect((screen.getByLabelText('城市') as HTMLSelectElement).value).toBe('');
  });

  it('拒绝授权显示错误提示', async () => {
    stubGeolocation({ error: { code: 1, message: 'denied' } });
    render(<SettingsDialog open onOpenTable={() => {}} view={view} onClose={() => {}} onApply={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: '使用当前位置' }));
    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toContain('定位被拒绝');
    });
  });

  it('不支持 geolocation 时显示错误', async () => {
    render(<SettingsDialog open onOpenTable={() => {}} view={view} onClose={() => {}} onApply={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: '使用当前位置' }));
    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toContain('不支持');
    });
  });
});
