import { describe, expect, it, vi } from 'vitest';

vi.mock('@tarojs/components', () => ({ Canvas: 'canvas', View: 'div', Text: 'span' }));
vi.mock('@tarojs/taro', () => ({ createSelectorQuery: vi.fn() }));

import { extractClientPoint, hitTestStar } from '../StarChart';

describe('click/touch unified picking', () => {
  const stars = [{ id: 'a', x: 10, y: 10 }, { id: 'b', x: 100, y: 100 }] as any;

  it('click event without touches selects the same star as touch event', () => {
    const touchLike = { changedTouches: [{ clientX: 12, clientY: 12 }] };
    const clickLike = { clientX: 12, clientY: 12 };
    const tp = extractClientPoint(touchLike);
    const cp = extractClientPoint(clickLike);
    expect(cp).not.toBeNull();
    expect(cp).toEqual(tp);
    expect(hitTestStar(stars, 200, 200, cp!.x, cp!.y)?.id).toBe(
      hitTestStar(stars, 200, 200, tp!.x, tp!.y)?.id,
    );
    expect(hitTestStar(stars, 200, 200, cp!.x, cp!.y)?.id).toBe('a');
  });

  it('prefers touch data when both touch and click coords exist', () => {
    const mixed = { changedTouches: [{ clientX: 12, clientY: 12 }], clientX: 100, clientY: 100 };
    expect(extractClientPoint(mixed)).toEqual({ x: 12, y: 12 });
  });

  it('returns null when no point data', () => {
    expect(extractClientPoint({})).toBeNull();
  });
});
