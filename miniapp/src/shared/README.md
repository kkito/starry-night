# miniapp 共享 core/lib/data 约定

miniapp 不复制算法，所有天文计算只读引用仓库根的共享模块：

- `../../src/core`（`computeSky`、`loadCatalog` 等）
- `../../src/lib`
- `../../data/catalog.json`

入口：`src/shared/catalog.ts` 的 `loadSharedCatalog()` 是共享星表的唯一入口，
后续任务统一复用。验证测试：`src/__tests__/shared-core.test.ts`。
