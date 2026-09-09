import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { azLineEnds, ringPoints, splitTrackSegments } from '../sky3d-scene';
import type { StarTrack } from '../../../../src/lib/track';

const track = (alts: number[], pastCount: number): StarTrack => ({
  id: 's1',
  pastCount,
  points: alts.map((alt, i) => ({ x: 0, y: 0, alt, az: i * 10 })),
});

describe('sky3d-scene', () => {
  it('splitTrackSegments 按 pastCount 分过去/未来，跳过地平线下段', () => {
    const t = track([10, 20, -5, 30, 40], 2);
    const { past, future } = splitTrackSegments(t);
    // past: i=1(10→20) 一段； i=2 (20→-5) 含地平线下跳过；future: i=3 跳过(-5→30)，i=4 (30→40) 一段
    expect(past).toHaveLength(1);
    expect(future).toHaveLength(1);
    // TrackSeg 存投影后 DomeVec：按 y 高度区分（alt 10° vs 30°）
    expect(past[0]!.a.y).toBeLessThan(future[0]!.a.y);
  });
  it('splitTrackSegments 空轨迹返回空', () => {
    expect(splitTrackSegments(null)).toEqual({ past: [], future: [] });
  });
  it('ringPoints 闭环：首尾重合、y 一致', () => {
    const pts = ringPoints(30, 400, 90);
    expect(pts.length).toBeGreaterThan(4);
    const first = pts[0]!;
    const last = pts[pts.length - 1]!;
    expect(last.x).toBeCloseTo(first.x, 9);
    expect(last.z).toBeCloseTo(first.z, 9);
    for (const p of pts) expect(p.y).toBeCloseTo(400 * Math.sin((30 * Math.PI) / 180), 9);
  });
  it('azLineEnds 从地平画到高空', () => {
    const [a, b] = azLineEnds(90, 400);
    expect(a!.y).toBeCloseTo(0, 9);
    expect(b!.y).toBeGreaterThan(a!.y);
  });
  it('adapter 精细化与 H5 对齐：分桶星点/实虚线轨迹/剪影/方位标注/仰角标注', () => {
    const src = fs.readFileSync(path.resolve(__dirname, '../Sky3DAdapter.tsx'), 'utf8');
    // 星点按 pointSizeFor 分桶（H5 版 buildStars 同款）
    expect(src).toContain('pointSizeFor');
    expect(src).toContain('buckets');
    // 轨迹过去实线/未来虚线（splitTrackSegments + LineDashedMaterial）
    expect(src).toContain('splitTrackSegments');
    expect(src).toContain('LineDashedMaterial');
    // 剪影树+楼
    expect(src).toContain('CylinderGeometry');
    expect(src).toContain('BoxGeometry');
    // 方位标注 + 仰角度数标注
    expect(src).toContain('directionLabel');
    expect(src).toContain('SILHOUETTE_GROUPS');
  });
  it('adapter 星点是圆形：PointsMaterial 挂 circleTexture map（同 H5 版 buildStars）', () => {
    const src = fs.readFileSync(path.resolve(__dirname, '../Sky3DAdapter.tsx'), 'utf8');
    expect(src).toContain('circleTexture');
    expect(src).toMatch(/map:\s*rt\.starTex/);
  });
  it('选中标签画在 three.js 场景里：rebuild 按 selectedId 挂 Sprite，不用 CoverView', () => {
    // CoverView 盖 webgl canvas 定位/样式受限，标签跟星走必须进场景（同方位标注 directionLabel 原理）。
    const src = fs.readFileSync(path.resolve(__dirname, '../Sky3DAdapter.tsx'), 'utf8');
    expect(src).toContain('selectedStarLabel');
    expect(src).toMatch(/selectedId/);
    // dynamic 重建必须消费 selectedId，否则切星不换标签
    expect(src).toMatch(/dataRef\.current\s*=\s*\{\s*stars,\s*track,\s*selectedId/);
    expect(src).not.toContain('CoverView');
  });
  it('选中标签内容与 H5 StarTooltip 对齐：nameEn/alt/az/distAu 都画进去', () => {
    // H5 StarTooltip 有 5 行：星名/nameEn/mag/alt-az/distAu；Sprite 之前只画了星名+mag。
    const src = fs.readFileSync(path.resolve(__dirname, '../Sky3DAdapter.tsx'), 'utf8');
    expect(src).toContain('selectedStarLabel');
    expect(src).toContain('nameEn');
    expect(src).toContain('distAu');
    // 位置：标签底边必须浮在光晕之上——按标签实际半高动态留空隙，
    // 固定抬升（如 y+34）在 5 行标签时半高 20 + 光晕 14，底边只差 3 个单位必然重叠。
    expect(src).toMatch(/label\.scale\.y\s*\/\s*2/);
  });
});
