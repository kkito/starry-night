import { describe, expect, it } from 'vitest';
import { canvasSize } from '../canvas-size';

describe('canvasSize（来源：根 src/App.tsx，I4 双端一致）', () => {
  it('auto 跟随视口原尺寸', () => {
    expect(canvasSize({ width: 375, height: 667 }, 'auto')).toEqual({ width: 375, height: 667 });
  });

  it('landscape 固定 16:9 且不超出视口', () => {
    const { width, height } = canvasSize({ width: 375, height: 667 }, 'landscape');
    expect(width / height).toBeCloseTo(16 / 9, 9);
    expect(width).toBeLessThanOrEqual(375);
    expect(height).toBeLessThanOrEqual(667);
  });

  it('portrait 固定 9:16 且不超出视口', () => {
    const { width, height } = canvasSize({ width: 800, height: 600 }, 'portrait');
    expect(width / height).toBeCloseTo(9 / 16, 9);
    expect(width).toBeLessThanOrEqual(800);
    expect(height).toBeLessThanOrEqual(600);
  });
});
