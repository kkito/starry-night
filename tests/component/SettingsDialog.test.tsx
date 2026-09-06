// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SettingsDialog } from '../../src/components/SettingsDialog';
import { CITIES, findCity } from '../../src/lib/cities';

afterEach(cleanup);

const view = { lat: 39.9, lon: 116.4, date: '2026-03-20T20:00', magLimit: 5 };

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
    render(<SettingsDialog open view={view} onClose={() => {}} onApply={onApply} />);
    await userEvent.selectOptions(screen.getByLabelText('城市'), '成都');
    expect(screen.getByLabelText('纬度')).toHaveProperty('value', '30.5728');
    expect(screen.getByLabelText('经度')).toHaveProperty('value', '104.0668');
  });

  it('城市回填后可应用', async () => {
    const onApply = vi.fn();
    render(<SettingsDialog open view={view} onClose={() => {}} onApply={onApply} />);
    await userEvent.selectOptions(screen.getByLabelText('城市'), '伦敦');
    await userEvent.click(screen.getByRole('button', { name: '应用' }));
    expect(onApply).toHaveBeenCalledWith({ ...view, lat: 51.5072, lon: -0.1276 });
  });

  it('手动修改纬度时城市复位为手动输入', async () => {
    render(<SettingsDialog open view={view} onClose={() => {}} onApply={() => {}} />);
    await userEvent.selectOptions(screen.getByLabelText('城市'), '成都');
    await userEvent.type(screen.getByLabelText('纬度'), '1');
    const select = screen.getByLabelText('城市') as HTMLSelectElement;
    expect(select.value).toBe('');
  });
});

describe('浏览器定位', () => {
  it('授权成功回填经纬度并复位城市', async () => {
    stubGeolocation({ success: { latitude: -33.8688, longitude: 151.2093 } });
    render(<SettingsDialog open view={view} onClose={() => {}} onApply={() => {}} />);
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
    render(<SettingsDialog open view={view} onClose={() => {}} onApply={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: '使用当前位置' }));
    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toContain('定位被拒绝');
    });
  });

  it('不支持 geolocation 时显示错误', async () => {
    render(<SettingsDialog open view={view} onClose={() => {}} onApply={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: '使用当前位置' }));
    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toContain('不支持');
    });
  });
});
