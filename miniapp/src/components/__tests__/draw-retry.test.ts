import { describe, expect, it, vi } from 'vitest';

vi.mock('@tarojs/components', () => ({ Canvas: 'canvas', View: 'div', Text: 'span' }));
vi.mock('@tarojs/taro', () => ({ createSelectorQuery: vi.fn() }));

import { MAX_DRAW_RETRIES, tryDrawWithRetry } from '../StarChart';

const ARGS = { width: 200, height: 200, stars: [], mirror: false, shape: 'ellipse', track: null } as any;

function flush(): Promise<void> {
  return new Promise((r) => setTimeout(r, 0));
}

describe('tryDrawWithRetry', () => {
  it('retries after first failure and draws on second success', async () => {
    const err = new Error('node missing');
    const node = { getContext: vi.fn(() => ({})) };
    const getNode = vi.fn().mockRejectedValueOnce(err).mockResolvedValueOnce(node);
    const scheduled: Array<() => void> = [];
    const draw = vi.fn();
    const onOk = vi.fn();
    const onFail = vi.fn();
    tryDrawWithRetry({ canvasId: 'starchart', getNode, schedule: (fn) => { scheduled.push(fn); }, draw, args: ARGS, onOk, onFail });
    await flush();
    expect(draw).not.toHaveBeenCalled();
    expect(scheduled).toHaveLength(1);
    scheduled[0]!();
    await flush();
    expect(draw).toHaveBeenCalledTimes(1);
    expect(onOk).toHaveBeenCalledTimes(1);
    expect(onFail).not.toHaveBeenCalled();
  });

  it('calls onFail after exceeding max retries', async () => {
    const getNode = vi.fn().mockRejectedValue(new Error('always missing'));
    const scheduled: Array<() => void> = [];
    const draw = vi.fn();
    const onFail = vi.fn();
    tryDrawWithRetry({ canvasId: 'starchart', getNode, schedule: (fn) => { scheduled.push(fn); }, draw, args: ARGS, onFail });
    for (let i = 0; i <= MAX_DRAW_RETRIES; i++) {
      await flush();
      scheduled[i]?.();
    }
    await flush();
    expect(draw).not.toHaveBeenCalled();
    expect(onFail).toHaveBeenCalledTimes(1);
    expect(getNode).toHaveBeenCalledTimes(MAX_DRAW_RETRIES + 1);
  });
});
