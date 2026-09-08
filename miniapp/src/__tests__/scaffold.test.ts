import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('taro scaffold', () => {
  it('app.config declares index page', () => {
    const cfg = fs.readFileSync(path.resolve(__dirname, '../app.config.ts'), 'utf8');
    expect(cfg).toContain('pages/index/index');
  });
  it('index page exists', () => {
    expect(fs.existsSync(path.resolve(__dirname, '../pages/index/index.tsx'))).toBe(true);
  });
});
