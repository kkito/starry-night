import * as Taro from '@tarojs/taro';

export function getCurrentPosition(timeoutMs = 10_000): Promise<{ lat: number; lon: number }> {
  return new Promise((resolve, reject) => {
    Taro.getLocation({
      type: 'wgs84',
      success: (res) => resolve({ lat: res.latitude, lon: res.longitude }),
      fail: () => reject(new Error('定位失败：请检查微信位置权限或手动选择城市')),
    });
    void timeoutMs;
  });
}
