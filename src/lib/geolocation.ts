export interface GeoPoint {
  lat: number;
  lon: number;
}

type GeoError = { code: number; message: string } | null;

const ERROR_BY_CODE: Record<number, string> = {
  1: '定位被拒绝：请允许浏览器获取位置权限',
  2: '无法获取位置：设备暂时不可用',
  3: '定位超时：请重试或手动输入',
};

export function getCurrentPosition(timeoutMs = 10_000): Promise<GeoPoint> {
  return new Promise((resolve, reject) => {
    const geo = navigator.geolocation;
    if (!geo) {
      reject(new Error('当前环境不支持浏览器定位'));
      return;
    }
    let settled = false;
    const succeed = (lat: number, lon: number) => {
      if (settled) return;
      settled = true;
      resolve({ lat, lon });
    };
    const fail = (err: GeoError) => {
      if (settled) return;
      settled = true;
      const msg = err && ERROR_BY_CODE[err.code] ? ERROR_BY_CODE[err.code] : '定位失败：未知错误';
      reject(new Error(msg));
    };
    geo.getCurrentPosition(
      (pos) => succeed(pos.coords.latitude, pos.coords.longitude),
      (err) => fail(err),
      { enableHighAccuracy: false, timeout: timeoutMs, maximumAge: 5 * 60_000 },
    );
  });
}
