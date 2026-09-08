import type { UserConfigExport } from '@tarojs/cli';
import devConfig from './dev';
import prodConfig from './prod';

const config: UserConfigExport<'webpack5'> = {
  projectName: 'miniapp',
  date: '2026-09-08',
  designWidth: 750,
  deviceRatio: {
    640: 2.34 / 2,
    750: 1,
    828: 1.81 / 2,
  },
  sourceRoot: 'src',
  outputRoot: 'dist',
  plugins: [],
  defineConstants: {},
  copy: {
    patterns: [],
    options: {},
  },
  framework: 'react',
  compiler: 'webpack5',
  mini: {
    postcss: {
      pxtransform: {
        enable: true,
        config: {},
      },
    },
  },
  h5: {
    publicPath: '/',
    staticDirectory: 'static',
    postcss: {
      autoprefixer: {
        enable: true,
        config: {},
      },
    },
  },
};

export default function defineConfig(
  merge: (base: unknown, ...sources: unknown[]) => Record<string, unknown>,
) {
  const base = { ...config };
  if (process.env.NODE_ENV === 'development') {
    return merge(base, devConfig);
  }
  return merge(base, prodConfig);
}
