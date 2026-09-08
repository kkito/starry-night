import { describe, expect, it, vi } from 'vitest';

vi.mock('@tarojs/components', () => ({ Canvas: 'canvas', View: 'div', Text: 'span' }));
vi.mock('@tarojs/taro', () => ({ createSelectorQuery: vi.fn() }));

import { hitTestStar } from '../StarChart';

describe('hitTestStar', () => {
  it('picks nearest star within threshold', () => {
    const stars = [{ id: 'a', x: 10, y: 10 }, { id: 'b', x: 100, y: 100 }];
    expect(hitTestStar(stars as any, 200, 200, 12, 12)?.id).toBe('a');
    expect(hitTestStar(stars as any, 200, 200, 0, 0)).toBeNull();
  });
});
