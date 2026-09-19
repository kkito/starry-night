import { defineConfig } from 'vitest/config';
import path from 'node:path';

// miniapp 测试（jsdom 渲染 Taro 组件壳）与根 web 测试共用同一份 react：
// miniapp/node_modules 里是 react 18，根是 react 19，双拷贝会让 testing-library
// 渲染 miniapp 组件时报 "Element from an older version of React"。统一钉到根拷贝。
export default defineConfig({
  resolve: {
    alias: {
      react: path.resolve(import.meta.dirname, 'node_modules/react'),
      'react-dom': path.resolve(import.meta.dirname, 'node_modules/react-dom'),
    },
  },
  test: {
    environment: 'node',
  },
});
