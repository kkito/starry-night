import { useEffect, useRef, useState } from 'react';
import { Canvas, View, Text } from '@tarojs/components';
import * as THREE from 'three';
import { altAzToVec, DOME_R, pointSizeFor } from '../../../src/lib/dome';
import type { DrawStar } from '../../../src/lib/drawlist';
import type { StarTrack } from '../../../src/lib/track';
import { COLORS } from '../../../src/lib/tokens';
import { clampPixelRatio, getCanvasRect, getGLCanvasNode, getViewport, makeOffscreen, nextFrame } from '../web-env';
import {
  dragDeltaToYawPitch,
  pinchDistToFov,
  toCanvasPoint,
  touchDist,
} from './sky3d-math';

export interface Sky3DProps {
  stars: DrawStar[];
  track: StarTrack | null;
  selectedId: string | null;
  onSelect?: (id: string | null) => void;
}

export const SKY3D_CANVAS_ID = 'skycanvas';

const ALT_RINGS = [10, 20, 30, 45, 60];
const RING_COLOR = 0x44507a;

function domeMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {},
    vertexShader: 'varying vec3 vP; void main(){vP=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: `varying vec3 vP;
      void main(){
        float h=normalize(vP).y;
        vec3 zen=vec3(.015,.03,.09);
        vec3 mid=vec3(.06,.10,.26);
        vec3 hor=vec3(.35,.28,.32);
        vec3 c=h>0.25?mix(mid,zen,smoothstep(.25,.9,h)):mix(hor,mid,smoothstep(0.,.25,h));
        if(h<0.) c=mix(hor,vec3(.02,.03,.05),smoothstep(0.,-.3,h));
        gl_FragColor=vec4(c,1.);
      }`,
  });
}

function silhouette<T extends THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>>(mesh: T): T {
  mesh.material.transparent = true;
  mesh.material.opacity = 0.45;
  mesh.material.depthWrite = false;
  return mesh;
}

/** 星点圆形纹理：PointsMaterial 默认是方块，用径向渐变贴图画成圆点。（离屏 canvas 经 makeOffscreen 适配 weapp/H5） */
function circleTexture(): THREE.CanvasTexture {
  const canvas = makeOffscreen(64, 64);
  const ctx = canvas.getContext('2d')!;
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.5, 'rgba(255,255,255,1)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(canvas);
}

function directionLabel(text: string, color = '#e8b45a'): THREE.Sprite {
  const canvas = makeOffscreen(128, 64);
  const ctx = canvas.getContext('2d')!;
  ctx.font = '40px system-ui, "PingFang SC", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  ctx.fillText(text, 64, 34);
  const tex = new THREE.CanvasTexture(canvas);
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, depthTest: false });
  const sp = new THREE.Sprite(mat);
  sp.scale.set(36, 18, 1);
  return sp;
}

const disposeObj = (o: THREE.Object3D) => {
  o.traverse((child) => {
    const mesh = child as THREE.Mesh;
    const g = mesh.geometry as THREE.BufferGeometry | undefined;
    g?.dispose?.();
    const m = mesh.material as THREE.Material | THREE.Material[] | undefined;
    // M3：SpriteMaterial 的 map（方位文字/星点纹理）需单独 dispose，否则显存泄漏。
    const disposeMap = (x: THREE.Material) => {
      const withMap = x as THREE.Material & { map?: { dispose?: () => void } | null };
      withMap.map?.dispose?.();
      x.dispose?.();
    };
    if (Array.isArray(m)) m.forEach(disposeMap);
    else if (m) disposeMap(m);
  });
};

export function Sky3D({ stars, track, selectedId, onSelect }: Sky3DProps) {
  const camRef = useRef({ yaw: (180 * Math.PI) / 180, pitch: (25 * Math.PI) / 180 });
  const [noGL, setNoGL] = useState(false);
  const cbRef = useRef(onSelect);
  cbRef.current = onSelect;
  const dataRef = useRef({ stars, track });
  dataRef.current = { stars, track };
  const selectedIdRef = useRef(selectedId);
  selectedIdRef.current = selectedId;

  // three 对象全部收拢在 ref，供 touch 回调与重建使用
  const rtRef = useRef<{
    camera: THREE.PerspectiveCamera;
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    dynamic: THREE.Group;
    starPos: THREE.Vector3[];
    starTex: THREE.CanvasTexture;
    raycaster: THREE.Raycaster;
    w: number;
    h: number;
  } | null>(null);
  const touchRef = useRef<{ lastX: number; lastY: number; pinchD: number; moved: boolean } | null>(null);
  // 画布 rect 缓存：首帧获取后复用；上方有 viewmode-switch 切换条，裸 client 坐标有 y 系统性偏移。
  // 判端走 web-env.getCanvasRect（按 TARO_ENV 判）：不能用 typeof document 判端，
  // Taro weapp 运行时也有 document 垫片，其元素没有 getBoundingClientRect，会炸。
  const rectRef = useRef<{ left: number; top: number } | null>(null);

  const queryCanvasRect = () => {
    getCanvasRect(SKY3D_CANVAS_ID).then((r) => { rectRef.current = r; });
  };

  /** client 点换算为画布内点：有 rect 则减偏移，否则回退全屏假设。 */
  const clientToCanvas = (clientX: number, clientY: number) => {
    const r = rectRef.current;
    if (!r) {
      console.warn('[Sky3D] no canvas rect cached, falling back to fullscreen assumption');
      return { x: clientX, y: clientY };
    }
    return toCanvasPoint(clientX, clientY, r);
  };

  // 选中不碰视角：与 Web 版一致，点击只叠加轨迹+tooltip，相机 yaw/pitch 完全由用户拖拽决定。
  const applyCam = () => {
    const rt = rtRef.current;
    if (!rt) return;
    const { yaw, pitch } = camRef.current;
    const d = new THREE.Vector3(
      Math.sin(yaw) * Math.cos(pitch),
      Math.sin(pitch),
      -Math.cos(yaw) * Math.cos(pitch),
    );
    rt.camera.lookAt(d.clone().multiplyScalar(100).add(rt.camera.position));
  };

  const buildStars = (rt: { starPos: THREE.Vector3[]; starTex: THREE.CanvasTexture }, starObjs: DrawStar[]) => {
    rt.starPos.length = 0;
    for (const s of starObjs) {
      const v = altAzToVec(s.az, s.alt, DOME_R * 0.98);
      rt.starPos.push(new THREE.Vector3(v.x, v.y, v.z));
    }
    const group = new THREE.Group();
    const buckets = new Map<number, number[]>();
    for (let i = 0; i < starObjs.length; i++) {
      const size = pointSizeFor(starObjs[i]!.rPx);
      let b = buckets.get(size);
      if (!b) { b = []; buckets.set(size, b); }
      b.push(i);
    }
    const c = new THREE.Color();
    for (const [size, idxs] of buckets) {
      const pts = idxs.map((i) => rt.starPos[i]!);
      const cols: number[] = [];
      for (const i of idxs) {
        c.set(starObjs[i]!.color);
        cols.push(c.r, c.g, c.b);
      }
      const g = new THREE.BufferGeometry().setFromPoints(pts);
      g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
      const m = new THREE.PointsMaterial({ map: rt.starTex, size, sizeAttenuation: false, vertexColors: true, transparent: true, opacity: 0.95, depthWrite: false });
      group.add(new THREE.Points(g, m));
    }
    return group;
  };

  const buildTrack = (t: StarTrack | null): THREE.Object3D[] => {
    if (!t) return [];
    const past: THREE.Vector3[] = [];
    const future: THREE.Vector3[] = [];
    for (let i = 1; i < t.points.length; i++) {
      const a = t.points[i - 1]!;
      const b = t.points[i]!;
      if (a.alt <= 0 || b.alt <= 0) continue;
      const va = altAzToVec(a.az, a.alt, DOME_R * 0.98);
      const vb = altAzToVec(b.az, b.alt, DOME_R * 0.98);
      const seg = [new THREE.Vector3(va.x, va.y, va.z), new THREE.Vector3(vb.x, vb.y, vb.z)];
      (i <= t.pastCount ? past : future).push(...seg);
    }
    const out: THREE.Object3D[] = [];
    if (past.length) {
      out.push(new THREE.LineSegments(
        new THREE.BufferGeometry().setFromPoints(past),
        new THREE.LineBasicMaterial({ color: new THREE.Color(COLORS.accent) }),
      ));
    }
    if (future.length) {
      const l = new THREE.LineSegments(
        new THREE.BufferGeometry().setFromPoints(future),
        new THREE.LineDashedMaterial({ color: new THREE.Color(COLORS.accent), dashSize: 5, gapSize: 5 }),
      );
      l.computeLineDistances();
      out.push(l);
    }
    return out;
  };

  const rebuildScene = (starObjs: DrawStar[], t: StarTrack | null) => {
    const rt = rtRef.current;
    if (!rt) return;
    for (const o of [...rt.dynamic.children]) {
      rt.dynamic.remove(o);
      disposeObj(o);
    }
    rt.dynamic.add(buildStars(rt, starObjs), ...buildTrack(t));
  };

  // 星星/轨迹 prop 更新时重建动态场景对象（与 Web 版 rebuildSceneRef 语义一致）
  useEffect(() => {
    rebuildScene(stars, track);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stars, track]);

  useEffect(() => {
    let cancelled = false;
    let cancelLoop: (() => void) | null = null;
    queryCanvasRect();
    // three 已降级到 0.158（见 miniapp/package.json）：最后一个带 webgl2→webgl 回退的版本，
    // 小程序 getContext 只认 'webgl' 也能拿到上下文。把 node 直接当 canvas 传给 three，
    // 让 three 自己按 ['webgl2','webgl','experimental-webgl'] 顺序回退。
    // 注意：node 必须补 addEventListener/setAttribute 垫片（three 初始化时要调）。
    getGLCanvasNode(SKY3D_CANVAS_ID).then((node: any) => {
      if (cancelled) return;
      let renderer: THREE.WebGLRenderer;
      try {
        if (typeof node?.getContext !== 'function') { setNoGL(true); return; }
        if (typeof node.addEventListener !== 'function') node.addEventListener = () => {};
        if (typeof node.removeEventListener !== 'function') node.removeEventListener = () => {};
        if (typeof node.setAttribute !== 'function') node.setAttribute = () => {};
        renderer = new THREE.WebGLRenderer({ canvas: node, antialias: true, alpha: true });
      } catch {
        setNoGL(true);
        return;
      }
      const vp = getViewport();
      const w = vp.width;
      const h = vp.height;
      renderer.setPixelRatio(clampPixelRatio(vp.pixelRatio));
      renderer.setSize(w, h);

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(65, w / h, 0.1, 2000);
      camera.position.set(0, 2, 0);
      const starTex = circleTexture();

      // 天穹 + 辉光环 + 地面（M1 最小亮机层）
      scene.add(new THREE.Mesh(new THREE.SphereGeometry(DOME_R, 48, 32), domeMaterial()));
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

      // 仰角圈 + 方位线 + 仰角度数标注
      const RING_OPACITY = [0.6, 0.5, 0.5, 0.4, 0.35];
      ALT_RINGS.forEach((alt, i) => {
        const pts: THREE.Vector3[] = [];
        for (let az = 0; az <= 360; az += 3) {
          const v = altAzToVec(az, alt, DOME_R * 0.985);
          pts.push(new THREE.Vector3(v.x, v.y, v.z));
        }
        scene.add(new THREE.Line(
          new THREE.BufferGeometry().setFromPoints(pts),
          new THREE.LineBasicMaterial({ color: RING_COLOR, transparent: true, opacity: RING_OPACITY[i] ?? 0.5 }),
        ));
      });
      for (const alt of ALT_RINGS) {
        for (const az of [0, 90, 180, 270] as const) {
          const v = altAzToVec(az, alt, DOME_R * 0.985);
          const sp = directionLabel(`${alt}°`, '#8ea0c8');
          sp.position.set(v.x, v.y + 2, v.z);
          sp.scale.set(18, 9, 1);
          scene.add(sp);
        }
      }
      for (let az = 0; az < 360; az += 30) {
        const a = altAzToVec(az, 0, DOME_R * 0.985);
        const b = altAzToVec(az, 70, DOME_R * 0.985);
        scene.add(new THREE.Line(
          new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(a.x, a.y, a.z), new THREE.Vector3(b.x, b.y, b.z)]),
          new THREE.LineBasicMaterial({ color: RING_COLOR, transparent: true, opacity: 0.35 }),
        ));
      }

      // 剪影：每 90° 一组树 + 楼（共 4 组，半透明）
      const SILHOUETTE_GROUPS = [
        { treeAz: 20, bldAz: 43 },
        { treeAz: 110, bldAz: 133 },
        { treeAz: 200, bldAz: 223 },
        { treeAz: 290, bldAz: 313 },
      ];
      {
        const winPts: number[] = [];
        for (const g of SILHOUETTE_GROUPS) {
          const td = altAzToVec(g.treeAz, 0, DOME_R * 0.55);
          const tree = new THREE.Group();
          const trunk = silhouette(new THREE.Mesh(
            new THREE.CylinderGeometry(1.2, 1.6, 10, 8),
            new THREE.MeshBasicMaterial({ color: 0x060d0a }),
          ));
          trunk.position.y = 5;
          const top = silhouette(new THREE.Mesh(
            new THREE.ConeGeometry(9, 22, 10),
            new THREE.MeshBasicMaterial({ color: 0x060d0a }),
          ));
          top.position.y = 20;
          tree.add(trunk, top);
          tree.position.set(td.x, 0, td.z);
          scene.add(tree);

          const bd = altAzToVec(g.bldAz, 0, DOME_R * 0.55);
          const b = silhouette(new THREE.Mesh(
            new THREE.BoxGeometry(22, 38, 10),
            new THREE.MeshBasicMaterial({ color: 0x0a1024 }),
          ));
          b.position.set(bd.x, 19, bd.z);
          b.lookAt(0, 19, 0);
          b.updateMatrixWorld();
          scene.add(b);
          const lit: Array<[number, number]> = [[0, 3], [2, 2], [1, 1], [2, 0]];
          for (const [cIdx, r] of lit) {
            const off = new THREE.Vector3(-7 + cIdx * 7, 8 + r * 8, 5.2).applyQuaternion(b.quaternion);
            winPts.push(bd.x + off.x, off.y, bd.z + off.z);
          }
        }
        const winG = new THREE.BufferGeometry();
        winG.setAttribute('position', new THREE.Float32BufferAttribute(winPts, 3));
        scene.add(new THREE.Points(winG, new THREE.PointsMaterial({ color: 0xffdc78, size: 8, sizeAttenuation: false, transparent: true, opacity: 0.9, depthWrite: false })));
      }

      // 地平线方位标注：东/南/西/北
      for (const [az, text] of [[0, '北'], [90, '东'], [180, '南'], [270, '西']] as const) {
        const v = altAzToVec(az, 4, DOME_R * 0.97);
        const sp = directionLabel(text, az === 90 ? '#e8b45a' : '#9aa5c4');
        sp.position.set(v.x, v.y, v.z);
        scene.add(sp);
      }

      const dynamic = new THREE.Group();
      scene.add(dynamic);
      const raycaster = new THREE.Raycaster();
      (raycaster.params.Points as any).threshold = 4;
      rtRef.current = { camera, renderer, scene, dynamic, starPos: [], starTex, raycaster, w, h };
      applyCam();
      rebuildScene(dataRef.current.stars, dataRef.current.track);

      const step = () => {
        if (cancelled) return;
        renderer.render(scene, camera);
        cancelLoop = nextFrame(step);
      };
      step();
    }).catch(() => setNoGL(true));
    return () => {
      cancelled = true;
      cancelLoop?.();
      const rt = rtRef.current;
      rtRef.current = null;
      if (rt) {
        disposeObj(rt.scene);
        rt.renderer.dispose();
        rt.starTex.dispose();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** NDC 拾取：返回命中星星 id 或 null（tap 容差沿用 Web 版的 ray 距离 < 6）。 */
  const pickAt = (x: number, y: number): string | null => {
    const rt = rtRef.current;
    if (!rt) return null;
    const ndc = new THREE.Vector2((x / rt.w) * 2 - 1, -(y / rt.h) * 2 + 1);
    rt.raycaster.setFromCamera(ndc, rt.camera);
    let best = -1;
    let bestD = Infinity;
    for (let i = 0; i < rt.starPos.length; i++) {
      const d = rt.raycaster.ray.distanceToPoint(rt.starPos[i]!);
      if (d < bestD) { bestD = d; best = i; }
    }
    if (bestD >= 6 || best < 0) return null;
    return dataRef.current.stars[best]?.id ?? null;
  };

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
    if (Math.abs(t.clientX - st.lastX) + Math.abs(t.clientY - st.lastY) > 2) st.moved = true;
    const r = dragDeltaToYawPitch(dx, dy, camRef.current.yaw, camRef.current.pitch);
    camRef.current.yaw = r.yaw;
    camRef.current.pitch = r.pitch;
    st.lastX = t.clientX;
    st.lastY = t.clientY;
    applyCam();
  };
  const onTouchEnd = (e: any) => {
    const st = touchRef.current;
    touchRef.current = null;
    if (!st || st.moved) return;
    const t = e?.changedTouches?.[0];
    if (!t) return;
    const p = clientToCanvas(t.clientX, t.clientY);
    cbRef.current?.(pickAt(p.x, p.y));
  };

  const onPickClick = (e: any) => {
    const t = e?.changedTouches?.[0] ?? e;
    if (t?.clientX == null || t?.clientY == null) return;
    const p = clientToCanvas(t.clientX, t.clientY);
    cbRef.current?.(pickAt(p.x, p.y));
  };

  const selectedStar = selectedId ? (stars.find((x) => x.id === selectedId) ?? null) : null;
  if (noGL) {
    return (
      <View data-testid='skydome-fallback' style={{ position: 'relative', background: COLORS.sky, color: COLORS.inkDim, padding: 24, textAlign: 'center' }}>
        <Text>当前环境不支持 WebGL，无法显示 3D 天穹</Text>
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
        canvasId={SKY3D_CANVAS_ID}
        id={SKY3D_CANVAS_ID}
        style={{ width: `${vp.width}px`, height: `${vp.height}px` }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onClick={onPickClick}
      />
      {selectedStar && (
        <View data-testid='selected-tooltip' style={{ position: 'absolute', top: 12, left: 12 }}>
          <Text>{selectedStar.name ?? selectedStar.id}</Text>
        </View>
      )}
    </View>
  );
}
