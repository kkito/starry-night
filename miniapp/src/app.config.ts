export default {
  pages: ['pages/index/index', 'pages/settings/index', 'pages/table/index'],
  window: {
    backgroundTextStyle: 'light',
    navigationBarBackgroundColor: '#fff',
    navigationBarTitleText: 'starry-night',
    navigationBarTextStyle: 'black',
  },
  // I3 定位权限声明：设置页"定位当前"经 Taro.getLocation 取 wgs84 坐标，用于计算当地星空。
  requiredPrivateInfos: ['getLocation'],
  permission: {
    'scope.userLocation': { desc: '用于获取当前位置，计算当地星空' },
  },
};

export function getAppConfig() {
  return { pages: ['pages/index/index', 'pages/settings/index', 'pages/table/index'] };
}
