// tests/unit/sky-html3d.test.ts
import { describe, it, expect } from 'vitest';
import { projectHtml3D, silhouetteShapes, directionLabels } from '../../src/lib/sky-html3d';

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

// 与 Sky3D 相同的剪影布局：树 az 20/110/200/290，楼 az 43/133/223/313
describe('silhouetteShapes', () => {
  const pitch = (25 * Math.PI) / 180;
  it('共 4 组：4 树 + 4 楼，每栋楼带 4 扇亮窗', () => {
    const shapes = silhouetteShapes(800, 600, Math.PI, pitch, 65);
    expect(shapes.length).toBe(8);
    expect(shapes.filter((s) => s.kind === 'tree').length).toBe(4);
    const blds = shapes.filter((s) => s.kind === 'building');
    expect(blds.length).toBe(4);
    for (const b of blds) expect(b.windows.length).toBe(4);
  });
  it('朝南（yaw=π）时视野 az∈[139.7,220.3]，只有 az200 的树可见，背后组 base 为 null', () => {
    const shapes = silhouetteShapes(800, 600, Math.PI, pitch, 65);
    const vis = shapes.filter((s) => s.base !== null);
    expect(vis.length).toBe(1);
    expect(vis[0]!.kind).toBe('tree');
    expect(vis[0]!.az).toBe(200);
    // 可见的树底边应落在画布内（地平线附近）
    expect(vis[0]!.base!.x).toBeGreaterThan(0);
    expect(vis[0]!.base!.x).toBeLessThan(800);
    expect(vis[0]!.base!.y).toBeLessThan(600);
  });
  it('朝北（yaw=0）时可见组换成 az20 的树（az290 偏 70° 超出半视场被剔除）', () => {
    const shapes = silhouetteShapes(800, 600, 0, pitch, 65);
    const vis = shapes.filter((s) => s.base !== null);
    expect(vis.length).toBe(1);
    expect(vis[0]!.kind).toBe('tree');
    expect(vis[0]!.az).toBe(20);
  });
});

// 与 Sky3D 相同的方位标注：北0/东90/南180/西270，正东金色高亮
describe('directionLabels', () => {
  const pitch = (25 * Math.PI) / 180;
  it('共 4 条：北/东/南/西，az 映射正确', () => {
    const labels = directionLabels(800, 600, Math.PI, pitch, 65);
    expect(labels.length).toBe(4);
    const byAzText = labels.map((l) => l.text).sort().join('');
    expect(byAzText).toBe('东北南西');
    const east = labels.find((l) => l.text === '东')!;
    expect(east.color).toBe('#e8b45a');
    const north = labels.find((l) => l.text === '北')!;
    expect(north.color).not.toBe('#e8b45a');
  });
  it('朝南（yaw=π）时只有「南」可见，且在画布中部', () => {
    const labels = directionLabels(800, 600, Math.PI, pitch, 65);
    const vis = labels.filter((l) => l.p !== null);
    expect(vis.length).toBe(1);
    expect(vis[0]!.text).toBe('南');
    expect(vis[0]!.p!.x).toBeGreaterThan(300);
    expect(vis[0]!.p!.x).toBeLessThan(500);
    expect(vis[0]!.p!.y).toBeLessThan(600);
  });
  it('朝北（yaw=0）时换成「北」可见', () => {
    const labels = directionLabels(800, 600, 0, pitch, 65);
    const vis = labels.filter((l) => l.p !== null);
    expect(vis.length).toBe(1);
    expect(vis[0]!.text).toBe('北');
  });
});
