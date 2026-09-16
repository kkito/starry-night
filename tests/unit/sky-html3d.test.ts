// tests/unit/sky-html3d.test.ts
import { describe, it, expect } from 'vitest';
import { projectHtml3D } from '../../src/lib/sky-html3d';

describe('projectHtml3D', () => {
  it('正前方星落屏幕中心', () => {
    // yaw=π 朝南，pitch=25°；az=180/alt=25 的星应在中心附近
    const p = projectHtml3D(180, 25, Math.PI, (25 * Math.PI) / 180, 65, 800, 600);
    expect(p).not.toBeNull();
    expect(Math.abs(p!.x - 400)).toBeLessThan(2);
    expect(Math.abs(p!.y - 300)).toBeLessThan(2);
  });
  it('背后星返回 null', () => {
    const p = projectHtml3D(0, 25, Math.PI, (25 * Math.PI) / 180, 65, 800, 600);
    expect(p).toBeNull();
  });
  it('yaw 转 180° 后东西对调', () => {
    const a = projectHtml3D(90, 20, Math.PI, 0.4, 65, 800, 600);
    const b = projectHtml3D(90, 20, 0, 0.4, 65, 800, 600);
    expect(a).not.toBeNull();
    expect(b).not.toBeNull();
    expect((a!.x - 400) * (b!.x - 400)).toBeLessThan(0);
  });
});
