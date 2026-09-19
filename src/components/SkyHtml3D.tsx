// src/components/SkyHtml3D.tsx
import { useEffect, useRef, useState } from 'react';
import { StarTooltip } from './StarTooltip';
import { projectHtml3D } from '@starry/sky-core/lib/sky-html3d';
import { drawSkyScene } from '@starry/sky-core/lib/sky-scene';
import type { DrawStar } from '@starry/sky-core/lib/drawlist';
import type { StarTrack } from '@starry/sky-core/lib/track';

export interface Sky3DProps {
  stars: DrawStar[];
  track: StarTrack | null;
  selectedId: string | null;
  onSelect?: (id: string | null) => void;
}

const PICK_PX = 22;

export function SkyHtml3D({ stars, track, selectedId, onSelect }: Sky3DProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const camRef = useRef({ yaw: Math.PI, pitch: (25 * Math.PI) / 180, fov: 65 });
  const cbRef = useRef(onSelect);
  cbRef.current = onSelect;
  const posRef = useRef<Map<string, { x: number; y: number }>>(new Map());
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
    posRef.current = drawSkyScene(ctx, { w, h, cam: camRef.current, stars, track });
  });

  const pick = (cx: number, cy: number): string | null => {
    let best: string | null = null;
    let bestD = PICK_PX;
    for (const [id, p] of posRef.current) {
      const d = Math.hypot(p.x - cx, p.y - cy);
      if (d < bestD) { bestD = d; best = id; }
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
