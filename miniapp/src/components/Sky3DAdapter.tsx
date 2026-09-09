// weapp 专用 3D 天穹：threejs-miniprogram（r108 UMD 外置 vendor），
// 与 H5 版 Sky3D.tsx 同 props 接口，由调用方按 isWeapp() 二选一。
import { useEffect, useRef, useState } from 'react';
import { Canvas, View, Text } from '@tarojs/components';
import { getCanvasRect, getGLCanvasNode, getViewport } from '../web-env';
import { dragDeltaToYawPitch, pinchDistToFov, toCanvasPoint, touchDist } from './sky3d-math';
import type { DrawStar } from '../../../src/lib/drawlist';
import type { StarTrack } from '../../../src/lib/track';
import { COLORS } from '../../../src/lib/tokens';

// adapter 是官方 threejs-miniprogram UMD 包：factory 头部直接写裸 exports 对象，
// webpack 会把它与业务代码 scope-hoisting 内联进同一模块，import * 读出的命名空间
// 里根本没有 createScopedThreejs（线上 Jp is not a function 即此原因）。
// 因此 vendor 不打进 bundle：config.copy 原样拷到页面目录，运行时用 hidden require
//（__non_webpack_require__，webpack 不解析、原样留到小程序端）按官方 demo 方式加载。
declare const __non_webpack_require__: (p: string) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  createScopedThreejs: (canvas: any) => any;
};
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function loadAdapter(): { createScopedThreejs: (canvas: any) => any } {
  // 编译后文件在 dist/pages/index/index.js，同目录 ./threejs-miniprogram.js。
  return __non_webpack_require__('./threejs-miniprogram.js');
}

export const SKY3D_WEAPP_CANVAS_ID = 'skycanvas-weapp';

interface WeappProps {
  stars: DrawStar[];
  track: StarTrack | null;
  selectedId: string | null;
  onSelect?: (id: string | null) => void;
}

export function Sky3DWeapp({ stars, track, selectedId, onSelect }: WeappProps) {
  const camRef = useRef({ yaw: Math.PI, pitch: (25 * Math.PI) / 180 });
  const [err, setErr] = useState<string | null>(null);
  const cbRef = useRef(onSelect);
  cbRef.current = onSelect;
  const dataRef = useRef({ stars, track });
  dataRef.current = { stars, track };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rtRef = useRef<any>(null);
  const touchRef = useRef<{ lastX: number; lastY: number; pinchD: number; moved: boolean } | null>(null);
  const rectRef = useRef<{ left: number; top: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    getCanvasRect(SKY3D_WEAPP_CANVAS_ID).then((r) => { rectRef.current = r; });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    getGLCanvasNode(SKY3D_WEAPP_CANVAS_ID).then((node: any) => {
      if (cancelled) return;
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const THREE: any = loadAdapter().createScopedThreejs(node);
        const vp = getViewport();
        // 场景：天穹渐变球 + 辉光环 + 地面（同原生验证版最小亮机层）
        const camera = new THREE.PerspectiveCamera(65, vp.width / vp.height, 0.1, 2000);
        camera.position.set(0, 2, 0);
        const scene = new THREE.Scene();
        const DOME_R = 400;
        const dome = new THREE.Mesh(
          new THREE.SphereGeometry(DOME_R, 48, 32),
          new THREE.ShaderMaterial({
            side: THREE.BackSide,
            depthWrite: false,
            uniforms: {},
            vertexShader: 'varying vec3 vP; void main(){vP=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
            fragmentShader: [
              'varying vec3 vP;',
              'void main(){',
              '  float h=normalize(vP).y;',
              '  vec3 zen=vec3(.015,.03,.09);',
              '  vec3 mid=vec3(.06,.10,.26);',
              '  vec3 hor=vec3(.35,.28,.32);',
              '  vec3 c=h>0.25?mix(mid,zen,smoothstep(.25,.9,h)):mix(hor,mid,smoothstep(0.,.25,h));',
              '  if(h<0.) c=mix(hor,vec3(.02,.03,.05),smoothstep(0.,-.3,h));',
              '  gl_FragColor=vec4(c,1.);',
              '}',
            ].join('\n'),
          }),
        );
        scene.add(dome);
        const glow = new THREE.Mesh(
          new THREE.TorusGeometry(DOME_R * 0.995, 1.2, 8, 128),
          new THREE.MeshBasicMaterial({ color: 0xe8b45a, transparent: true, opacity: 0.55 }),
        );
        glow.rotation.x = Math.PI / 2;
        scene.add(glow);
        const ground = new THREE.Mesh(
          new THREE.CircleGeometry(DOME_R, 64),
          new THREE.MeshBasicMaterial({ color: 0x0a120c }),
        );
        ground.rotation.x = -Math.PI / 2;
        scene.add(ground);

        const dynamic = new THREE.Group();
        scene.add(dynamic);
        const raycaster = new THREE.Raycaster();
        raycaster.params.Points.threshold = 4;
        const renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(vp.width, vp.height);
        rtRef.current = {
          THREE, camera, scene, dynamic, renderer, raycaster,
          starPos: [] as unknown[], w: vp.width, h: vp.height, DOME_R,
        };
        applyCam();
        rebuildScene();
        const step = () => {
          if (cancelled) return;
          renderer.render(scene, camera);
          node.requestAnimationFrame(step);
        };
        step();
      } catch (e) {
        console.error('[Sky3DWeapp] init failed:', e);
        setErr(e instanceof Error ? e.message : String(e));
      }
    }).catch((e) => {
      console.error('[Sky3DWeapp] canvas node missing:', e);
      setErr(e instanceof Error ? e.message : String(e));
    });
    return () => { cancelled = true; rtRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    rebuildScene();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stars, track]);

  const applyCam = () => {
    const rt = rtRef.current;
    if (!rt) return;
    const { yaw, pitch } = camRef.current;
    const d = new rt.THREE.Vector3(
      Math.sin(yaw) * Math.cos(pitch),
      Math.sin(pitch),
      -Math.cos(yaw) * Math.cos(pitch),
    );
    rt.camera.lookAt(d.clone().multiplyScalar(100).add(rt.camera.position));
  };

  // r108 几何体 API 叫 addAttribute（setAttribute 是 r109+），兼容写法同原生验证版。
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const setAttr = (g: any) => (typeof g.setAttribute === 'function' ? 'setAttribute' : 'addAttribute');

  const rebuildScene = () => {
    const rt = rtRef.current;
    if (!rt) return;
    const { THREE, dynamic } = rt;
    const DOME_R = rt.DOME_R as number;
    while (dynamic.children.length) dynamic.remove(dynamic.children[0]);
    const { stars: objs, track: t } = dataRef.current;
    rt.starPos = objs.map((s: DrawStar) => {
      const az = (s.az * Math.PI) / 180;
      const alt = (s.alt * Math.PI) / 180;
      const r = DOME_R * 0.98;
      return new THREE.Vector3(
        r * Math.cos(alt) * Math.sin(az),
        r * Math.sin(alt),
        -r * Math.cos(alt) * Math.cos(az),
      );
    });
    const c = new THREE.Color();
    const pts = rt.starPos as { x: number; y: number; z: number }[];
    const cols: number[] = [];
    objs.forEach((s: DrawStar) => { c.set(s.color); cols.push(c.r, c.g, c.b); });
    const g = new THREE.BufferGeometry().setFromPoints(pts);
    g[setAttr(g)]('color', new THREE.Float32BufferAttribute(cols, 3));
    const size = 6;
    dynamic.add(new THREE.Points(g, new THREE.PointsMaterial({
      size, sizeAttenuation: false, vertexColors: true,
      transparent: true, opacity: 0.95, depthWrite: false,
    })));
    void t;
    void DOME_R;
  };

  const clientToCanvas = (clientX: number, clientY: number) => {
    const r = rectRef.current;
    if (!r) return { x: clientX, y: clientY };
    return toCanvasPoint(clientX, clientY, r);
  };

  const pickAt = (x: number, y: number): string | null => {
    const rt = rtRef.current;
    if (!rt) return null;
    const ndc = new rt.THREE.Vector2((x / rt.w) * 2 - 1, -(y / rt.h) * 2 + 1);
    rt.raycaster.setFromCamera(ndc, rt.camera);
    let best = -1;
    let bestD = Infinity;
    (rt.starPos as { distanceToPoint?: unknown }[]).forEach((p, i) => {
      const d = rt.raycaster.ray.distanceToPoint(p);
      if (d < bestD) { bestD = d; best = i; }
    });
    if (bestD >= 6 || best < 0) return null;
    return dataRef.current.stars[best]?.id ?? null;
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const onTouchStart = (e: any) => {
    const touches = e?.touches ?? [];
    const t = touches[0] ?? e?.changedTouches?.[0];
    if (!t) return;
    touchRef.current = {
      lastX: t.clientX, lastY: t.clientY,
      pinchD: touches.length >= 2 ? touchDist([touches[0], touches[1]]) : 0,
      moved: false,
    };
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const onTouchMove = (e: any) => {
    const st = touchRef.current;
    const rt = rtRef.current;
    if (!st || !rt) return;
    const touches = e?.touches ?? [];
    if (touches.length >= 2) {
      const d = touchDist([touches[0], touches[1]]);
      if (st.pinchD > 0) {
        rt.camera.fov = pinchDistToFov(rt.camera.fov, st.pinchD, d);
        rt.camera.updateProjectionMatrix();
      }
      st.pinchD = d;
      st.moved = true;
      return;
    }
    const t = touches[0] ?? e?.changedTouches?.[0];
    if (!t) return;
    const dx = t.clientX - st.lastX;
    const dy = t.clientY - st.lastY;
    if (Math.abs(dx) + Math.abs(dy) > 2) st.moved = true;
    const r = dragDeltaToYawPitch(dx, dy, camRef.current.yaw, camRef.current.pitch);
    camRef.current.yaw = r.yaw;
    camRef.current.pitch = r.pitch;
    st.lastX = t.clientX;
    st.lastY = t.clientY;
    applyCam();
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const onTouchEnd = (e: any) => {
    const st = touchRef.current;
    touchRef.current = null;
    if (!st || st.moved) return;
    const t = e?.changedTouches?.[0];
    if (!t) return;
    const p = clientToCanvas(t.clientX, t.clientY);
    cbRef.current?.(pickAt(p.x, p.y));
  };

  const selectedStar = selectedId ? (stars.find((x) => x.id === selectedId) ?? null) : null;
  if (err) {
    return (
      <View data-testid='skydome-fallback' style={{ position: 'relative', background: COLORS.sky, color: COLORS.inkDim, padding: 24, textAlign: 'center' }}>
        <Text>3D 初始化失败：{err}</Text>
        {selectedStar && (
          <View data-testid='selected-tooltip'>
            <Text>{selectedStar.name ?? selectedStar.id}</Text>
          </View>
        )}
      </View>
    );
  }
  const vp = getViewport();
  return (
    <View data-testid='skydome' style={{ position: 'relative', width: '100%', height: '100%' }}>
      <Canvas
        type='webgl'
        canvasId={SKY3D_WEAPP_CANVAS_ID}
        id={SKY3D_WEAPP_CANVAS_ID}
        style={{ width: `${vp.width}px`, height: `${vp.height}px` }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      />
      {selectedStar && (
        <View data-testid='selected-tooltip' style={{ position: 'absolute', top: 12, left: 12 }}>
          <Text>{selectedStar.name ?? selectedStar.id}</Text>
        </View>
      )}
    </View>
  );
}
