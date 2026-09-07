# AGENTS.md

## TDD（强制）

- 所有开发与修复（功能、bugfix、重构行为变化）都走 TDD 红绿灯：先写失败测试（RED）→ 最小实现（GREEN）→ 重构。
- 测试命令：`pnpm test`（全量）、`pnpm vitest run <path>`（单文件）；类型：`pnpm typecheck`；构建：`pnpm build`。
- 不补测试的 PR 不合入；修 bug 先补复现测试。
