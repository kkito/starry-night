export default {
  pages: ['pages/index/index'],
  window: {
    backgroundTextStyle: 'light',
    navigationBarBackgroundColor: '#fff',
    navigationBarTitleText: 'starry-night',
    navigationBarTextStyle: 'black',
  },
};

export function getAppConfig() {
  return { pages: ['pages/index/index'] };
}
