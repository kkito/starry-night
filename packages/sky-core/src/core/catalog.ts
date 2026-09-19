import catalogJson from '../../data/catalog.json';

export interface CatalogStar {
  id: string;
  name?: string;
  mag: number;
  bv?: number;
  raDeg: number;
  decDeg: number;
}

interface CatalogFile {
  magLimit: number;
  stars: CatalogStar[];
}

let cached: CatalogStar[] | null = null;

/** 加载预处理星表并按星等上限裁剪（默认 5.0，即星表全量）。 */
export function loadCatalog(magLimit = 5.0): CatalogStar[] {
  const file = catalogJson as CatalogFile;
  if (magLimit > file.magLimit) {
    throw new RangeError(`magLimit ${magLimit} 超出星表上限 ${file.magLimit}，请调低 preprocess 的 MAG_LIMIT`);
  }
  if (!cached) cached = [...file.stars];
  return cached.filter((s) => s.mag <= magLimit);
}
