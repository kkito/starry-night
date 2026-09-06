export interface City {
  name: string;
  lat: number;
  lon: number;
}

// 精选城市表：覆盖国内主要城市，附少量海外参考点
export const CITIES: City[] = [
  { name: '北京', lat: 39.9042, lon: 116.4074 },
  { name: '上海', lat: 31.2304, lon: 121.4737 },
  { name: '广州', lat: 23.1291, lon: 113.2644 },
  { name: '深圳', lat: 22.5431, lon: 114.0579 },
  { name: '天津', lat: 39.3434, lon: 117.3616 },
  { name: '重庆', lat: 29.5630, lon: 106.5516 },
  { name: '杭州', lat: 30.2741, lon: 120.1551 },
  { name: '南京', lat: 32.0603, lon: 118.7969 },
  { name: '武汉', lat: 30.5928, lon: 114.3055 },
  { name: '成都', lat: 30.5728, lon: 104.0668 },
  { name: '西安', lat: 34.3416, lon: 108.9398 },
  { name: '苏州', lat: 31.2989, lon: 120.5853 },
  { name: '长沙', lat: 28.2282, lon: 112.9388 },
  { name: '郑州', lat: 34.7466, lon: 113.6254 },
  { name: '青岛', lat: 36.0671, lon: 120.3826 },
  { name: '沈阳', lat: 41.8057, lon: 123.4315 },
  { name: '哈尔滨', lat: 45.8038, lon: 126.5350 },
  { name: '昆明', lat: 24.8801, lon: 102.8329 },
  { name: '贵阳', lat: 26.6470, lon: 106.6302 },
  { name: '兰州', lat: 36.0611, lon: 103.8343 },
  { name: '拉萨', lat: 29.6520, lon: 91.1721 },
  { name: '乌鲁木齐', lat: 43.8256, lon: 87.6168 },
  { name: '三亚', lat: 18.2528, lon: 109.5119 },
  { name: '香港', lat: 22.3193, lon: 114.1694 },
  { name: '澳门', lat: 22.1987, lon: 113.5439 },
  { name: '台北', lat: 25.0330, lon: 121.5654 },
  { name: '东京', lat: 35.6762, lon: 139.6503 },
  { name: '新加坡', lat: 1.3521, lon: 103.8198 },
  { name: '悉尼', lat: -33.8688, lon: 151.2093 },
  { name: '伦敦', lat: 51.5072, lon: -0.1276 },
  { name: '纽约', lat: 40.7128, lon: -74.0060 },
];

export function findCity(name: string): City | undefined {
  return CITIES.find((c) => c.name === name);
}
