import path from 'path';
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
  defineConstants: {
    // 关键：Taro 的 DefinePlugin 需要显式声明才会在构建时替换 process.env.TARO_ENV。
    // 默认分支走 weapp，避免业务代码里的 isWeapp() 在 weapp 产物中误判为 H5。
    'process.env.TARO_ENV': JSON.stringify(process.env.TARO_ENV ?? 'weapp'),
  },
  copy: {
    patterns: [],
    options: {},
  },
  framework: 'react',
  compiler: 'webpack5',
  // 验证性配置：把仓根外 ../src 纳入 babel-loader 处理范围（Task 2）。
  // 原因：Taro 默认 script rule 只含 sourceDir，根外 TS 会报 Module parse failed（type 语法无法解析）。
  // 实测：compile.include 与顶层 webpackChain 均无效，mini.webpackChain 生效。
  mini: {
    webpackChain(chain) {
      const rootSrc = path.resolve(__dirname, '..', '..', 'src');
      chain.module
        .rule('script')
        .include.add(rootSrc)
        .end();
    },
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
    webpackChain(chain) {
      const rootSrc = path.resolve(__dirname, '..', '..', 'src');
      chain.module
        .rule('script')
        .include.add(rootSrc)
        .end();
    },
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
