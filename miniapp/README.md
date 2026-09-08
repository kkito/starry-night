# miniapp（Taro 双端：微信小程序 + H5）

## 安装（两步）

```bash
# 1. 根依赖
pnpm install
# 2. miniapp 自身依赖
cd miniapp && pnpm install
```

## 构建（直调本地 taro，避免 npx 受 devEngines 限制）

```bash
cd miniapp
./node_modules/.bin/taro build --type weapp
./node_modules/.bin/taro build --type h5
```
