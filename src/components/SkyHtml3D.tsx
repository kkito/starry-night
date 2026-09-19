// src/components/SkyHtml3D.tsx
import { useEffect, useRef, useState } from 'react';
import { pointSizeFor } from '@starry/sky-core/lib/dome';
import { COLORS } from '@starry/sky-core/lib/tokens';
import { StarTooltip } from './StarTooltip';
import { projectHtml3D, silhouetteShapes, silhouettePx, directionLabels } from '@starry/sky-core/lib/sky-html3d';
import type { Sky3DProps } from './Sky3D';

const ALT_RINGS = [10, 20, 30, 45, 60];
const PICK_PX = 22;

export function SkyHtml3D({ stars, track, selectedId, onSelect }: Sky3DProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const camRef = useRef({ yaw: Math.PI, pitch: (25 * Math.PI) / 180, fov: 65 });
  const dataRef = useRef({ stars, track });
  dataRef.current = { stars, track };
  const cbRef = useRef(onSelect);
  cbRef.current = onSelect;
  const [, force] = useState(0);
  const [viewSize, setViewSize] = useState({ w: 800, h: 600 });

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const w = (canvas.width = wrap.clientWidth || 800);
    const h = (canvas.height = wrap.clientHeight || 600);
    setViewSize((prev) => (prev.w === w && prev.h === h ? prev : { w, h }));
    const { yaw, pitch, fov } = camRef.current;
    // 天穹渐变：按像素高度插值（与 Sky3D shader 同色标 zen/mid/hor）
    // 测试 mock 的 ctx.createLinearGradient 可能不返回 gradient 对象，做防御性兜底
    const g = ctx.createLinearGradient(0, 0, 0, h) as unknown as CanvasGradient | undefined;
    if (g && typeof g.addColorStop === 'function') {
      g.addColorStop(0, '#040814');
      g.addColorStop(0.5, '#0f1a42');
      g.addColorStop(0.75, '#594a52');
      g.addColorStop(1, '#05080d');
      ctx.fillStyle = g;
    } else {
      ctx.fillStyle = '#040814';
    }
    ctx.fillRect(0, 0, w, h);
    // 地平线辉光
    const horP = projectHtml3D(yaw * 180 / Math.PI, 0, yaw, pitch, fov, w, h);
    ctx.strokeStyle = 'rgba(232,180,90,.55)';
    ctx.beginPath();
    ctx.ellipse(w / 2, horP?.y ?? h * 0.75, w * 0.48, 8, 0, 0, Math.PI * 2);
    ctx.stroke();
    // 仰角圈
    ctx.strokeStyle = 'rgba(68,80,122,.6)';
    for (const alt of ALT_RINGS) {
      ctx.beginPath();
      let started = false;
      for (let az = 0; az <= 360; az += 3) {
        const p = projectHtml3D(az, alt, yaw, pitch, fov, w, h);
        if (!p) { started = false; continue; }
        if (!started) { ctx.moveTo(p.x, p.y); started = true; } else ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();
    }
    // 方位线（经线）：每 30° 一条，alt 0 → 70
    ctx.strokeStyle = 'rgba(68,80,122,.35)';
    for (let az = 0; az < 360; az += 30) {
      ctx.beginPath();
      let started = false;
      for (let alt = 0; alt <= 70; alt += 5) {
        const p = projectHtml3D(az, alt, yaw, pitch, fov, w, h);
        if (!p) { started = false; continue; }
        if (!started) { ctx.moveTo(p.x, p.y); started = true; } else ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();
    }
    // 方位标注：东南西北（正东金色高亮）
    ctx.font = '14px system-ui, "PingFang SC", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const l of directionLabels(w, h, yaw, pitch, fov)) {
      if (!l.p) continue;
      ctx.fillStyle = l.color;
      ctx.fillText(l.text, l.p.x, l.p.y);
    }
    // 剪影：树 + 楼 + 亮窗（方位与 Sky3D 一致，底边落在地平线上）
    for (const shape of silhouetteShapes(w, h, yaw, pitch, fov)) {
      if (!shape.base) continue;
      const { pw, ph } = silhouettePx(shape, h, fov);
      const bx = shape.base.x;
      const by = shape.base.y;
      if (shape.kind === 'tree') {
        ctx.fillStyle = 'rgba(6,13,10,.75)';
        ctx.fillRect(bx - pw * 0.08, by - ph * 0.35, pw * 0.16, ph * 0.35);
        ctx.beginPath();
        ctx.moveTo(bx, by - ph);
        ctx.lineTo(bx - pw / 2, by - ph * 0.22);
        ctx.lineTo(bx + pw / 2, by - ph * 0.22);
        ctx.closePath();
        ctx.fill();
      } else {
        ctx.fillStyle = 'rgba(10,16,36,.75)';
        ctx.fillRect(bx - pw / 2, by - ph, pw, ph);
        ctx.fillStyle = 'rgba(255,220,120,.9)';
        for (const win of shape.windows) {
          const wx = bx + win.dxN * pw;
          const wy = by - win.dyN * ph;
          const ws = Math.max(3, ph * 0.06);
          ctx.fillRect(wx - ws / 2, wy - ws / 2, ws, ws);
        }
      }
    }
    // 轨迹：过去实线 / 未来虚线
    const t = dataRef.current.track;
    if (t) {
      const segs: Array<{ a: { x: number; y: number }; b: { x: number; y: number }; future: boolean }> = [];
      for (let i = 1; i < t.points.length; i++) {
        const a = t.points[i - 1]!;
        const b = t.points[i]!;
        if (a.alt <= 0 || b.alt <= 0) continue;
        const pa = projectHtml3D(a.az, a.alt, yaw, pitch, fov, w, h);
        const pb = projectHtml3D(b.az, b.alt, yaw, pitch, fov, w, h);
        if (!pa || !pb) continue;
        segs.push({ a: pa, b: pb, future: i > t.pastCount });
      }
      ctx.strokeStyle = COLORS.accent;
      for (const future of [false, true]) {
        ctx.setLineDash(future ? [5, 5] : []);
        ctx.beginPath();
        for (const s of segs.filter((x) => x.future === future)) {
          ctx.moveTo(s.a.x, s.a.y);
          ctx.lineTo(s.b.x, s.b.y);
        }
        ctx.stroke();
      }
      ctx.setLineDash([]);
    }
    // 星点
    for (const s of dataRef.current.stars) {
      const p = projectHtml3D(s.az, s.alt, yaw, pitch, fov, w, h);
      if (!p) continue;
      (s as unknown as { _sx?: number; _sy?: number })._sx = p.x;
      (s as unknown as { _sy?: number })._sy = p.y;
      ctx.fillStyle = s.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, pointSizeFor(s.rPx) / 2, 0, Math.PI * 2);
      ctx.fill();
    }
  });

  const pick = (cx: number, cy: number): string | null => {
    let best: string | null = null;
    let bestD = PICK_PX;
    for (const s of dataRef.current.stars) {
      const sx = (s as unknown as { _sx?: number })._sx;
      const sy = (s as unknown as { _sy?: number })._sy;
      if (sx === undefined || sy === undefined) continue;
      const d = Math.hypot(sx - cx, sy - cy);
      if (d < bestD) { bestD = d; best = s.id; }
    }
    return best;
  };

  const downRef = useRef<{ x: number; y: number } | null>(null);
  const selectedStar = selectedId ? (stars.find((x) => x.id === selectedId) ?? null) : null;
  const cam = camRef.current;
  const selectedPos = selectedStar
    ? projectHtml3D(selectedStar.az, selectedStar.alt, cam.yaw, cam.pitch, cam.fov, viewSize.w, viewSize.h)
    : null;
  return (
    <div ref={wrapRef} data-testid="skydome-html3d" style={{ position: 'relative', width: '100%', height: '100%', touchAction: 'none' }}>
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: '100%', display: 'block' }}
        onPointerDown={(e) => { downRef.current = { x: e.clientX, y: e.clientY }; }}
        onPointerMove={(e) => {
          const d = downRef.current;
          if (!d) return;
          const cam = camRef.current;
          cam.yaw -= (e.clientX - d.x) * 0.003;
          const min = 0.9 * (((cam.fov * Math.PI) / 180) / 2);
          cam.pitch = Math.max(min, Math.min(1.2, cam.pitch + (e.clientY - d.y) * 0.002));
          downRef.current = { x: e.clientX, y: e.clientY };
          force((n) => n + 1);
        }}
        onPointerUp={(e) => {
          const d = downRef.current;
          downRef.current = null;
          if (!d) return;
          if (Math.abs(e.clientX - d.x) + Math.abs(e.clientY - d.y) > 3) return;
          const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
          cbRef.current?.(pick(e.clientX - rect.left, e.clientY - rect.top));
        }}
        onWheel={(e) => {
          const cam = camRef.current;
          cam.fov = Math.max(30, Math.min(100, cam.fov + e.deltaY * 0.02));
          force((n) => n + 1);
        }}
      />
      {selectedStar && selectedPos && (
        <div
          data-testid="selected-tooltip"
          data-x={selectedPos.x}
          data-y={selectedPos.y}
          style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
        >
          <StarTooltip star={selectedStar} x={selectedPos.x} y={selectedPos.y} />
        </div>
      )}
    </div>
  );
}
