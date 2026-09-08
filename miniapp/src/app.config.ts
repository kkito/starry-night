export default {
  pages: ['pages/index/index', 'pages/settings/index', 'pages/table/index'],
  window: {
    backgroundTextStyle: 'light',
    navigationBarBackgroundColor: '#fff',
    navigationBarTitleText: 'starry-night',
    navigationBarTextStyle: 'black',
  },
};

export function getAppConfig() {
  return { pages: ['pages/index/index', 'pages/settings/index', 'pages/table/index'] };
}
