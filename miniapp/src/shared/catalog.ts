import { loadCatalog, type CatalogStar } from '../../../src/core/catalog';

/**
 * 共享星表的唯一入口（miniapp 内后续任务统一复用）。
 * 只读引用根 `src/core` + `data/catalog.json`，不得在 miniapp 内分叉复制算法。
 */
export function loadSharedCatalog(magLimit = 5.0): CatalogStar[] {
  return loadCatalog(magLimit);
}

export type { CatalogStar };
