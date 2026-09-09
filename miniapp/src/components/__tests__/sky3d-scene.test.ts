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
});
